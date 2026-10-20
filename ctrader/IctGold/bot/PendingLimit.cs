// v2.61-dev (item 4, part 2): resting limit orders at the consequent encroachment and several setups per direction.
//
// CE Execution = RestingLimit (only with Entry Mode = FvgCeTouch): as soon as a setup has its PD array (stage WaitingEntry) and
// the complete pre-order gate sequence passes for an entry AT the CE (PlanEntry, dry run), a limit order rests at the CE with
// SL/TP attached. It is re-planned on every closed execution bar (cancel/replace when stop, TP2 or volume change) and cancelled
// on every tick on which a gate turns red (session end, news window, caps, kill switch, G3 block), when the setup resets
// (invalidation, expiry, day roll) and at OnStop. Resting orders never exceed the free position slots. The fill is adopted by
// the same post-fill path as a market entry (AdoptFill: ledger, re-validation at the real fill, protection, managed trade).
// Whenever no order rests (gate red at the last re-plan, no free slot) the v2.60 tick trigger stays the fallback, so this mode
// never takes fewer entries than TickTrigger; it removes the slippage/latency of a market order sent after the touch.
//
// Setup Slots Per Direction > 1: a new liquidity raid in the same direction no longer waits until the running setup has ended;
// it arms a free slot. Slots never share liquidity, MSS or PD array (duplicates are dropped). 1 = v2.60.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using cAlgo.API;
using FailSafe;

namespace cAlgo.Robots
{
    public enum SmcCeExecution
    {
        TickTrigger,
        RestingLimit
    }

    public partial class IctGoldV259Dev
    {
        [Parameter("CE Execution", DefaultValue = SmcCeExecution.TickTrigger, Group = "18 v2.61 Execution")]
        public SmcCeExecution CeExecution { get; set; }

        [Parameter("Setup Slots Per Direction", DefaultValue = 1, MinValue = 1, MaxValue = 3, Group = "18 v2.61 Execution")]
        public int SetupSlotsPerDirection { get; set; }

        private readonly List<SetupState> _longSlots = new List<SetupState>();
        private readonly List<SetupState> _shortSlots = new List<SetupState>();
        private readonly HashSet<int> _cancelRetry = new HashSet<int>();
        private bool _closedBarThisTick;

        private bool RestingLimitsActive { get { return EntryMode == SmcEntryMode.FvgCeTouch && CeExecution == SmcCeExecution.RestingLimit; } }

        private IEnumerable<SetupState> ParentSlots()
        {
            foreach (SetupState s in _longSlots) yield return s;
            foreach (SetupState s in _shortSlots) yield return s;
        }

        private void CreateParentSlots()
        {
            _longSlots.Clear();
            _shortSlots.Clear();
            for (int k = 0; k < Math.Max(1, SetupSlotsPerDirection); k++)
            {
                _longSlots.Add(k == 0 ? _longState : NewParentSlot(1));
                _shortSlots.Add(k == 0 ? _shortState : NewParentSlot(-1));
            }
            foreach (SetupState s in ParentSlots())
                s.PendingCancelSink = CancelRestingFromReset;
        }

        private SetupState NewParentSlot(int direction)
        {
            return new SetupState(direction, NsF) { CandidateResetSink = CandReset };
        }

        private SetupState FirstWaitingSlot(int direction)
        {
            foreach (SetupState s in direction > 0 ? _longSlots : _shortSlots)
                if (s.Stage == SetupStage.Waiting)
                    return s;
            return null;
        }

