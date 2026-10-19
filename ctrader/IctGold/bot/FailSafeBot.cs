using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using cAlgo.API;
using FailSafe;

namespace cAlgo.Robots
{
    // v2.54-dev G3 fail-safes (F1-F7 review fixes): bot-side wiring. Decision logic lives in FailSafe.cs (offline tested).
    public partial class IctGoldV259Dev
    {
        private const string BotVersion = "v2.59-dev";

        // ---- parameters (defaults keep the historical backtest behaviour; live start validation below demands them)
        [Parameter("Atomic SL/TP With Order", DefaultValue = true, Group = "12 G3 Fail-safes")]
        public bool AtomicProtection { get; set; }
        [Parameter("Protection Close Retry Seconds", DefaultValue = 5.0, MinValue = 1, Group = "12 G3 Fail-safes")]
        public double ProtectionRetrySeconds { get; set; }
        [Parameter("Protection Escalate After Attempts", DefaultValue = 3, MinValue = 1, Group = "12 G3 Fail-safes")]
        public int ProtectionEscalateAfter { get; set; }
        [Parameter("News Live Fail-Closed", DefaultValue = true, Group = "12 G3 Fail-safes")]
        public bool NewsLiveFailClosed { get; set; }
        [Parameter("Allow Zero HIGH News Window (live)", DefaultValue = false, Group = "12 G3 Fail-safes")]
        public bool AllowZeroHighNewsWindow { get; set; }
        [Parameter("Allow Fixed Lots in Live (override)", DefaultValue = false, Group = "12 G3 Fail-safes")]
        public bool AllowFixedLotsLive { get; set; }
        [Parameter("Sizing Cross-Check", DefaultValue = true, Group = "12 G3 Fail-safes")]
        public bool SizingCrossCheck { get; set; }
        [Parameter("Sizing Cross-Check Tolerance", DefaultValue = 0.10, MinValue = 0.0001, Group = "12 G3 Fail-safes")]
        public double SizingCrossCheckTolerance { get; set; }
        [Parameter("Risk Cap Per Trade EUR (0=off)", DefaultValue = 0.0, MinValue = 0, Group = "12 G3 Fail-safes")]
        public double RiskCapPerTradeAccount { get; set; }
        [Parameter("Max Risk Cap EUR (0=off)", DefaultValue = 0.0, MinValue = 0, Group = "12 G3 Fail-safes")]
        public double MaxRiskCapAccount { get; set; }
        [Parameter("Max Margin Use % of Equity (0=off)", DefaultValue = 80.0, MinValue = 0, MaxValue = 100, Group = "12 G3 Fail-safes")]
        public double MaxMarginUsePercent { get; set; }

        [Parameter("Kill-Switch Enabled", DefaultValue = false, Group = "13 Kill-Switch")]
        public bool KsEnabled { get; set; }
        [Parameter("KS Daily Loss % (0=off)", DefaultValue = 0.0, MinValue = 0, Group = "13 Kill-Switch")]
        public double KsDailyLossPct { get; set; }
        [Parameter("KS Daily Loss EUR (0=off)", DefaultValue = 0.0, MinValue = 0, Group = "13 Kill-Switch")]
        public double KsDailyLossAbs { get; set; }
        [Parameter("KS Weekly Loss % (0=off)", DefaultValue = 0.0, MinValue = 0, Group = "13 Kill-Switch")]
        public double KsWeeklyLossPct { get; set; }
        [Parameter("KS Weekly Loss EUR (0=off)", DefaultValue = 0.0, MinValue = 0, Group = "13 Kill-Switch")]
        public double KsWeeklyLossAbs { get; set; }
        [Parameter("KS Monthly Loss % (0=off)", DefaultValue = 0.0, MinValue = 0, Group = "13 Kill-Switch")]
        public double KsMonthlyLossPct { get; set; }
        [Parameter("KS Monthly Loss EUR (0=off)", DefaultValue = 0.0, MinValue = 0, Group = "13 Kill-Switch")]
        public double KsMonthlyLossAbs { get; set; }
        [Parameter("KS Max Consecutive Losses (0=off)", DefaultValue = 0, MinValue = 0, Group = "13 Kill-Switch")]
        public int KsMaxConsecutiveLosses { get; set; }
        [Parameter("KS Stop On Protection Failure", DefaultValue = true, Group = "13 Kill-Switch")]
        public bool KsStopOnProtectionFailure { get; set; }
        [Parameter("KS Daily Auto Reset", DefaultValue = false, Group = "13 Kill-Switch")]
        public bool KsDailyAutoReset { get; set; }
        [Parameter("KS Period Auto Reset (week/month)", DefaultValue = false, Group = "13 Kill-Switch")]
        public bool KsPeriodAutoReset { get; set; }
        [Parameter("KS Allow Bootstrap (first live start)", DefaultValue = false, Group = "13 Kill-Switch")]
        public bool KsAllowBootstrap { get; set; }
        [Parameter("KS Reset Token (NONE=off)", DefaultValue = "NONE", Group = "13 Kill-Switch")]
        public string KsResetToken { get; set; }
        [Parameter("KS State Directory (AUTO)", DefaultValue = "AUTO", Group = "13 Kill-Switch")]
        public string KsStateDirectory { get; set; }

        [Parameter("Owner Instance Id", DefaultValue = "PRIMARY", Group = "12 G3 Fail-safes")]
        public string OwnerInstanceId { get; set; }
        [Parameter("Journal Directory (AUTO/OFF/path)", DefaultValue = "AUTO", Group = "14 Journal")]
        public string JournalDirectory { get; set; }

        // ---- state
        private KillSwitch _ks;
        private ProtectionRecovery _recovery;
        private ProtectionRecovery _flatten;
        private StopModifyGuard _stopGuard;
        private EntryLedger _ledger;
        private OwnershipGuard _ownership;
        private string _safetyOnlyReason = "";   // F3: set when the start sequence failed; entries are locked for good, exposure is still served
        private readonly List<KeyValuePair<DateTime, string>> _startExposure = new List<KeyValuePair<DateTime, string>>();   // event UTC + reason for unprotected own positions found before the KS exists
        private string _startupFault = "";       // F3: non-throwing start faults (state lock, file errors)
        private readonly Dictionary<int, string> _fsLedgerSig = new Dictionary<int, string>();
        private DailyJournal _journal;
        private bool _sizingFault;
        private string _sizingFaultText = "";
        private string _reconciliationFault = "";
        private string _lastNewsBlockJournaled = "";
        private bool _newsCoverageOk = true;
        private string _lastKsStatusJournaled = "";
        private string _alarmDirectory = "";
        private FileStream _ksStateLock;
        private bool _fsRecoveryOwner;             // live broker/state mutation is legal only while this instance holds FileShare.None
        private string _fsRecoveryLockDirectoryOverride = null; // offline harness only; production leaves null and uses canonical bot data root
        private readonly Dictionary<int, string> _fsTradeKey = new Dictionary<int, string>();
        private readonly Dictionary<int, double[]> _fsRequest = new Dictionary<int, double[]>(); // bid, ask, requested volume
        private double _pendingReqBid, _pendingReqAsk;

        private bool FsLive { get { return RunningMode == RunningMode.RealTime; } }
        private string FsOwnerMarker { get { return "G3|" + BotVersion + "|" + (OwnerInstanceId ?? "") + "|"; } }
        private bool FsOwned(Position p) { return p != null && p.Label == BotLabel && p.SymbolName == SymbolName && (p.Comment ?? "").StartsWith(FsOwnerMarker, StringComparison.Ordinal); }
        private bool FsOwned(PendingOrder o) { return o != null && o.Label == BotLabel && o.SymbolName == SymbolName && (o.Comment ?? "").StartsWith(FsOwnerMarker, StringComparison.Ordinal); }

        private static string FsBotDataRoot(string bot)
        {
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "cAlgo", "Data", "cBots", bot);
        }

        private void FsAlarm(string message)
        {
            Print("G3-ALARM: " + message);
            if (!FsLive || string.IsNullOrEmpty(_alarmDirectory)) return;
            try
            {
                Directory.CreateDirectory(_alarmDirectory);
                System.IO.File.AppendAllText(Path.Combine(_alarmDirectory, Server.Time.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + ".log"),
                    Server.Time.ToString("o", CultureInfo.InvariantCulture) + " G3-ALARM " + message.Replace("\r", " ").Replace("\n", " ") + Environment.NewLine,
                    new System.Text.UTF8Encoding(false));
            }
            catch { Print("G3-ALARM-PERSIST-FAILED"); }
        }

