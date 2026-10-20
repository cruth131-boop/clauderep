using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using cAlgo.API;
using NewSetups;
using CandidateTelemetry;
using Bar = NewSetups.Bar;

namespace cAlgo.Robots
{
    public partial class IctGoldV259Dev
    {
        [Parameter("Enable Judas", DefaultValue = false, Group = "11 NS-1 Development")]
        public bool EnableJudas { get; set; }
        [Parameter("Enable OTE Entry Policy", DefaultValue = false, Group = "11 NS-1 Development")]
        public bool EnableOteEntryPolicy { get; set; }
        [Parameter("Enable Breaker", DefaultValue = false, Group = "11 NS-1 Development")]
        public bool EnableBreaker { get; set; }
        [Parameter("Enable Mitigation", DefaultValue = false, Group = "11 NS-1 Development")]
        public bool EnableMitigation { get; set; }
        [Parameter("Enable ATM", DefaultValue = false, Group = "11 NS-1 Development")]
        public bool EnableAtm { get; set; }
        // v2.46-dev reachability fix (default OFF = v2.45 behaviour). Zone width of Breaker/Mitigation/ATM source
        // blocks is an M15/H1 candle, but v2.45 divided it by the M2 execution ATR before comparing with
        // MaximumZoneWidthAtr (1.25) and the width quality bands, a timeframe mismatch (M15 ATR is ~2-3x M2 ATR).
        // ON: width is normalised by the ATR of the block's own timeframe at the block bar. Thresholds unchanged.
        [Parameter("NS Zone Width ATR From Source TF", DefaultValue = true, Group = "11 NS-1 Development")]
        public bool NsSourceTfZoneAtr { get; set; }
        // v2.48-dev K01 Judas context experiment (default OFF = exact H1 + M15 persistent-trend contract).
        // ON (only with EnableJudas): the H1 persistent trend must equal the trade direction at break, activation and
        // every lifecycle bar; the M15 trend is measured as a diagnostic (ctx_diag counter) and is NOT a veto.
        // H1-only is a development PROXY for higher-timeframe direction, not a source-faithful Daily/Weekly bias.
        [Parameter("NS Judas H1-Only Context", DefaultValue = false, Group = "11 NS-1 Development")]
        public bool NsJudasH1OnlyContext { get; set; }
        // v2.48-dev K04 Mitigation experiment (default OFF = pre-touch exec deadline eventStart+Scale(12) M2 bars).
        // ON (only with EnableMitigation): before the first touch only the pattern deadline (M15 break + 8 bars)
        // applies; after the first touch the unchanged Scale(5) touch->confirmation window starts (no rolling).
        // The 120-minute figure is an operational assumption derived from the frozen pattern contract, not an ICT constant.
        [Parameter("NS Mitigation Pattern Retest Deadline", DefaultValue = false, Group = "11 NS-1 Development")]
        public bool NsMitigationPatternRetestDeadline { get; set; }

        private sealed class NsCandidate
        {
            public SetupState State;
            public Pattern Pattern;
            public ZoneInfo SourceZone, FvgEvidence, ObEvidence;
            public double SourceAtr, ZoneAtr;
            public int EventStart, Deadline, FreezeIndex = -1, Episodes, LastLifecycleIndex;
            public DateTime ActivationUtc;
            public bool Terminal, Ready, Touching, IdentityRecorded;
            public string CandidateId;
            public string LiquidityId;
            public DateTime ImpulseOriginUtc;
            public DateTime JudasDeadline = DateTime.MaxValue;
        }
        private sealed class NsTake
        {
            public int Direction, Index, ReclaimIndex = -1;
            public LiquidityLevel Level;
            public double Extreme;
        }
        private sealed class NsJudasAttempt
        {
            public int Direction, Sweep, Reclaim = -1;
            public int MssPivotIndex = -1;
            public double Extreme, Level, KeyOpen, MssLevel;
            public DateTime Day, Deadline, MssPivotConfirmedUtc;
            public bool Terminal;
        }
        private sealed class NsConsumedIdentity
        {
            public Pattern Pattern;
            public string LiquidityId;
            public double Low, High;
        }
        private sealed class NsParentIdentity
        {
            public int Direction;
            public DateTime BreakUtc, TakenUtc;
            public string RaidId;
            public double Low, High, LiquidityPrice;
        }
        private readonly List<NsParentIdentity> _nsParents = new List<NsParentIdentity>();
        private string NsRaidId(SetupState s)
        {
            if (s.TakenIndex < 0 || s.TakenIndex >= _exec.Count || !s.LiquidityExternal) return null;
            return s.Direction + "|" + s.LiquidityPrice.ToString("R", CultureInfo.InvariantCulture) +
                "|" + NsUtc(_exec.OpenTimes[s.TakenIndex]).ToString("O", CultureInfo.InvariantCulture);
        }
        private bool NsMatchesParent(NsCandidate c, NsParentIdentity parent)
        {
            if (c.Pattern.Direction != parent.Direction) return false;
            if (c.Pattern.Core == "K01" && c.Pattern.BreakUtc == parent.BreakUtc) return true;
            if (c.Pattern.Core == "K03" && c.State.LiquidityPrice == parent.LiquidityPrice &&
                parent.TakenUtc >= _m15.OpenTimes[c.Pattern.Anchors[2]] &&
                parent.TakenUtc < _m15.OpenTimes[c.Pattern.Anchors[2]].AddMinutes(15) &&
                NsOverlap(c.State.Zone ?? c.SourceZone, parent.Low, parent.High)) return true;
            string raid = NsRaidId(c.State);
            return raid != null && raid == parent.RaidId && NsOverlap(c.State.Zone ?? c.SourceZone, parent.Low, parent.High);
        }
        private void NsRecordParentFill(SetupState s)
        {
            if (!NsCoresEnabled() || s.NsNew || s.Zone == null) return;
            var identity = new NsParentIdentity { Direction = s.Direction, RaidId = NsRaidId(s),
                TakenUtc = s.TakenIndex < 0 ? DateTime.MinValue : NsUtc(_exec.OpenTimes[s.TakenIndex]), LiquidityPrice = s.LiquidityPrice,
                BreakUtc = s.MssIndex < 0 ? DateTime.MinValue : NsUtc(_exec.OpenTimes[s.MssIndex].AddMinutes(ExecutionMinutes())),
                Low = s.Zone.Low, High = s.Zone.High };
            _nsParents.Add(identity);
            foreach (var c in _nsCandidates.Where(c => NsMatchesParent(c, identity)).ToList()) NsConsume(c, "parent_fill_identity_match");
        }
        private readonly List<NsCandidate> _nsCandidates = new List<NsCandidate>();
        private readonly Dictionary<int, SetupState> _nsProtectionFailures = new Dictionary<int, SetupState>();
        private void NsCompensateProtectionFailure(Position position, SetupState state)
        {
            // v2.47-dev: unified, verified close with bounded retry, entry lock and kill-switch latch (FailSafeBot.cs).
            FsCloseWithRecovery(position, state, "post-fill protection invalid");
        }
        private void NsRetryProtectionFailures()
        {
            // v2.47-dev: retries run through ProtectionRecovery (backoff, escalation); states are released here.
            FsOnTick();
            FsReleaseRecovered();
        }
        private readonly List<NsTake> _nsTakes = new List<NsTake>();
        private readonly List<NsJudasAttempt> _nsJudas = new List<NsJudasAttempt>();
        private readonly HashSet<string> _nsSeen = new HashSet<string>(StringComparer.Ordinal);
        private readonly HashSet<string> _nsFormations = new HashSet<string>(StringComparer.Ordinal);
        private readonly List<NsConsumedIdentity> _nsConsumed = new List<NsConsumedIdentity>();
        private DateTime _nsJudasDay = DateTime.MinValue;
        private double _nsAsiaLow, _nsAsiaHigh, _nsKeyOpen;
        private bool _nsJudasRange;
        private bool _nsJudasRejected;
        private int _nsLastM15 = -1, _nsLastH1 = -1, _nsLastExec = -1;

