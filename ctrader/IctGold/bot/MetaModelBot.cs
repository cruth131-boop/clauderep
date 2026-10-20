// v2.61-dev (item 5): meta-labeling on the order gate. Default Off = v2.60.
//  Log       every setup that reaches the order gate writes META_CAND (decision, waived soft gates, geometry, features) and,
//            once resolved, META_OUT (bracket outcome: decision quote, plan stop, structural TP2). Trading is unchanged.
//  Shadow    Log + the model probability in META_CAND. Trading is unchanged.
//  Override  a setup rejected ONLY by soft gates the model was trained for (score, R/R floor, delivery veto, M5 internal
//            context, H4 bias, extended-session quality) is taken when p * TP2_R - (1 - p) >= the expected-R threshold and
//            TP2 is a real liquidity objective with TP2_R >= Meta Min R/R. Hard gates (session, news, caps, cooldowns, spread,
//            stop distance, margin, G3/kill switch) are never waived.
// The relaxed plan is a dry run of the unchanged gate sequence (PlanEntry quiet) with the soft gates waived, so features and
// geometry are exactly what the order would use.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using cAlgo.API;
using MetaLabel;

namespace cAlgo.Robots
{
    public enum SmcMetaMode
    {
        Off,
        Log,
        Shadow,
        Override
    }

    public partial class IctGoldV259Dev
    {
        [Parameter("Meta Mode", DefaultValue = SmcMetaMode.Off, Group = "19 v2.61 Meta-Labeling")]
        public SmcMetaMode MetaMode { get; set; }

        [Parameter("Meta Model Path", DefaultValue = "", Group = "19 v2.61 Meta-Labeling")]
        public string MetaModelPath { get; set; }

        // 0 = use the threshold stored in the model file.
        [Parameter("Meta Min Expected R (0=model)", DefaultValue = 0.0, MinValue = 0.0, MaxValue = 3.0, Step = 0.05, Group = "19 v2.61 Meta-Labeling")]
        public double MetaMinExpectedR { get; set; }

        [Parameter("Meta Min R/R", DefaultValue = 1.5, MinValue = 1.0, MaxValue = 5.0, Step = 0.1, Group = "19 v2.61 Meta-Labeling")]
        public double MetaMinRewardRisk { get; set; }

        [Parameter("Meta Shadow Horizon Minutes", DefaultValue = 240, MinValue = 30, MaxValue = 1440, Group = "19 v2.61 Meta-Labeling")]
        public int MetaShadowHorizonMinutes { get; set; }

        public static readonly string[] MetaSoftGates = { "score", "rr_floor", "delivery_veto", "m5_internal_context", "htf_bias", "gate:extended session quality" };

        private MetaModel _metaModel;
        private Bars _metaM1;
        private int _metaM1Done = -1;
        private long _metaSeq;
        private readonly List<BracketShadow> _metaPending = new List<BracketShadow>();
        private HashSet<string> _planWaive;                       // soft gates PlanEntry skips (dry runs of MetaDecide only)
        private readonly List<string> _planWaived = new List<string>();
        private int _metaOverrides;

        private bool PlanWaive(string gate)
        {
            if (_planWaive == null || !_planWaive.Contains(gate))
                return false;
            _planWaived.Add(gate);
            return true;
        }

        private void MetaStart()
        {
            if (MetaMode == SmcMetaMode.Off)
                return;
            _metaM1 = MarketData.GetBars(TimeFrame.Minute, SymbolName);
            _metaM1Done = _metaM1.Count - 2;
            if (MetaMode == SmcMetaMode.Shadow || MetaMode == SmcMetaMode.Override)
            {
                _metaModel = MetaModel.Load(MetaModelPath);   // fail-closed: a broken model stops the start
                foreach (string g in _metaModel.SoftGates)
                    if (!MetaSoftGates.Contains(g))
                        throw new InvalidOperationException("META: model lists gate '" + g + "' that is not an overridable soft gate.");
                Log("META: model {0} (trained on {1}), {2} features, min expected R {3:F2}, soft gates {4}.", _metaModel.Version, _metaModel.TrainedOn,
                    _metaModel.Features.Length, MetaThreshold(), string.Join(",", _metaModel.SoftGates));
            }
            Print("META_SCHEMA|version=1|mode={0}|soft_gates={1}|horizon_min={2}", MetaMode, string.Join(",", MetaSoftGates), MetaShadowHorizonMinutes);
        }