        private static string FsFileToken(string value)
        {
            return new string((value ?? "").Select(c => char.IsLetterOrDigit(c) || c == '-' || c == '_' ? c : '_').ToArray());
        }

        // ---- startup
        // F3: safety objects exist before anything that can throw; own unprotected exposure is registered/closed first.
        private void FsEnsureSafetyObjects()
        {
            if (_recovery != null) return;
            _recovery = new ProtectionRecovery(Math.Max(1, ProtectionEscalateAfter), Math.Max(1.0, ProtectionRetrySeconds));
            _recovery.Log = FsAlarm;
            _recovery.OnEscalate = m => { FsAlarm("ESCALATION " + m); Jr("error", null, "code", DailyJournal.Q("PROTECTION_CLOSE_ESCALATED"), "message", DailyJournal.Q(m)); };
            _flatten = new ProtectionRecovery(Math.Max(1, ProtectionEscalateAfter), Math.Max(1.0, ProtectionRetrySeconds));
            _flatten.Log = FsAlarm;
            _flatten.OnEscalate = m => { FsAlarm("CONTROLLED CLOSE ESCALATION " + m); Jr("error", null, "code", DailyJournal.Q("CONTROLLED_CLOSE_ESCALATED"), "message", DailyJournal.Q(m)); };
            _stopGuard = new StopModifyGuard(Math.Max(1.0, ProtectionRetrySeconds));
            _ownership = new OwnershipGuard();
            _ownership.OnFault = f =>
            {
                _reconciliationFault = f;
                FsAlarm(f + " -> entries locked; no foreign order touched");
                Jr("error", null, "code", DailyJournal.Q("RECONCILIATION_REQUIRED"), "message", DailyJournal.Q(f));
            };
        }

        // Own positions without SL/TP: register for recovery, latch the kill switch (if present) and attempt one verified close now.
        // Live callers must already hold the exclusive recovery lock; lock conflicts stay observational.
        private void FsRegisterStartExposure()
        {
            if (FsLive && !_fsRecoveryOwner) { FsAlarm("startup exposure observed without recovery ownership; no broker action permitted"); return; }
            foreach (Position p in Positions.FindAll(BotLabel, SymbolName))
            {
                if (!FsOwned(p)) continue;
                if (p.StopLoss.HasValue && p.TakeProfit.HasValue) continue;
                string reason = "unprotected position #" + p.Id + " found at start";
                DateTime eventUtc = Server.Time;
                if (_recovery.Contains(p.Id) || _startExposure.Any(r => r.Value.Contains("#" + p.Id + " "))) continue;
                _recovery.Register(p.Id, "unprotected position found at start", eventUtc);
                _startExposure.Add(new KeyValuePair<DateTime, string>(eventUtc, reason));
                if (_ks != null) _ks.OnProtectionFailure(eventUtc, reason);
                FsAlarm("unprotected position #" + p.Id + " at start -> close + entry lock");
                double beforeBalance = Account.Balance;
                if (FsTryClose(p.Id)) _recovery.Resolve(p.Id); else _recovery.NoteAttempt(p.Id, Server.Time);
                if (_ks != null) _ks.Update(Server.Time, Account.Equity, Account.Balance, Account.Balance - beforeBalance);
            }
        }

        // F3: called when the start sequence threw in live mode. Never rethrows; keeps serving exposure, no entries ever.
        private void FsEnterSafetyOnly(Exception ex)
        {
            _safetyOnlyReason = "start failed: " + ex.GetType().Name + ": " + ex.Message;
            try { FsEnsureSafetyObjects(); } catch { }
            try { FsAlarm("SAFETY-ONLY MODE: " + _safetyOnlyReason); } catch { }
            try { if (!FsLive || _fsRecoveryOwner) FsRegisterStartExposure(); else FsAlarm("SAFETY-ONLY PASSIVE: recovery lock not owned; no close/modify/state action"); } catch (Exception e2) { try { FsAlarm("safety-only exposure registration failed: " + e2.GetType().Name); } catch { } }
            try { if (_ownership != null) FsOwnershipCheck(); } catch { }
            try { Jr("error", null, "code", DailyJournal.Q("STARTUP_SAFETY_ONLY"), "message", DailyJournal.Q(_safetyOnlyReason)); } catch { }
        }

        private static string FsDayKey(DateTime utc) { return NyTime.DayKey(utc); }