        // One arming attempt per direction and bar (the first idle slot); busy slots advance as before. 1 slot = v2.60.
        private void AdvanceSlots(List<SetupState> slots, int i, double atr, DateTime timeUtc)
        {
            if (slots.Count == 1)
            {
                AdvanceState(slots[0], i, atr, timeUtc);
                return;
            }
            bool armingTried = false;
            foreach (SetupState s in slots)
            {
                bool idle = s.Stage == SetupStage.Waiting;
                if (idle && armingTried)
                    continue;
                AdvanceState(s, i, atr, timeUtc);
                if (idle)
                    armingTried = true;
                if (s.Stage != SetupStage.Waiting && s.Stage != SetupStage.ProtectionFailure && IsDuplicateSlot(s, slots))
                {
                    NsF("PARENT", "slot_duplicate");
                    s.Reset();
                }
            }
        }

        private bool IsDuplicateSlot(SetupState s, List<SetupState> slots)
        {
            double tol = Math.Max(Symbol.TickSize * 2.0, DuplicateLiquidityTolerancePips * StrategyPip);
            foreach (SetupState o in slots)
            {
                if (ReferenceEquals(o, s) || o.Stage == SetupStage.Waiting || o.Stage == SetupStage.ProtectionFailure)
                    continue;
                if (Math.Abs(o.LiquidityPrice - s.LiquidityPrice) <= tol)
                    return true;
                if (s.MssIndex >= 0 && o.MssIndex == s.MssIndex && Math.Abs(o.MssLevel - s.MssLevel) <= tol)
                    return true;
                if (s.Zone != null && o.Zone != null && s.Zone.SourceIndex == o.Zone.SourceIndex)
                    return true;
            }
            return false;
        }

        // ------------------------------------------------------------------ resting CE limit orders
        private void StartRestingLimits()
        {
            PendingOrders.Filled += OnRestingLimitFilled;
            // A resting order left by a previous run has no setup behind it: cancel it (never adopt it).
            if (FsLive && !_fsRecoveryOwner)
                return;
            foreach (PendingOrder o in PendingOrders.Where(FsOwned).ToList())
            {
                TradeResult r = CancelPendingOrder(o);
                Jr("pending", null, "event", DailyJournal.Q("stale_cancelled_at_start"), "order_id", o.Id.ToString(CultureInfo.InvariantCulture),
                   "result", DailyJournal.Q(r.IsSuccessful ? "ok" : "failed"));
                if (!r.IsSuccessful) _cancelRetry.Add(o.Id);
            }
        }

        private void StopRestingLimits()
        {
            PendingOrders.Filled -= OnRestingLimitFilled;
            foreach (SetupState s in ParentSlots())
                if (s.PendingOrderId != 0)
                    CancelResting(s, "bot stop");
        }

        private PendingOrder FindOwnPending(int id)
        {
            foreach (PendingOrder o in PendingOrders)
                if (o.Id == id && FsOwned(o))
                    return o;
            return null;
        }

        private void CancelRestingFromReset(SetupState s) { CancelResting(s, "setup reset"); }

        private void CancelResting(SetupState s, string reason)
        {
            int id = s.PendingOrderId;
            s.PendingOrderId = 0;
            s.PendingKey = "";
            if (id == 0)
                return;
            PendingOrder o = FindOwnPending(id);
            if (o == null)
                return;   // already filled/cancelled/expired; a late fill is handled as orphan
            TradeResult r = CancelPendingOrder(o);
            NsF("PARENT", "limit_cancel");
            if (!r.IsSuccessful)
            {
                _cancelRetry.Add(id);
                FsAlarm("resting limit cancel failed #" + id + " (" + reason + "); retry every tick, a fill is closed as orphan");
            }
            if (VerboseLog)
                Log("{0}: resting CE limit #{1} cancelled ({2}).", DirectionText(s.Direction), id, reason);
        }

