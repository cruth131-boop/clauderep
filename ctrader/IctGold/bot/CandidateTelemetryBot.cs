using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using cAlgo.API;
using CandidateTelemetry;
using NewSetups;

namespace cAlgo.Robots
{
    // Observer-only wiring. It does not call an order/position API and owns no strategy state.
    public partial class IctGoldV259Dev
    {
        [Parameter("Candidate Shadow Evaluation", DefaultValue = false, Group = "12 Candidate Telemetry")]
        public bool ShadowEvalEnabled { get; set; }
        [Parameter("Shadow OTE Detector", DefaultValue = false, Group = "12 Candidate Telemetry")]
        public bool ShadowOteDetectorEnabled { get; set; }
        [Parameter("Shadow ATM Detector", DefaultValue = false, Group = "12 Candidate Telemetry")]
        public bool ShadowAtmDetectorEnabled { get; set; }

        private CandidateRegistry _candRegistry;
        private readonly List<CandidateSnapshot> _candShadowPending = new List<CandidateSnapshot>();
        private readonly HashSet<string> _candShadowOteSeen = new HashSet<string>(StringComparer.Ordinal);
        private readonly HashSet<string> _candShadowAtmSeen = new HashSet<string>(StringComparer.Ordinal);
        private Bars _candM1;

        private void CandInitialize()
        {
            if (_candRegistry != null) return;
            string run = "IctGoldV259Dev-" + Server.Time.ToUniversalTime().ToString("yyyyMMddTHHmmss", CultureInfo.InvariantCulture);
            _candRegistry = new CandidateRegistry(run);
            if (ShadowEvalEnabled) _candM1 = MarketData.GetBars(TimeFrame.Minute, SymbolName);
            Print("CAND_SCHEMA|schema_version={0}|terminal_enum={1}|shadow_rr=1.0,1.2,1.5,1.6,2.0,3.0|bid_bars=true|spread_pips=2",
                CandidateRegistry.SchemaVersion, string.Join(",", Enum.GetValues(typeof(CandidateTerminalStage)).Cast<CandidateTerminalStage>().Select(CandidateRegistry.EnumName)));
        }

        private string CandBeginPattern(Pattern p, DateTime detectUtc)
        {
            CandInitialize();
            string module = NsModP(p);
            var c = _candRegistry.Begin(module, detectUtc, p == null ? "invalid" : p.Id, p == null ? 0 : p.Direction,
                p == null ? "na" : p.Core, p == null ? "na" : p.Core, "native");
            c.Session = SessionName(detectUtc);
            c.KnownAt = detectUtc.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture);
            return c.CandidateId;
        }

        private void CandBind(SetupState s, string candidateId, DateTime detectUtc)
        {
            if (s == null) return;
            CandInitialize();
            s.CandidateTelemetryId = candidateId;
            s.CandidateResetSink = CandReset;
            var c = _candRegistry.Find(candidateId);
            if (c == null) return;
            c.Lane = string.IsNullOrEmpty(s.SetupType) ? "LiquiditySweep" : s.SetupType;
            c.Core = string.IsNullOrEmpty(s.NsCore) ? "PARENT" : s.NsCore;
            c.Policy = s.NsOte ? "OTE" : "native";
            c.Session = SessionName(detectUtc);
            c.HtfBias = s.Direction > 0 ? "bull" : s.Direction < 0 ? "bear" : "na";
            c.PremiumDiscount = s.Zone == null ? "na" : s.Zone.InCorrectPremiumDiscount ? (s.Direction > 0 ? "discount" : "premium") : "eq";
            c.ZoneWidth = s.Zone == null ? (double?)null : s.Zone.High - s.Zone.Low;
        }

        private void CandEnsureState(SetupState s, DateTime detectUtc)
        {
            CandInitialize();
            if (!string.IsNullOrEmpty(s.CandidateTelemetryId) && _candRegistry.Find(s.CandidateTelemetryId) != null) return;
            string module = NsMod(s);
            string formation = !string.IsNullOrEmpty(s.NsId) ? s.NsId : (string.IsNullOrEmpty(s.SetupType) ? "PARENT" : s.SetupType) + "|" + s.Direction + "|" + detectUtc.Ticks;
            var c = _candRegistry.Begin(module, detectUtc, formation, s.Direction,
                string.IsNullOrEmpty(s.SetupType) ? "LiquiditySweep" : s.SetupType,
                string.IsNullOrEmpty(s.NsCore) ? "PARENT" : s.NsCore, s.NsOte ? "OTE" : "native");
            CandBind(s, c.CandidateId, detectUtc);
        }