        private bool NsCoresEnabled() => EnableJudas || EnableBreaker || EnableMitigation || EnableAtm;
        private bool NsAnyEnabled() => NsCoresEnabled() || EnableOteEntryPolicy;
        private static bool NsPrimaryType(string type) => type == "JudasH1M15Dev" || type == "BreakerH1M15Dev" ||
            type == "MitigationH1M15Dev" || type == "AtmH1Dev";
        private static bool NsFinite(double x) => !double.IsNaN(x) && !double.IsInfinity(x);
        private bool NsValidBar(Bars bars, int i)
        {
            if (bars == null || i < 0 || i >= bars.Count) return false;
            double o = bars.OpenPrices[i], h = bars.HighPrices[i], l = bars.LowPrices[i], c = bars.ClosePrices[i];
            return NsFinite(o) && NsFinite(h) && NsFinite(l) && NsFinite(c) && h > l && o >= l && o <= h && c >= l && c <= h;
        }
        private static DateTime NsUtc(DateTime t) => DateTime.SpecifyKind(t, DateTimeKind.Utc);
        private string NsExecAnchorId(int i) => "2:" + i + ":" + NsUtc(_exec.OpenTimes[i]).ToString("O", CultureInfo.InvariantCulture);
        private int NsClosedIndex(Bars bars, int minutes, DateTime t)
        {
            if (bars == null || bars.Count == 0) return -1;
            int k = bars.OpenTimes.GetIndexByTime(t);
            if (k < 0) return -1;
            while (k >= 0 && bars.OpenTimes[k].AddMinutes(minutes) > t) k--;
            return k;
        }
        private List<Bar> NsBars(Bars bars, int minutes, DateTime t, int count)
        {
            int end = NsClosedIndex(bars, minutes, t);
            if (end < count - 1 + 14) return NsRej<List<Bar>>("ALL", "NsBars:L154:tf" + minutes);
            // ATR reads fourteen preceding bars, including the previous close.
            // Validate support as well as the emitted detector window.
            for (int k = end - count + 1 - 14; k <= end; k++)
                if (!NsValidBar(bars, k) || (k > end - count + 1 - 14 &&
                    !NsContiguous(bars, k, minutes))) return NsRej<List<Bar>>("ALL", "NsBars:L159:tf" + minutes);
            var output = new List<Bar>();
            for (int k = end - count + 1; k <= end; k++)
            {
                if (!NsFinite(bars.OpenPrices[k]) || !NsFinite(bars.HighPrices[k]) || !NsFinite(bars.LowPrices[k]) ||
                    !NsFinite(bars.ClosePrices[k]) || bars.HighPrices[k] <= bars.LowPrices[k] ||
                    bars.LowPrices[k] > Math.Min(bars.OpenPrices[k], bars.ClosePrices[k]) ||
                    bars.HighPrices[k] < Math.Max(bars.OpenPrices[k], bars.ClosePrices[k]) ||
                    (k > end - count + 1 && !NsContiguous(bars, k, minutes))) return NsRej<List<Bar>>("ALL", "NsBars:L167:tf" + minutes);
                double atr = CalculateAtr(bars, k, 14);
                if (!NsFinite(atr) || atr <= 0) return NsRej<List<Bar>>("ALL", "NsBars:L169:tf" + minutes);
                output.Add(new Bar { Index = k, OpenUtc = NsUtc(bars.OpenTimes[k]), Open = bars.OpenPrices[k],
                    High = bars.HighPrices[k], Low = bars.LowPrices[k], Close = bars.ClosePrices[k], Atr = atr });
            }
            return output;
        }
        // Core-aware context. OFF / every core except K01+NsJudasH1OnlyContext keeps the exact H1 + M15 contract.
        private string NsContextWhy(string core, int d, DateTime t)
        {
            int h = NsClosedIndex(_h1, 60, t), m = NsClosedIndex(_m15, 15, t);
            // Initial FindPriorPivot searches another lookback before trend start.
            bool enough = h >= 133 && m >= 173;
            bool valid = enough && NsHistoryValid(_h1, 60, h, h - 243) && NsHistoryValid(_m15, 15, m, m - 323);
            int th = valid ? GetPersistentStructureTrend(_h1, h, 2, 2, 120) : 0;
            int tm = valid ? GetPersistentStructureTrend(_m15, m, 2, 2, 160) : 0;
            return NsRules.ContextWhy(core, NsJudasH1OnlyContext, d, enough, valid, th, tm);
        }
        private bool NsContext(string core, int d, DateTime t) { return NsContextWhy(core, d, t) == "ok"; }
        // v2.46-dev reachability fix: v2.45 demanded gap-free bars over 243 H1 / 323 M15 / ~250 exec bars,
        // which can never hold on XAUUSD (daily break, weekend, holidays/early closes). v2.48-dev: the tolerated
        // missing span is 55 min .. 96 h (NsRules.GapTolerated) so that holiday weekends (Good Friday -> Sunday
        // reopen > 72 h) pass. This is a DURATION HEURISTIC, not session/calendar validation: it also accepts a
        // mid-session data hole of that length. Shorter holes and longer outages still fail closed.
        private static bool NsContiguous(Bars bars, int k, int minutes)
        {
            return NsRules.GapTolerated(bars.OpenTimes[k] - bars.OpenTimes[k - 1], minutes);
        }
        // History continuity must accept flat (high == low) bars: they are valid thin-market data.
        // Only non-finite or inconsistent OHLC fails (detector windows keep the strict NsValidBar).
        private bool NsHistoryBarOk(Bars bars, int i)
        {
            if (bars == null || i < 0 || i >= bars.Count) return false;
            double o = bars.OpenPrices[i], h = bars.HighPrices[i], l = bars.LowPrices[i], c = bars.ClosePrices[i];
            return NsFinite(o) && NsFinite(h) && NsFinite(l) && NsFinite(c) && h >= l && o >= l && o <= h && c >= l && c <= h;
        }
        private bool NsHistoryValid(Bars bars, int minutes, int end, int first)
        {
            if (bars == null || end < 14 || end >= bars.Count) return false;
            first = Math.Max(0, first);
            for (int k = first; k <= end; k++)
            {
                if (!NsHistoryBarOk(bars, k))
                { NsF("HISTORY", "fail:tf" + minutes + ":invalid_bar"); return false; }
                if (k > first && !NsContiguous(bars, k, minutes))
                {
                    double gap = (bars.OpenTimes[k] - bars.OpenTimes[k - 1]).TotalMinutes;
                    string cls = gap <= 0 ? "nonpositive" : gap <= 2.5 * minutes ? "le2.5tf" : gap <= 120 ? "le2h" : gap <= 1500 ? "le25h" : "gt25h";
                    NsFE("HISTORY", "fail:tf" + minutes + ":gap_" + cls, "prevOpen=" + bars.OpenTimes[k - 1].ToString("yyyy-MM-ddTHH:mm", CultureInfo.InvariantCulture) + "|nextOpen=" + bars.OpenTimes[k].ToString("yyyy-MM-ddTHH:mm", CultureInfo.InvariantCulture) + "|gapMin=" + gap.ToString("F0", CultureInfo.InvariantCulture));
                    return false;
                }
            }
            return true;
        }
        private bool NsGateHistoryValid(DateTime t)
        {
            int h = NsClosedIndex(_h1, 60, t), m = NsClosedIndex(_m15, 15, t),
                f = NsClosedIndex(_m5, 5, t), e = NsClosedIndex(_exec, ExecutionMinutes(), t);
            int m5Support = Math.Max(243, Math.Max(M5InternalLookback + M5InternalPivotLeft + 14,
                UsePreviousDayLiquidity ? 900 : UseAsiaLiquidity || UseLondonLiquidity ? 500 : 0));
            return NsHistoryValid(_h1, 60, h, h - Math.Max(243, CrtH1ContextLookbackBars + 14)) &&
                NsHistoryValid(_m15, 15, m, m - Math.Max(323, Math.Max(M15LiquidityLookback + M15PivotLeft + 14, CrtM15ContextLookbackBars + 14))) &&
                NsHistoryValid(_m5, 5, f, f - m5Support) &&
                NsHistoryValid(_exec, ExecutionMinutes(), e, e - Math.Max(243 + ExecPivotLeft, MssLookbackBars + ExecPivotLeft + 14));
        }
        private bool NsH1ArrayTouched(Pattern p, DateTime t)
        {
            int end = NsClosedIndex(_h1, 60, t);
            if (end < 133) return false;
            double low = 0, high = 0;
            DateTime formationClose = DateTime.MaxValue;
            bool found = false;
            for (int k = end; k >= Math.Max(2, end - 119); k--)
            {
                double atr = CalculateAtr(_h1, k, 14);
                double l = p.Direction > 0 ? _h1.HighPrices[k - 2] : _h1.HighPrices[k];
                double h = p.Direction > 0 ? _h1.LowPrices[k] : _h1.LowPrices[k - 2];
                if (!NsFinite(atr) || atr <= 0 || !NsFinite(l) || !NsFinite(h) || h - l < .03 * atr) continue;
                bool invalid = false;
                for (int q = k + 1; q <= end; q++)
                    if (p.Direction > 0 ? _h1.ClosePrices[q] < l : _h1.ClosePrices[q] > h) { invalid = true; break; }
                if (invalid) continue;
                low = l; high = h; formationClose = _h1.OpenTimes[k].AddMinutes(60); found = true; break;
            }
            if (!found) return false;
            int last = Math.Min(p.BreakIndex, NsClosedIndex(_m15, 15, t));
            for (int k = p.StartIndex; k <= last; k++)
                if (_m15.OpenTimes[k].AddMinutes(15) >= formationClose &&
                    _m15.LowPrices[k] <= high && _m15.HighPrices[k] >= low) return true;
            return false;
        }
        private void NsRecordTakes(int i, double atr, DateTime t)
        {
            foreach (var take in _nsTakes.Where(x => x.ReclaimIndex < 0).ToList())
            {
                if (i > take.Index + ScaleLogicBars(ReclaimBars)) { _nsTakes.Remove(take); continue; }
                take.Extreme = take.Direction > 0 ? Math.Min(take.Extreme, _exec.LowPrices[i]) : Math.Max(take.Extreme, _exec.HighPrices[i]);
                if (IsLevelReclaimed(i, take.Direction, take.Level.Price)) take.ReclaimIndex = i;
            }
            foreach (int d in new[] { 1, -1 })
            {
                LiquidityLevel level; bool reclaim; double extreme;
                // The E candle is closed now, but the raided level must already have
                // been known before that candle opened. Keep the original detector's
                // sweep/reclaim thresholds; do not synthesize an external take.
                if (TryDetectLiquidityTake(i, d, atr, _exec.OpenTimes[i], out level, out reclaim, out extreme) && level.External)
                    _nsTakes.Add(new NsTake { Direction = d, Index = i, ReclaimIndex = reclaim ? i : -1,
                        Extreme = extreme, Level = new LiquidityLevel(level.Name, level.Price, level.Side, level.Strength, level.External) });
            }
            // Retain a full 24-hour ATM formation without unbounded replay memory.
            _nsTakes.RemoveAll(x => _exec.OpenTimes[x.Index].AddMinutes(2) < t.AddHours(-25));
        }
        private NsCandidate NsAcceptPattern(Pattern p, int i, double atr, DateTime t)
        {
            string id = p == null ? null : p.Core + "|" + SymbolName + "|" + p.Id;
            bool replay = id != null && _nsSeen.Contains(id);
            var candidate = NsBuildPattern(p, i, atr, t);
            if (candidate != null) NsFE(NsModP(p), "candidate_accepted", "dir=" + p.Direction + "|id=" + id);
            if (candidate == null && !replay && id != null && _nsSeen.Contains(id) &&
                !_nsConsumed.Any(x => x.Pattern.Id == p.Id))
            {
                // Final failures before source construction still have immutable causal
                // block/anchor/raid identity; do not let recovery erase the rejection.
                Bars structure = p.Core == "K05" ? _h1 : p.Core == "K01" ? _exec : _m15;
                string liquidityId = p.Id;
                if (p.Core == "K01") liquidityId = _nsJudasDay.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "|Asia|" + p.Direction;
                else if (p.Core == "K03") liquidityId = "M15|" + structure.OpenTimes[p.Anchors[0]].ToString("O", CultureInfo.InvariantCulture) + "|" + p.Direction;
                else
                {
                    DateTime start = structure.OpenTimes[p.Core == "K05" ? p.Anchors[1] : p.Anchors[0]];
                    var take = _nsTakes.Where(x => x.Direction == p.Direction && x.ReclaimIndex >= 0 &&
                        _exec.OpenTimes[x.Index] >= start && _exec.OpenTimes[x.ReclaimIndex].AddMinutes(2) <= p.BreakUtc)
                        .Where(x => p.Core != "K04" || (p.Direction > 0 ? x.Extreme >= _m15.LowPrices[p.Anchors[0]] : x.Extreme <= _m15.HighPrices[p.Anchors[0]]))
                        .OrderBy(x => x.Index).FirstOrDefault();
                    if (take != null) liquidityId = take.Level.Name + "|" + _exec.OpenTimes[take.Index].ToString("O", CultureInfo.InvariantCulture) + "|" + p.Direction;
                }
                _nsConsumed.Add(new NsConsumedIdentity { Pattern = p, LiquidityId = liquidityId, Low = p.BlockLow, High = p.BlockHigh });
            }
            return candidate;
        }
        private NsCandidate NsBuildPattern(Pattern p, int i, double atr, DateTime t)
        {
            if (p == null || (p.Core != "K01" && p.Core != "K03" && p.Core != "K04" && p.Core != "K05") ||
                (p.Direction != 1 && p.Direction != -1) || p.Anchors == null ||
                p.Anchors.Length != (p.Core == "K05" ? 2 : 3) || p.BreakUtc > NsUtc(t) ||
                string.IsNullOrEmpty(p.Id) || !NsFinite(p.ImpulseLow) || !NsFinite(p.ImpulseHigh) || !NsFinite(p.InvalidExtreme) ||
                !NsFinite(atr) || atr <= 0 || p.ImpulseHigh <= p.ImpulseLow) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L325");
            Bars structure = p.Core == "K05" ? _h1 : p.Core == "K01" ? _exec : _m15;
            int minutes = p.Core == "K05" ? 60 : p.Core == "K01" ? 2 : 15;
            if (p.StartIndex < 0 || p.StartIndex > p.BreakIndex || p.BreakIndex < 0 || p.BreakIndex > NsClosedIndex(structure, minutes, t) ||
                p.Anchors.Any(k => k < 0 || k > p.BreakIndex) ||
                structure.OpenTimes[p.BreakIndex].AddMinutes(minutes) != p.BreakUtc) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L330");
            if (!HasDirectionalDisplacement(structure, p.BreakIndex, p.Direction, CalculateAtr(structure, p.BreakIndex, 14))) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L331");
            string id = p.Core + "|" + SymbolName + "|" + p.Id;
            if (!_nsSeen.Add(id)) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L333");
            string formation = p.Core + "|" + SymbolName + "|" + p.Direction + "|" + minutes + "|" +
                string.Join("|", p.Anchors.Select(k => structure.OpenTimes[k].ToString("O", CultureInfo.InvariantCulture)));
            if (!_nsFormations.Add(formation)) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L336");
            int structuralOrigin = p.Core == "K05" ? p.Anchors[1] : p.Core == "K01" ? p.StartIndex : p.Anchors[2];
            int structuralEnd = NsClosedIndex(structure, minutes, t);
            for (int k = structuralOrigin + 1; k <= structuralEnd; k++)
            {
                if (!NsValidBar(structure, k)) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L341");
                double buffer = Math.Max(Symbol.TickSize, CalculateAtr(structure, k, 14) * MssAtrBuffer);
                if (!NsFinite(buffer) || (p.Direction > 0 ? structure.LowPrices[k] < p.InvalidExtreme - buffer :
                    structure.HighPrices[k] > p.InvalidExtreme + buffer)) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L344");
                if ((p.Core == "K03" || p.Core == "K04") && k > p.BreakIndex &&
                    (p.Direction > 0 ? structure.ClosePrices[k] < p.BlockLow - buffer :
                    structure.ClosePrices[k] > p.BlockHigh + buffer)) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L347");
            }
            if (!NsContext(p.Core, p.Direction, p.BreakUtc) || !NsContext(p.Core, p.Direction, t))
            {
                string why = NsContext(p.Core, p.Direction, p.BreakUtc) ? "at_activation:" + NsContextWhy(p.Core, p.Direction, t) : "at_break:" + NsContextWhy(p.Core, p.Direction, p.BreakUtc);
                NsFE(NsModP(p), "ctx_fail:" + why, "dir=" + p.Direction + "|id=" + p.Id);
                return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L353");
            }
            if (p.Core == "K01" && NsJudasH1OnlyContext)
            {
                // Diagnostic only: how often the legacy M15 veto would have blocked this candidate (at break / at activation).
                int hb = NsClosedIndex(_h1, 60, p.BreakUtc), mb = NsClosedIndex(_m15, 15, p.BreakUtc), ha = NsClosedIndex(_h1, 60, t), ma = NsClosedIndex(_m15, 15, t);
                if (NsRules.H1OnlyOverrodeM15(p.Core, true, p.Direction, GetPersistentStructureTrend(_h1, hb, 2, 2, 120), GetPersistentStructureTrend(_m15, mb, 2, 2, 160)) ||
                    NsRules.H1OnlyOverrodeM15(p.Core, true, p.Direction, GetPersistentStructureTrend(_h1, ha, 2, 2, 120), GetPersistentStructureTrend(_m15, ma, 2, 2, 160)))
                    NsFE("JUDAS", "ctx_diag:m15_misaligned_not_veto", "dir=" + p.Direction + "|id=" + p.Id);
            }
            if ((p.Core == "K03" || p.Core == "K04") && !NsH1ArrayTouched(p, t)) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L355");
            // The event anchor is the original first E close at/after the structural break,
            // even when a snapshot only exposes that break later. Never backdate touches.
            int eventStart = _exec.OpenTimes.GetIndexByTime(p.BreakUtc.AddMinutes(-2));
            if (eventStart < 0) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L359");
            if (_exec.OpenTimes[eventStart].AddMinutes(2) < p.BreakUtc) eventStart++;
            if (eventStart > i) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L361");
            var s = new SetupState(p.Direction, NsF) { NsNew = true, NsCore = p.Core, NsId = id,
                NsOte = EnableOteEntryPolicy || p.Core == "K05", StartIndex = eventStart, TakenIndex = eventStart, MssIndex = eventStart,
                HasDisplacement = true, ImpulseLow = p.ImpulseLow, ImpulseHigh = p.ImpulseHigh, SweepExtreme = p.InvalidExtreme,
                SetupType = p.Core == "K01" ? "JudasH1M15Dev" : p.Core == "K03" ? "BreakerH1M15Dev" : p.Core == "K04" ? "MitigationH1M15Dev" : "AtmH1Dev",
                Stage = SetupStage.WaitingPdArray, PdArrayWaitUntil = eventStart,
                ExpiryIndex = NsRules.InitialExecDeadline(NsRules.PatternOnlyPreTouch(p.Core, NsMitigationPatternRetestDeadline), eventStart, ScaleLogicBars(12)) };
            string liquidityId;
            if (p.Core == "K01" || p.Core == "K03")
            {
                s.LiquidityExternal = true; s.LiquidityStrength = p.Core == "K01" ? 2 : 1;
                s.LiquidityPrice = p.Core == "K01" ? (p.Direction > 0 ? _nsAsiaLow : _nsAsiaHigh) :
                    (p.Direction > 0 ? structure.LowPrices[p.Anchors[0]] : structure.HighPrices[p.Anchors[0]]);
                s.LiquidityName = p.Core == "K01" ? "Asia NS-1" : "M15 confirmed A raid";
                liquidityId = p.Core == "K01" ? _nsJudasDay.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "|Asia|" + p.Direction :
                    "M15|" + structure.OpenTimes[p.Anchors[0]].ToString("O", CultureInfo.InvariantCulture) + "|" + p.Direction;
                if (p.Core == "K01")
                {
                    var attempt = _nsJudas.Last(x => x.Direction == p.Direction && x.Day == _nsJudasDay);
                    s.TakenIndex = attempt.Sweep; s.ReclaimIndex = attempt.Reclaim; s.SameBarReclaim = attempt.Reclaim == attempt.Sweep;
                }
            }
            else
            {
                DateTime start = structure.OpenTimes[p.Core == "K05" ? p.Anchors[1] : p.Anchors[0]];
                var real = _nsTakes.Where(x => x.Direction == p.Direction && x.ReclaimIndex >= 0 &&
                    _exec.OpenTimes[x.Index] >= start && _exec.OpenTimes[x.ReclaimIndex].AddMinutes(2) <= p.BreakUtc)
                    .Where(x => p.Core != "K04" || (p.Direction > 0 ? x.Extreme >= _m15.LowPrices[p.Anchors[0]] : x.Extreme <= _m15.HighPrices[p.Anchors[0]]))
                    .OrderBy(x => x.Index).FirstOrDefault();
                if (RequireExternalLiquidity && real == null) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L389");
                if (real != null)
                {
                    s.LiquidityExternal = real.Level.External; s.LiquidityStrength = real.Level.Strength;
                    s.LiquidityPrice = real.Level.Price; s.LiquidityName = real.Level.Name;
                    s.SameBarReclaim = real.Index == real.ReclaimIndex; s.TakenIndex = real.Index; s.ReclaimIndex = real.ReclaimIndex;
                    liquidityId = real.Level.Name + "|" + _exec.OpenTimes[real.Index].ToString("O", CultureInfo.InvariantCulture) + "|" + p.Direction;
                }
                else { s.LiquidityName = "Structure break (not a take)"; liquidityId = p.Id; }
            }
            // Origin-OB search starts at the causal pattern impulse origin, not an unrelated take.
            int origin = p.Core == "K05" ? p.Anchors[1] : p.Core == "K01" ? p.StartIndex : p.Anchors[2];
            DateTime originUtc = structure.OpenTimes[origin];
            // Evidence needs the covered causal window, not a synthesized origin.
            // An E candle straddling an earlier M15 origin is not source evidence.
            s.StartIndex = _exec.OpenTimes.GetIndexByTime(originUtc);
            if (s.StartIndex < 0) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L405");
            if (_exec.OpenTimes[s.StartIndex] < originUtc) s.StartIndex++;
            if (s.StartIndex > eventStart) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L407");
            for (int k = s.StartIndex; k <= i; k++)
            {
                if (!NsValidBar(_exec, k) || (k > s.StartIndex && !NsContiguous(_exec, k, 2))) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L410");
                if (k <= eventStart) continue;
                double buffer = Math.Max(Symbol.TickSize, CalculateAtr(_exec, k, 14) * MssAtrBuffer);
                if (!NsFinite(buffer) || (p.Direction > 0 ? _exec.LowPrices[k] < p.InvalidExtreme - buffer :
                    _exec.HighPrices[k] > p.InvalidExtreme + buffer)) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L414");
                if ((p.Core == "K03" || p.Core == "K04") && (p.Direction > 0 ?
                    _exec.ClosePrices[k] < p.BlockLow - buffer : _exec.ClosePrices[k] > p.BlockHigh + buffer)) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L416");
            }
            CaptureCrtContext(s, i, atr, t);
            var c = new NsCandidate { State = s, Pattern = p, EventStart = eventStart, Deadline = s.ExpiryIndex, LiquidityId = liquidityId,
                SourceAtr = CalculateAtr(_exec, eventStart, 14), ImpulseOriginUtc = NsUtc(originUtc) };
            if (p.Core == "K01") c.JudasDeadline = _nsJudas.Last(x => x.Direction == p.Direction && x.Day == _nsJudasDay).Deadline;
            double sourceTfAtr = NsSourceTfZoneAtr && p.Core != "K01" ? CalculateAtr(structure, p.SourceIndex, 14) : c.SourceAtr;
            int atrMode = NsRules.ZoneAtrMode(NsSourceTfZoneAtr, p.Core, sourceTfAtr);
            // v2.48-dev: an invalid source-timeframe ATR rejects the candidate; no silent fallback to the M2 ATR.
            if (atrMode < 0) { NsConsume(c, "NsBuildPattern:source_atr_invalid"); return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:source_atr_invalid"); }
            c.ZoneAtr = atrMode == 1 ? sourceTfAtr : c.SourceAtr;
            c.SourceZone = NsSourceZone(c, eventStart, c.SourceAtr);
            if (c.SourceZone == null) { NsConsume(c, "NsBuildPattern:L425"); return (NsCandidate)null; }
            double low, high;
            if (!EntryGeometry.Clip(s.Direction, c.SourceZone.Low, c.SourceZone.High, s.ImpulseLow, s.ImpulseHigh,
                0, 0, s.NsOte, Symbol.TickSize, out low, out high)) { NsConsume(c, "NsBuildPattern:L428"); return (NsCandidate)null; }
            s.Zone = NsEvidenceZone(c, low, high, c.SourceZone.SourceIndex, c.SourceZone.Label, c.SourceZone.Quality);
            if (s.Zone == null) { NsConsume(c, "NsBuildPattern:L430"); return (NsCandidate)null; }
            if (_nsParents.Any(x => NsMatchesParent(c, x))) { NsConsume(c, "NsBuildPattern:L431"); return (NsCandidate)null; }
            if (_nsConsumed.Any(x => NsMatchesIdentity(c, x.Pattern, x.LiquidityId, x.Low, x.High))) return NsRej<NsCandidate>(NsModP(p), "NsBuildPattern:L432");
            AnnotateZoneWithCrtContext(s, s.Zone);
            c.FreezeIndex = i; c.LastLifecycleIndex = i; c.ActivationUtc = NsUtc(t); s.Stage = SetupStage.WaitingEntry;
            return c;
        }
        private static bool NsOverlap(ZoneInfo z, double low, double high) =>
            z != null && Math.Min(z.High, high) > Math.Max(z.Low, low);
        private ZoneInfo NsEvidenceZone(NsCandidate c, double low, double high, int sourceIndex, string label, int sourceQuality)
        {
            bool fvg = NsOverlap(c.FvgEvidence, low, high), ob = NsOverlap(c.ObEvidence, low, high);
            bool pair = false;
            if (fvg && ob)
            {
                double gap = Math.Max(0, Math.Max(c.FvgEvidence.Low - c.ObEvidence.High, c.ObEvidence.Low - c.FvgEvidence.High));
                pair = NsOverlap(c.FvgEvidence, c.ObEvidence.Low, c.ObEvidence.High) ||
                    (BridgeNearbyFvgOb && gap / StrategyPip <= MaxFvgObBridgePips);
            }
            return NsQualify(c.State, new ZoneInfo { Low = low, High = high, SourceIndex = sourceIndex,
                HasFvg = fvg, HasOrderBlock = ob, Composite = pair, Label = label }, c.ZoneAtr > 0 ? c.ZoneAtr : c.SourceAtr, sourceQuality);
        }
        private ZoneInfo NsSourceZone(NsCandidate c, int i, double atr)
        {
            var p = c.Pattern; var s = c.State;
            if (!NsFinite(atr) || atr <= 0) return NsRej<ZoneInfo>(NsModP(c.Pattern), "NsSourceZone:L455");
            double rawLow = p.BlockLow, rawHigh = p.BlockHigh;
            int sourceIndex = p.SourceIndex;
            if (p.Core == "K01")
            {
                sourceIndex = -1;
                for (int k = s.MssIndex - 1; k >= p.StartIndex; k--)
                    if (s.Direction * (_exec.ClosePrices[k] - _exec.OpenPrices[k]) < 0) { sourceIndex = k; break; }
                if (sourceIndex < 0) return NsRej<ZoneInfo>(NsModP(c.Pattern), "NsSourceZone:L463");
                rawLow = _exec.LowPrices[sourceIndex]; rawHigh = _exec.HighPrices[sourceIndex];
            }
            else if (p.Core == "K03" || p.Core == "K04")
            {
                if (sourceIndex < 0 || sourceIndex > p.BreakIndex) return NsRej<ZoneInfo>(NsModP(c.Pattern), "NsSourceZone:L468");
                rawLow = _m15.LowPrices[sourceIndex]; rawHigh = _m15.HighPrices[sourceIndex];
                if (rawLow != p.BlockLow || rawHigh != p.BlockHigh) return NsRej<ZoneInfo>(NsModP(c.Pattern), "NsSourceZone:L470");
            }
            else
            {
                if (sourceIndex != p.Anchors[0]) return NsRej<ZoneInfo>(NsModP(c.Pattern), "NsSourceZone:L474");
                double b = Math.Max(Symbol.TickSize, CalculateAtr(_h1, p.BreakIndex, 14) * MssAtrBuffer);
                double level = s.Direction > 0 ? _h1.HighPrices[sourceIndex] : _h1.LowPrices[sourceIndex];
                rawLow = level - b; rawHigh = level + b;
                if (rawLow != p.BlockLow || rawHigh != p.BlockHigh) return NsRej<ZoneInfo>(NsModP(c.Pattern), "NsSourceZone:L478");
            }
            double low, high;
            if (!EntryGeometry.Clip(s.Direction, rawLow, rawHigh, s.ImpulseLow, s.ImpulseHigh,
                0, 0, false, Symbol.TickSize, out low, out high)) return NsRej<ZoneInfo>(NsModP(c.Pattern), "NsSourceZone:L482");
            // Evidence is frozen independently of the named primary zone. A block name
            // never awards OB/composite points, nor may future M2 gaps upgrade quality.
            for (int k = i; k >= Math.Max(2, s.StartIndex); k--)
            {
                var fvg = TryCreateFvg(k, s.Direction, atr);
                if (NsOverlap(fvg, low, high)) { c.FvgEvidence = fvg; break; }
            }
            int taken = s.TakenIndex;
            s.TakenIndex = s.StartIndex;
            c.ObEvidence = FindOriginOrderBlock(s, atr);
            s.TakenIndex = taken;
            if (!NsOverlap(c.ObEvidence, low, high)) c.ObEvidence = null;
            return NsEvidenceZone(c, low, high, sourceIndex, s.SetupType + " Source", int.MaxValue);
        }

        private ZoneInfo NsQualify(SetupState s, ZoneInfo z, double atr, int sourceQuality)
        {
            if (z == null || !NsFinite(atr) || atr <= 0) return NsRej<ZoneInfo>(NsMod(s), "NsQualify:L500");
            z.Width = z.High - z.Low; z.WidthAtr = z.Width / atr;
            if (!NsFinite(z.Width) || z.Width < Symbol.TickSize - 1e-10 || z.WidthAtr > MaximumZoneWidthAtr)
            { NsFE(NsMod(s), "qualify_detail:width", "dir=" + s.Direction + "|width=" + Fi(z.Width) + "|atr=" + Fi(atr) + "|widthAtr=" + Fi(z.WidthAtr) + "|max=" + Fi(MaximumZoneWidthAtr)); }
            if (!NsFinite(z.Width) || z.Width < Symbol.TickSize - 1e-10 || z.WidthAtr > MaximumZoneWidthAtr) return NsRej<ZoneInfo>(NsMod(s), "NsQualify:L504");
            z.HasDisplacement = s.HasDisplacement;
            z.InCorrectPremiumDiscount = IsCorrectPremiumDiscount(s, z);
            z.OteConfluence = HasOteConfluence(s, z);
            z.Quality = Math.Min(sourceQuality, EvaluateZoneQuality(z));
            if (RequireCompositeZone && !z.Composite) return NsRej<ZoneInfo>(NsMod(s), "NsQualify:L509");
            // NS-2 authorizes only these four primary cores to use genuine non-FVG zones.
            bool nonFvgCore = s.NsNew && (s.NsCore == "K01" || s.NsCore == "K03" || s.NsCore == "K04" || s.NsCore == "K05");
            if ((!nonFvgCore && !z.HasFvg) || !z.HasDisplacement || !z.InCorrectPremiumDiscount || z.Quality < MinimumZoneQuality)
                NsFE(NsMod(s), "qualify_detail:zone", "dir=" + s.Direction + "|fvg=" + z.HasFvg + "|disp=" + z.HasDisplacement + "|pd=" + z.InCorrectPremiumDiscount + "|q=" + z.Quality + "|min=" + MinimumZoneQuality + "|widthAtr=" + Fi(z.WidthAtr));
            if ((!nonFvgCore && !z.HasFvg) || !z.HasDisplacement || !z.InCorrectPremiumDiscount || z.Quality < MinimumZoneQuality) return NsRej<ZoneInfo>(NsMod(s), "NsQualify:L514");
            return z;
        }
        private ZoneInfo NsClipZone(SetupState s, ZoneInfo source, double atr, double blockLow, double blockHigh, bool ote)
        {
            double low, high;
            if (source == null || !EntryGeometry.Clip(s.Direction, source.Low, source.High, s.ImpulseLow, s.ImpulseHigh,
                blockLow, blockHigh, ote, Symbol.TickSize, out low, out high)) return NsRej<ZoneInfo>(NsMod(s), "NsClipZone:L521");
            var fvg = TryCreateFvg(source.SourceIndex, s.Direction, atr);
            int taken = s.TakenIndex;
            if (s.NsNew) s.TakenIndex = s.StartIndex;
            var ob = FindOriginOrderBlock(s, atr); s.TakenIndex = taken;
            bool hasFvg = fvg != null && Math.Min(high, fvg.High) > Math.Max(low, fvg.Low);
            bool hasOb = ob != null && Math.Min(high, ob.High) > Math.Max(low, ob.Low);
            if (!hasFvg && !s.NsNew)
                NsFE(NsMod(s), "clip_detail:no_fvg_overlap", "dir=" + s.Direction + "|srcLabel=" + source.Label + "|srcIdx=" + source.SourceIndex + "|src=" + Fi(source.Low) + "-" + Fi(source.High) +
                    "|clip=" + Fi(low) + "-" + Fi(high) + "|fvgAtSrcIdx=" + (fvg == null ? "null" : Fi(fvg.Low) + "-" + Fi(fvg.High)) + "|srcHasFvg=" + source.HasFvg);
            var z = new ZoneInfo { Low = low, High = high, SourceIndex = source.SourceIndex, HasFvg = hasFvg, HasOrderBlock = hasOb,
                Composite = source.Composite && hasFvg && hasOb, Label = source.Label + (ote ? " OTE" : " Block") };
            return NsQualify(s, z, atr, source.Quality);
        }
        private bool NsInvalid(NsCandidate c, int i, double atr, DateTime t)
        {
            var p = c.Pattern; var s = c.State;
            int index = p.Core == "K05" ? NsClosedIndex(_h1, 60, t) : p.Core == "K01" ? i : NsClosedIndex(_m15, 15, t);
            double buffer = Math.Max(Symbol.TickSize, atr * MssAtrBuffer);
            string mod = NsMod(s);
            string deadline = NsRules.DeadlineReason(i, c.Deadline, index, p.DeadlineIndex);
            if (deadline != null) { NsF(mod, "invalid:" + deadline); return true; }
            if (t >= c.JudasDeadline) { NsF(mod, "invalid:judas_window_end"); return true; }
            if (!NsContext(p.Core, s.Direction, t)) { NsF(mod, "invalid:context_lost"); return true; }
            if (s.Direction > 0 ? _exec.LowPrices[i] < p.InvalidExtreme - buffer : _exec.HighPrices[i] > p.InvalidExtreme + buffer) { NsF(mod, "invalid:extreme_broken"); return true; }
            if ((p.Core == "K03" || p.Core == "K04") && (s.Direction > 0 ? _exec.ClosePrices[i] < p.BlockLow - buffer : _exec.ClosePrices[i] > p.BlockHigh + buffer)) { NsF(mod, "invalid:block_close_through"); return true; }
            if (s.Zone != null && IsZoneInvalidatedForDirection(s.Zone, i, s.Direction, atr)) { NsF(mod, "invalid:zone_invalidated"); return true; }
            return false;
        }
        private bool NsStep(NsCandidate c, int i, double atr, DateTime t)
        {
            if (c.Terminal) return false;
            c.Ready = false;
            NsF(NsMod(c.State), "step");
            if (c.LastLifecycleIndex >= 0 && i > c.LastLifecycleIndex + 1)
            { NsConsume(c, "NsStep:L556"); return false; }
            c.LastLifecycleIndex = i;
            var s = c.State;
            if (NsInvalid(c, i, atr, t)) { NsConsume(c, "NsStep:L559"); return false; }
            if (s.Zone == null)
            {
                // Missing/failed source is terminal; NEW never waits for a later FVG.
                NsConsume(c, "NsStep:L563");
                return false;
            }
            if (i <= c.FreezeIndex || i <= c.EventStart) return false;
            bool touch = BarTouchesZone(i, s.Zone);
            if (touch && !c.Touching)
            {
                if (++c.Episodes > 1) { NsConsume(c, "NsStep:L570"); return false; }
                if ((c.Pattern.Core == "K03" || c.Pattern.Core == "K04") &&
                    (s.Direction > 0 ? _exec.ClosePrices[i - 1] < s.Zone.High : _exec.ClosePrices[i - 1] > s.Zone.Low))
                { NsConsume(c, "NsStep:L573"); return false; }
                NsFE(NsMod(s), "touch", "dir=" + s.Direction + "|zone=" + Fi(s.Zone.Low) + "-" + Fi(s.Zone.High) + "|q=" + s.Zone.Quality);
                s.TouchIndex = i; s.ZoneTouches = 1; s.EntryTrigger = "ZoneRetest"; s.Stage = SetupStage.WaitingConfirmation;
                c.Deadline = NsRules.TouchDeadline(c.Deadline, i, ScaleLogicBars(5)); s.ExpiryIndex = c.Deadline;
            }
            c.Touching = touch;
            if (s.TouchIndex < 0) return false;
            double fill = EntryGeometry.FillRatio(s.Direction, s.Zone.Low, s.Zone.High, _exec.LowPrices[i], _exec.HighPrices[i]);
            if (!NsFinite(fill)) { NsConsume(c, "NsStep:L581"); return false; }
            s.MaxFillRatio = Math.Max(s.MaxFillRatio, Math.Max(0, fill));
            if (s.MaxFillRatio > MaximumZoneFill) { NsConsume(c, "NsStep:L583"); return false; }
            if (!IsReactionConfirmation(s, i, atr)) { NsF(NsMod(s), "await_confirmation"); return false; }
            NsFE(NsMod(s), "confirmed", "dir=" + s.Direction);
            c.Ready = true; return true;
        }
        private bool NsDuplicate(NsCandidate a, NsCandidate b)
        {
            var z = b.State.Zone;
            return NsMatchesIdentity(a, b.Pattern, b.LiquidityId, z == null ? 0 : z.Low, z == null ? 0 : z.High);
        }
        private bool NsMatchesIdentity(NsCandidate a, Pattern p, string liquidityId, double low, double high)
        {
            if (a.Pattern.Direction != p.Direction) return false;
            bool sameTf = (a.Pattern.Core == "K05") == (p.Core == "K05") && (a.Pattern.Core == "K01") == (p.Core == "K01");
            if (sameTf && a.Pattern.BreakUtc == p.BreakUtc) return true;
            bool overlap = a.State.Zone != null && Math.Min(a.State.Zone.High, high) > Math.Max(a.State.Zone.Low, low);
            return overlap && (a.LiquidityId == liquidityId || (sameTf && a.Pattern.Anchors.SequenceEqual(p.Anchors)));
        }
        private void NsConsume(NsCandidate c, string why = null)
        {
            if (c.IdentityRecorded) return;
            NsFE(NsMod(c.State), "consume:" + (why ?? "unspecified"), "dir=" + c.State.Direction + "|id=" + c.State.NsId);
            var z = c.State.Zone ?? c.SourceZone;
            _nsConsumed.Add(new NsConsumedIdentity { Pattern = c.Pattern, LiquidityId = c.LiquidityId,
                Low = z == null ? c.Pattern.BlockLow : z.Low, High = z == null ? c.Pattern.BlockHigh : z.High });
            c.IdentityRecorded = true;
            c.Terminal = true;
            if (why != "episode_consumed_after_selection")
                CandEnd(c.State, Server.Time, why == "duplicate_of_selected" ? CandidateTerminalStage.Deduped : CandidateTerminalStage.Invalidated, why ?? "unspecified");
        }
        private void NsConsumeEpisode(NsCandidate c)
        {
            // Snapshot all matching candidates BEFORE execution can State.Reset().
            var duplicates = _nsCandidates.Where(x => NsDuplicate(c, x)).ToList();
            NsConsume(c, "episode_consumed_after_selection");
            foreach (var duplicate in duplicates) NsConsume(duplicate, "duplicate_of_selected");
        }
        private void NsAdvance(int i, double atr, DateTime t)
        {
            if (!NsCoresEnabled()) return;
            if (i <= _nsLastExec) return;
            _nsLastExec = i;
            // Validate fully closed snapshots; missing/malformed data cannot park old ready entries.
            var m15 = NsBars(_m15, 15, t, 160); var h1 = NsBars(_h1, 60, t, 120);
            var execution = NsBars(_exec, 2, t, 40);
            if (m15 == null || h1 == null || execution == null || execution[execution.Count - 1].Index != i || !NsFinite(atr) || atr <= 0)
            { NsF("ALL", "advance_bars_invalid"); foreach (var c in _nsCandidates) NsConsume(c, "advance_bars_invalid"); return; }
            NsRecordTakes(i, atr, t);
            // Snapshot parked candidates before advancing Judas. New Judas candidates
            // freeze on this bar and must not be processed until the next closed bar.
            var parkedCandidates = _nsCandidates.ToList();
            if (EnableJudas) NsAdvanceJudas(i, atr, t);
            NsF("ALL", "advance_bars_ok");
            var ready = parkedCandidates.Where(c => !c.Terminal && NsStep(c, i, atr, t)).OrderBy(c => c.ActivationUtc)
                .ThenBy(c => c.Pattern.BreakUtc).ThenBy(c => c.Pattern.Core, StringComparer.Ordinal)
                .ThenBy(c => c.State.Direction).ThenBy(c => c.State.NsId, StringComparer.Ordinal).ToList();
            if (_lastAcceptedSignalUtc != t && ready.Count > 0)
            {
                // Opposite directions are rejected only when both survive the original gateway/score/SL/TP guards.
                foreach (var c in ready) NsF(NsMod(c.State), "ready");
                var eligible = ready.Where(c => NsPreflight(c.State, i, atr, t)).ToList();
                foreach (var c in eligible) NsF(NsMod(c.State), "preflight_pass");
                if (eligible.Select(c => c.State.Direction).Distinct().Count() > 1)
                { foreach (var c in eligible) NsF(NsMod(c.State), "rej:opposite_direction_conflict"); foreach (var c in eligible) NsConsumeEpisode(c); }
                else if (eligible.Count > 0)
                {
                    foreach (var c in eligible.Skip(1)) NsF(NsMod(c.State), "rej:lost_to_earlier_ready_same_bar");
                    var first = eligible[0]; NsConsumeEpisode(first); NsF(NsMod(first.State), "exec_call"); TryExecuteSetup(first.State, i, atr, t);
                }
                foreach (var c in ready.Except(eligible))
                    NsConsumeEpisode(c);
            }
            else if (_lastAcceptedSignalUtc == t)
            { foreach (var c in ready) NsF(NsMod(c.State), "rej:same_signal_utc_already_accepted"); foreach (var c in ready) NsConsumeEpisode(c); }
            int mi = m15[m15.Count - 1].Index, hi = h1[h1.Count - 1].Index;
            foreach (int d in new[] { 1, -1 })
            {
                if ((d > 0 && !EnableLongs) || (d < 0 && !EnableShorts)) continue;
                if (mi != _nsLastM15 && (EnableBreaker || EnableMitigation))
                    foreach (var p in Patterns.Detect(m15, 15, d, Symbol.TickSize, MinimumSweepPips * StrategyPip, MinimumSweepAtr, MssAtrBuffer))
                        if ((p.Core == "K03" && EnableBreaker) || (p.Core == "K04" && EnableMitigation))
                        {
                            NsFE(NsModP(p), "detector_hit", "dir=" + p.Direction + "|id=" + p.Id);
                            string cand = CandBeginPattern(p, t); var c = NsAcceptPattern(p, i, atr, t);
                            if (c != null) { c.CandidateId = cand; CandBind(c.State, cand, t); _nsCandidates.Add(c); }
                            else CandEndById(cand, t, CandidateTerminalStage.FormationRejected, "pattern_build_rejected");
                        }
                if (hi != _nsLastH1 && EnableAtm)
                    foreach (var p in Patterns.Detect(h1, 60, d, Symbol.TickSize, MinimumSweepPips * StrategyPip, MinimumSweepAtr, MssAtrBuffer))
                    {
                        NsFE(NsModP(p), "detector_hit", "dir=" + p.Direction + "|id=" + p.Id);
                        string cand = CandBeginPattern(p, t); var c = NsAcceptPattern(p, i, atr, t);
                        if (c != null) { c.CandidateId = cand; CandBind(c.State, cand, t); _nsCandidates.Add(c); }
                        else CandEndById(cand, t, CandidateTerminalStage.FormationRejected, "pattern_build_rejected");
                    }
            }
            _nsLastM15 = mi; _nsLastH1 = hi;
            _nsCandidates.RemoveAll(c => c.Terminal);
        }
        private bool NsPreflight(SetupState s, int i, double atr, DateTime t)
        {
            string mod = NsMod(s);
            if (RequireExternalLiquidity && !s.LiquidityExternal) return NsRejB(mod, "pf:external_liquidity");
            string reason;
            if (!CanOpenNewTrade(t, s, false, out reason)) return NsRejB(mod, "pf:gate:" + reason);
            var regime = GetSetupRegime(s, t);   // v2.60-dev: same veto timing rule as the Parent order gate
            bool veto = BlockDeliveryVeto && regime.DeliveryVetoDirection == -s.Direction;
            if (veto && !(AllowAPlusCompositeAgainstDeliveryVeto && IsAPlusCompositeSetup(s))) return NsRejB(mod, "pf:delivery_veto");
            int score = ScoreSetup(s, i, atr, t, regime);
            int req = UseSessionFilter ? Math.Max(MinimumSignalScore, RequiredScoreForSession(t)) : MinimumSignalScore;
            if (score < req)
            { NsFE(mod, "rej:pf:score", "dir=" + s.Direction + "|score=" + score + "|req=" + req + "|session=" + SessionName(t)); return false; }
            double entry = s.Direction > 0 ? Symbol.Ask : Symbol.Bid;
            if (s.NsOte && !EntryGeometry.Contains(entry, s.Zone.Low, s.Zone.High))
            { NsFE(mod, "rej:pf:quote_outside_ote_zone", "dir=" + s.Direction + "|entry=" + Fi(entry) + "|zone=" + Fi(s.Zone.Low) + "-" + Fi(s.Zone.High)); return false; }
            double stop = EntryGeometry.StopTick(BuildStructuralStop(s, i, atr, entry), s.Direction, Symbol.TickSize);
            double risk = Math.Abs(entry - stop) / StrategyPip;
            if (!NsFinite(entry) || !NsFinite(stop) || !NsFinite(risk) || s.Direction * (entry - stop) <= 0) return NsRejB(mod, "pf:stop_geometry");
            if (risk < MinimumStopPips - 1e-9 || risk > EffectiveMaximumStopPips(s) + 1e-9)
            { NsFE(mod, "rej:pf:stop_distance", "dir=" + s.Direction + "|riskPips=" + Fi(risk) + "|max=" + Fi(EffectiveMaximumStopPips(s))); return false; }
            double tp1, tp2, p1, p2; string n1, n2;
            if (!TryBuildTradeTargets(s, entry, t, out tp1, out n1, out p1, out tp2, out n2, out p2)) return NsRejB(mod, "pf:no_target_room");
            double rr, rrRequired;   // v2.60-dev: one reward/risk rule (EvaluateRewardRisk) for preflight, order gate and post-fill
            if (!EvaluateRewardRisk(s, entry, risk, ref tp1, ref p1, p2, n2, out rr, out rrRequired))
            { NsFE(mod, "rej:pf:rr_floor", "dir=" + s.Direction + "|rr=" + Fi(rr) + "|req=" + Fi(rrRequired)); return false; }
            if (!(CalculateVolumeInUnits(risk, s.Direction > 0 ? TradeType.Buy : TradeType.Sell, true) >= Symbol.VolumeInUnitsMin)) return NsRejB(mod, "pf:volume");
            return true;
        }
        private static TimeZoneInfo NsNyZone()
        {
            // Fail closed if IANA rules are unavailable; no unverified Windows fallback.
            return TimeZoneInfo.FindSystemTimeZoneById("America/New_York");
        }
        private static bool NsNyBoundary(DateTime local, out DateTime utc)
        {
            var zone = NsNyZone(); local = DateTime.SpecifyKind(local, DateTimeKind.Unspecified); utc = DateTime.MinValue;
            if (zone.IsInvalidTime(local)) return false;
            if (zone.IsAmbiguousTime(local))
            { utc = zone.GetAmbiguousTimeOffsets(local).Select(offset => NsUtc(local - offset)).OrderBy(x => x).First(); return true; }
            utc = TimeZoneInfo.ConvertTimeToUtc(local, zone); return true;
        }
        private void NsFreezeJudas(DateTime t)
        {
            DateTime day = TimeZoneInfo.ConvertTimeFromUtc(NsUtc(t), NsNyZone()).Date;
            if (day != _nsJudasDay)
            {
                // Every attempt still open at the NY-day change gets exactly one terminal reason.
                foreach (var open in _nsJudas.Where(x => !x.Terminal)) { open.Terminal = true; NsF("JUDAS", "terminal:day_rollover"); }
                _nsJudasDay = day; _nsJudasRange = false; _nsJudasRejected = false; _nsJudas.Clear();
            }
            if (_nsJudasRange || _nsJudasRejected) return;
            DateTime start, end;
            if (!NsNyBoundary(day.AddDays(-1).AddHours(20), out start) || !NsNyBoundary(day, out end)) return;
            if (t < end.AddMinutes(2)) return; // still-open midnight is unavailable, not malformed
            _nsJudasRejected = true; // closed required anchors are terminal for this NY day
            NsF("JUDAS", "asia_range_checked");
            int count = 0; double low = double.MaxValue, high = double.MinValue;
            int closed = NsClosedIndex(_m15, 15, end);
            for (int k = closed; k >= 0 && _m15.OpenTimes[k] >= start; k--)
            {
                if (_m15.OpenTimes[k].AddMinutes(15) > end) continue;
                if (!NsValidBar(_m15, k) || (k < closed &&
                    _m15.OpenTimes[k + 1] - _m15.OpenTimes[k] != TimeSpan.FromMinutes(15))) { NsF("JUDAS", "day_terminal:asia_data_invalid_bar_or_gap"); return; }
                count++; low = Math.Min(low, _m15.LowPrices[k]); high = Math.Max(high, _m15.HighPrices[k]);
            }
            int key = _exec.OpenTimes.GetIndexByTime(end);
            if (count != 16 || high <= low) { NsF("JUDAS", "day_terminal:asia_range_invalid"); return; }
            if (key < 0 || _exec.OpenTimes[key] != end || !NsValidBar(_exec, key) || t < end.AddMinutes(2)) { NsF("JUDAS", "day_terminal:keyopen_invalid"); return; }
            _nsAsiaLow = low; _nsAsiaHigh = high; _nsKeyOpen = _exec.OpenPrices[key]; _nsJudasRange = true; _nsJudasRejected = false;
            NsFE("JUDAS", "asia_range_ok", "day=" + day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "|low=" + Fi(low) + "|high=" + Fi(high));
        }
        private void NsAdvanceJudas(int i, double atr, DateTime t)
        {
            NsFreezeJudas(t);
            DateTime local = TimeZoneInfo.ConvertTimeFromUtc(NsUtc(t), NsNyZone());
            if (!_nsJudasRange) { NsF("JUDAS", "bar_skipped:no_asia_range"); return; }
            if (local.TimeOfDay.TotalHours >= 5)
            {
                NsF("JUDAS", "bar_skipped:after_0500_ny");
                foreach (var open in _nsJudas.Where(x => !x.Terminal)) { open.Terminal = true; NsF("JUDAS", "terminal:window_end"); }
                return;
            }
            NsF("JUDAS", "bar_in_window");
            double sweep = Math.Max(MinimumSweepPips * StrategyPip, MinimumSweepAtr * atr);
            double tol = Math.Max(Symbol.TickSize * 2, .015 * atr), buffer = Math.Max(Symbol.TickSize, atr * MssAtrBuffer);
            bool longRaid = _exec.LowPrices[i] < _nsAsiaLow - sweep && _exec.ClosePrices[i - 1] >= _nsAsiaLow - tol;
            bool shortRaid = _exec.HighPrices[i] > _nsAsiaHigh + sweep && _exec.ClosePrices[i - 1] <= _nsAsiaHigh + tol;
            // R12: reject a two-sided Asia raid before advancing attempts or candidates.
            // A same-bar ambiguity is terminal for both directions and cannot leave a
            // previously parked K01 candidate executable through the request path.
            if (longRaid && shortRaid)
            {
                NsFE("JUDAS", "attempt_terminal:two_sided_raid", "");
                foreach (var a in _nsJudas.Where(x => !x.Terminal)) { a.Terminal = true; NsF("JUDAS", "terminal:two_sided_raid"); }
                    foreach (var c in _nsCandidates.Where(c => c.Pattern.Core == "K01" && c.LiquidityId != null && c.LiquidityId.StartsWith(_nsJudasDay.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "|Asia|", StringComparison.Ordinal)).ToList()) NsConsume(c, "NsAdvanceJudas:L756");
                foreach (int d in new[] { 1, -1 }) if (!_nsJudas.Any(x => x.Direction == d)) { _nsJudas.Add(new NsJudasAttempt { Direction = d, Terminal = true }); }
                return;
            }
            foreach (var a in _nsJudas.Where(x => !x.Terminal).ToList())
            {
                if (a.Reclaim < 0)
                {
                    // R11: the reclaim deadline is inclusive. Check it before
                    // accepting the reclaim; a late reclaim is terminal forever.
                    int reclaimDeadline = a.Sweep + ScaleLogicBars(2);
                    if (i > reclaimDeadline) { NsFE("JUDAS", "attempt_terminal:reclaim_deadline", "dir=" + a.Direction); NsF("JUDAS", "terminal:reclaim_deadline"); a.Terminal = true; continue; }
                    a.Extreme = a.Direction > 0 ? Math.Min(a.Extreme, _exec.LowPrices[i]) : Math.Max(a.Extreme, _exec.HighPrices[i]);
                    if (a.Direction * (_exec.ClosePrices[i] - a.Level) >= 0) { a.Reclaim = i; NsFE("JUDAS", "reclaim", "dir=" + a.Direction); }
                }
                if (a.Terminal || a.Reclaim < 0) continue;
                if (i > a.Reclaim + ScaleLogicBars(7) || (a.Direction > 0 ? _exec.LowPrices[i] < a.Extreme - buffer : _exec.HighPrices[i] > a.Extreme + buffer))
                { NsFE("JUDAS", "attempt_terminal:mss_window_or_extreme_broken", "dir=" + a.Direction); NsF("JUDAS", "terminal:mss_window_or_extreme_broken"); a.Terminal = true; continue; }
                if (i <= a.Sweep || a.Direction * (_exec.ClosePrices[i] - a.MssLevel) <= buffer ||
                    a.Direction * (_exec.ClosePrices[i] - a.KeyOpen) <= buffer || !HasDirectionalDisplacement(_exec, i, a.Direction, atr)) continue;
                double lo, hi; GetRangeExtremes(a.Sweep, i, out lo, out hi);
                if (a.Direction > 0) lo = a.Extreme; else hi = a.Extreme;
                var p = new Pattern { Core = "K01", Id = "K01|2|" + a.Direction + "|" + NsExecAnchorId(a.MssPivotIndex) + "|" + NsExecAnchorId(a.Sweep) + "|" +
                    NsExecAnchorId(a.Reclaim) + "|" + NsExecAnchorId(i) + "|" + NsUtc(t).ToString("O", CultureInfo.InvariantCulture),
                    Direction = a.Direction, StartIndex = a.Sweep, BreakIndex = i, DeadlineIndex = i + ScaleLogicBars(12), BreakUtc = NsUtc(t),
                    ImpulseLow = lo, ImpulseHigh = hi, InvalidExtreme = a.Extreme, Anchors = new[] { a.Sweep, a.Reclaim, i },
                    MssPivotIndex = a.MssPivotIndex, MssPivotConfirmedUtc = a.MssPivotConfirmedUtc,
                    AnchorOpenUtc = new[] { NsUtc(_exec.OpenTimes[a.Sweep]), NsUtc(_exec.OpenTimes[a.Reclaim]), NsUtc(_exec.OpenTimes[i]) },
                    AnchorConfirmedUtc = new[] { NsUtc(_exec.OpenTimes[a.Sweep].AddMinutes(2)), NsUtc(_exec.OpenTimes[a.Reclaim].AddMinutes(2)), NsUtc(t) } };
                NsFE("JUDAS", "detector_hit", "dir=" + a.Direction + "|id=" + p.Id);
                string cand = CandBeginPattern(p, t);
                var c = NsAcceptPattern(p, i, atr, t);
                if (c != null) { c.CandidateId = cand; CandBind(c.State, cand, t); _nsCandidates.Add(c); }
                else CandEndById(cand, t, CandidateTerminalStage.FormationRejected, "pattern_build_rejected");
                a.Terminal = true;
                NsF("JUDAS", c != null ? "terminal:pattern_accepted" : "terminal:pattern_rejected_by_build");
            }
            foreach (int d in new[] { 1, -1 })
            {
                if ((d > 0 ? !longRaid || !EnableLongs : !shortRaid || !EnableShorts) || _nsJudas.Any(x => x.Direction == d)) continue;
                double mss = FindMssLevelBefore(i, d); DateTime deadline;
                if (!NsNyBoundary(_nsJudasDay.AddHours(5), out deadline)) continue;
                var a = new NsJudasAttempt { Direction = d, Day = _nsJudasDay, Deadline = deadline, Sweep = i,
                    Extreme = d > 0 ? _exec.LowPrices[i] : _exec.HighPrices[i], Level = d > 0 ? _nsAsiaLow : _nsAsiaHigh,
                    KeyOpen = _nsKeyOpen, MssLevel = mss, Terminal = mss <= 0 };
                for (int k = i - ExecPivotRight - 1; k >= Math.Max(ExecPivotLeft, i - MssLookbackBars); k--)
                    if (IsPivot(_exec, k, d > 0, ExecPivotLeft, ExecPivotRight, i - 1))
                    { a.MssPivotIndex = k; a.MssPivotConfirmedUtc = NsUtc(_exec.OpenTimes[k + ExecPivotRight].AddMinutes(2)); break; }
                if (a.MssPivotIndex < 0) a.Terminal = true;
                if (mss <= 0) NsF("JUDAS", "terminal:no_mss_level");
                else if (a.MssPivotIndex < 0) NsF("JUDAS", "terminal:no_mss_pivot");
                if (d * (_exec.ClosePrices[i] - a.Level) >= 0) a.Reclaim = i;
                NsFE("JUDAS", "asia_raid", "dir=" + d + "|sweepIdx=" + i + "|mssLevel=" + Fi(mss) + "|terminalNoMssLevel=" + (mss <= 0) + "|terminalNoPivot=" + (a.MssPivotIndex < 0) + "|sameBarReclaim=" + (a.Reclaim == i));
                _nsJudas.Add(a);
            }
        }
    }
}
