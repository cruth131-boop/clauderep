using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace CandidateTelemetry
{
    // Stable schema. Additive changes require a new SchemaVersion; names are parser keys.
    public enum CandidateTerminalStage
    {
        FormationRejected,
        CoreRejected,
        PolicyRejected,
        VariantRejected,
        Invalidated,
        Expired,
        Deduped,
        Unselected,
        GateRejected,
        NoTarget,
        RiskRejected,
        OrderRejected,
        Filled,
        ProtectionFailed,
        Reset,
        EndOfRun
    }

    public enum ShadowStatus { Pending, NoFill, Stop, Target, Timeout, DataGap }

    public sealed class CandidateSnapshot
    {
        public string CandidateId = "";
        public string RunId = "";
        public string Module = "UNKNOWN";
        public string Lane = "na";
        public string Core = "na";
        public string Policy = "native";
        public string VariantId = "native";
        public string FormationId = "na";
        public string ParentCandidateId = "na";
        public int Direction;
        public string Session = "na";
        public DateTime DetectUtc;
        public DateTime EndUtc;
        public CandidateTerminalStage Terminal;
        public string Reason = "na";
        public double? Entry;
        public double? Stop;
        public double? Tp;
        public double? Rr;
        public double? StopUsd;
        public double? ZoneWidth;
        public string HtfBias = "na";
        public string PremiumDiscount = "na";
        public string MissingReason = "na";
        public string KnownAt = "na";
        public string GateVector = "na";
        public double? FinalLots;
        public bool? MinLotFeasible;
        public bool IsLimit;
    }

    public sealed class CandidateRegistry
    {
        public const string SchemaVersion = "1";
        private readonly string _runId;
        private readonly Dictionary<string, CandidateSnapshot> _open = new Dictionary<string, CandidateSnapshot>(StringComparer.Ordinal);
        private readonly HashSet<string> _ended = new HashSet<string>(StringComparer.Ordinal);
        private long _sequence;

        public CandidateRegistry(string runId) { _runId = Clean(runId); }
        public int OpenCount { get { return _open.Count; } }
        public int EndedCount { get { return _ended.Count; } }

        public CandidateSnapshot Begin(string module, DateTime barTimeUtc, string formationId, int direction, string lane, string core, string policy, string parentCandidateId = "na")
        {
            string key = Clean(module) + "|" + barTimeUtc.ToUniversalTime().Ticks.ToString(CultureInfo.InvariantCulture) + "|" + Clean(formationId);
            CandidateSnapshot existing;
            if (_open.TryGetValue(key, out existing)) return existing;
            _sequence++;
            string id = Clean(module) + "-" + barTimeUtc.ToUniversalTime().ToString("yyyyMMddTHHmmss", CultureInfo.InvariantCulture) + "-" + _sequence.ToString(CultureInfo.InvariantCulture);
            var c = new CandidateSnapshot
            {
                CandidateId = id, RunId = _runId, Module = Clean(module), Lane = Clean(lane), Core = Clean(core), Policy = Clean(policy),
                FormationId = Clean(formationId), ParentCandidateId = Clean(parentCandidateId), Direction = direction,
                DetectUtc = DateTime.SpecifyKind(barTimeUtc.ToUniversalTime(), DateTimeKind.Utc)
            };
            _open[key] = c;
            _open[id] = c;
            return c;
        }

        public CandidateSnapshot Find(string id)
        {
            CandidateSnapshot c; return id != null && _open.TryGetValue(id, out c) ? c : null;
        }

        public string End(string id, DateTime utc, CandidateTerminalStage terminal, string reason)
        {
            if (string.IsNullOrEmpty(id) || _ended.Contains(id)) return null;
            CandidateSnapshot c;
            if (!_open.TryGetValue(id, out c)) return null;
            c.EndUtc = DateTime.SpecifyKind(utc.ToUniversalTime(), DateTimeKind.Utc);
            c.Terminal = terminal; c.Reason = Clean(reason);
            _ended.Add(id);
            foreach (string key in _open.Where(x => object.ReferenceEquals(x.Value, c)).Select(x => x.Key).ToList()) _open.Remove(key);
            return FormatEnd(c);
        }

        public IEnumerable<string> EndAll(DateTime utc)
        {
            foreach (CandidateSnapshot c in _open.Values.Distinct().ToList())
            {
                string line = End(c.CandidateId, utc, CandidateTerminalStage.EndOfRun, "bot_stop");
                if (line != null) yield return line;
            }
        }

        public static string FormatEnd(CandidateSnapshot c)
        {
            return "CAND_END|schema_version=" + SchemaVersion + "|run_id=" + Clean(c.RunId) + "|cand=" + Clean(c.CandidateId) +
                "|formation_id=" + Clean(c.FormationId) + "|parent_candidate_id=" + Clean(c.ParentCandidateId) +
                "|module=" + Clean(c.Module) + "|lane/type=" + Clean(c.Lane) + "|core=" + Clean(c.Core) + "|policy=" + Clean(c.Policy) +
                "|variant_id=" + Clean(c.VariantId) + "|dir=" + c.Direction.ToString(CultureInfo.InvariantCulture) + "|session=" + Clean(c.Session) +
                "|t_detect=" + Time(c.DetectUtc) + "|t_end=" + Time(c.EndUtc) + "|terminal=" + EnumName(c.Terminal) + "|reason=" + Clean(c.Reason) +
                "|entry=" + Num(c.Entry) + "|sl=" + Num(c.Stop) + "|tp=" + Num(c.Tp) + "|rr=" + Num(c.Rr) + "|stopUsd=" + Num(c.StopUsd) +
                "|zoneWidth=" + Num(c.ZoneWidth) + "|htfBias=" + Clean(c.HtfBias) + "|pd=" + Clean(c.PremiumDiscount) +
                "|missing_reason=" + Clean(c.MissingReason) + "|known_at=" + Clean(c.KnownAt) + "|gates=" + Clean(c.GateVector) +
                "|finalLots=" + Num(c.FinalLots) + "|min_lot_feasible=" + Bool(c.MinLotFeasible);
        }

        public static string EnumName(CandidateTerminalStage s)
        { return string.Concat(s.ToString().Select((ch, i) => char.IsUpper(ch) && i > 0 ? "_" + ch : ch.ToString())).ToUpperInvariant(); }
        public static string Num(double? x) { return x.HasValue && !double.IsNaN(x.Value) && !double.IsInfinity(x.Value) ? x.Value.ToString("R", CultureInfo.InvariantCulture) : "na"; }
        private static string Bool(bool? x) { return x.HasValue ? (x.Value ? "true" : "false") : "na"; }
        private static string Time(DateTime t) { return t == DateTime.MinValue ? "na" : t.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fff'Z'", CultureInfo.InvariantCulture); }
        public static string Clean(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return "na";
            return s.Replace('|', '/').Replace('\r', ' ').Replace('\n', ' ').Trim();
        }
    }

    public sealed class ShadowBar
    {
        public DateTime OpenUtc;
        public double Open, High, Low, Close; // Bid OHLC; Ask is Bid + SpreadPrice.
    }

    public sealed class ShadowOutcome
    {
        public double TargetR;
        public ShadowStatus Status = ShadowStatus.Pending;
        public DateTime EndUtc;
        public double MfeR;
        public double MaeR;
        public int Minutes;
        public bool IntrabarAmbiguous;
        public bool Censored;
        public double? ExitPrice;
        public double? MarkR;
    }

    public sealed class ShadowResult
    {
        public string CandidateId = "";
        public bool Filled;
        public DateTime? FillUtc;
        public readonly List<ShadowOutcome> Outcomes = new List<ShadowOutcome>();

        public string Format()
        {
            var p = new List<string> { "SHADOW_END", "schema_version=" + CandidateRegistry.SchemaVersion, "cand=" + CandidateRegistry.Clean(CandidateId), "filled=" + (Filled ? "true" : "false") };
            foreach (ShadowOutcome o in Outcomes)
            {
                string k = "R" + o.TargetR.ToString("0.0", CultureInfo.InvariantCulture);
                p.Add(k + "_status=" + o.Status.ToString().ToUpperInvariant()); p.Add(k + "_mfeR=" + o.MfeR.ToString("R", CultureInfo.InvariantCulture));
                p.Add(k + "_maeR=" + o.MaeR.ToString("R", CultureInfo.InvariantCulture)); p.Add(k + "_minutes=" + o.Minutes.ToString(CultureInfo.InvariantCulture));
                p.Add(k + "_ambiguous=" + (o.IntrabarAmbiguous ? "true" : "false")); p.Add(k + "_censored=" + (o.Censored ? "true" : "false"));
                p.Add(k + "_exit=" + CandidateRegistry.Num(o.ExitPrice)); p.Add(k + "_markR=" + CandidateRegistry.Num(o.MarkR));
            }
            return string.Join("|", p);
        }
    }

    public static class ShadowEvaluator
    {
        public static readonly double[] Grid = { 1.0, 1.2, 1.5, 1.6, 2.0, 3.0 };

        public static ShadowResult Evaluate(string candidateId, int direction, double entry, double stop, bool limit, DateTime submitUtc,
            DateTime administrativeEndUtc, double spreadPrice, IEnumerable<ShadowBar> source)
        {
            var result = new ShadowResult { CandidateId = candidateId };
            foreach (double r in Grid) result.Outcomes.Add(new ShadowOutcome { TargetR = r });
            double risk = Math.Abs(entry - stop);
            if ((direction != 1 && direction != -1) || !(risk > 0) || !(spreadPrice >= 0))
            { foreach (var o in result.Outcomes) { o.Status = ShadowStatus.DataGap; o.Censored = true; } return result; }

            DateTime horizon = submitUtc.AddHours(24) < administrativeEndUtc ? submitUtc.AddHours(24) : administrativeEndUtc;
            bool filled = false; DateTime fillUtc = DateTime.MinValue; double lastExitQuote = entry;
            ShadowBar previous = null;
            foreach (ShadowBar b in (source ?? Enumerable.Empty<ShadowBar>()).OrderBy(x => x.OpenUtc))
            {
                if (b.OpenUtc < submitUtc) continue;
                if (b.OpenUtc > horizon) break;
                if (!FiniteBar(b) || (previous != null && b.OpenUtc > previous.OpenUtc.AddMinutes(2)))
                { foreach (var o in result.Outcomes.Where(x => x.Status == ShadowStatus.Pending)) { o.Status = ShadowStatus.DataGap; o.Censored = true; o.EndUtc = b.OpenUtc; } break; }
                previous = b;
                double askOpen = b.Open + spreadPrice, askHigh = b.High + spreadPrice, askLow = b.Low + spreadPrice;
                if (!filled)
                {
                    bool hit = limit ? (direction > 0 ? b.Low + spreadPrice <= entry : b.High >= entry) : true;
                    if (!hit) continue;
                    // Market uses the first tradable post-submit quote. A limit uses its frozen price.
                    if (!limit) entry = direction > 0 ? askOpen : b.Open;
                    risk = Math.Abs(entry - stop); if (!(risk > 0)) break;
                    filled = result.Filled = true; fillUtc = b.OpenUtc; result.FillUtc = fillUtc;
                }

                double exitHigh = direction > 0 ? b.High : askHigh;
                double exitLow = direction > 0 ? b.Low : askLow;
                lastExitQuote = direction > 0 ? b.Close : b.Close + spreadPrice;
                double favorable = direction > 0 ? exitHigh - entry : entry - exitLow;
                double adverse = direction > 0 ? entry - exitLow : exitHigh - entry;
                foreach (ShadowOutcome o in result.Outcomes.Where(x => x.Status == ShadowStatus.Pending))
                {
                    o.MfeR = Math.Max(o.MfeR, Math.Max(0, favorable / risk));
                    o.MaeR = Math.Max(o.MaeR, Math.Max(0, adverse / risk));
                    double target = entry + direction * risk * o.TargetR;
                    bool stopHit = direction > 0 ? exitLow <= stop : exitHigh >= stop;
                    bool targetHit = direction > 0 ? exitHigh >= target : exitLow <= target;
                    if (stopHit || targetHit)
                    {
                        // No tick ordering exists inside M1, including the fill bar: stop first is conservative.
                        o.IntrabarAmbiguous = stopHit && targetHit;
                        o.Status = stopHit ? ShadowStatus.Stop : ShadowStatus.Target;
                        o.ExitPrice = stopHit ? stop : target; o.EndUtc = b.OpenUtc;
                        o.Minutes = Math.Max(0, (int)Math.Round((b.OpenUtc - fillUtc).TotalMinutes));
                    }
                }
                if (result.Outcomes.All(x => x.Status != ShadowStatus.Pending)) break;
            }

            foreach (ShadowOutcome o in result.Outcomes.Where(x => x.Status == ShadowStatus.Pending))
            {
                o.Status = filled ? ShadowStatus.Timeout : ShadowStatus.NoFill; o.Censored = true; o.EndUtc = horizon;
                o.Minutes = filled ? Math.Max(0, (int)Math.Round((horizon - fillUtc).TotalMinutes)) : 0;
                o.MarkR = filled ? direction * (lastExitQuote - entry) / risk : (double?)null;
            }
            return result;
        }

        private static bool FiniteBar(ShadowBar b)
        {
            return b != null && F(b.Open) && F(b.High) && F(b.Low) && F(b.Close) && b.High >= Math.Max(b.Open, b.Close) && b.Low <= Math.Min(b.Open, b.Close) && b.High >= b.Low;
        }
        private static bool F(double x) { return !double.IsNaN(x) && !double.IsInfinity(x); }
    }
}