        // Called every tick before the tick trigger. Cheap gate check every tick, full re-plan on closed execution bars only.
        private void ManageRestingLimits()
        {
            bool closedBar = _closedBarThisTick;
            _closedBarThisTick = false;
            foreach (int id in _cancelRetry.ToList())
            {
                PendingOrder o = FindOwnPending(id);
                if (o == null || CancelPendingOrder(o).IsSuccessful)
                    _cancelRetry.Remove(id);
            }
            if (!RestingLimitsActive)
                return;
            int closed = _exec.Count - 2;
            if (closed < 5)
                return;
            DateTime now = Server.Time;

            foreach (SetupState s in ParentSlots())
            {
                if (s.PendingOrderId == 0)
                    continue;
                if (FindOwnPending(s.PendingOrderId) == null) { s.PendingOrderId = 0; s.PendingKey = ""; continue; }   // expired/cancelled by the server
                string reason;
                if (s.NsNew || s.Stage != SetupStage.WaitingEntry || s.Zone == null)
                    CancelResting(s, "stage " + s.Stage);
                else if (!CanOpenNewTrade(now, s, s.SetupType == "FailedSetupFlip", out reason))
                    CancelResting(s, "gate " + reason);
            }
            if (!closedBar)
                return;

            double atr = CalculateAtr(_exec, closed, 14);
            if (atr <= 0)
                return;
            int room = MaxConcurrentPositions - Positions.FindAll(BotLabel, SymbolName).Length;
            int resting = ParentSlots().Count(x => x.PendingOrderId != 0);
            foreach (SetupState s in ParentSlots())
            {
                if (s.NsNew || s.NsOte || s.Stage != SetupStage.WaitingEntry || s.Zone == null || closed < s.Zone.SourceIndex)
                    continue;
                double ce = NormalizePrice(s.Zone.Midpoint);
                double quote = s.Direction > 0 ? Symbol.Ask : Symbol.Bid;
                if (s.PendingOrderId == 0 && (s.Direction > 0 ? quote <= ce + Symbol.TickSize : quote >= ce - Symbol.TickSize))
                    continue;   // at/through the CE already: the tick trigger decides
                if (UseSessionFilter && !IsTradingSession(now))
                    continue;
                // same touch context as ProcessCeEntries, so score and CE stop anchor are evaluated exactly as at a touch
                s.ZoneTouches = 1;
                s.TouchIndex = closed + 1;
                s.EntryTrigger = "CeTouch";
                s.ConfirmationType = "CE";
                string reject;
                EntryPlan plan = PlanEntry(s, closed, atr, now, ce, true, out reject);
                if (plan == null)
                {
                    if (s.PendingOrderId != 0) CancelResting(s, "re-plan " + reject);
                    continue;
                }
                string key = Px(plan.Stop) + "|" + Px(plan.Tp2) + "|" + plan.Volume.ToString("R", CultureInfo.InvariantCulture);
                if (s.PendingOrderId != 0)
                {
                    if (key == s.PendingKey)
                        continue;
                    CancelResting(s, "re-plan geometry");
                    resting--;
                }
                if (resting >= room)
                    continue;
                PlaceResting(s, plan, key, closed);
                if (s.PendingOrderId != 0)
                    resting++;
            }
        }