        private double MetaThreshold() { return MetaMinExpectedR > 0 ? MetaMinExpectedR : (_metaModel == null ? 0.2 : _metaModel.MinExpectedR); }

        // Called by TryExecuteSetup before the normal gate sequence. Returns a plan only when Override takes a soft-rejected setup.
        private EntryPlan MetaDecide(SetupState s, int i, double atr, DateTime timeUtc)
        {
            double quote = s.Direction > 0 ? Symbol.Ask : Symbol.Bid;
            // label entry: a CE touch is valued at the CE (what a resting limit gets), independent of the tick grid
            double labelEntry = s.EntryTrigger == "CeTouch" && s.Zone != null ? NormalizePrice(s.Zone.Midpoint) : quote;
            string strictReason, relaxedReason;
            EntryPlan strict = PlanEntry(s, i, atr, timeUtc, quote, true, out strictReason);
            EntryPlan relaxed = strict;
            List<string> waived = new List<string>();
            if (strict == null)
            {
                _planWaive = new HashSet<string>(MetaSoftGates, StringComparer.Ordinal);
                _planWaived.Clear();
                try { relaxed = PlanEntry(s, i, atr, timeUtc, quote, true, out relaxedReason); }
                finally { _planWaive = null; }
                waived = _planWaived.Distinct().ToList();
                if (relaxed == null)
                    return null;   // a hard gate rejects it as well: nothing to learn or to override
            }

            double tp2R = relaxed.RiskPips > 0 ? relaxed.Tp2Pips / relaxed.RiskPips : 0;
            double p = MetaProbability(s, relaxed, i, atr, timeUtc, waived);
            double expR = double.IsNaN(p) ? double.NaN : MetaModel.ExpectedR(p, tp2R);
            bool take = MetaMode == SmcMetaMode.Override && strict == null && _metaModel != null &&
                        waived.Count > 0 && waived.All(g => _metaModel.SoftGates.Contains(g)) &&
                        relaxed.Tp2Name != "Runner TP2" && tp2R >= MetaMinRewardRisk - 1e-9 && expR >= MetaThreshold();
            MetaRecord(s, relaxed, i, atr, timeUtc, take ? "override" : strict != null ? "accept" : "reject", strict != null ? "na" : strictReason, waived, labelEntry, p, expR);
            if (!take)
                return null;
            _metaOverrides++;
            NsF("PARENT", "meta_override");
            Log("{0}: META OVERRIDE of {1} (waived {2}): p={3:F3}, TP2 {4:F2}R, expected {5:F2}R >= {6:F2}.", DirectionText(s.Direction),
                strictReason, string.Join("+", waived), p, tp2R, expR, MetaThreshold());
            return relaxed;
        }

        private double MetaProbability(SetupState s, EntryPlan plan, int i, double atr, DateTime timeUtc, List<string> waived)
        {
            return _metaModel != null ? _metaModel.Probability(MetaFeatures(s, plan, i, atr, timeUtc, waived)) : double.NaN;
        }

        // A resting CE limit that filled is an accepted candidate as well (its plan was made at the CE when the order was placed).
        private void MetaRecordLimitFill(SetupState s, EntryPlan plan, int i, double atr, DateTime timeUtc)
        {
            if (MetaMode == SmcMetaMode.Off || plan == null || s.NsNew)
                return;
            var none = new List<string>();
            double tp2R = plan.RiskPips > 0 ? plan.Tp2Pips / plan.RiskPips : 0;
            double p = MetaProbability(s, plan, i, atr, timeUtc, none);
            MetaRecord(s, plan, i, atr, timeUtc, "accept", "na", none, plan.Entry, p, double.IsNaN(p) ? double.NaN : MetaModel.ExpectedR(p, tp2R));
        }