        private void FsInitialize()
        {
            FsEnsureSafetyObjects();

            Print("G3-SYMBOL|name={0}|pipSize={1:R}|tickSize={2:R}|pipValue={3:R}|tickValue={4:R}|lotSize={5:R}|unitsMin={6:R}|unitsStep={7:R}|unitsMax={8:R}|asset={9}|accountLeverage={10:R}",
                SymbolName, Symbol.PipSize, Symbol.TickSize, Symbol.PipValue, Symbol.TickValue, Symbol.LotSize,
                Symbol.VolumeInUnitsMin, Symbol.VolumeInUnitsStep, Symbol.VolumeInUnitsMax, Account.Asset.Name, Account.PreciseLeverage);
            // v2.54-dev (B2): the probe reports the REAL parameter values (equity, risk %, caps, sizing mode) for a 100 broker-pip stop.
            double probeEquity = Account.Equity;
            double probeTarget = FsCapped(probeEquity * RiskPercentPerTrade / 100.0, RiskCapPerTradeAccount);
            double probeOneLotUnits = Symbol.QuantityToVolumeInUnits(1.0);
            double probeRiskOneLot = Symbol.AmountRisked(probeOneLotUnits, 100.0); // 100 broker pips = 10.00 XAUUSD at observed PipSize 0.1
            double probeRawUnits = SizingMode == SmcScalpSizingMode.RiskPercent
                ? (probeRiskOneLot > 0 ? probeOneLotUnits * probeTarget / probeRiskOneLot : 0)
                : Symbol.QuantityToVolumeInUnits(FixedLots);
            double probeUnits = Symbol.NormalizeVolumeInUnits(probeRawUnits, RoundingMode.Down);
            double probeActualRisk = probeUnits >= Symbol.VolumeInUnitsMin ? Symbol.AmountRisked(probeUnits, 100.0) : 0;
            Print("G3-SIZING-PROBE|sizingMode={0}|fixedLots={1:R}|equity={2:R}|riskPct={3:R}|riskCapEUR={4:R}|targetRiskEUR={5:R}|stopBrokerPips=100|oneLotUnits={6:R}|riskOneLotEUR={7:R}|units={8:R}|lots={9:R}|actualRiskEUR={10:R}",
                SizingMode, FixedLots, probeEquity, RiskPercentPerTrade, RiskCapPerTradeAccount, probeTarget, probeOneLotUnits, probeRiskOneLot, probeUnits, Symbol.VolumeInUnitsToQuantity(probeUnits), probeActualRisk);

            string botName = GetType().Name;
            if (FsLive) _alarmDirectory = Path.Combine(FsBotDataRoot(botName), "Alarms");
            string jdir = (JournalDirectory ?? "AUTO").Trim();
            if (jdir.Equals("AUTO", StringComparison.OrdinalIgnoreCase))
                jdir = FsLive ? Path.Combine(FsBotDataRoot(botName), "DailyJournal") : "OFF";
            if (!jdir.Equals("OFF", StringComparison.OrdinalIgnoreCase))
                _journal = new DailyJournal(jdir, botName, BotVersion, DailyJournal.NewInstanceId(), // F7: full 128-bit instance id
                    Account.Number.ToString(CultureInfo.InvariantCulture), SymbolName);

            // F3/F5: file lock + stores. Failures never throw: they lock entries and escalate (lock conflict is explicit).
            IStateStore ksStore = null, ledgerStore = null;
            if (FsLive)
            {
                try
                {
                    string sdir = (KsStateDirectory ?? "AUTO").Trim();
                    if (sdir.Equals("AUTO", StringComparison.OrdinalIgnoreCase)) sdir = Path.Combine(FsBotDataRoot(botName), "State");
                    // Recovery ownership is account-wide for this bot version and deliberately independent of the
                    // user-supplied OwnerInstanceId/state directory. Different IDs/paths must not create parallel owners.
                    string lockDir = string.IsNullOrEmpty(_fsRecoveryLockDirectoryOverride)
                        ? Path.Combine(FsBotDataRoot(botName), "RecoveryOwner") : _fsRecoveryLockDirectoryOverride;
                    Directory.CreateDirectory(lockDir);
                    _ksStateLock = new FileStream(Path.Combine(lockDir, "account-" + Account.Number.ToString(CultureInfo.InvariantCulture) + ".lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
                    _fsRecoveryOwner = true;
                    string stem = Path.Combine(sdir, "killswitch-" + Account.Number.ToString(CultureInfo.InvariantCulture) + "-" + FsFileToken(OwnerInstanceId));
                    Directory.CreateDirectory(sdir);
                    ksStore = new FileStateStore(stem + ".state");
                    ledgerStore = new FileStateStore(Path.Combine(sdir, "entries-" + Account.Number.ToString(CultureInfo.InvariantCulture) + "-" + FsFileToken(OwnerInstanceId) + ".state"));
                }
                catch (Exception ex)
                {
                    _startupFault = (ex is IOException ? "state lock/dir unavailable (another instance running?): " : "state init failed: ") + ex.GetType().Name;
                    FsAlarm("ESCALATE " + _startupFault);
                    Jr("error", null, "code", DailyJournal.Q("STATE_INIT_FAILED"), "message", DailyJournal.Q(_startupFault));
                }
            }
            else { _fsRecoveryOwner = true; ksStore = new MemoryStateStore(); ledgerStore = new MemoryStateStore(); } // a backtest must never read or write live state

            if (KsEnabled && ksStore != null)
            {
                var cfg = new KillSwitchConfig
                {
                    DailyLossPct = KsDailyLossPct, DailyLossAbs = KsDailyLossAbs, WeeklyLossPct = KsWeeklyLossPct, WeeklyLossAbs = KsWeeklyLossAbs,
                    MonthlyLossPct = KsMonthlyLossPct, MonthlyLossAbs = KsMonthlyLossAbs, MaxConsecutiveLosses = KsMaxConsecutiveLosses,
                    StopOnProtectionFailure = KsStopOnProtectionFailure, DailyAutoReset = KsDailyAutoReset, PeriodAutoReset = KsPeriodAutoReset,
                    AllowBootstrap = KsAllowBootstrap || !FsLive,
                    StrictBalance = FsLive,
                    ResetToken = string.Equals(KsResetToken, "NONE", StringComparison.OrdinalIgnoreCase) ? "" : (KsResetToken ?? "")
                };
                _ks = new KillSwitch(cfg, ksStore);
                _ks.Log = FsAlarm;
                _ks.OnTransition = (status, reason) => Jr("control", null, "kill_switch_status", DailyJournal.Q(status), "reason", DailyJournal.Q(reason));
                _ks.ReconciliationCheck = FsKsReconciliation;
                _ks.OnAutoReset = (latch, detail) => Jr("ks_auto_reset", null, "latch_type", DailyJournal.Q(latch), "detail", DailyJournal.Q(detail));
                _ks.OnAutoResetRefused = (latch, reason) => Jr("ks_auto_reset_refused", null, "latch_type", DailyJournal.Q(latch), "reason", DailyJournal.Q(reason));
                _ks.LoadOrBootstrap(Server.Time, Account.Equity, Account.Balance);
                // exposure registered before the KS existed still latches it
                foreach (KeyValuePair<DateTime, string> exposure in _startExposure) _ks.OnProtectionFailure(exposure.Key, exposure.Value);
            }

            if (ledgerStore != null)
            {
                _ledger = new EntryLedger(ledgerStore, KsAllowBootstrap || !FsLive);
                _ledger.Log = FsAlarm;
                _ledger.Load(FsDayKey(Server.Time));
                if (!_ledger.Loaded) Jr("error", null, "code", DailyJournal.Q("LEDGER_FAULT"), "message", DailyJournal.Q(_ledger.Fault));
            }

            // The exclusive owner may now mutate broker/state. A lock-conflicted instance remains passive even when
            // it observes the same owner marker and an unprotected position.
            if (_fsRecoveryOwner) FsRegisterStartExposure();

            // Fail closed on any account exposure this bot cannot attribute. Never close foreign positions blindly.
            FsOwnershipCheck();

            Jr("bot_start", null, "mode", DailyJournal.Q(RunningMode.ToString()), "kill_switch_enabled", KsEnabled ? "true" : "false",
               "kill_switch_status", DailyJournal.Q(_ks == null ? "off" : (_ks.AllowsEntries ? "ok" : _ks.BlockReason())),
               "atomic_protection", AtomicProtection ? "true" : "false", "equity", DailyJournal.N(Account.Equity), "currency", DailyJournal.Q(Account.Asset.Name));
        }

        // v2.59-dev: gate for the automatic release of the protection-failure latch. "" = clean; otherwise the refusal reason.
        // Clean means: recovery lock held, startup/safety-only/reconciliation faults absent, ledger loaded, no unattributed account
        // position or pending order, no own position without SL/TP, no open protection-recovery or controlled-close item.
        private string FsKsReconciliation()
        {
            if (FsLive && !_fsRecoveryOwner) return "recovery lock not held";
            if (_safetyOnlyReason.Length > 0) return "safety-only mode: " + _safetyOnlyReason;
            if (_startupFault.Length > 0) return "startup fault: " + _startupFault;
            if (_reconciliationFault.Length > 0) return "reconciliation fault: " + _reconciliationFault;
            if (_ownership != null && _ownership.Fault.Length > 0) return "ownership fault: " + _ownership.Fault;
            if (_ledger == null || !_ledger.Loaded) return "entry ledger unavailable";
            if (_recovery == null || _flatten == null) return "safety objects missing";
            if (_recovery.Count > 0) return "open protection-recovery close intent (" + _recovery.Count + ")";
            if (_flatten.Count > 0) return "open controlled-close intent (" + _flatten.Count + ")";
            foreach (Position p in Positions)
            {
                if (!FsOwned(p)) return "foreign position #" + p.Id.ToString(CultureInfo.InvariantCulture);
                if (!p.StopLoss.HasValue || !p.TakeProfit.HasValue) return "unprotected position #" + p.Id.ToString(CultureInfo.InvariantCulture);
            }
            foreach (PendingOrder o in PendingOrders)
                if (!FsOwned(o)) return "foreign pending order #" + o.Id.ToString(CultureInfo.InvariantCulture);
            return "";
        }

        // F6: account-wide, cheap; runs on every tick and before every order. Latches; never touches foreign items.
        private void FsOwnershipCheck()
        {
            if (_ownership == null) return;
            int fp = 0, fo = 0;
            foreach (Position p in Positions) if (!FsOwned(p)) fp++;
            foreach (PendingOrder o in PendingOrders) if (!FsOwned(o)) fo++;
            _ownership.Check(fp, fo);
        }

        // Live start conditions. Called from OnStart once the owner lifts the backtest-only guard; until then it is unreachable
        // because the RealTime guard stops the bot first.
        private void FsValidateLiveStart()
        {
            if (!Account.IsLive || Account.Number != 2077191 || !string.Equals(Account.Asset.Name, "EUR", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(SymbolName, "XAUUSD", StringComparison.OrdinalIgnoreCase) || Math.Abs(Account.PreciseLeverage - 30.0) > 1e-9)
                throw new InvalidOperationException("G3: exact live account contract mismatch (live account 2077191, EUR, XAUUSD, account leverage 1:30 required).");
            if (!KsEnabled || _ks == null)
                throw new InvalidOperationException("G3: live start requires Kill-Switch Enabled.");
            if (_ks == null || !(KsDailyLossAbs > 0 || KsDailyLossPct > 0) || !(KsWeeklyLossAbs > 0 || KsWeeklyLossPct > 0) || !(KsMonthlyLossAbs > 0 || KsMonthlyLossPct > 0))
                throw new InvalidOperationException("G3: live start requires daily, weekly and monthly loss limits.");
            if (_journal == null) throw new InvalidOperationException("G3: live start requires journaling (Journal Directory must not be OFF).");
            if (!_journal.Healthy) FsAlarm("journal unavailable at start; entries locked, protection management remains active");
            if (KsAllowBootstrap) throw new InvalidOperationException("G3: KS bootstrap is initialization-only; state was created/loaded, restart with bootstrap=False before trading.");
            if (!KsStopOnProtectionFailure) throw new InvalidOperationException("G3: live start requires Stop On Protection Failure.");
            // v2.59-dev (owner decision 2026-10-09): the bot is released again every NY day; KsDailyAutoReset / KsPeriodAutoReset are permitted live
            // (the v2.55 refusal of KsDailyAutoReset is removed). A protection latch still releases only on a clean reconciliation (FsKsReconciliation).
            if (string.IsNullOrWhiteSpace(OwnerInstanceId) || OwnerInstanceId == "NONE") throw new InvalidOperationException("G3: Owner Instance Id required.");
            if (!UseNewsFilter || !NewsLiveFailClosed) throw new InvalidOperationException("G3: live start requires the news filter, fail-closed.");
            // v2.54-dev (V52-1): a 0/0 HIGH window blocks only the exact release timestamp. Live needs a real window unless explicitly authorised.
            if (HighImpactMinutesBefore < 0 || HighImpactMinutesAfter < 0) throw new InvalidOperationException("G3: negative HIGH news window.");
            if (HighImpactMinutesBefore == 0 && HighImpactMinutesAfter == 0 && !AllowZeroHighNewsWindow)
                throw new InvalidOperationException("G3: live start requires a non-zero HIGH news entry window (before=" + HighImpactMinutesBefore + ", after=" + HighImpactMinutesAfter + "); 0/0 needs explicit AllowZeroHighNewsWindow=True.");
            // v2.54-dev (B2): FixedLotsWithRiskCap trades FixedLots whatever RiskPercentPerTrade says (the percentage is only a cap). A live start must
            // therefore use SizingMode=RiskPercent unless fixed lots are explicitly authorised.
            if (SizingMode == SmcScalpSizingMode.FixedLotsWithRiskCap && !AllowFixedLotsLive)
                throw new InvalidOperationException("G3: live start requires SizingMode=RiskPercent; FixedLotsWithRiskCap (FixedLots=" + FixedLots.ToString("R", CultureInfo.InvariantCulture) + ") ignores RiskPercentPerTrade and needs explicit AllowFixedLotsLive=True.");
            if (!AtomicProtection) throw new InvalidOperationException("G3: live start requires atomic SL/TP.");
            if (!SizingCrossCheck) throw new InvalidOperationException("G3: live start requires the sizing cross-check.");
            if (RiskCapPerTradeAccount <= 0 || MaxRiskCapAccount <= 0) throw new InvalidOperationException("G3: live start requires absolute EUR risk caps.");
            List<string> limitIssues = LimitConsistency.Check(RiskPercentPerTrade, MaximumRiskPercent, DailyRealizedLossLimitPercent, MaxConcurrentPositions,
                KsDailyLossPct, KsWeeklyLossPct, KsMonthlyLossPct, MaxMarginUsePercent);
            if (limitIssues.Count > 0) throw new InvalidOperationException("G3: inconsistent risk/limit parameters: " + string.Join("; ", limitIssues));
            Print("G3-LIMITS|riskPerTradePct={0:R}|maxRiskPct={1:R}|dailyRealizedLossPct={2:R}|maxConcurrent={3}|worstCaseOpenRiskPct={4:R}|marginUsePct={5:R}",
                RiskPercentPerTrade, MaximumRiskPercent, DailyRealizedLossLimitPercent, MaxConcurrentPositions, LimitConsistency.WorstCaseOpenRiskPct(MaximumRiskPercent, MaxConcurrentPositions), MaxMarginUsePercent);
        }

        private void FsOnStop()
        {
            // Only the exclusive recovery owner may perform final broker/state mutations.
            if (FsLive && !_fsRecoveryOwner)
            {
                try { FsAlarm("PASSIVE STOP: recovery lock not owned; no close or state write attempted"); } catch { }
                return;
            }
            // F3: a stop (also after a failed start) makes one last verified attempt for every queued item.
            try
            {
                foreach (ProtectionRecovery q in new[] { _recovery, _flatten })
                    if (q != null) foreach (int id in q.Ids()) { if (Positions.FindById(id) != null && FsTryClose(id)) q.Resolve(id); }
            }
            catch (Exception ex) { try { FsAlarm("final close attempt failed: " + ex.GetType().Name); } catch { } }
            try
            {
                int open = (_recovery == null ? 0 : _recovery.Count) + (_flatten == null ? 0 : _flatten.Count);
                if (open > 0) FsAlarm("STOPPED WITH " + open + " UNRESOLVED CLOSE ITEM(S) - manual action required");
                Jr("bot_stop", null, "kill_switch_status", DailyJournal.Q(_ks == null ? "off" : _ks.BlockReason()), "equity", DailyJournal.N(Account.Equity), "unresolved_close_items", open.ToString(CultureInfo.InvariantCulture));
            }
            catch { }
            try { if (_ks != null && _ks.Initialized) _ks.Persist(); } catch { }
            // Keep callbacks under the lock; then revoke logical ownership before making the OS lock available.
            try { Positions.Closed -= OnPositionClosed; } catch { }
            _fsRecoveryOwner = false;
            if (_ksStateLock != null) { try { _ksStateLock.Dispose(); } catch { } _ksStateLock = null; }
        }

        // ---- per tick
        private void FsOnTick()
        {
            DateTime now = Server.Time;
            FsOwnershipCheck();
            if (FsLive && !_fsRecoveryOwner) return;
            if (_ks != null)
            {
                _ks.Update(now, Account.Equity, Account.Balance, 0);
                string st = _ks.BlockReason();
                if (st != _lastKsStatusJournaled)
                {
                    _lastKsStatusJournaled = st;
                    if (st.Length > 0) FsAlarm(st);
                }
                if (_ks.MustFlatten) FsFlatten(now);
            }
            // F1: both queues are served on every tick, independent of the kill-switch latch and of the original trigger.
            SafetyTick.Run(now, _recovery, _flatten, id => Positions.FindById(id) != null, FsTryClose);
            if (_stopGuard != null) _stopGuard.Sweep(id => Positions.FindById(id) != null);
        }

        // Equity stop: no new requests, cancel own pendings, queue own positions for verified close (served by SafetyTick).
        private void FsFlatten(DateTime now)
        {
            if (FsLive && !_fsRecoveryOwner) { FsAlarm("flatten suppressed: recovery lock not owned"); return; }
            foreach (PendingOrder o in PendingOrders.Where(FsOwned).ToList())
            {
                TradeResult cancel = CancelPendingOrder(o);
                if (!cancel.IsSuccessful) { FsAlarm("pending cancel failed #" + o.Id); Jr("error", null, "code", DailyJournal.Q("CANCEL_FAILED"), "message", DailyJournal.Q("kill-switch pending cancellation failed")); }
            }
            foreach (Position p in Positions.FindAll(BotLabel, SymbolName).Where(FsOwned))
                _flatten.Register(p.Id, "kill-switch flatten", now);
        }

        // Verified close: true only when the broker no longer lists the position. Exceptions count as failure.
        private bool FsTryClose(int positionId)
        {
            if (FsLive && !_fsRecoveryOwner) { FsAlarm("close suppressed #" + positionId + ": recovery lock not owned"); return false; }
            try
            {
                Position p = Positions.FindById(positionId);
                if (p == null) return true;
                TradeResult r = ClosePosition(p);
                return r.IsSuccessful && Positions.FindById(positionId) == null;
            }
            catch (Exception ex) { FsAlarm("close exception #" + positionId + ": " + ex.GetType().Name); return false; }
        }

        private bool FsRequestClose(Position p, string reason)
        {
            if (p == null || !FsOwned(p)) return false;
            if (FsLive && !_fsRecoveryOwner) { FsAlarm("close request suppressed #" + p.Id + ": recovery lock not owned"); return false; }
            ManagedTrade managed;
            if (_managed.TryGetValue(p.Id, out managed))
            {
                managed.PendingCloseReason = reason ?? "controlled close";
                if (!FsLedgerSync(managed))
                {
                    FsAlarm("close request #" + p.Id + " not executed: pending intent could not be persisted");
                    return false;
                }
            }
            bool known = _flatten.Contains(p.Id);
            _flatten.Register(p.Id, reason, Server.Time);
            if (!known) Jr("position", FsKeyFor(p.Id), "position_event", DailyJournal.Q("close_requested"), "position_id", p.Id.ToString(CultureInfo.InvariantCulture), "reason", DailyJournal.Q(reason));
            _flatten.Tick(Server.Time, id => Positions.FindById(id) != null, FsTryClose);
            bool closed = Positions.FindById(p.Id) == null;
            // not closed: stays queued; FsOnTick serves the queue on every tick until the broker confirms.
            if (!closed) { FsAlarm(reason + " close failed #" + p.Id + "; entry lock + retry"); Jr("error", FsKeyFor(p.Id), "code", DailyJournal.Q("CLOSE_FAILED"), "message", DailyJournal.Q(reason)); }
            return closed;
        }

        // Combined entry gate (all fail-closed). Returns null when entries are allowed.
        private string FsEntryBlock()
        {
            if (_safetyOnlyReason.Length > 0) return "G3 safety-only mode (" + _safetyOnlyReason + ")";
            if (_startupFault.Length > 0) return "G3 startup fault: " + _startupFault;
            if (FsLive && !_fsRecoveryOwner) return "G3 recovery lock not owned";
            FsOwnershipCheck(); // F6: re-evaluated before every order
            if (_recovery != null && _recovery.EntriesLocked) return "G3 protection recovery active";
            if (_flatten != null && _flatten.EntriesLocked) return "G3 controlled close active";
            if (_stopGuard != null && _stopGuard.EntriesLocked) return "G3 stop modification fault";
            if (_ks != null && !_ks.AllowsEntries) return _ks.BlockReason();
            if (_ledger != null && !_ledger.Loaded) return "G3 entry ledger fault: " + _ledger.Fault;
            if (_sizingFault) return "G3 sizing fault: " + _sizingFaultText;
            if (_reconciliationFault.Length > 0) return "G3 reconciliation fault: " + _reconciliationFault;
            if (_journal != null && !_journal.Healthy) return "G3 journal unhealthy (" + _journal.LastError + ")";
            if (FsLive && NewsLiveFailClosed)
            {
                string news = LiveNewsBlock(); // re-poll and re-check immediately before every order
                if (news != null) return "G3 news block: " + news;
            }
            return null;
        }

        // ---- protection helpers
        private bool FsSecureProtection(Position position, SetupState s, double stop, double tp, DateTime decisionUtc)
        {
            int id = position.Id;
            PostFillResult res = PostFill.Secure(id, stop, tp, Symbol.TickSize,
                () => { Position q = Positions.FindById(id); return q == null ? new double?[] { null, null } : new double?[] { q.StopLoss, q.TakeProfit }; },
                () => { Position q = Positions.FindById(id); return q != null && ModifyPosition(q, stop, tp, ProtectionType.Absolute).IsSuccessful; },
                () => FsTryClose(id), _recovery, _ks, Server.Time, FsAlarm);
            if (res == PostFillResult.AlreadyProtected || res == PostFillResult.ProtectedByModify)
            {
                Position q = Positions.FindById(id);
                Jr("position", FsKeyFor(id), "position_event", DailyJournal.Q("protection_verified"), "position_id", id.ToString(CultureInfo.InvariantCulture), "result", DailyJournal.Q(res.ToString()),
                   "stop_loss", DailyJournal.N(q == null ? (double?)null : q.StopLoss), "take_profit", DailyJournal.N(q == null ? (double?)null : q.TakeProfit));
                return true;
            }
            Jr("error", FsKeyFor(id), "code", DailyJournal.Q("PROTECTION_" + res), "message", DailyJournal.Q("post-fill protection could not be verified"), "position_id", id.ToString(CultureInfo.InvariantCulture));
            if (res == PostFillResult.ModifyFailedCloseFailed)
            { s.Stage = SetupStage.ProtectionFailure; _nsProtectionFailures[id] = s; }
            else s.Reset();
            return false;
        }

        // Replacement for the former NS-only compensation: used by every post-fill protection failure path.
        private void FsCloseWithRecovery(Position position, SetupState state, string reason)
        {
            int id = position.Id;
            state.Stage = SetupStage.ProtectionFailure;
            _nsProtectionFailures[id] = state;
            _recovery.Register(id, reason, Server.Time);
            if (_ks != null) _ks.OnProtectionFailure(Server.Time, "#" + id + " " + reason);
            FsAlarm("protection failure #" + id + ": " + reason);
            Jr("error", FsKeyFor(id), "code", DailyJournal.Q("POSTFILL_INVALID"), "message", DailyJournal.Q(reason), "position_id", id.ToString(CultureInfo.InvariantCulture));
            if (FsTryClose(id)) { _recovery.Resolve(id); _nsProtectionFailures.Remove(id); state.Reset(); }
            else _recovery.NoteAttempt(id, Server.Time);
        }

        // Called every tick: states whose recovery finished are released.
        private void FsReleaseRecovered()
        {
            foreach (var kv in _nsProtectionFailures.ToList())
                if (Positions.FindById(kv.Key) == null) { _nsProtectionFailures.Remove(kv.Key); kv.Value.Reset(); }
        }

        // ---- sizing
        private double FsCapped(double amount, double cap) { return cap > 0 ? Math.Min(amount, cap) : amount; }

        private bool FsSizingAgrees(double units, double stopSymbolPips, double stopPriceDistance)
        {
            if (!SizingCrossCheck) return true;
            string detail;
            double risk = Symbol.AmountRisked(units, stopSymbolPips);
            bool ok = Sizing.RiskViewsAgree(risk, units, stopSymbolPips, Symbol.PipValue, Symbol.TickValue, Symbol.TickSize, stopPriceDistance, SizingCrossCheckTolerance, out detail);
            if (!ok && !_sizingFault)
            {
                _sizingFault = true; _sizingFaultText = detail;
                FsAlarm("sizing cross-check failed: " + detail);
                Jr("error", null, "code", DailyJournal.Q("SIZING_MISMATCH"), "message", DailyJournal.Q(detail));
            }
            return ok;
        }

        // ---- v2.54-dev live news (F1): ONE refresh/publication path for tick, entry guard and pre-order guard.
        private LiveNewsGate _liveNews;
        private string _lastLiveNewsFault = "";

        private NewsWindows LiveNewsWindows()
        {
            return new NewsWindows
            {
                HighBefore = HighImpactMinutesBefore, HighAfter = HighImpactMinutesAfter,
                MediumBefore = MediumImpactMinutesBefore, MediumAfter = MediumImpactMinutesAfter,
                CloseBefore = CloseHighNewsMinutesBefore, MaxAgeMinutes = NewsMaxStaleMinutes, BlockMedium = BlockMediumImpactNews
            };
        }

        // Polls (60 s throttle unless forced), publishes any newly accepted snapshot into the bot state (events, coverage), refreshes
        // freshness/status and returns the current block reason (null = entries permitted), including the EXACT event windows.
        private string LiveNewsRefresh(bool force)
        {
            if (_liveNews == null) { _newsCoverageOk = false; _lastNewsSuccessUtc = DateTime.MinValue; return "news live feed not initialised"; }
            LiveNewsSnapshot published = _liveNews.Refresh(Server.Time, force);
            if (published != null) LiveNewsPublish(published);
            LiveNewsFeed feed = _liveNews.Feed; LiveNewsSnapshot s = feed.Current;
            // age is always measured from the snapshot's own source_as_of_utc: a reload can never rejuvenate it
            _lastNewsSuccessUtc = (feed.Fault != null || s == null) ? DateTime.MinValue : s.SourceAsOfUtc;
            _newsCoverageOk = true;   // coverage/tentative/future/event windows are judged by the gate before every entry
            string block = _liveNews.Check(Server.Time, LiveNewsWindows());
            _newsStatus = block == null ? "LIVE " + (s == null ? 0 : s.Events.Count) + " events as_of " + (s == null ? "-" : s.SourceAsOfUtc.ToString("MM-dd HH:mm", CultureInfo.InvariantCulture)) : "LIVE BLOCK: " + block;
            if (feed.Fault != null && _lastLiveNewsFault != feed.Fault) { _lastLiveNewsFault = feed.Fault; FsAlarm("NEWS fail-closed: " + feed.Fault); }
            if (feed.Fault == null) _lastLiveNewsFault = "";
            return block;
        }

        // Tick entry point; tick, entry and pre-order guards all go through the single LiveNewsRefresh().
        private void LiveNewsPoll(bool force)
        {
            LiveNewsRefresh(force);
        }

        // Used by the entry gate and immediately before every order: re-polls, publishes, then checks health AND event windows.
        private string LiveNewsBlock()
        {
            return LiveNewsRefresh(false);
        }

        // v2.54-dev (V52-2): the single production path between the last entry gate and the broker request.
        // Returns null (and sends NOTHING) when the gate blocks; the reason is returned in block.
        private TradeResult FsGuardedMarketOrder(TradeType tradeType, double volume, double? slPips, double? tpPips, string comment, out string block)
        {
            block = FsEntryBlock();
            if (block != null) return null;
            _pendingReqBid = Symbol.Bid; _pendingReqAsk = Symbol.Ask;
            return ExecuteMarketOrder(tradeType, SymbolName, volume, BotLabel, slPips, tpPips, comment);
        }

        // ---- news
        private string FsLiveNewsBlock(DateTime utc)
        {
            if (!FsLive || !NewsLiveFailClosed) return null;
            return NewsGuard.LiveBlock(true, UseNewsFilter, _lastNewsSuccessUtc != DateTime.MinValue, _lastNewsSuccessUtc, utc, NewsMaxStaleMinutes, _newsCoverageOk);
        }

        private void FsJournalNewsBlock(string reason, DateTime utc)
        {
            string id = reason + "@" + utc.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
            if (id == _lastNewsBlockJournaled) return;
            _lastNewsBlockJournaled = id;
            if (reason.Length > 0) Jr("news_block", null, "reason", DailyJournal.Q(reason), "reference", DailyJournal.Q(_nextNewsText));
        }

        // ---- journal
        private string FsKeyFor(int positionId) { string k; return _fsTradeKey.TryGetValue(positionId, out k) ? k : null; }

        private void Jr(string type, string key, params string[] kv)
        {
            if (_journal == null) return;
            var f = new List<KeyValuePair<string, string>>();
            for (int i = 0; i + 1 < kv.Length; i += 2) f.Add(new KeyValuePair<string, string>(kv[i], kv[i + 1]));
            _journal.Write(Server.Time, type, key, f);
        }

        private bool FsJournalOpened(Position p, double stop, double tp, string setupType, DateTime decisionUtc)
        {
            string key = decisionUtc.ToString("yyyyMMddTHHmmss", CultureInfo.InvariantCulture) + "|" + (p.TradeType == TradeType.Buy ? "L" : "S") + "|" + setupType + "|" + p.Id.ToString(CultureInfo.InvariantCulture);
            _fsTradeKey[p.Id] = key;
            _fsRequest[p.Id] = new[] { _pendingReqBid, _pendingReqAsk, p.VolumeInUnits };
            Jr("position", key, "position_event", DailyJournal.Q("opened"), "position_id", p.Id.ToString(CultureInfo.InvariantCulture),
               "side", DailyJournal.Q(p.TradeType.ToString()), "volume", DailyJournal.N(p.VolumeInUnits), "volume_unit", DailyJournal.Q("units"),
               "price", DailyJournal.N(p.EntryPrice), "stop_loss", DailyJournal.N(p.StopLoss), "take_profit", DailyJournal.N(p.TakeProfit),
               "protection_orders_set", (p.StopLoss.HasValue && p.TakeProfit.HasValue) ? "true" : "false",
               "request_bid", DailyJournal.N(_pendingReqBid), "request_ask", DailyJournal.N(_pendingReqAsk));
            return FsLedgerRecordFill(p, key);
        }

        private void FsJournalClosed(Position position)
        {
            if (_ks != null)
            {
                // Reconcile the realised balance delta before persisting the loss counter. This avoids
                // misclassifying the trade as external cashflow after a crash between callback and tick.
                _ks.Update(Server.Time, Account.Equity, Account.Balance, position.NetProfit);
                _ks.OnTradeClosed(Server.Time, position.NetProfit);
            }
            FsLedgerRemove(position.Id);
            if (_journal == null) return;
            string key = FsKeyFor(position.Id);
            double[] req; _fsRequest.TryGetValue(position.Id, out req);
            double? slip = null; double? spread = null;
            if (req != null)
            {
                slip = position.TradeType == TradeType.Buy ? Math.Max(0, position.EntryPrice - req[1]) : Math.Max(0, req[0] - position.EntryPrice);
                spread = req[1] - req[0];
            }
            HistoricalTrade h = History.LastOrDefault(x => x.PositionId == position.Id);
            Jr("trade", key, "position_id", position.Id.ToString(CultureInfo.InvariantCulture),
               "side", DailyJournal.Q(position.TradeType.ToString()), "volume", DailyJournal.N(position.VolumeInUnits), "volume_unit", DailyJournal.Q("units"),
               "entry_time", DailyJournal.Q(DailyJournal.T(position.EntryTime)), "entry_price", DailyJournal.N(position.EntryPrice),
               "exit_time", DailyJournal.Q(DailyJournal.T(h != null ? h.ClosingTime : Server.Time)), "exit_price", DailyJournal.N(h != null ? (double?)h.ClosingPrice : null),
               "gross_pnl", DailyJournal.N(position.GrossProfit), "commission", DailyJournal.N(position.Commissions), "swap", DailyJournal.N(position.Swap),
               "net_pnl", DailyJournal.N(position.NetProfit), "currency", DailyJournal.Q(Account.Asset.Name),
               "slippage", DailyJournal.N(slip), "slippage_unit", DailyJournal.Q("price"),
               "slippage_reference", DailyJournal.Q("long: max(0,fill-requestAsk); short: max(0,requestBid-fill)"),
               "spread", DailyJournal.N(spread), "spread_unit", DailyJournal.Q("price"),
               "protection_orders_set", position.StopLoss.HasValue ? "true" : "false",
               "stop_loss", DailyJournal.N(position.StopLoss), "take_profit", DailyJournal.N(position.TakeProfit));
            _fsTradeKey.Remove(position.Id); _fsRequest.Remove(position.Id);
        }

        // ---- F4: unified stop modification (SL moves). Verifies SL and TP by readback; every failure path is handled.
        private bool FsStopModify(Position position, double candidate)
        {
            int id = position.Id;
            double? prevTp = position.TakeProfit;
            StopModifyOutcome outcome = _stopGuard.Apply(id, candidate, position.StopLoss, prevTp, Symbol.TickSize,
                () => { Position q = Positions.FindById(id); return q == null ? null : new double?[] { q.StopLoss, q.TakeProfit }; },
                () => { Position q = Positions.FindById(id); return q != null && ModifyPosition(q, candidate, prevTp, ProtectionType.Absolute).IsSuccessful; },
                () => FsTryClose(id), _recovery, _ks, Server.Time, FsAlarm);
            if (outcome == StopModifyOutcome.Applied)
            {
                Position rb = Positions.FindById(id);
                if (rb != null)
                    Jr("position", FsKeyFor(id), "position_event", DailyJournal.Q("modified"), "position_id", id.ToString(CultureInfo.InvariantCulture),
                       "volume", DailyJournal.N(rb.VolumeInUnits), "price", DailyJournal.N(rb.StopLoss), "stop_loss", DailyJournal.N(rb.StopLoss), "take_profit", DailyJournal.N(rb.TakeProfit),
                       "protection_orders_set", "true");
                return true;
            }
            if (outcome != StopModifyOutcome.Throttled && outcome != StopModifyOutcome.PositionGone)
                Jr("error", FsKeyFor(id), "code", DailyJournal.Q("STOP_MODIFY_" + outcome), "message", DailyJournal.Q("stop modification not verified"), "position_id", id.ToString(CultureInfo.InvariantCulture));
            return false;
        }

        // F5 final check: the NORMALISED / read-back stop must respect the configured risk cap (no invented limits).
        private bool FsFinalRiskOk(Position position, double normalizedStop, double capAmount)
        {
            Position q = Positions.FindById(position.Id) ?? position;
            double entry = q.EntryPrice;
            double? rbStop = q.StopLoss;
            double normPips = Math.Abs(entry - normalizedStop) / Symbol.PipSize;
            if (!RiskCap.WithinCap(Symbol.AmountRisked(q.VolumeInUnits, normPips), capAmount)) return false;
            if (!rbStop.HasValue) return false;
            double rbPips = Math.Abs(entry - rbStop.Value) / Symbol.PipSize;
            return RiskCap.WithinCap(Symbol.AmountRisked(q.VolumeInUnits, rbPips), capAmount);
        }

        // ---- F5: persistent entry ledger / runner lifecycle
        private static string FsD(double v) { return v.ToString("R", CultureInfo.InvariantCulture); }
        private static double FsP(string s) { return double.Parse(s, NumberStyles.Float, CultureInfo.InvariantCulture); }

        private void FsLedgerFault()
        {
            if (_ledger != null && !_ledger.Loaded) { FsAlarm("LEDGER FAULT: " + _ledger.Fault + " -> entries locked"); Jr("error", null, "code", DailyJournal.Q("LEDGER_FAULT"), "message", DailyJournal.Q(_ledger.Fault)); }
        }

        private bool FsLedgerRecordFill(Position p, string key)
        {
            if (_ledger == null || !_ledger.Loaded) return false;
            double[] req; _fsRequest.TryGetValue(p.Id, out req);
            var f = new Dictionary<string, string>
            {
                { "complete", "0" }, { "day", _ledger.DayKey }, { "tradeKey", key ?? "" }, { "dir", p.TradeType == TradeType.Buy ? "1" : "-1" },
                { "entry", FsD(p.EntryPrice) }, { "reqBid", req == null ? "" : FsD(req[0]) }, { "reqAsk", req == null ? "" : FsD(req[1]) }, { "reqVol", req == null ? "" : FsD(req[2]) }
            };
            bool ok = _ledger.RecordFill(p.Id, f);
            _tradesToday = _ledger.Entries;
            if (!ok) FsLedgerFault();
            return ok;
        }

        private void FsLedgerLosses(int n) { if (_ledger == null) return; _ledger.SetLosses(n); FsLedgerFault(); }
        private void FsLedgerRollDay(DateTime nyDate) { if (_ledger == null) return; _ledger.RollDay(nyDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)); FsLedgerFault(); }
        private void FsLedgerRemove(int id) { _fsLedgerSig.Remove(id); if (_ledger == null) return; _ledger.Remove(id); FsLedgerFault(); }

        // Persist the full lifecycle of a managed trade. MFE/MAE are stored floored to whole strategy pips (write only on change).
        private bool FsLedgerSync(ManagedTrade m)
        {
            if (_ledger == null || !_ledger.Loaded) return false;
            string sig = (m.Tp1Taken ? "1" : "0") + (m.BreakEvenApplied ? "1" : "0") + (m.TimeStopApplied ? "1" : "0") + (m.Tp1ClosePending ? "1" : "0") + "|" + FsD(m.Tp1RemainingVolume) + "|" + Math.Floor(m.MaxFavorablePips).ToString(CultureInfo.InvariantCulture) + "|" + Math.Floor(m.MaxAdversePips).ToString(CultureInfo.InvariantCulture) + "|" + FsD(m.LastProtectedSwing) + "|" + (m.ExitOverride ?? "") + "|" + (m.PendingCloseReason ?? "");
            string old;
            if (_fsLedgerSig.TryGetValue(m.PositionId, out old) && old == sig) return true;
            Dictionary<string, string> prev;
            _ledger.Positions.TryGetValue(m.PositionId, out prev);
            double[] req; _fsRequest.TryGetValue(m.PositionId, out req);
            var f = new Dictionary<string, string>
            {
                { "complete", "1" }, { "day", prev != null && prev.ContainsKey("day") ? prev["day"] : _ledger.DayKey }, { "tradeKey", FsKeyFor(m.PositionId) ?? (prev != null && prev.ContainsKey("tradeKey") ? prev["tradeKey"] : "") },
                { "dir", m.Direction.ToString(CultureInfo.InvariantCulture) }, { "entry", FsD(m.EntryPrice) }, { "initStop", FsD(m.InitialStop) }, { "initRisk", FsD(m.InitialRiskPrice) },
                { "entryTime", m.EntryTimeUtc.ToString("o", CultureInfo.InvariantCulture) }, { "score", m.Score.ToString(CultureInfo.InvariantCulture) },
                { "setupType", m.SetupType ?? "" }, { "liqName", m.LiquidityName ?? "" }, { "liqPrice", FsD(m.LiquidityPrice) }, { "setupName", m.SetupName ?? "" }, { "targetName", m.TargetName ?? "" },
                { "zoneLow", FsD(m.ZoneLow) }, { "zoneHigh", FsD(m.ZoneHigh) }, { "zoneQ", m.ZoneQuality.ToString(CultureInfo.InvariantCulture) },
                { "tp1Price", FsD(m.Tp1Price) }, { "tp1Pips", FsD(m.Tp1Pips) }, { "tp1Name", m.Tp1Name ?? "" }, { "tp2Price", FsD(m.Tp2Price) }, { "tp2Pips", FsD(m.Tp2Pips) }, { "tp2Name", m.Tp2Name ?? "" },
                { "origVol", FsD(m.OriginalVolumeInUnits) },
                { "tp1Taken", m.Tp1Taken ? "1" : "0" }, { "tp1Pending", m.Tp1ClosePending ? "1" : "0" }, { "tp1Remaining", FsD(m.Tp1RemainingVolume) },
                { "beApplied", m.BreakEvenApplied ? "1" : "0" }, { "timeStop", m.TimeStopApplied ? "1" : "0" },
                { "mfe", FsD(Math.Floor(m.MaxFavorablePips)) }, { "mae", FsD(Math.Floor(m.MaxAdversePips)) }, { "lastSwing", FsD(m.LastProtectedSwing) }, { "exitOverride", m.ExitOverride ?? "" }, { "pendingClose", m.PendingCloseReason ?? "" },
                { "reqBid", req == null ? (prev != null && prev.ContainsKey("reqBid") ? prev["reqBid"] : "") : FsD(req[0]) },
                { "reqAsk", req == null ? (prev != null && prev.ContainsKey("reqAsk") ? prev["reqAsk"] : "") : FsD(req[1]) },
                { "reqVol", req == null ? (prev != null && prev.ContainsKey("reqVol") ? prev["reqVol"] : "") : FsD(req[2]) }
            };
            bool ok = _ledger.Set(m.PositionId, f);
            if (!ok) { FsLedgerFault(); return false; }
            _fsLedgerSig[m.PositionId] = sig;
            return true;
        }

        // Rebuilds a managed trade from the ledger. Returns null (-> safety-only for this position) when no complete,
        // consistent record exists; the caller then raises a reconciliation fault instead of guessing from SL/volume.
        private ManagedTrade FsRestoreManaged(Position p, out string why)
        {
            why = null;
            Dictionary<string, string> f;
            if (_ledger == null || !_ledger.Loaded) { why = "ledger unavailable"; return null; }
            if (!_ledger.Positions.TryGetValue(p.Id, out f)) { why = "no ledger record"; return null; }
            try
            {
                if (!f.ContainsKey("complete") || f["complete"] != "1") { why = "ledger record incomplete (crash between fill and lifecycle record)"; return null; }
                int dir = int.Parse(f["dir"], CultureInfo.InvariantCulture);
                if (dir != (p.TradeType == TradeType.Buy ? 1 : -1) || !PostFill.Matches(p.EntryPrice, FsP(f["entry"]), Symbol.TickSize)) { why = "ledger record does not match broker position"; return null; }
                DateTime et = DateTime.Parse(f["entryTime"], CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);
                var m = new ManagedTrade
                {
                    PositionId = p.Id, Direction = dir, EntryPrice = FsP(f["entry"]), InitialStop = FsP(f["initStop"]), InitialRiskPrice = FsP(f["initRisk"]),
                    EntryExecIndex = Math.Max(0, _exec.OpenTimes.GetIndexByTime(et)), EntryTimeUtc = et, Score = int.Parse(f["score"], CultureInfo.InvariantCulture),
                    SetupType = f["setupType"], LiquidityName = f["liqName"], LiquidityPrice = FsP(f["liqPrice"]), SetupName = f["setupName"], TargetName = f["targetName"],
                    ZoneLow = FsP(f["zoneLow"]), ZoneHigh = FsP(f["zoneHigh"]), ZoneQuality = int.Parse(f["zoneQ"], CultureInfo.InvariantCulture),
                    Tp1Price = FsP(f["tp1Price"]), Tp1Pips = FsP(f["tp1Pips"]), Tp1Name = f["tp1Name"], Tp2Price = FsP(f["tp2Price"]), Tp2Pips = FsP(f["tp2Pips"]), Tp2Name = f["tp2Name"],
                    OriginalVolumeInUnits = FsP(f["origVol"]),
                    Tp1Taken = f["tp1Taken"] == "1", Tp1ClosePending = f.ContainsKey("tp1Pending") && f["tp1Pending"] == "1",
                    Tp1RemainingVolume = f.ContainsKey("tp1Remaining") ? FsP(f["tp1Remaining"]) : 0,
                    BreakEvenApplied = f["beApplied"] == "1", TimeStopApplied = f["timeStop"] == "1",
                    MaxFavorablePips = FsP(f["mfe"]), MaxAdversePips = FsP(f["mae"]), LastProtectedSwing = FsP(f["lastSwing"]), ExitOverride = f["exitOverride"].Length == 0 ? null : f["exitOverride"],
                    PendingCloseReason = f.ContainsKey("pendingClose") && f["pendingClose"].Length > 0 ? f["pendingClose"] : null
                };
                if (!(m.InitialRiskPrice > 0) || double.IsNaN(m.InitialRiskPrice)) { why = "ledger record invalid initial risk"; return null; }
                bool currentPartialPolicy = UseTp1PartialClose && Tp1ClosePercent > 0 && Tp1ClosePercent < 100;
                if (m.Tp1ClosePending || currentPartialPolicy)
                {
                    double expected = m.Tp1RemainingVolume;
                    if (!(expected > 0) && currentPartialPolicy)
                        expected = Symbol.NormalizeVolumeInUnits(m.OriginalVolumeInUnits * (1.0 - Tp1ClosePercent / 100.0), RoundingMode.Down);
                    if (!(expected >= Symbol.VolumeInUnitsMin)) { why = "pending TP1 intent lacks a valid expected remainder"; return null; }
                    double tol = Math.Max(Symbol.VolumeInUnitsStep / 2.0, 1e-9);
                    bool full = Math.Abs(p.VolumeInUnits - m.OriginalVolumeInUnits) <= tol;
                    bool partial = Math.Abs(p.VolumeInUnits - expected) <= tol;
                    if (!full && !partial) { why = "broker volume does not match full or TP1 remainder"; return null; }
                    bool needsReconcile = m.Tp1ClosePending || (m.Tp1Taken != partial);
                    if (needsReconcile)
                    {
                        m.Tp1Taken = partial; m.Tp1ClosePending = false; m.Tp1RemainingVolume = expected;
                        if (!FsLedgerSync(m)) { why = "TP1 volume reconciliation could not be persisted"; return null; }
                    }
                }
                else
                {
                    double tol = Math.Max(Symbol.VolumeInUnitsStep / 2.0, 1e-9);
                    if (p.VolumeInUnits > m.OriginalVolumeInUnits + tol) { why = "broker volume exceeds original volume"; return null; }
                    // A legacy record has no expected remainder. Any observed reduction is treated as already executed,
                    // never retried, because broker volume is the only durable truth available.
                    if (p.VolumeInUnits < m.OriginalVolumeInUnits - tol && !m.Tp1Taken)
                    {
                        m.Tp1Taken = true; m.Tp1RemainingVolume = p.VolumeInUnits;
                        if (!FsLedgerSync(m)) { why = "legacy TP1 remainder reconciliation could not be persisted"; return null; }
                    }
                }
                _fsTradeKey[p.Id] = f["tradeKey"].Length > 0 ? f["tradeKey"] : "recovered|" + p.Id.ToString(CultureInfo.InvariantCulture);
                if (f["reqBid"].Length > 0 && f["reqAsk"].Length > 0 && f["reqVol"].Length > 0) _fsRequest[p.Id] = new[] { FsP(f["reqBid"]), FsP(f["reqAsk"]), FsP(f["reqVol"]) };
                var sig = (m.Tp1Taken ? "1" : "0") + (m.BreakEvenApplied ? "1" : "0") + (m.TimeStopApplied ? "1" : "0") + (m.Tp1ClosePending ? "1" : "0") + "|" + FsD(m.Tp1RemainingVolume) + "|" + Math.Floor(m.MaxFavorablePips).ToString(CultureInfo.InvariantCulture) + "|" + Math.Floor(m.MaxAdversePips).ToString(CultureInfo.InvariantCulture) + "|" + FsD(m.LastProtectedSwing) + "|" + (m.ExitOverride ?? "") + "|" + (m.PendingCloseReason ?? "");
                _fsLedgerSig[p.Id] = sig;
                return m;
            }
            catch (Exception ex) { why = "ledger record unreadable (" + ex.GetType().Name + ")"; return null; }
        }

        // F3/F5: the start sequence after market data/state objects exist. Any exception here is handled by StartupGuard
        // (live: safety-only mode). Order matters: safety objects + exposure registration come before anything fallible.
        private void FsStartSequence()
        {
            ResetNyDay(Server.Time, true);
            FsInitialize();
            RecoverManagedPositions();     // lifecycle from ledger, never from SL/volume guesses
            if (_ledger != null && _ledger.Loaded)
            {
                _tradesToday = _ledger.EffectiveEntriesToday;   // same-day restart keeps the entry cap
                _consecutiveLosses = _ledger.ConsecutiveLosses;
            }
            Positions.Closed += OnPositionClosed;
            if (FsLive) FsValidateLiveStart();
        }

        // Returns true when the tick was fully handled by the safety-only mode.
        private bool FsSafetyOnlyTick()
        {
            if (_safetyOnlyReason.Length == 0) return false;
            try { FsOnTick(); FsReleaseRecovered(); } catch (Exception ex) { Print("G3 safety-only tick error: " + ex.GetType().Name); }
            return true;
        }

        private void RecoverManagedPositions()
        {
            var live = new HashSet<int>();
            foreach (Position p in Positions.FindAll(BotLabel, SymbolName))
            {
                if (!FsOwned(p)) continue;
                live.Add(p.Id);
                if (!p.StopLoss.HasValue || !p.TakeProfit.HasValue) { _reconciliationFault = "owned position lacks SL/TP"; continue; }
                string why;
                ManagedTrade m = FsRestoreManaged(p, out why);
                if (m == null)
                {
                    // F5: not reconstructable -> safety-only reconciliation for this position (broker SL/TP stay in force), entries locked.
                    _reconciliationFault = "owned position #" + p.Id + " not reconstructable: " + why;
                    FsAlarm(_reconciliationFault + " -> position left to its broker SL/TP, entries locked");
                    Jr("error", null, "code", DailyJournal.Q("RESTORE_FAILED"), "message", DailyJournal.Q(_reconciliationFault), "position_id", p.Id.ToString(CultureInfo.InvariantCulture));
                    continue;
                }
                _managed[p.Id] = m;
                if (!string.IsNullOrEmpty(m.PendingCloseReason))
                {
                    _flatten.Register(p.Id, m.PendingCloseReason, Server.Time);
                    FsAlarm("restored pending close #" + p.Id + " (" + m.PendingCloseReason + ") -> queued before regular management");
                }
                Jr("position", FsKeyFor(p.Id), "position_event", DailyJournal.Q("recovered_from_ledger"), "position_id", p.Id.ToString(CultureInfo.InvariantCulture),
                   "tp1_taken", m.Tp1Taken ? "true" : "false", "break_even_applied", m.BreakEvenApplied ? "true" : "false", "volume", DailyJournal.N(p.VolumeInUnits),
                   "stop_loss", DailyJournal.N(p.StopLoss), "take_profit", DailyJournal.N(p.TakeProfit));
            }
            // records of positions that closed while the bot was offline
            if (_ledger != null && _ledger.Loaded)
                foreach (int id in _ledger.Positions.Keys.ToList())
                    if (!live.Contains(id)) FsLedgerRemove(id);
        }

    }
}