        private void PlaceResting(SetupState s, EntryPlan plan, string key, int closed)
        {
            double slPips = Math.Abs(plan.Entry - plan.Stop) / Symbol.PipSize;
            double tpPips = Math.Abs(plan.Tp2 - plan.Entry) / Symbol.PipSize;
            int bars = Math.Max(1, s.ExpiryIndex - closed + 1);
            DateTime expiry = _exec.OpenTimes[closed].AddMinutes((bars + 1) * ExecutionMinutes());
            string lane = NewSetups.NsRules.LaneComment(FsOwnerMarker, "Parent", false, false, null);
            string block;
            TradeResult r = FsGuardedLimitOrder(plan.TradeType, plan.Volume, plan.Entry, slPips, tpPips, expiry, lane, out block);
            if (block != null || r == null || !r.IsSuccessful || r.PendingOrder == null)
            {
                NsF("PARENT", block != null ? "rej:limit:g3_block" : "rej:limit:order_failed");
                return;
            }
            s.PendingOrderId = r.PendingOrder.Id;
            s.PendingKey = key;
            s.PendingScore = plan.Score;
            s.PendingSizingEquity = Account.Equity;
            s.PendingStop = plan.Stop;
            s.PendingTp2 = plan.Tp2;
            s.PendingReqBid = Symbol.Bid;
            s.PendingReqAsk = Symbol.Ask;
            s.PendingPlan = plan;
            NsF("PARENT", "limit_placed");
            Jr("pending", null, "event", DailyJournal.Q("limit_placed"), "order_id", s.PendingOrderId.ToString(CultureInfo.InvariantCulture),
               "side", DailyJournal.Q(plan.TradeType.ToString()), "price", DailyJournal.N(plan.Entry), "stop_loss", DailyJournal.N(plan.Stop),
               "take_profit", DailyJournal.N(plan.Tp2), "volume", DailyJournal.N(plan.Volume), "expiry_utc", DailyJournal.Q(expiry.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture)));
            if (VerboseLog)
                Log("{0}: resting CE limit #{1} @ {2}, SL {3}, TP2 {4}, score {5}, expiry {6:HH:mm}.", DirectionText(s.Direction), s.PendingOrderId,
                    Px(plan.Entry), Px(plan.Stop), Px(plan.Tp2), plan.Score, expiry);
        }

        private void OnRestingLimitFilled(PendingOrderFilledEventArgs args)
        {
            PendingOrder o = args.PendingOrder;
            Position p = args.Position;
            if (o == null || p == null || !FsOwned(o))
                return;
            _cancelRetry.Remove(o.Id);
            SetupState s = ParentSlots().FirstOrDefault(x => x.PendingOrderId == o.Id);
            DateTime now = Server.Time;
            if (_ks != null) _ks.Update(now, Account.Equity, Account.Balance, Account.Balance - _ks.LastBalance);   // fill cost is own trading
            int others = Positions.FindAll(BotLabel, SymbolName).Count(x => x.Id != p.Id);
            string anomaly = s == null ? "orphan resting limit fill (setup already gone)"
                : FsEntryBlock() != null ? "resting limit filled while entries are blocked: " + FsEntryBlock()
                : others >= MaxConcurrentPositions ? "resting limit filled beyond the concurrent position cap"
                : _tradesToday >= MaxTradesPerNyDay ? "resting limit filled beyond the daily trade cap" : null;
            if (s != null)
            {
                s.PendingOrderId = 0;
                s.PendingKey = "";
                _pendingReqBid = s.PendingReqBid;
                _pendingReqAsk = s.PendingReqAsk;
            }
            if (anomaly != null)
            {
                NsF("PARENT", "rej:limit:fill_anomaly");
                FsAlarm(anomaly + " #" + p.Id);
                if (!FsJournalOpened(p, p.StopLoss ?? 0, p.TakeProfit ?? 0, "RestingLimitAnomaly", now))
                {
                    if (s != null) { FsCloseWithRecovery(p, s, "resting limit anomaly ledger failure"); return; }
                }
                FsRequestClose(p, anomaly);
                if (s != null) s.Reset();
                return;
            }
            int closed = _exec.Count - 2;
            double atr = CalculateAtr(_exec, closed, 14);
            s.ZoneTouches = 1;
            s.TouchIndex = closed + 1;
            s.EntryTrigger = "CeTouch";
            s.ConfirmationType = "CE";
            string fm = NsMod(s);
            NsF("PARENT", "ce_touch");
            NsF(fm, "exec_enter");
            NsFE(fm, "order_request", "dir=" + s.Direction + "|type=" + s.SetupType + "|entryEst=" + Fi(o.TargetPrice) + "|resting=1");
            MetaRecordLimitFill(s, s.PendingPlan, closed, atr, now);
            AdoptFill(s, p, closed, atr, now, s.PendingScore, s.PendingSizingEquity, s.PendingStop, s.PendingTp2, fm);
        }
    }
}
