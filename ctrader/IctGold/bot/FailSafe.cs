using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

// v2.59-dev G3 fail-safes (v2.47 base + review fixes F1-F7; v2.56: automatic daily release of all latches). Pure logic only: NO cTrader API types, so the offline test project
// (tests/failsafe) compiles and executes exactly this file. The bot wires these classes in; the
// broker boundary is always injected as a delegate.
namespace FailSafe
{
    // ------------------------------------------------------------------ New York time
    public static class NyTime
    {
        public static DateTime ToNy(DateTime utc)
        {
            DateTime dstStartUtc = Nth(utc.Year, 3, 2).AddHours(2 + 5);   // 02:00 EST = 07:00 UTC
            DateTime dstEndUtc = Nth(utc.Year, 11, 1).AddHours(2 + 4);    // 02:00 EDT = 06:00 UTC
            bool dst = utc >= dstStartUtc && utc < dstEndUtc;
            return utc.AddHours(dst ? -4 : -5);
        }
        private static DateTime Nth(int year, int month, int occurrence)
        {
            var d = new DateTime(year, month, 1);
            int delta = ((int)DayOfWeek.Sunday - (int)d.DayOfWeek + 7) % 7;
            return d.AddDays(delta + 7 * (occurrence - 1));
        }
        // New York wall-clock time -> UTC (for a clock time inside the spring-forward gap the EST reading is used).
        public static DateTime FromNy(DateTime ny)
        {
            DateTime edt = ny.AddHours(4);
            return ToNy(edt) == ny ? edt : ny.AddHours(5);
        }
        public static string DayKey(DateTime utc) { return ToNy(utc).Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture); }
        public static string WeekKey(DateTime utc)
        {
            DateTime ny = ToNy(utc).Date;
            int back = ((int)ny.DayOfWeek + 6) % 7; // Monday = 0
            return ny.AddDays(-back).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
        public static string MonthKey(DateTime utc) { return ToNy(utc).ToString("yyyy-MM", CultureInfo.InvariantCulture); }
    }

    // ------------------------------------------------------------------ Kill switch
    public sealed class KillSwitchConfig
    {
        // 0 disables the respective limit. Effective limit = min(pct * period-start equity, abs) of the enabled parts.
        public double DailyLossPct, DailyLossAbs, WeeklyLossPct, WeeklyLossAbs, MonthlyLossPct, MonthlyLossAbs;
        public int MaxConsecutiveLosses;          // 0 = off; latched until next NY day
        public bool StopOnProtectionFailure = true;
        public bool DailyAutoReset = true;        // daily latch clears at the next NY day; v2.56: also releases a protection-failure latch at the next NY day if reconciliation is clean
        public bool PeriodAutoReset;              // v2.56: weekly/monthly latch clears at the start of the next NY week/month (no token); default off
        public bool AllowBootstrap;               // one-time initialisation when no state exists (live first start)
        public bool StrictBalance;                // live: an unexplained balance delta is NOT declared a deposit/withdrawal; it locks entries (F6)
        public string ResetToken = "";            // weekly/monthly/protection latches clear only with a NEW token after a period change
        public bool AnyLimitEnabled
        {
            get { return DailyLossPct > 0 || DailyLossAbs > 0 || WeeklyLossPct > 0 || WeeklyLossAbs > 0 || MonthlyLossPct > 0 || MonthlyLossAbs > 0 || MaxConsecutiveLosses > 0; }
        }
        public static double Limit(double pct, double abs, double startEquity)
        {
            double a = pct > 0 ? pct / 100.0 * startEquity : double.PositiveInfinity;
            double b = abs > 0 ? abs : double.PositiveInfinity;
            return Math.Min(a, b); // +inf = disabled
        }
    }

    public interface IStateStore { string Read(); void Write(string text); }