        private void MetaRecord(SetupState s, EntryPlan relaxed, int i, double atr, DateTime timeUtc, string decision, string strictReason,
            List<string> waived, double labelEntry, double p, double expR)
        {
            Dictionary<string, double> x = MetaFeatures(s, relaxed, i, atr, timeUtc, waived);
            string id = "M" + (++_metaSeq).ToString(CultureInfo.InvariantCulture);
            var sb = new StringBuilder("META_CAND|id=").Append(id)
                .Append("|t=").Append(timeUtc.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture))
                .Append("|dir=").Append(s.Direction)
                .Append("|type=").Append(string.IsNullOrEmpty(s.SetupType) ? "LiquiditySweep" : s.SetupType)
                .Append("|session=").Append(SessionName(timeUtc))
                .Append("|decision=").Append(decision)
                .Append("|reason=").Append(strictReason)
                .Append("|waived=").Append(waived.Count == 0 ? "na" : string.Join("+", waived))
                .Append("|entry=").Append(Px(labelEntry)).Append("|sl=").Append(Px(relaxed.Stop)).Append("|tp2=").Append(Px(relaxed.Tp2))
                .Append("|tp2_name=").Append((relaxed.Tp2Name ?? "").Replace('|', '/'))
                .Append("|p=").Append(double.IsNaN(p) ? "na" : p.ToString("0.####", CultureInfo.InvariantCulture))
                .Append("|exp_r=").Append(double.IsNaN(expR) ? "na" : expR.ToString("0.####", CultureInfo.InvariantCulture));
            foreach (var kv in x)
                sb.Append("|f_").Append(kv.Key).Append('=').Append(kv.Value.ToString("0.#####", CultureInfo.InvariantCulture));
            Print(sb.ToString());
            _metaPending.Add(new BracketShadow
            {
                Id = id, Direction = s.Direction, Entry = labelEntry, Stop = relaxed.Stop, Target = relaxed.Tp2, Spread = Symbol.Ask - Symbol.Bid,
                StartUtc = timeUtc, HorizonUtc = timeUtc.AddMinutes(MetaShadowHorizonMinutes)
            });
        }