        private void CandCaptureGeometry(SetupState s, DateTime knownAt, double entry, double stop, double? tp, double? rr, double finalUnits = double.NaN)
        {
            if (s == null || _candRegistry == null) return;
            var c = _candRegistry.Find(s.CandidateTelemetryId); if (c == null) return;
            c.Entry = entry; c.Stop = stop; c.Tp = tp; c.Rr = rr; c.StopUsd = Math.Abs(entry - stop);
            c.KnownAt = knownAt.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture);
            if (!double.IsNaN(finalUnits) && !double.IsInfinity(finalUnits))
            {
                c.FinalLots = finalUnits / Symbol.LotSize;
                c.MinLotFeasible = c.FinalLots >= 0.1 - 1e-12;
            }
            c.MissingReason = "na";
        }

        private void CandMarkGate(SetupState s, string gate)
        {
            if (s == null || _candRegistry == null) return;
            var c = _candRegistry.Find(s.CandidateTelemetryId); if (c != null) c.GateVector = CandidateRegistry.Clean(gate);
        }

        private void CandEndById(string candidateId, DateTime utc, CandidateTerminalStage terminal, string reason)
        {
            if (_candRegistry == null) return;
            var c = _candRegistry.Find(candidateId);
            string line = _candRegistry.End(candidateId, utc, terminal, reason);
            if (line == null) return;
            Print(line);
            if (ShadowEvalEnabled && c != null && c.Entry.HasValue && c.Stop.HasValue && terminal != CandidateTerminalStage.EndOfRun)
                _candShadowPending.Add(c);
        }

        private void CandEnd(SetupState s, DateTime utc, CandidateTerminalStage terminal, string reason)
        { if (s != null) CandEndById(s.CandidateTelemetryId, utc, terminal, reason); }

        private void CandReset(SetupState s, int callerLine)
        {
            if (s == null || string.IsNullOrEmpty(s.CandidateTelemetryId)) return;
            CandEnd(s, Server.Time, CandidateTerminalStage.Reset, "state_reset:L" + callerLine.ToString(CultureInfo.InvariantCulture));
        }

        // Diagnostic-only detectors have private identities and never call NsAcceptPattern, NsAdvance,
        // TryExecuteSetup or any order-capable method. Execution EnableAtm/EnableOteEntryPolicy are not read here.
        private void CandObserveShadowDetectors(int execIndex, DateTime utc)
        {
            if (!ShadowEvalEnabled) return;
            CandInitialize();
            if (ShadowOteDetectorEnabled)
            {
                foreach (SetupState s in new[] { _longState, _shortState })
                {
                    if (s == null || s.Zone == null || s.Stage == SetupStage.Waiting || s.NsNew ||
                        !(s.ImpulseHigh > s.ImpulseLow)) continue;
                    double low, high;
                    if (!EntryGeometry.Clip(s.Direction, s.Zone.Low, s.Zone.High, s.ImpulseLow, s.ImpulseHigh,
                        0, 0, true, Symbol.TickSize, out low, out high)) continue;
                    string formation = s.Direction + "|" + s.StartIndex + "|" + s.MssIndex + "|" +
                        low.ToString("R", CultureInfo.InvariantCulture) + "|" + high.ToString("R", CultureInfo.InvariantCulture);
                    if (!_candShadowOteSeen.Add(formation)) continue;
                    var c = _candRegistry.Begin("OTE", utc, formation, s.Direction,
                        string.IsNullOrEmpty(s.SetupType) ? "Parent" : s.SetupType, "PARENT", "shadow_ote", s.CandidateTelemetryId);
                    c.Session = SessionName(utc); c.ZoneWidth = high - low; c.PremiumDiscount = s.Direction > 0 ? "discount" : "premium";
                    c.KnownAt = utc.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture);
                    c.MissingReason = "virtual_confirmation_not_yet_observed";
                    CandEndById(c.CandidateId, utc, CandidateTerminalStage.VariantRejected, "shadow_ote_detector_hit");
                }
            }
            if (ShadowAtmDetectorEnabled)
            {
                int end = NsClosedIndex(_h1, 60, utc);
                if (end < 119) return;
                var bars = new List<NewSetups.Bar>();
                for (int k = end - 119; k <= end; k++)
                {
                    if (!NsValidBar(_h1, k) || (k > end - 119 && !NsContiguous(_h1, k, 60))) { bars.Clear(); break; }
                    double atr = CalculateAtr(_h1, k, 14);
                    if (!NsFinite(atr) || atr <= 0) { bars.Clear(); break; }
                    bars.Add(new NewSetups.Bar { Index = k, OpenUtc = NsUtc(_h1.OpenTimes[k]), Open = _h1.OpenPrices[k],
                        High = _h1.HighPrices[k], Low = _h1.LowPrices[k], Close = _h1.ClosePrices[k], Atr = atr });
                }
                foreach (int direction in new[] { 1, -1 })
                    foreach (Pattern p in Patterns.Detect(bars, 60, direction, Symbol.TickSize,
                        MinimumSweepPips * StrategyPip, MinimumSweepAtr, MssAtrBuffer).Where(x => x.Core == "K05"))
                    {
                        if (!_candShadowAtmSeen.Add(p.Id)) continue;
                        var c = _candRegistry.Begin("ATM", utc, p.Id, p.Direction, "AtmH1LegacyProxy", "K05", "shadow_atm");
                        c.Session = SessionName(utc); c.ZoneWidth = p.BlockHigh - p.BlockLow;
                        c.HtfBias = p.Direction > 0 ? "bull" : "bear";
                        c.KnownAt = utc.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture);
                        c.MissingReason = "detector_only_no_virtual_confirmation";
                        CandEndById(c.CandidateId, utc, CandidateTerminalStage.CoreRejected, "shadow_atm_detector_hit");
                    }
            }
        }

        private DateTime CandAdministrativeEnd(CandidateSnapshot c)
        {
            DateTime end = c.EndUtc.AddHours(24);
            string session = c.Session;
            if (session == "na" || session == "OFF") return end;
            for (DateTime t = c.EndUtc.AddMinutes(1); t < end; t = t.AddMinutes(1))
                if (SessionName(t) != session) return t;
            return end;
        }

        private void CandAdvanceShadows(bool force)
        {
            if (!ShadowEvalEnabled || _candM1 == null || _candShadowPending.Count == 0) return;
            foreach (var c in _candShadowPending.ToList())
            {
                DateTime administrativeEnd = CandAdministrativeEnd(c);
                if (!force && Server.Time < administrativeEnd) continue;
                var bars = new List<ShadowBar>();
                for (int i = 0; i < _candM1.Count; i++)
                {
                    DateTime t = DateTime.SpecifyKind(_candM1.OpenTimes[i], DateTimeKind.Utc);
                    if (t < c.EndUtc || t > administrativeEnd) continue;
                    bars.Add(new ShadowBar { OpenUtc = t, Open = _candM1.OpenPrices[i], High = _candM1.HighPrices[i], Low = _candM1.LowPrices[i], Close = _candM1.ClosePrices[i] });
                }
                double spreadPrice = 2.0 * Symbol.PipSize;
                var r = ShadowEvaluator.Evaluate(c.CandidateId, c.Direction, c.Entry.Value, c.Stop.Value, c.IsLimit, c.EndUtc, administrativeEnd, spreadPrice, bars);
                Print(r.Format());
                _candShadowPending.Remove(c);
            }
        }

        private void CandOnStop()
        {
            if (_candRegistry == null) return;
            foreach (string line in _candRegistry.EndAll(Server.Time)) Print(line);
            CandAdvanceShadows(true);
            Print("CAND_DONE|schema_version={0}|ended={1}|open={2}|shadow_pending={3}|drops=0|coverage=complete",
                CandidateRegistry.SchemaVersion, _candRegistry.EndedCount, _candRegistry.OpenCount, _candShadowPending.Count);
        }
    }
}