    public sealed class FileStateStore : IStateStore
    {
        private readonly string _path;
        public FileStateStore(string path) { _path = path; }
        public string Read() { return File.Exists(_path) ? File.ReadAllText(_path, Encoding.UTF8) : null; }
        public void Write(string text)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_path));
            string tmp = _path + ".tmp";
            byte[] bytes = new UTF8Encoding(false).GetBytes(text);
            using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                fs.Write(bytes, 0, bytes.Length);
                fs.Flush(true);
            }
            if (File.Exists(_path)) File.Replace(tmp, _path, null);
            else File.Move(tmp, _path);
        }
    }

    public sealed class MemoryStateStore : IStateStore
    {
        public string Text; public bool FailWrites;
        public string Read() { return Text; }
        public void Write(string text) { if (FailWrites) throw new IOException("injected"); Text = text; }
    }

    public sealed class KillSwitch
    {
        private readonly KillSwitchConfig _cfg;
        private readonly IStateStore _store;
        public string DayKey = "", WeekKey = "", MonthKey = "";
        public double DayPeak, WeekPeak, MonthPeak, DayStart, WeekStart, MonthStart;
        public double LastBalance;
        public string DayLatch = "", WeekLatch = "", MonthLatch = "", ProtLatch = ""; // reason text, "" = not latched
        public string DayLatchKey = "", WeekLatchKey = "", MonthLatchKey = "", ConsumedToken = "";
        public int ConsecutiveLosses;
        public DateTime LastUtc = DateTime.MinValue;
        public string StateFault = "";            // non-empty -> entries locked
        public string BalanceFault = "";          // strict mode: unexplained balance delta -> entries locked, own positions keep their broker SL/TP (no flatten)
        public bool Initialized;
        public Action<string> Log = delegate { };
        public Action<string, string> OnTransition = delegate { }; // (status, reason)
        // v2.56: automatic release. (latchType day|week|month|protection, detail) / refused (latchType, reason). Journal events ks_auto_reset / ks_auto_reset_refused.
        public Action<string, string> OnAutoReset = delegate { };
        public Action<string, string> OnAutoResetRefused = delegate { };
        // v2.56: returns "" when broker/bot reconciliation is clean, else the reason. Null -> a protection latch is never auto-released (fail closed).
        public Func<string> ReconciliationCheck;
        public string ProtLatchKey = "";
        private string _lastRefusal = "";

        public KillSwitch(KillSwitchConfig cfg, IStateStore store) { _cfg = cfg; _store = store; }

        // ---- status
        public string BlockReason()
        {
            if (StateFault.Length > 0) return "KS state fault: " + StateFault;
            if (!Initialized) return "KS not initialised";
            if (BalanceFault.Length > 0) return "KS balance reconciliation required: " + BalanceFault;
            if (ProtLatch.Length > 0) return "KS protection failure latch: " + ProtLatch;
            if (MonthLatch.Length > 0) return "KS monthly latch: " + MonthLatch;
            if (WeekLatch.Length > 0) return "KS weekly latch: " + WeekLatch;
            if (DayLatch.Length > 0) return "KS daily latch: " + DayLatch;
            return "";
        }
        public bool AllowsEntries { get { return BlockReason().Length == 0; } }
        // Equity stop = loss latch (not state fault): own positions must be closed in a controlled way.
        public bool MustFlatten { get { return StateFault.Length > 0 || ProtLatch.Length > 0 || MonthLatch.Length > 0 || WeekLatch.Length > 0 || DayLatch.Length > 0; } }

        // ---- lifecycle
        public void LoadOrBootstrap(DateTime utc, double equity) { LoadOrBootstrap(utc, equity, equity); }
        public void LoadOrBootstrap(DateTime utc, double equity, double balance)
        {
            string text;
            try { text = _store.Read(); }
            catch (Exception ex) { Fault("state unreadable (" + ex.GetType().Name + ")"); return; }
            if (text == null)
            {
                if (_cfg.AllowBootstrap) { Bootstrap(utc, equity, balance); return; }
                Fault("state missing"); return;
            }
            string why = Parse(text, utc);
            if (why != null) { Fault(why); return; }
            if (Math.Abs(balance - LastBalance) > 0.005)
            {
                Fault("balance changed while offline; reconciliation required");
                return;
            }
            Initialized = true;
            ApplyToken();
        }

        public void Bootstrap(DateTime utc, double equity) { Bootstrap(utc, equity, equity); }
        public void Bootstrap(DateTime utc, double equity, double balance)
        {
            DayKey = NyTime.DayKey(utc); WeekKey = NyTime.WeekKey(utc); MonthKey = NyTime.MonthKey(utc);
            DayPeak = WeekPeak = MonthPeak = DayStart = WeekStart = MonthStart = equity;
            LastBalance = balance;
            DayLatch = WeekLatch = MonthLatch = ProtLatch = ""; DayLatchKey = WeekLatchKey = MonthLatchKey = ProtLatchKey = "";
            ConsecutiveLosses = 0; LastUtc = utc; StateFault = ""; Initialized = true;
            ConsumedToken = _cfg.ResetToken ?? "";
            Persist();
        }

        private void Fault(string why) { StateFault = why; Initialized = false; Log("KS FAULT: " + why); OnTransition("fault", why); }

        public void Update(DateTime utc, double equity) { Update(utc, equity, LastBalance, 0); }
        // knownTradingBalanceDelta is the sum of this bot's closed-trade net PnL since the prior call.
        // Any remainder in Account.Balance is external cashflow. Shift period starts/peaks by it so a
        // deposit/withdrawal cannot manufacture a loss/profit or trip/heal an equity DD latch.
        public void Update(DateTime utc, double equity, double balance, double knownTradingBalanceDelta)
        {
            if (!Initialized) return;
            if (LastBalance <= 0) { Fault("state last balance invalid"); return; }
            double externalCashflow = balance - LastBalance - knownTradingBalanceDelta;
            if (_cfg.StrictBalance && Math.Abs(externalCashflow) > 0.005)
            {
                // F6: cannot tell a deposit from a foreign realised loss. Entries lock; loss limits keep running on raw equity.
                // LastBalance stays untouched so a restart also faults ("balance changed while offline").
                if (BalanceFault.Length == 0)
                {
                    BalanceFault = "unexplained balance delta " + externalCashflow.ToString("F2", CultureInfo.InvariantCulture);
                    Log("KS BALANCE FAULT: " + BalanceFault); OnTransition("balance_unexplained", BalanceFault);
                }
            }
            else
            {
                if (Math.Abs(externalCashflow) > 0.005)
                {
                    DayStart += externalCashflow; WeekStart += externalCashflow; MonthStart += externalCashflow;
                    DayPeak += externalCashflow; WeekPeak += externalCashflow; MonthPeak += externalCashflow;
                    Log("KS cashflow neutralized: " + externalCashflow.ToString("F2", CultureInfo.InvariantCulture));
                }
                LastBalance = balance;
            }
            if (utc < LastUtc.AddMinutes(-5)) { Fault("clock moved backwards"); return; }
            bool changed = false;
            string dk = NyTime.DayKey(utc), wk = NyTime.WeekKey(utc), mk = NyTime.MonthKey(utc);
            if (dk != DayKey)
            {
                DayKey = dk; DayPeak = DayStart = equity; ConsecutiveLosses = 0; changed = true;
                if (DayLatch.Length > 0 && _cfg.DailyAutoReset)
                { string was = DayLatch; DayLatch = ""; OnTransition("daily_reset", dk); OnAutoReset("day", "latch '" + was + "' released at NY day " + dk); }
            }
            if (wk != WeekKey)
            {
                WeekKey = wk; WeekPeak = WeekStart = equity; changed = true;
                if (WeekLatch.Length > 0 && _cfg.PeriodAutoReset && WeekLatchKey != wk)
                { string was = WeekLatch; WeekLatch = ""; OnTransition("weekly_reset", wk); OnAutoReset("week", "latch '" + was + "' released at NY week " + wk); }
            }
            if (mk != MonthKey)
            {
                MonthKey = mk; MonthPeak = MonthStart = equity; changed = true;
                if (MonthLatch.Length > 0 && _cfg.PeriodAutoReset && MonthLatchKey != mk)
                { string was = MonthLatch; MonthLatch = ""; OnTransition("monthly_reset", mk); OnAutoReset("month", "latch '" + was + "' released at NY month " + mk); }
            }
            changed |= TryReleaseProtection(dk);
            ApplyToken();
            if (equity > DayPeak) { DayPeak = equity; changed = true; }
            if (equity > WeekPeak) { WeekPeak = equity; changed = true; }
            if (equity > MonthPeak) { MonthPeak = equity; changed = true; }
            changed |= CheckKeyed(ref DayLatch, ref DayLatchKey, DayKey, "day", DayPeak - equity, KillSwitchConfig.Limit(_cfg.DailyLossPct, _cfg.DailyLossAbs, DayStart));
            changed |= CheckKeyed(ref WeekLatch, ref WeekLatchKey, WeekKey, "week", WeekPeak - equity, KillSwitchConfig.Limit(_cfg.WeeklyLossPct, _cfg.WeeklyLossAbs, WeekStart));
            changed |= CheckKeyed(ref MonthLatch, ref MonthLatchKey, MonthKey, "month", MonthPeak - equity, KillSwitchConfig.Limit(_cfg.MonthlyLossPct, _cfg.MonthlyLossAbs, MonthStart));
            LastUtc = utc;
            if (changed) Persist();
        }

        // v2.56: protection-failure latch releases at the next NY day ONLY when reconciliation is clean; otherwise it stays and the refusal is journaled once per reason.
        private bool TryReleaseProtection(string dayKey)
        {
            if (ProtLatch.Length == 0 || !_cfg.DailyAutoReset) return false;
            if (ProtLatchKey.Length == 0) { ProtLatchKey = dayKey; return true; }   // no attribution (should not happen): never release on the first sight, start counting now
            if (ProtLatchKey == dayKey) return false;
            string why;
            if (ReconciliationCheck == null) why = "reconciliation check unavailable";
            else
            {
                try { why = ReconciliationCheck() ?? "reconciliation check returned null"; }
                catch (Exception ex) { why = "reconciliation check failed (" + ex.GetType().Name + ")"; }
            }
            if (why.Length > 0)
            {
                string key = dayKey + "|" + why;
                if (key != _lastRefusal) { _lastRefusal = key; Log("KS protection latch auto-reset refused: " + why); OnAutoResetRefused("protection", why); }
                return false;
            }
            string was = ProtLatch; ProtLatch = ""; ProtLatchKey = ""; _lastRefusal = "";
            Log("KS protection latch auto-reset at NY day " + dayKey);
            OnTransition("protection_reset", dayKey); OnAutoReset("protection", "latch '" + was + "' released at NY day " + dayKey + " (reconciliation clean)");
            return true;
        }

        private bool Check(ref string latch, string name, double dd, double limit)
        {
            if (latch.Length > 0 || double.IsPositiveInfinity(limit) || dd < limit - 1e-9) return false;
            latch = "dd=" + dd.ToString("F2", CultureInfo.InvariantCulture) + ">=" + limit.ToString("F2", CultureInfo.InvariantCulture) + " (" + name + ")";
            Log("KS LATCH " + latch); OnTransition(name + "_latched", latch); return true;
        }
        private bool CheckKeyed(ref string latch, ref string latchKey, string key, string name, double dd, double limit)
        {
            bool c = Check(ref latch, name, dd, limit);
            if (c) latchKey = key;
            return c;
        }

        public void OnTradeClosed(DateTime utc, double netProfit)
        {
            if (!Initialized) return;
            if (netProfit < 0) ConsecutiveLosses++; else if (netProfit > 0) ConsecutiveLosses = 0;
            if (_cfg.MaxConsecutiveLosses > 0 && ConsecutiveLosses >= _cfg.MaxConsecutiveLosses && DayLatch.Length == 0)
            { DayLatch = "consecutive losses=" + ConsecutiveLosses; DayLatchKey = DayKey; Log("KS LATCH " + DayLatch); OnTransition("daily_latched", DayLatch); }
            Persist();
        }

        public void OnProtectionFailure(DateTime eventUtc, string reason)
        {
            if (!_cfg.StopOnProtectionFailure || ProtLatch.Length > 0) return;
            // Attribute a newly observed incident to the event's NY day. DayKey can still be the
            // persisted prior day during startup or before the first rollover Update after midnight.
            ProtLatch = reason; ProtLatchKey = NyTime.DayKey(eventUtc);
            Log("KS LATCH protection failure: " + reason); OnTransition("protection_latched", reason);
            if (Initialized) Persist();
        }

        // Weekly/monthly/protection latches: only a NEW non-empty token AND (for week/month) a period change releases them.
        private void ApplyToken()
        {
            string t = _cfg.ResetToken ?? "";
            if (t.Length == 0 || t == ConsumedToken) return;
            bool hadLatch = DayLatch.Length > 0 || WeekLatch.Length > 0 || MonthLatch.Length > 0 || ProtLatch.Length > 0;
            bool any = false;
            if (WeekLatch.Length > 0 && WeekLatchKey != WeekKey) { WeekLatch = ""; any = true; }
            if (MonthLatch.Length > 0 && MonthLatchKey != MonthKey) { MonthLatch = ""; any = true; }
            if (ProtLatch.Length > 0) { ProtLatch = ""; ProtLatchKey = ""; any = true; }
            if (DayLatch.Length > 0 && !_cfg.DailyAutoReset && DayLatchKey != DayKey) { DayLatch = ""; any = true; }
            // A token supplied too early must remain usable after the required period rollover.
            if (!hadLatch || any) ConsumedToken = t;
            else return;
            if (any) { Log("KS reset token consumed"); OnTransition("reset_by_token", ""); }
            Persist();
        }

        // ---- persistence (line format + SHA-256 body checksum)
        private string Body()
        {
            Func<double, string> d = v => v.ToString("R", CultureInfo.InvariantCulture);
            var sb = new StringBuilder();
            sb.Append("v=1\n");
            sb.Append("dayKey=" + DayKey + "\nweekKey=" + WeekKey + "\nmonthKey=" + MonthKey + "\n");
            sb.Append("dayPeak=" + d(DayPeak) + "\nweekPeak=" + d(WeekPeak) + "\nmonthPeak=" + d(MonthPeak) + "\n");
            sb.Append("dayStart=" + d(DayStart) + "\nweekStart=" + d(WeekStart) + "\nmonthStart=" + d(MonthStart) + "\nlastBalance=" + d(LastBalance) + "\n");
            sb.Append("dayLatch=" + Esc(DayLatch) + "\nweekLatch=" + Esc(WeekLatch) + "\nmonthLatch=" + Esc(MonthLatch) + "\nprotLatch=" + Esc(ProtLatch) + "\n");
            sb.Append("dayLatchKey=" + DayLatchKey + "\nweekLatchKey=" + WeekLatchKey + "\nmonthLatchKey=" + MonthLatchKey + "\nconsumedToken=" + Esc(ConsumedToken) + "\n");
            sb.Append("protLatchKey=" + ProtLatchKey + "\n");
            sb.Append("consecutiveLosses=" + ConsecutiveLosses.ToString(CultureInfo.InvariantCulture) + "\n");
            sb.Append("lastUtc=" + LastUtc.ToString("o", CultureInfo.InvariantCulture) + "\n");
            return sb.ToString();
        }
        private static string Esc(string s) { return (s ?? "").Replace("\\", "\\\\").Replace("\n", "\\n").Replace("=", "\\e"); }
        private static string Unesc(string s) { return s.Replace("\\e", "=").Replace("\\n", "\n").Replace("\\\\", "\\"); }
        private static string Sha(string s) { using (var h = SHA256.Create()) return string.Concat(h.ComputeHash(Encoding.UTF8.GetBytes(s)).Select(b => b.ToString("x2"))); }

        public void Persist()
        {
            try { string b = Body(); _store.Write(b + "sha256=" + Sha(b) + "\n"); }
            catch (Exception ex) { Fault("state write failed (" + ex.GetType().Name + ")"); }
        }

        private string Parse(string text, DateTime nowUtc)
        {
            int i = text.LastIndexOf("sha256=", StringComparison.Ordinal);
            if (i < 0) return "state checksum missing";
            string body = text.Substring(0, i);
            if (!string.Equals(text.Substring(i + 7).Trim(), Sha(body), StringComparison.Ordinal)) return "state checksum mismatch";
            var kv = new Dictionary<string, string>();
            foreach (string line in body.Split('\n'))
            {
                if (line.Length == 0) continue;
                int e = line.IndexOf('=');
                if (e <= 0) return "state malformed line";
                kv[line.Substring(0, e)] = line.Substring(e + 1);
            }
            string[] req = { "v", "dayKey", "weekKey", "monthKey", "dayPeak", "weekPeak", "monthPeak", "dayStart", "weekStart", "monthStart",
                             "lastBalance", "dayLatch", "weekLatch", "monthLatch", "protLatch", "dayLatchKey", "weekLatchKey", "monthLatchKey", "consumedToken", "consecutiveLosses", "lastUtc" };
            foreach (string k in req) if (!kv.ContainsKey(k)) return "state field missing: " + k;
            if (kv["v"] != "1") return "state version unsupported";
            double[] n = new double[7]; string[] nk = { "dayPeak", "weekPeak", "monthPeak", "dayStart", "weekStart", "monthStart", "lastBalance" };
            for (int j = 0; j < 7; j++)
                if (!double.TryParse(kv[nk[j]], NumberStyles.Float, CultureInfo.InvariantCulture, out n[j]) || double.IsNaN(n[j]) || double.IsInfinity(n[j]) || n[j] <= 0) return "state number invalid: " + nk[j];
            int cl; DateTime last;
            if (!int.TryParse(kv["consecutiveLosses"], NumberStyles.Integer, CultureInfo.InvariantCulture, out cl) || cl < 0) return "state counter invalid";
            if (!DateTime.TryParse(kv["lastUtc"], CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out last)) return "state time invalid";
            if (last > nowUtc.AddMinutes(5)) return "state timestamp in the future";
            DayKey = kv["dayKey"]; WeekKey = kv["weekKey"]; MonthKey = kv["monthKey"];
            DayPeak = n[0]; WeekPeak = n[1]; MonthPeak = n[2]; DayStart = n[3]; WeekStart = n[4]; MonthStart = n[5]; LastBalance = n[6];
            DayLatch = Unesc(kv["dayLatch"]); WeekLatch = Unesc(kv["weekLatch"]); MonthLatch = Unesc(kv["monthLatch"]); ProtLatch = Unesc(kv["protLatch"]);
            DayLatchKey = kv["dayLatchKey"]; WeekLatchKey = kv["weekLatchKey"]; MonthLatchKey = kv["monthLatchKey"]; ConsumedToken = Unesc(kv["consumedToken"]);
            ConsecutiveLosses = cl; LastUtc = last;
            // v2.56: optional (states written by <= v2.55 lack it). A protection latch without a key is attributed to the stored day key,
            // so it can release at the next NY day but never earlier and never because of a restart.
            ProtLatchKey = kv.ContainsKey("protLatchKey") ? kv["protLatchKey"] : "";
            if (ProtLatch.Length > 0 && ProtLatchKey.Length == 0) ProtLatchKey = DayKey;
            return null;
        }
    }

    // ------------------------------------------------------------------ Post-fill protection
    public enum PostFillResult { AlreadyProtected, ProtectedByModify, ModifyFailedPositionClosed, ModifyFailedCloseFailed }

    public sealed class ProtectionRecovery
    {
        private sealed class Item { public int Attempts; public DateTime NextTry = DateTime.MinValue; public string Reason; }
        private readonly Dictionary<int, Item> _items = new Dictionary<int, Item>();
        private readonly int _escalateAfter; private readonly double _retrySeconds;
        public Action<string> Log = delegate { };
        public Action<string> OnEscalate = delegate { };
        public bool Escalated { get; private set; }
        public ProtectionRecovery(int escalateAfter, double retrySeconds) { _escalateAfter = escalateAfter; _retrySeconds = retrySeconds; }
        public int Count { get { return _items.Count; } }
        public bool EntriesLocked { get { return _items.Count > 0; } }
        public IList<int> Ids() { return _items.Keys.ToList(); }
        public bool Contains(int id) { return _items.ContainsKey(id); }
        public int Attempts(int id) { Item it; return _items.TryGetValue(id, out it) ? it.Attempts : 0; }
        public void Register(int id, string reason, DateTime now)
        {
            if (!_items.ContainsKey(id)) _items[id] = new Item { Reason = reason, NextTry = now };
        }
        public void Resolve(int id) { _items.Remove(id); }
        // An immediate close attempt made outside Tick (e.g. right after the fill) counts and starts the backoff.
        public void NoteAttempt(int id, DateTime now)
        {
            Item it; if (!_items.TryGetValue(id, out it)) return;
            it.Attempts++; it.NextTry = now.AddSeconds(_retrySeconds);
        }

        // Called every tick. tryClose must return true ONLY when the position is verifiably gone.
        public void Tick(DateTime now, Func<int, bool> isOpen, Func<int, bool> tryClose)
        {
            foreach (int id in _items.Keys.ToList())
            {
                Item it = _items[id];
                if (!isOpen(id)) { _items.Remove(id); Log("PROTECTION recovery: #" + id + " no longer open, released."); continue; }
                if (now < it.NextTry) continue;
                it.Attempts++;
                it.NextTry = now.AddSeconds(_retrySeconds);
                bool ok;
                try { ok = tryClose(id); } catch (Exception ex) { ok = false; Log("PROTECTION recovery close exception: " + ex.GetType().Name); }
                if (ok) { _items.Remove(id); Log("PROTECTION recovery: #" + id + " closed after " + it.Attempts + " attempt(s)."); }
                else
                {
                    Log("PROTECTION recovery: close #" + id + " FAILED, attempt " + it.Attempts + "; entries stay locked.");
                    if (it.Attempts == _escalateAfter) { Escalated = true; OnEscalate("close failed " + it.Attempts + "x for #" + id); }
                }
            }
        }
    }

    public static class PostFill
    {
        public static bool Matches(double? actual, double want, double tick)
        { return actual.HasValue && Math.Abs(actual.Value - want) <= tick / 2.0 + 1e-12; }

        // Stop-modification comparison with a one-tick tolerance (TickSize): only the platform's price quantisation may differ.
        // A missing value, or a deviation of more than one tick, is still a mismatch.
        public static bool MatchesWithinTick(double? actual, double want, double tick)
        { return actual.HasValue && Math.Abs(actual.Value - want) <= tick + 1e-9; }

        // modify: attempts ModifyPosition (true = broker accepted). readback: current SL/TP from the broker object.
        // close: attempts close and returns true only if the position is verifiably gone.
        public static PostFillResult Secure(int positionId, double wantSl, double wantTp, double tick,
            Func<double?[]> readback, Func<bool> modify, Func<bool> close,
            ProtectionRecovery recovery, KillSwitch kill, DateTime now, Action<string> log)
        {
            double?[] rb = readback();
            if (MatchesWithinTick(rb[0], wantSl, tick) && MatchesWithinTick(rb[1], wantTp, tick)) return PostFillResult.AlreadyProtected;
            string why;
            bool ok = false;
            try { ok = modify(); } catch (Exception ex) { log("PROTECTION modify exception " + ex.GetType().Name); }
            if (ok)
            {
                rb = readback();
                if (MatchesWithinTick(rb[0], wantSl, tick) && MatchesWithinTick(rb[1], wantTp, tick)) return PostFillResult.ProtectedByModify;
                why = "modify accepted but readback differs";
            }
            else why = "modify failed";
            log("PROTECTION FAILURE #" + positionId + ": " + why);
            if (recovery != null) recovery.Register(positionId, why, now);
            if (kill != null) kill.OnProtectionFailure(now, "#" + positionId + " " + why);
            bool closed = false;
            try { closed = close(); } catch (Exception ex) { log("PROTECTION close exception " + ex.GetType().Name); }
            if (closed) { if (recovery != null) recovery.Resolve(positionId); return PostFillResult.ModifyFailedPositionClosed; }
            if (recovery != null) recovery.NoteAttempt(positionId, now);
            log("PROTECTION close FAILED #" + positionId + " -> entry lock + retry");
            return PostFillResult.ModifyFailedCloseFailed;
        }
    }

    // ------------------------------------------------------------------ News fail-closed
    public static class NewsGuard
    {
        // Returns a block reason, or null if the guard imposes nothing.
        // Backtest behaviour (realtime=false) is intentionally untouched: the caller's existing logic applies.
        public static string LiveBlock(bool realtime, bool filterEnabled, bool haveData, DateTime lastSuccessUtc, DateTime nowUtc,
            int maxStaleMinutes, bool coverageOk)
        {
            if (!realtime) return null;
            if (!filterEnabled) return "news filter disabled in live mode";
            if (!haveData) return "news data unavailable";
            if (!coverageOk) return "news calendar coverage invalid";
            if (nowUtc > lastSuccessUtc.AddMinutes(maxStaleMinutes)) return "news data stale";
            return null;
        }
        // HTTP is admissible only in live (RealTime) mode. Never in backtest, whatever the parameters say.
        public static bool HttpAllowed(bool realtime, bool fileCalendarActive) { return realtime && !fileCalendarActive; }
    }

    // ------------------------------------------------------------------ Sizing
    public static class Sizing
    {
        // units = riskAccount / (priceDistance * quoteToAccount); step-down; 0 if below min.
        public static double Units(double riskAccount, double priceDistance, double quoteToAccountRate,
            double unitsMin, double unitsStep, double unitsMax)
        {
            if (!(riskAccount > 0) || !(priceDistance > 0) || !(quoteToAccountRate > 0) || !(unitsStep > 0)) return 0;
            double raw = riskAccount / (priceDistance * quoteToAccountRate);
            double u = Math.Floor(raw / unitsStep + 1e-9) * unitsStep;
            if (u > unitsMax) u = Math.Floor(unitsMax / unitsStep + 1e-9) * unitsStep;
            return u < unitsMin ? 0 : u;
        }
        // v2.54-dev margin cap. Margin is linear in units; the result is the largest step-aligned volume whose margin fits
        // the budget (never above the requested units). 0 when the budget cannot fund the minimum volume.
        public static double MarginCapUnits(double units, double marginForUnits, double marginBudget, double unitsMin, double unitsStep)
        {
            if (!(units > 0) || !(unitsStep > 0)) return 0;
            if (double.IsNaN(marginForUnits) || double.IsNaN(marginBudget) || !(marginForUnits > 0)) return 0;
            if (marginForUnits <= marginBudget) return units;
            if (!(marginBudget > 0)) return 0;
            double u = Math.Floor(units * marginBudget / marginForUnits / unitsStep + 1e-9) * unitsStep;
            if (u > units) u = units;
            return u < unitsMin ? 0 : u;
        }
        public static double Risk(double units, double priceDistance, double quoteToAccountRate) { return units * priceDistance * quoteToAccountRate; }

        // Cross-check of the three independent views of "risk per unit of price distance":
        // AmountRisked (API), PipValue*pips, TickValue/TickSize*distance. All must agree within tol (fraction).
        public static bool RiskViewsAgree(double amountRisked, double units, double pips, double pipValue, double tickValue, double tickSize,
            double priceDistance, double tol, out string detail)
        {
            double a = amountRisked;
            double b = units * pips * pipValue;
            double c = tickSize > 0 ? units * priceDistance / tickSize * tickValue : double.NaN;
            detail = string.Format(CultureInfo.InvariantCulture, "AmountRisked={0:F4} PipValue-view={1:F4} TickValue-view={2:F4}", a, b, c);
            if (double.IsNaN(a) || double.IsNaN(b) || double.IsNaN(c) || a <= 0) return false;
            return Math.Abs(a - b) <= tol * a && Math.Abs(a - c) <= tol * a;
        }
    }

    // ------------------------------------------------------------------ Daily journal (JSON Lines)
    public sealed class DailyJournal
    {
        public const string SchemaVersion = "1";
        private readonly string _dir, _bot, _version, _instance, _account, _symbol;
        private long _seq;
        public bool Healthy { get; private set; }
        public string LastError = "";
        public DailyJournal(string dir, string botName, string botVersion, string instanceId, string accountId, string symbol)
        {
            _dir = dir; _bot = botName; _version = botVersion; _instance = instanceId; _account = accountId; _symbol = symbol;
            try { Directory.CreateDirectory(dir); Healthy = true; }
            catch (Exception ex) { Healthy = false; LastError = ex.GetType().Name; }
        }
        // F7: full 128-bit id (event_id = instance + "-" + seq); restarts get a fresh instance, never a truncated one.
        public static string NewInstanceId() { return Guid.NewGuid().ToString("N"); }
        public string PathFor(DateTime utc) { return Path.Combine(_dir, utc.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + ".jsonl"); }

        public static string Q(string s)
        {
            if (s == null) return "null";
            var sb = new StringBuilder("\"");
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default: if (c < 0x20) sb.Append("\\u" + ((int)c).ToString("x4")); else sb.Append(c); break;
                }
            }
            return sb.Append('"').ToString();
        }
        public static string N(double v) { return double.IsNaN(v) || double.IsInfinity(v) ? "null" : v.ToString("R", CultureInfo.InvariantCulture); }
        public static string N(double? v) { return v.HasValue ? N(v.Value) : "null"; }
        public static string T(DateTime utc) { return utc.ToString("yyyy-MM-ddTHH:mm:ss.fff", CultureInfo.InvariantCulture) + "Z"; }

        // fields: pre-encoded JSON values (use Q/N/T). Returns false and marks the journal unhealthy on failure.
        public bool Write(DateTime utc, string eventType, string tradeKey, IList<KeyValuePair<string, string>> fields)
        {
            try
            {
                _seq++;
                var sb = new StringBuilder("{");
                sb.Append("\"schema_version\":" + Q(SchemaVersion));
                sb.Append(",\"timestamp\":" + Q(T(utc)));
                sb.Append(",\"event_id\":" + Q(_instance + "-" + _seq.ToString(CultureInfo.InvariantCulture)));
                sb.Append(",\"event_type\":" + Q(eventType));
                sb.Append(",\"bot_name\":" + Q(_bot) + ",\"bot_version\":" + Q(_version) + ",\"instance_id\":" + Q(_instance));
                sb.Append(",\"account_id\":" + Q(_account) + ",\"symbol\":" + Q(_symbol));
                sb.Append(",\"trade_key\":" + Q(tradeKey));
                if (fields != null)
                    foreach (var kv in fields) sb.Append("," + Q(kv.Key) + ":" + kv.Value);
                sb.Append("}\n");
                using (var fs = new FileStream(PathFor(utc), FileMode.Append, FileAccess.Write, FileShare.Read))
                {
                    byte[] bytes = new UTF8Encoding(false).GetBytes(sb.ToString());
                    fs.Write(bytes, 0, bytes.Length);
                    fs.Flush(true);
                }
                return true;
            }
            catch (Exception ex) { Healthy = false; LastError = ex.GetType().Name; return false; }
        }
    }

    // ------------------------------------------------------------------ F1: independent safety tick
    public static class SafetyTick
    {
        // Both retry queues (protection recovery AND controlled close) are served on every tick, independent of the
        // kill-switch latch and of the trigger that created the item. Items resolve only on a verified disappearance.
        public static void Run(DateTime now, ProtectionRecovery recovery, ProtectionRecovery flatten, Func<int, bool> isOpen, Func<int, bool> tryClose)
        {
            if (recovery != null) recovery.Tick(now, isOpen, tryClose);
            if (flatten != null) flatten.Tick(now, isOpen, tryClose);
        }
    }

    // ------------------------------------------------------------------ F2: strict HTTP news schema / timezone validation
    public sealed class NewsRow { public string Title, Country, Date, Impact; }
    public sealed class NewsItem { public string Title, Currency; public int Impact; public DateTime TimeUtc; }
    public sealed class FileNewsRow { public string Title, Currency, Impact, Status; public bool Enabled; public DateTime TimeUtc; }

    public static class StrictCsv
    {
        public static List<string> SplitRecords(string text)
        {
            var lines = new List<string>(); var current = new StringBuilder();
            bool quoted = false, fieldStart = true, afterQuote = false;
            for (int i = 0; i < (text ?? "").Length; i++)
            {
                char c = text[i];
                if (quoted)
                {
                    current.Append(c);
                    if (c == '"')
                    {
                        if (i + 1 < text.Length && text[i + 1] == '"') { current.Append('"'); i++; }
                        else { quoted = false; afterQuote = true; }
                    }
                    continue;
                }
                if (afterQuote)
                {
                    if (c == ',') { current.Append(c); fieldStart = true; afterQuote = false; continue; }
                    if (c == '\r') { current.Append(c); continue; }
                    if (c == '\n') { lines.Add(current.ToString().TrimEnd('\r')); current.Length = 0; fieldStart = true; afterQuote = false; continue; }
                    throw new InvalidOperationException("CSV has characters after a closing quote");
                }
                if (c == '"')
                {
                    if (!fieldStart) throw new InvalidOperationException("CSV has a quote inside an unquoted field");
                    quoted = true; fieldStart = false; current.Append(c); continue;
                }
                if (c == ',') { current.Append(c); fieldStart = true; continue; }
                if (c == '\n') { lines.Add(current.ToString().TrimEnd('\r')); current.Length = 0; fieldStart = true; continue; }
                current.Append(c); if (c != '\r') fieldStart = false;
            }
            if (quoted) throw new InvalidOperationException("CSV has an unterminated quoted field");
            if (current.Length > 0) lines.Add(current.ToString().TrimEnd('\r'));
            lines.RemoveAll(string.IsNullOrWhiteSpace); return lines;
        }

        public static List<string> SplitRow(string line)
        {
            var fields = new List<string>(); var current = new StringBuilder();
            bool quoted = false, fieldStart = true, afterQuote = false;
            for (int i = 0; i < (line ?? "").Length; i++)
            {
                char c = line[i];
                if (quoted)
                {
                    if (c == '"')
                    {
                        if (i + 1 < line.Length && line[i + 1] == '"') { current.Append('"'); i++; }
                        else { quoted = false; afterQuote = true; }
                    }
                    else current.Append(c);
                    continue;
                }
                if (afterQuote)
                {
                    if (c != ',') throw new InvalidOperationException("CSV row has characters after a closing quote");
                    fields.Add(current.ToString()); current.Length = 0; fieldStart = true; afterQuote = false; continue;
                }
                if (c == '"')
                {
                    if (!fieldStart) throw new InvalidOperationException("CSV row has a quote inside an unquoted field");
                    quoted = true; fieldStart = false; continue;
                }
                if (c == ',') { fields.Add(current.ToString()); current.Length = 0; fieldStart = true; continue; }
                current.Append(c); fieldStart = false;
            }
            if (quoted) throw new InvalidOperationException("CSV row has an unterminated quoted field");
            fields.Add(current.ToString()); return fields;
        }
    }

    public static class FileNewsValidator
    {
        private static readonly HashSet<string> ValidCurrencies = new HashSet<string>(StringComparer.Ordinal)
        {
            "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "SEK", "NOK", "DKK", "MXN", "BRL",
            "ZAR", "SGD", "HKD", "KRW", "INR", "TRY", "PLN", "CZK", "HUF", "ILS", "RUB", "XAU", "ALL"
        };
        public static bool Validate(string time, string currency, string impact, string enabled, string status, string title,
            out FileNewsRow row, out string error)
        {
            row = null; error = null;
            string t = (time ?? "").Trim(), c = (currency ?? "").Trim().ToUpperInvariant();
            string i = (impact ?? "").Trim().ToUpperInvariant(), e = (enabled ?? "").Trim().ToLowerInvariant();
            string s = (status ?? "").Trim().ToUpperInvariant();
            if (t.Length == 0) error = "event_time_utc is empty";
            else if (c.Length == 0) error = "currency is empty";
            else if (!ValidCurrencies.Contains(c)) error = "unknown currency '" + c + "'";
            else if (i.Length == 0) error = "impact is empty";
            else if (e != "true" && e != "false") error = "enabled is not boolean";
            else if (s != "EXACT" && s != "TENTATIVE" && s != "ALL_DAY" && s != "CANCELLED") error = "unknown time_status '" + s + "'";
            else if (title == null || title.Trim().Length == 0) error = "title is empty";
            else if (i != "HIGH" && i != "MEDIUM" && i != "LOW" && i != "HOLIDAY" && i != "UNKNOWN") error = "unknown impact '" + i + "'";
            DateTime utc = DateTime.MinValue;
            if (error == null && !DateTime.TryParseExact(t, "yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture,
                    DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out utc)) error = "event_time_utc is unparsable";
            else if (error == null) row = new FileNewsRow { Title = title, Currency = c, Impact = i, Enabled = e == "true", Status = s, TimeUtc = utc };
            return error == null;
        }
    }

    public static class NewsFeedValidator
    {
        private static readonly string[] Formats =
        {
            "yyyy-MM-dd'T'HH:mm:sszzz", "yyyy-MM-dd'T'HH:mm:ss.FFFFFFFzzz",
            "yyyy-MM-dd'T'HH:mm:ss'Z'", "yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'"
        };
        // Canonical impact vocabulary. Anything else makes the whole refresh fail (never silently dropped).
        public static bool ImpactKnown(string impact)
        {
            string v = (impact ?? "").Trim().ToUpperInvariant();
            return v == "HIGH" || v == "MEDIUM" || v == "LOW" || v == "HOLIDAY";
        }
        public static int ImpactLevel(string impact)
        {
            switch ((impact ?? "").Trim().ToUpperInvariant()) { case "HIGH": return 3; case "MEDIUM": return 2; case "LOW": return 1; default: return 0; }
        }
        // Every row must be schema-complete with an explicit-offset timestamp; one defective row (relevant or not)
        // rejects the entire feed. Only after validation are rows filtered by currency and impact.
        public static bool Validate(IList<NewsRow> rows, ISet<string> currencies, out List<NewsItem> events, out string error)
        {
            events = new List<NewsItem>();
            if (rows == null || rows.Count == 0) { error = "feed empty or not a list"; return false; }
            var parsed = new List<NewsItem>();
            for (int i = 0; i < rows.Count; i++)
            {
                NewsRow r = rows[i];
                if (r == null) { error = "row " + i + " null"; return false; }
                if (string.IsNullOrWhiteSpace(r.Country)) { error = "row " + i + " lacks country"; return false; }
                if (string.IsNullOrWhiteSpace(r.Impact)) { error = "row " + i + " lacks impact"; return false; }
                if (!ImpactKnown(r.Impact)) { error = "row " + i + " unknown impact '" + r.Impact + "'"; return false; }
                if (r.Title == null) { error = "row " + i + " lacks title"; return false; }
                if (string.IsNullOrWhiteSpace(r.Date)) { error = "row " + i + " lacks date"; return false; }
                DateTimeOffset dto;
                if (!DateTimeOffset.TryParseExact(r.Date.Trim(), Formats, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out dto))
                { error = "row " + i + " date lacks explicit UTC/offset or is unparsable"; return false; }
                string cur = r.Country.Trim().ToUpperInvariant();
                int level = ImpactLevel(r.Impact);
                if (level <= 0) continue;
                if (currencies != null && currencies.Count > 0 && !currencies.Contains(cur)) continue;
                parsed.Add(new NewsItem { Title = r.Title, Currency = cur, Impact = level, TimeUtc = dto.UtcDateTime });
            }
            parsed.Sort((a, b) => a.TimeUtc.CompareTo(b.TimeUtc));
            events = parsed; error = null; return true;
        }
    }

    // ------------------------------------------------------------------ F3: startup safety-only mode
    public static class StartupGuard
    {
        // Runs the (possibly throwing) start sequence. In live mode ANY exception enters safety-only mode instead of
        // propagating, so already-registered exposure keeps being served. Backtests keep strict start failures.
        public static bool Run(bool live, Action core, Action<Exception> enterSafetyOnly)
        {
            try { core(); return true; }
            catch (Exception ex)
            {
                if (!live) throw;
                enterSafetyOnly(ex);
                return false;
            }
        }
    }

    // ------------------------------------------------------------------ F4: stop-modification failure policy
    public enum StopModifyOutcome { Applied, PositionGone, Throttled, FailedOldProtectionIntact, FailedUnprotectedClosed, FailedUnprotected }

    public sealed class StopModifyGuard
    {
        private static string Fmt(double? v) { return v.HasValue ? v.Value.ToString("R", CultureInfo.InvariantCulture) : "null"; }
        private readonly HashSet<int> _paused = new HashSet<int>();
        private readonly Dictionary<int, DateTime> _next = new Dictionary<int, DateTime>();
        private readonly double _retrySeconds;
        public StopModifyGuard(double retrySeconds) { _retrySeconds = retrySeconds; }
        public bool EntriesLocked { get { return _paused.Count > 0; } }
        public int PausedCount { get { return _paused.Count; } }
        public bool IsPaused(int id) { return _paused.Contains(id); }
        public void Sweep(Func<int, bool> isOpen)
        {
            foreach (int id in _paused.ToList()) if (!isOpen(id)) { _paused.Remove(id); _next.Remove(id); }
        }

        // readback returns null when the position no longer exists, otherwise {SL, TP}. Both values are verified.
        public StopModifyOutcome Apply(int id, double newSl, double? prevSl, double? prevTp, double tick,
            Func<double?[]> readback, Func<bool> modify, Func<bool> close,
            ProtectionRecovery recovery, KillSwitch kill, DateTime now, Action<string> log)
        {
            DateTime nt;
            if (_paused.Contains(id) && _next.TryGetValue(id, out nt) && now < nt) return StopModifyOutcome.Throttled;
            bool ok = false;
            try { ok = modify(); } catch (Exception ex) { log("STOP-MODIFY exception " + ex.GetType().Name + " #" + id); }
            double?[] rb;
            try { rb = readback(); } catch (Exception ex) { log("STOP-MODIFY readback exception " + ex.GetType().Name + " #" + id); rb = new double?[] { null, null }; }
            if (rb == null) { _paused.Remove(id); _next.Remove(id); return StopModifyOutcome.PositionGone; }
            // v2.54-dev (B1): the broker/backtester re-quantises prices on modify by up to one tick (evidence: want TP=2418.18 read 2418.17;
            // want SL=2516.70 read 2516.69). SL and the unchanged TP are therefore compared with a TickSize tolerance. Anything further off,
            // a missing SL, or a missing/unexpected TP is still a failure.
            bool tpSame = prevTp.HasValue ? PostFill.MatchesWithinTick(rb[1], prevTp.Value, tick) : !rb[1].HasValue;
            // v2.59-dev (M1): Applied requires BOTH a successful API result AND a readback within one tick. A false/throwing modify whose readback
            // happens to sit within one tick of the request (e.g. old SL exactly one tick away) is NOT a success.
            bool readbackMatches = PostFill.MatchesWithinTick(rb[0], newSl, tick) && tpSame;
            if (ok && readbackMatches) { _paused.Remove(id); _next.Remove(id); return StopModifyOutcome.Applied; }
            string why = ok ? "stop modify accepted but readback differs" : "stop modify failed";
            log("STOP-MODIFY DIAG #" + id + " want SL=" + Fmt(newSl) + " TP=" + Fmt(prevTp) + " prevSL=" + Fmt(prevSl) + " | read SL=" + Fmt(rb[0]) + " TP=" + Fmt(rb[1]) + " tick=" + Fmt(tick));
            // Protection is verifiably in force if the readback shows the previous SL+TP, or (API said failure but) the requested SL with the unchanged TP.
            // Either way: pause + throttled retry; no emergency close, no KS latch, never reported as Applied.
            bool oldIntact = (prevSl.HasValue && prevTp.HasValue && PostFill.MatchesWithinTick(rb[0], prevSl.Value, tick) && PostFill.MatchesWithinTick(rb[1], prevTp.Value, tick))
                || (!ok && readbackMatches && rb[0].HasValue && (prevTp.HasValue ? rb[1].HasValue : !rb[1].HasValue));
            if (oldIntact)
            {
                // Previous SL+TP verifiably still in force: not unprotected. Latched entry pause + throttled retry.
                _paused.Add(id); _next[id] = now.AddSeconds(_retrySeconds);
                log("STOP-MODIFY " + why + " #" + id + ": old protection intact -> entry pause + retry");
                return StopModifyOutcome.FailedOldProtectionIntact;
            }
            log("STOP-MODIFY " + why + " #" + id + ": protection unclear -> recovery close");
            _paused.Add(id); _next[id] = now.AddSeconds(_retrySeconds);
            if (recovery != null) recovery.Register(id, why, now);
            if (kill != null) kill.OnProtectionFailure(now, "#" + id + " " + why);
            bool closed = false;
            try { closed = close(); } catch (Exception ex) { log("STOP-MODIFY close exception " + ex.GetType().Name); }
            if (closed) { if (recovery != null) recovery.Resolve(id); _paused.Remove(id); _next.Remove(id); return StopModifyOutcome.FailedUnprotectedClosed; }
            if (recovery != null) recovery.NoteAttempt(id, now);
            return StopModifyOutcome.FailedUnprotected;
        }
    }

    // ------------------------------------------------------------------ F5: persistent entry counter + runner lifecycle
    public sealed class EntryLedger
    {
        private readonly IStateStore _store;
        private readonly bool _allowBootstrap;
        public string DayKey = "";
        public int Entries, ConsecutiveLosses;
        public string Fault = "";
        public bool Loaded;
        // positionId -> lifecycle fields (strings, written by the bot); "complete" = "1" only once the full record exists.
        public readonly Dictionary<int, Dictionary<string, string>> Positions = new Dictionary<int, Dictionary<string, string>>();
        // Durable same-day fill evidence is independent of open-position lifecycle records. Removing a closed or
        // compensated position must never erase the fact that the broker accepted a primary fill.
        public readonly HashSet<int> FillIds = new HashSet<int>();
        public Action<string> Log = delegate { };
        public EntryLedger(IStateStore store, bool allowBootstrap) { _store = store; _allowBootstrap = allowBootstrap; }

        public void Load(string todayKey)
        {
            string text;
            try { text = _store.Read(); } catch (Exception ex) { Fail("ledger unreadable (" + ex.GetType().Name + ")"); return; }
            if (text == null)
            {
                if (!_allowBootstrap) { Fail("ledger missing"); return; }
                DayKey = todayKey; Entries = 0; ConsecutiveLosses = 0; Loaded = true; Persist(); return;
            }
            string why = Parse(text);
            if (why != null) { Fail(why); return; }
            Loaded = true;
            RollDay(todayKey);
        }

        private void Fail(string why) { Fault = why; Loaded = false; Log("LEDGER FAULT: " + why); }

        public void RollDay(string todayKey)
        {
            if (!Loaded || DayKey == todayKey) return;
            DayKey = todayKey; Entries = 0; ConsecutiveLosses = 0; FillIds.Clear();
            Persist();
        }
        public int EffectiveEntriesToday { get { return Entries; } }

        // One ledger transaction records both the broker fill and the daily-cap increment. Replays with the same
        // broker position id are idempotent. The fill id remains after the position lifecycle record is removed.
        public bool RecordFill(int id, Dictionary<string, string> fields)
        {
            if (!Loaded) return false;
            bool alreadyCounted = FillIds.Contains(id);
            if (alreadyCounted) return true;
            Positions[id] = new Dictionary<string, string>(fields);
            FillIds.Add(id); Entries++;
            Persist();
            return Loaded;
        }
        public void SetLosses(int n) { if (!Loaded || n == ConsecutiveLosses) return; ConsecutiveLosses = n; Persist(); }
        public void Remove(int id) { if (!Loaded) return; if (Positions.Remove(id)) Persist(); }
        // Persists only when the record changed. Returns false when the write failed (ledger then faulted).
        public bool Set(int id, Dictionary<string, string> fields)
        {
            if (!Loaded) return false;
            Dictionary<string, string> cur;
            if (Positions.TryGetValue(id, out cur) && SameFields(cur, fields)) return true;
            Positions[id] = new Dictionary<string, string>(fields);
            Persist();
            return Loaded;
        }
        private static bool SameFields(Dictionary<string, string> a, Dictionary<string, string> b)
        {
            if (a.Count != b.Count) return false;
            foreach (var kv in a) { string v; if (!b.TryGetValue(kv.Key, out v) || v != kv.Value) return false; }
            return true;
        }

        private static string Enc(string s) { return Uri.EscapeDataString(s ?? ""); }
        private static string Dec(string s) { return Uri.UnescapeDataString(s); }
        private static string Sha(string s) { using (var h = SHA256.Create()) return string.Concat(h.ComputeHash(Encoding.UTF8.GetBytes(s)).Select(b => b.ToString("x2"))); }

        public void Persist()
        {
            try
            {
                var sb = new StringBuilder();
                sb.Append("v=2\ndayKey=" + DayKey + "\nentries=" + Entries.ToString(CultureInfo.InvariantCulture) + "\nlosses=" + ConsecutiveLosses.ToString(CultureInfo.InvariantCulture) + "\n");
                foreach (int id in FillIds.OrderBy(x => x)) sb.Append("fill=" + id.ToString(CultureInfo.InvariantCulture) + "\n");
                foreach (var kv in Positions.OrderBy(k => k.Key))
                    sb.Append("pos=" + kv.Key.ToString(CultureInfo.InvariantCulture) + ";" + string.Join("&", kv.Value.OrderBy(f => f.Key, StringComparer.Ordinal).Select(f => Enc(f.Key) + "=" + Enc(f.Value))) + "\n");
                string b = sb.ToString();
                _store.Write(b + "sha256=" + Sha(b) + "\n");
            }
            catch (Exception ex) { Fail("ledger write failed (" + ex.GetType().Name + ")"); }
        }

        private string Parse(string text)
        {
            int i = text.LastIndexOf("sha256=", StringComparison.Ordinal);
            if (i < 0) return "ledger checksum missing";
            string body = text.Substring(0, i);
            if (!string.Equals(text.Substring(i + 7).Trim(), Sha(body), StringComparison.Ordinal)) return "ledger checksum mismatch";
            string day = null; int entries = -1, losses = -1, version = 0;
            var pos = new Dictionary<int, Dictionary<string, string>>();
            var fills = new HashSet<int>();
            foreach (string line in body.Split('\n'))
            {
                if (line.Length == 0) continue;
                int e = line.IndexOf('=');
                if (e <= 0) return "ledger malformed line";
                string k = line.Substring(0, e), v = line.Substring(e + 1);
                if (k == "v") { if (!int.TryParse(v, out version) || (version != 1 && version != 2)) return "ledger version unsupported"; }
                else if (k == "dayKey") day = v;
                else if (k == "entries") { if (!int.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out entries) || entries < 0) return "ledger entries invalid"; }
                else if (k == "losses") { if (!int.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out losses) || losses < 0) return "ledger losses invalid"; }
                else if (k == "fill")
                {
                    int fillId; if (!int.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out fillId) || fillId < 0 || !fills.Add(fillId)) return "ledger fill invalid";
                }
                else if (k == "pos")
                {
                    int semi = v.IndexOf(';'); int id;
                    if (semi <= 0 || !int.TryParse(v.Substring(0, semi), NumberStyles.Integer, CultureInfo.InvariantCulture, out id)) return "ledger position invalid";
                    var f = new Dictionary<string, string>();
                    foreach (string part in v.Substring(semi + 1).Split(new[] { '&' }, StringSplitOptions.RemoveEmptyEntries))
                    {
                        int q = part.IndexOf('=');
                        if (q <= 0) return "ledger field invalid";
                        f[Dec(part.Substring(0, q))] = Dec(part.Substring(q + 1));
                    }
                    pos[id] = f;
                }
                else return "ledger unknown key";
            }
            if (version == 0 || string.IsNullOrEmpty(day) || entries < 0 || losses < 0) return "ledger field missing";
            if (version == 2 && fills.Count > entries) return "ledger fill/count mismatch";
            DayKey = day; Entries = entries; ConsecutiveLosses = losses;
            Positions.Clear(); foreach (var kv in pos) Positions[kv.Key] = kv.Value;
            FillIds.Clear(); foreach (int id in fills) FillIds.Add(id);
            // v1 migration has no durable fill ids. Preserve its counter but write v2 on the next mutation;
            // existing open records are intentionally not guessed to be same-day fills.
            return null;
        }
    }

    // ------------------------------------------------------------------ F6: continuous ownership reconciliation
    public sealed class OwnershipGuard
    {
        public string Fault { get; private set; }
        public Action<string> OnFault = delegate { };
        public OwnershipGuard() { Fault = ""; }
        // Latches on the first foreign exposure and stays latched (operator reconciliation + restart). Never closes foreign items.
        public bool Check(int foreignPositions, int foreignPendingOrders)
        {
            if (Fault.Length > 0) return false;
            if (foreignPositions == 0 && foreignPendingOrders == 0) return true;
            Fault = "unattributed account position/pending order (positions=" + foreignPositions + ", pending=" + foreignPendingOrders + ")";
            OnFault(Fault);
            return false;
        }
    }

    // ------------------------------------------------------------------ final SL risk-cap check
    public static class RiskCap
    {
        // No invented limits: the cap is the caller's configured amount. Non-finite risk or cap violation fails closed.
        public static bool WithinCap(double risk, double cap)
        { return !double.IsNaN(risk) && !double.IsInfinity(risk) && risk > 0 && !double.IsNaN(cap) && risk <= cap + 1e-9; }
    }

    // ------------------------------------------------------------------ risk / limit parameter consistency (live start)
    public static class LimitConsistency
    {
        // Only logical relations between the configured values; no limit values are invented here. Pct values; 0 = off.
        public static List<string> Check(double riskPerTradePct, double maxRiskPct, double dailyRealizedLossPct, int maxConcurrent,
            double ksDailyPct, double ksWeeklyPct, double ksMonthlyPct, double marginUsePct)
        {
            var v = new List<string>();
            if (!(riskPerTradePct > 0)) v.Add("RiskPercentPerTrade must be > 0");
            if (riskPerTradePct > maxRiskPct) v.Add("RiskPercentPerTrade (" + riskPerTradePct + ") exceeds MaximumRiskPercent (" + maxRiskPct + ")");
            if (maxRiskPct > dailyRealizedLossPct) v.Add("MaximumRiskPercent (" + maxRiskPct + ") exceeds DailyRealizedLossLimitPercent (" + dailyRealizedLossPct + "): one stop-out would breach the daily limit");
            if (ksDailyPct > 0 && maxRiskPct > ksDailyPct) v.Add("MaximumRiskPercent exceeds Kill-Switch daily loss % (" + ksDailyPct + ")");
            if (ksDailyPct > 0 && ksWeeklyPct > 0 && ksDailyPct > ksWeeklyPct) v.Add("KS daily % exceeds weekly %");
            if (ksWeeklyPct > 0 && ksMonthlyPct > 0 && ksWeeklyPct > ksMonthlyPct) v.Add("KS weekly % exceeds monthly %");
            if (ksDailyPct > 0 && ksMonthlyPct > 0 && ksDailyPct > ksMonthlyPct) v.Add("KS daily % exceeds monthly %");
            if (maxConcurrent < 1) v.Add("MaxConcurrentPositions must be >= 1");
            if (!(marginUsePct > 0) || marginUsePct > 100) v.Add("MaxMarginUsePercent must be in (0,100] for live");
            return v;
        }
        // Informational: worst-case simultaneous open risk (not a pass/fail limit).
        public static double WorstCaseOpenRiskPct(double maxRiskPct, int maxConcurrent) { return maxRiskPct * Math.Max(1, maxConcurrent); }
    }
}