        // Feature vector at the decision (names are the model contract; additive changes only).
        private Dictionary<string, double> MetaFeatures(SetupState s, EntryPlan plan, int i, double atr, DateTime timeUtc, List<string> waived)
        {
            var f = new Dictionary<string, double>(StringComparer.Ordinal);
            string type = string.IsNullOrEmpty(s.SetupType) ? "LiquiditySweep" : s.SetupType;
            f["dir"] = s.Direction;
            f["type_sweep"] = type == "LiquiditySweep" ? 1 : 0;
            f["type_turtle"] = type == "TurtleSoup" ? 1 : 0;
            f["type_session"] = type == "SessionSweep" ? 1 : 0;
            f["type_crt"] = type == "CRT Sweep" ? 1 : 0;
            f["type_cont"] = type == "Continuation" ? 1 : 0;
            f["type_m5"] = type == "M5 Internal" ? 1 : 0;
            f["type_flip"] = type == "FailedSetupFlip" ? 1 : 0;
            string session = SessionName(timeUtc);
            f["sess_london"] = session == "LONDON" ? 1 : 0;
            f["sess_nyam"] = session == "NY-AM" ? 1 : 0;
            f["sess_nypm"] = session == "NY-PM" ? 1 : 0;
            f["sess_ext"] = IsExtendedSession(session) ? 1 : 0;
            int required = UseSessionFilter ? Math.Max(MinimumSignalScore, RequiredScoreForSession(timeUtc)) : MinimumSignalScore;
            if (IsM5InternalSetup(s)) required = Math.Max(required, M5InternalMinimumScore);
            f["score"] = plan.Score;
            f["score_margin"] = plan.Score - required;
            ZoneInfo z = s.Zone;
            f["zone_q"] = z == null ? 0 : z.Quality;
            f["zone_comp"] = z != null && z.Composite ? 1 : 0;
            f["zone_fvg"] = z != null && z.HasFvg ? 1 : 0;
            f["zone_ob"] = z != null && z.HasOrderBlock ? 1 : 0;
            f["zone_pd"] = z != null && z.InCorrectPremiumDiscount ? 1 : 0;
            f["zone_ote"] = z != null && z.OteConfluence ? 1 : 0;
            f["zone_crt_pd"] = z != null && z.CrtCorrectPremiumDiscount ? 1 : 0;
            f["zone_w_atr"] = z == null ? 0 : z.WidthAtr;
            f["liq_strength"] = s.LiquidityStrength;
            f["liq_external"] = s.LiquidityExternal ? 1 : 0;
            f["same_bar_reclaim"] = s.SameBarReclaim ? 1 : 0;
            double risk = Math.Abs(plan.Entry - plan.Stop);
            f["tp2_r"] = plan.RiskPips > 0 ? plan.Tp2Pips / plan.RiskPips : 0;
            f["tp1_r"] = plan.RiskPips > 0 ? plan.Tp1Pips / plan.RiskPips : 0;
            f["risk_atr"] = atr > 0 ? risk / atr : 0;
            f["spread_risk"] = risk > 0 ? (Symbol.Ask - Symbol.Bid) / risk : 0;
            RegimeSnapshot regime = GetSetupRegime(s, timeUtc);
            f["reg_anchor"] = regime.AnchorTrend * s.Direction;
            f["reg_delivery"] = regime.DeliveryTrend * s.Direction;
            f["reg_exec"] = regime.ExecTrend * s.Direction;
            f["reg_regime"] = regime.Regime * s.Direction;
            f["veto_against"] = regime.DeliveryVetoDirection == -s.Direction ? 1 : 0;
            f["crt_reclaimed"] = s.CrtH1SweepReclaimed ? 1 : 0;
            f["crt_m15_reclaimed"] = s.CrtM15SweepReclaimed ? 1 : 0;
            f["mss_age_min"] = s.MssIndex >= 0 ? (i - s.MssIndex) * ExecutionMinutes() : 0;
            foreach (string g in MetaSoftGates)
                f["w_" + g.Replace("gate:", "").Replace(' ', '_')] = waived.Contains(g) ? 1 : 0;
            return f;
        }

        // Resolves pending bracket shadows on every newly closed M1 bar.
        private void MetaTick()
        {
            if (MetaMode == SmcMetaMode.Off || _metaM1 == null)
                return;
            int last = _metaM1.Count - 2;
            for (int k = Math.Max(0, _metaM1Done + 1); k <= last; k++)
            {
                DateTime t = _metaM1.OpenTimes[k];
                foreach (BracketShadow b in _metaPending.ToList())
                {
                    if (t <= b.StartUtc) continue;   // bars that opened after the decision only
                    if (b.OnBar(t, _metaM1.HighPrices[k], _metaM1.LowPrices[k], _metaM1.ClosePrices[k]))
                    {
                        Print(b.Format());
                        _metaPending.Remove(b);
                    }
                }
            }
            _metaM1Done = Math.Max(_metaM1Done, last);
        }

        private void MetaStop()
        {
            if (MetaMode == SmcMetaMode.Off)
                return;
            foreach (BracketShadow b in _metaPending)
            {
                b.Status = "CENSORED";
                Print(b.Format());
            }
            _metaPending.Clear();
            Print("META_DONE|overrides={0}", _metaOverrides);
        }
    }
}
