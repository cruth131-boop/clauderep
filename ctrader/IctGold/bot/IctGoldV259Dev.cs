using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Security.Cryptography;
using System.Text;
using cAlgo.API;
using CandidateTelemetry;
using cAlgo.API.Internals;
using FailSafe;

namespace cAlgo.Robots
{
    public enum SmcScalpExecutionTimeFrame
    {
        M1,
        M2,
        M5
    }

    public enum SmcScalpSizingMode
    {
        FixedLotsWithRiskCap,
        RiskPercent
    }

    public enum SmcNewsPositionAction
    {
        KeepOpen,
        CloseIfUnprotected,
        CloseAll
    }

    // v2.60-dev: reward/risk basis. Tp1 = v2.59 (TP1 / risk >= Minimum R/R). StructuralTarget = TP2 must be a real
    // liquidity objective and TP2 / risk >= Structural Minimum R/R; TP1 becomes the partial at >= TP1 Minimum R.
    public enum SmcRrBasis
    {
        Tp1,
        StructuralTarget
    }

    // v2.60-dev: entry mode. ConfirmationClose = v2.59 (market order after the reaction candle closed).
    // FvgCeTouch = market order on the tick that trades into the PD array at its consequent encroachment (50 %).
    public enum SmcEntryMode
    {
        ConfirmationClose,
        FvgCeTouch
    }

    public enum SmcCeStopAnchor
    {
        SweepExtreme,
        ZoneEdge
    }

    public enum SmcConsumedLiquidity
    {
        Off,
        Sweeps,
        Targets,
        Both
    }

    public enum SmcHtfBias
    {
        Off,
        H4Structure
    }

    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.FullAccess)]
    public partial class IctGoldV259Dev : Robot
    {
        private const string BotLabel = "SMC-PRECISION-SCALP-V235";

        // ========================= GENERAL =========================
        [Parameter("Required Symbol Prefix", DefaultValue = "XAUUSD", Group = "01 General")]
        public string RequiredSymbolPrefix { get; set; }

        [Parameter("Price per Strategy Pip", DefaultValue = 0.10, MinValue = 0.00001, Step = 0.01, Group = "01 General")]
        public double PricePerStrategyPip { get; set; }

        [Parameter("Execution Timeframe", DefaultValue = SmcScalpExecutionTimeFrame.M2, Group = "01 General")]
        public SmcScalpExecutionTimeFrame ExecutionTimeframe { get; set; }

        [Parameter("Enable Longs", DefaultValue = true, Group = "01 General")]
        public bool EnableLongs { get; set; }

        [Parameter("Enable Shorts", DefaultValue = true, Group = "01 General")]
        public bool EnableShorts { get; set; }

        [Parameter("Max Trades / NY Day", DefaultValue = 8, MinValue = 1, MaxValue = 20, Group = "01 General")]
        public int MaxTradesPerNyDay { get; set; }

        [Parameter("Signal Cooldown Minutes", DefaultValue = 6, MinValue = 0, MaxValue = 120, Group = "01 General")]
        public int SignalCooldownMinutes { get; set; }

        [Parameter("Loss Cooldown Minutes", DefaultValue = 20, MinValue = 0, MaxValue = 240, Group = "01 General")]
        public int LossCooldownMinutes { get; set; }

        [Parameter("Max Consecutive Losses", DefaultValue = 3, MinValue = 1, MaxValue = 10, Group = "01 General")]
        public int MaxConsecutiveLosses { get; set; }

        [Parameter("Scale M5 Logic Windows", DefaultValue = true, Group = "01 General")]
        public bool ScaleM5LogicWindows { get; set; }

        // ========================= SESSIONS =========================
        [Parameter("Use Session Filter", DefaultValue = true, Group = "02 Sessions NY")]
        public bool UseSessionFilter { get; set; }

        [Parameter("Trade Asia Open", DefaultValue = true, Group = "02 Sessions NY")]
        public bool TradeAsiaOpen { get; set; }

        [Parameter("Asia Start NY", DefaultValue = 20.0, MinValue = 0.0, MaxValue = 23.5, Step = 0.5, Group = "02 Sessions NY")]
        public double AsiaStartNy { get; set; }

        [Parameter("Asia End NY", DefaultValue = 23.5, MinValue = 0.5, MaxValue = 24.0, Step = 0.5, Group = "02 Sessions NY")]
        public double AsiaEndNy { get; set; }

        [Parameter("Trade London", DefaultValue = true, Group = "02 Sessions NY")]
        public bool TradeLondon { get; set; }

        [Parameter("London Start NY", DefaultValue = 1.5, MinValue = 0.0, MaxValue = 8.0, Step = 0.5, Group = "02 Sessions NY")]
        public double LondonStartNy { get; set; }

        [Parameter("London End NY", DefaultValue = 5.5, MinValue = 1.0, MaxValue = 10.0, Step = 0.5, Group = "02 Sessions NY")]
        public double LondonEndNy { get; set; }

        [Parameter("Trade NY AM", DefaultValue = true, Group = "02 Sessions NY")]
        public bool TradeNyAm { get; set; }

        [Parameter("NY AM Start NY", DefaultValue = 6.5, MinValue = 5.0, MaxValue = 10.0, Step = 0.5, Group = "02 Sessions NY")]
        public double NyAmStartNy { get; set; }

        [Parameter("NY AM End NY", DefaultValue = 11.5, MinValue = 8.0, MaxValue = 13.0, Step = 0.5, Group = "02 Sessions NY")]
        public double NyAmEndNy { get; set; }

        [Parameter("Trade NY PM", DefaultValue = false, Group = "02 Sessions NY")]
        public bool TradeNyPm { get; set; }

        [Parameter("NY PM Start NY", DefaultValue = 13.5, MinValue = 12.0, MaxValue = 15.0, Step = 0.5, Group = "02 Sessions NY")]
        public double NyPmStartNy { get; set; }

        [Parameter("NY PM End NY", DefaultValue = 15.5, MinValue = 14.0, MaxValue = 16.0, Step = 0.5, Group = "02 Sessions NY")]
        public double NyPmEndNy { get; set; }

        [Parameter("Asia Minimum Score", DefaultValue = 88, MinValue = 50, MaxValue = 100, Group = "02 Sessions NY")]
        public int AsiaMinimumScore { get; set; }

        [Parameter("London Minimum Score", DefaultValue = 74, MinValue = 50, MaxValue = 100, Group = "02 Sessions NY")]
        public int LondonMinimumScore { get; set; }

        [Parameter("NY AM Minimum Score", DefaultValue = 72, MinValue = 50, MaxValue = 100, Group = "02 Sessions NY")]
        public int NyAmMinimumScore { get; set; }

        [Parameter("NY PM Minimum Score", DefaultValue = 84, MinValue = 50, MaxValue = 100, Group = "02 Sessions NY")]
        public int NyPmMinimumScore { get; set; }

        [Parameter("Park Confirmation Minutes", DefaultValue = 20, MinValue = 0, MaxValue = 90, Group = "02 Sessions NY")]
        public int ParkConfirmationMinutes { get; set; }

        [Parameter("Core NY 08:30-11 Score Bonus", DefaultValue = 10, MinValue = 0, MaxValue = 20, Group = "02 Sessions NY")]
        public int CoreNyScoreBonus { get; set; }

        // v2.35: soft session expansion. Core windows keep their existing score rules;
        // extended windows are deliberately A+/high-quality only.
        [Parameter("Enable Extended Sessions", DefaultValue = true, Group = "02 Sessions NY")]
        public bool EnableExtendedSessions { get; set; }

        [Parameter("Extended Asia Start NY", DefaultValue = 19.5, MinValue = 0.0, MaxValue = 23.5, Step = 0.5, Group = "02 Sessions NY")]
        public double ExtendedAsiaStartNy { get; set; }

        [Parameter("Extended Asia End NY", DefaultValue = 1.0, MinValue = 0.0, MaxValue = 6.0, Step = 0.5, Group = "02 Sessions NY")]
        public double ExtendedAsiaEndNy { get; set; }

        [Parameter("Extended London Start NY", DefaultValue = 1.0, MinValue = 0.0, MaxValue = 6.0, Step = 0.5, Group = "02 Sessions NY")]
        public double ExtendedLondonStartNy { get; set; }

        [Parameter("Extended London End NY", DefaultValue = 6.5, MinValue = 3.0, MaxValue = 10.0, Step = 0.5, Group = "02 Sessions NY")]
        public double ExtendedLondonEndNy { get; set; }

        [Parameter("Extended NY AM Start NY", DefaultValue = 6.0, MinValue = 4.0, MaxValue = 10.0, Step = 0.5, Group = "02 Sessions NY")]
        public double ExtendedNyAmStartNy { get; set; }

        [Parameter("Extended NY AM End NY", DefaultValue = 12.0, MinValue = 9.0, MaxValue = 13.0, Step = 0.5, Group = "02 Sessions NY")]
        public double ExtendedNyAmEndNy { get; set; }

        [Parameter("Trade Extended NY PM", DefaultValue = true, Group = "02 Sessions NY")]
        public bool TradeExtendedNyPm { get; set; }

        [Parameter("Extended NY PM Start NY", DefaultValue = 12.5, MinValue = 11.5, MaxValue = 15.0, Step = 0.5, Group = "02 Sessions NY")]
        public double ExtendedNyPmStartNy { get; set; }

        [Parameter("Extended NY PM End NY", DefaultValue = 16.0, MinValue = 14.0, MaxValue = 17.0, Step = 0.5, Group = "02 Sessions NY")]
        public double ExtendedNyPmEndNy { get; set; }

        [Parameter("Extended Minimum Score", DefaultValue = 88, MinValue = 60, MaxValue = 100, Group = "02 Sessions NY")]
        public int ExtendedMinimumScore { get; set; }

        [Parameter("Extended Minimum Zone Q", DefaultValue = 90, MinValue = 70, MaxValue = 100, Group = "02 Sessions NY")]
        public int ExtendedMinimumZoneQuality { get; set; }

        [Parameter("Extended Require Composite", DefaultValue = true, Group = "02 Sessions NY")]
        public bool ExtendedRequireComposite { get; set; }

        [Parameter("Extended Allow A with Full CRT", DefaultValue = true, Group = "02 Sessions NY")]
        public bool ExtendedAllowAWithFullCrt { get; set; }

        [Parameter("Extended Require Strong Context", DefaultValue = true, Group = "02 Sessions NY")]
        public bool ExtendedRequireStrongContext { get; set; }

        // ========================= LIQUIDITY / SWEEP =========================
        [Parameter("M15 Liquidity Lookback", DefaultValue = 160, MinValue = 40, MaxValue = 500, Group = "03 Liquidity")]
        public int M15LiquidityLookback { get; set; }

        [Parameter("M15 Pivot Left", DefaultValue = 2, MinValue = 1, MaxValue = 5, Group = "03 Liquidity")]
        public int M15PivotLeft { get; set; }

        [Parameter("M15 Pivot Right", DefaultValue = 2, MinValue = 1, MaxValue = 5, Group = "03 Liquidity")]
        public int M15PivotRight { get; set; }

        [Parameter("Equal Liquidity Tolerance ATR", DefaultValue = 0.08, MinValue = 0.01, MaxValue = 0.30, Step = 0.01, Group = "03 Liquidity")]
        public double EqualLiquidityToleranceAtr { get; set; }

        [Parameter("Minimum Sweep ATR", DefaultValue = 0.02, MinValue = 0.0, MaxValue = 0.30, Step = 0.005, Group = "03 Liquidity")]
        public double MinimumSweepAtr { get; set; }

        [Parameter("Minimum Sweep Pips", DefaultValue = 3, MinValue = 0, MaxValue = 50, Group = "03 Liquidity")]
        public double MinimumSweepPips { get; set; }

        [Parameter("Reclaim Bars", DefaultValue = 2, MinValue = 0, MaxValue = 6, Group = "03 Liquidity")]
        public int ReclaimBars { get; set; }

        [Parameter("Require External Liquidity", DefaultValue = true, Group = "03 Liquidity")]
        public bool RequireExternalLiquidity { get; set; }

        [Parameter("Use Previous Day H/L", DefaultValue = true, Group = "03 Liquidity")]
        public bool UsePreviousDayLiquidity { get; set; }

        [Parameter("Use Asia H/L", DefaultValue = true, Group = "03 Liquidity")]
        public bool UseAsiaLiquidity { get; set; }

        [Parameter("Use London H/L", DefaultValue = true, Group = "03 Liquidity")]
        public bool UseLondonLiquidity { get; set; }

        [Parameter("Use M15 Swings / EQ", DefaultValue = true, Group = "03 Liquidity")]
        public bool UseM15Liquidity { get; set; }

        // v2.35 frequency lane: M5 liquidity is INTERNAL, never treated as equivalent to
        // PDH/PDL/session/M15/H1 external liquidity. It may only trade through the strict
        // context gate below.
        [Parameter("Enable M5 Internal Liquidity", DefaultValue = true, Group = "03A M5 Internal")]
        public bool EnableM5InternalLiquidity { get; set; }

        [Parameter("M5 Internal Lookback", DefaultValue = 96, MinValue = 24, MaxValue = 300, Group = "03A M5 Internal")]
        public int M5InternalLookback { get; set; }

        [Parameter("M5 Internal Pivot Left", DefaultValue = 2, MinValue = 1, MaxValue = 5, Group = "03A M5 Internal")]
        public int M5InternalPivotLeft { get; set; }

        [Parameter("M5 Internal Pivot Right", DefaultValue = 2, MinValue = 1, MaxValue = 5, Group = "03A M5 Internal")]
        public int M5InternalPivotRight { get; set; }

        [Parameter("M5 Internal EQ Tolerance ATR", DefaultValue = 0.06, MinValue = 0.01, MaxValue = 0.20, Step = 0.01, Group = "03A M5 Internal")]
        public double M5InternalEqualToleranceAtr { get; set; }

        [Parameter("M5 Internal Minimum Zone Q", DefaultValue = 90, MinValue = 75, MaxValue = 100, Group = "03A M5 Internal")]
        public int M5InternalMinimumZoneQuality { get; set; }

        [Parameter("M5 Internal Require Composite", DefaultValue = true, Group = "03A M5 Internal")]
        public bool M5InternalRequireComposite { get; set; }

        [Parameter("M5 Internal Require Core Session", DefaultValue = true, Group = "03A M5 Internal")]
        public bool M5InternalRequireCoreSession { get; set; }

        [Parameter("M5 Internal Require CRT P/D", DefaultValue = true, Group = "03A M5 Internal")]
        public bool M5InternalRequireCrtPremiumDiscount { get; set; }

        [Parameter("M5 Internal Require Delivery Align", DefaultValue = true, Group = "03A M5 Internal")]
        public bool M5InternalRequireDeliveryAlignment { get; set; }

        [Parameter("M5 Internal Minimum Score", DefaultValue = 88, MinValue = 70, MaxValue = 100, Group = "03A M5 Internal")]
        public int M5InternalMinimumScore { get; set; }

        [Parameter("M5 Internal Minimum R/R", DefaultValue = 1.70, MinValue = 1.0, MaxValue = 4.0, Step = 0.05, Group = "03A M5 Internal")]
        public double M5InternalMinimumRewardRisk { get; set; }

        [Parameter("M5 Internal Maximum Stop Pips", DefaultValue = 60, MinValue = 20, MaxValue = 100, Group = "03A M5 Internal")]
        public double M5InternalMaximumStopPips { get; set; }

        [Parameter("Use CRT H1 Liquidity Trigger", DefaultValue = true, Group = "03 Liquidity")]
        public bool UseCrtH1Range { get; set; }

        [Parameter("Use CRT M15 Liquidity Trigger", DefaultValue = false, Group = "03 Liquidity")]
        public bool UseCrtM15Range { get; set; }

        [Parameter("CRT Minimum Candle ATR", DefaultValue = 0.65, MinValue = 0.20, MaxValue = 2.0, Step = 0.05, Group = "03 Liquidity")]
        public double CrtMinimumCandleAtr { get; set; }

        [Parameter("Enable CRT Context Layer", DefaultValue = true, Group = "03B CRT Context")]
        public bool EnableCrtContextLayer { get; set; }

        [Parameter("Use M15 CRT Context", DefaultValue = true, Group = "03B CRT Context")]
        public bool UseCrtM15Context { get; set; }

        [Parameter("CRT H1 Context Lookback Bars", DefaultValue = 3, MinValue = 1, MaxValue = 8, Group = "03B CRT Context")]
        public int CrtH1ContextLookbackBars { get; set; }

        [Parameter("CRT M15 Context Lookback Bars", DefaultValue = 4, MinValue = 1, MaxValue = 12, Group = "03B CRT Context")]
        public int CrtM15ContextLookbackBars { get; set; }

        [Parameter("CRT M15 Minimum Candle ATR", DefaultValue = 0.55, MinValue = 0.20, MaxValue = 2.0, Step = 0.05, Group = "03B CRT Context")]
        public double CrtM15MinimumCandleAtr { get; set; }

        [Parameter("CRT Sweep+Reclaim Score", DefaultValue = 10, MinValue = 0, MaxValue = 20, Group = "03B CRT Context")]
        public int CrtSweepReclaimScore { get; set; }

        [Parameter("CRT Correct PD Score", DefaultValue = 8, MinValue = 0, MaxValue = 20, Group = "03B CRT Context")]
        public int CrtCorrectPremiumDiscountScore { get; set; }

        [Parameter("CRT H1+M15 Alignment Score", DefaultValue = 5, MinValue = 0, MaxValue = 15, Group = "03B CRT Context")]
        public int CrtH1M15AlignmentScore { get; set; }

        [Parameter("CRT Opposing Target Score", DefaultValue = 5, MinValue = 0, MaxValue = 15, Group = "03B CRT Context")]
        public int CrtOpposingTargetRoomScore { get; set; }

        [Parameter("CRT EQ Penalty", DefaultValue = 5, MinValue = 0, MaxValue = 15, Group = "03B CRT Context")]
        public int CrtEquilibriumPenalty { get; set; }

        [Parameter("CRT EQ Tolerance % Range", DefaultValue = 0.08, MinValue = 0.01, MaxValue = 0.30, Step = 0.01, Group = "03B CRT Context")]
        public double CrtEquilibriumToleranceRange { get; set; }

        [Parameter("CRT Target Room Minimum R", DefaultValue = 1.70, MinValue = 1.0, MaxValue = 5.0, Step = 0.05, Group = "03B CRT Context")]
        public double CrtTargetRoomMinimumR { get; set; }

        [Parameter("CRT Invalidate After Re-entry", DefaultValue = true, Group = "03B CRT Context")]
        public bool CrtInvalidateAfterReentry { get; set; }

        [Parameter("CRT Outside Close Buffer ATR", DefaultValue = 0.05, MinValue = 0.0, MaxValue = 0.30, Step = 0.01, Group = "03B CRT Context")]
        public double CrtOutsideCloseBufferAtr { get; set; }

        [Parameter("Prefer CRT Opposite Side TP2", DefaultValue = true, Group = "03B CRT Context")]
        public bool PreferCrtOppositeSideTp2 { get; set; }

        [Parameter("Use CRT EQ as TP1", DefaultValue = false, Group = "03B CRT Context")]
        public bool UseCrtEquilibriumAsTp1 { get; set; }

        // ========================= MSS / DISPLACEMENT =========================
        [Parameter("Exec Pivot Left", DefaultValue = 2, MinValue = 1, MaxValue = 5, Group = "04 MSS / Displacement")]
        public int ExecPivotLeft { get; set; }

        [Parameter("Exec Pivot Right", DefaultValue = 1, MinValue = 1, MaxValue = 4, Group = "04 MSS / Displacement")]
        public int ExecPivotRight { get; set; }

        [Parameter("MSS Lookback Bars", DefaultValue = 24, MinValue = 8, MaxValue = 80, Group = "04 MSS / Displacement")]
        public int MssLookbackBars { get; set; }

        [Parameter("Max Reclaim -> MSS Bars", DefaultValue = 7, MinValue = 2, MaxValue = 15, Group = "04 MSS / Displacement")]
        public int MaxReclaimToMssBars { get; set; }

        [Parameter("MSS ATR Buffer", DefaultValue = 0.01, MinValue = 0.0, MaxValue = 0.15, Step = 0.0025, Group = "04 MSS / Displacement")]
        public double MssAtrBuffer { get; set; }

        [Parameter("Displacement Body ATR", DefaultValue = 0.60, MinValue = 0.20, MaxValue = 2.0, Step = 0.05, Group = "04 MSS / Displacement")]
        public double DisplacementBodyAtr { get; set; }

        [Parameter("Displacement Range ATR", DefaultValue = 0.80, MinValue = 0.20, MaxValue = 3.0, Step = 0.05, Group = "04 MSS / Displacement")]
        public double DisplacementRangeAtr { get; set; }

        [Parameter("Displacement Min Body %", DefaultValue = 58, MinValue = 30, MaxValue = 95, Group = "04 MSS / Displacement")]
        public double DisplacementMinBodyPercent { get; set; }

        [Parameter("Block Delivery Veto", DefaultValue = true, Group = "04 MSS / Displacement")]
        public bool BlockDeliveryVeto { get; set; }

        [Parameter("Allow A+ Composite vs Delivery Veto", DefaultValue = true, Group = "04 MSS / Displacement")]
        public bool AllowAPlusCompositeAgainstDeliveryVeto { get; set; }

        // ========================= PD ARRAY / ENTRY =========================
        [Parameter("FVG Minimum ATR", DefaultValue = 0.03, MinValue = 0.0, MaxValue = 1.0, Step = 0.01, Group = "05 Entry Zone")]
        public double FvgMinimumAtr { get; set; }

        [Parameter("OB Search Back Bars", DefaultValue = 6, MinValue = 1, MaxValue = 20, Group = "05 Entry Zone")]
        public int ObSearchBackBars { get; set; }

        [Parameter("Minimum Zone Quality", DefaultValue = 70, MinValue = 50, MaxValue = 100, Group = "05 Entry Zone")]
        public int MinimumZoneQuality { get; set; }

        [Parameter("Require FVG + OB Overlap", DefaultValue = false, Group = "05 Entry Zone")]
        public bool RequireCompositeZone { get; set; }

        [Parameter("Maximum Zone Width ATR", DefaultValue = 1.25, MinValue = 0.20, MaxValue = 2.50, Step = 0.05, Group = "05 Entry Zone")]
        public double MaximumZoneWidthAtr { get; set; }

        [Parameter("Maximum Zone Fill", DefaultValue = 0.90, MinValue = 0.20, MaxValue = 1.00, Step = 0.05, Group = "05 Entry Zone")]
        public double MaximumZoneFill { get; set; }

        [Parameter("Max MSS -> Entry Bars", DefaultValue = 12, MinValue = 2, MaxValue = 20, Group = "05 Entry Zone")]
        public int MaxMssToEntryBars { get; set; }

        [Parameter("Touch -> Confirmation Bars", DefaultValue = 5, MinValue = 0, MaxValue = 8, Group = "05 Entry Zone")]
        public int TouchToConfirmationBars { get; set; }

        [Parameter("Reaction Body ATR", DefaultValue = 0.14, MinValue = 0.05, MaxValue = 1.50, Step = 0.01, Group = "05 Entry Zone")]
        public double ReactionBodyAtr { get; set; }

        [Parameter("Reaction vs Previous Body", DefaultValue = 0.35, MinValue = 0.0, MaxValue = 2.0, Step = 0.05, Group = "05 Entry Zone")]
        public double ReactionVsPreviousBody { get; set; }

        [Parameter("Minimum Signal Score", DefaultValue = 70, MinValue = 50, MaxValue = 100, Group = "05 Entry Zone")]
        public int MinimumSignalScore { get; set; }

        [Parameter("A-Zone Fast Reaction Quality", DefaultValue = 84, MinValue = 75, MaxValue = 100, Group = "05 Entry Zone")]
        public int AZoneFastReactionQuality { get; set; }

        [Parameter("A+ Zone Quality", DefaultValue = 94, MinValue = 85, MaxValue = 100, Group = "05 Entry Zone")]
        public int APlusZoneQuality { get; set; }

        [Parameter("A+ Body ATR", DefaultValue = 0.10, MinValue = 0.02, MaxValue = 1.00, Step = 0.01, Group = "05 Entry Zone")]
        public double APlusBodyAtr { get; set; }

        [Parameter("A+ Prev Body Factor", DefaultValue = 0.20, MinValue = 0.0, MaxValue = 2.0, Step = 0.05, Group = "05 Entry Zone")]
        public double APlusPreviousBodyFactor { get; set; }

        [Parameter("B-Zone Body ATR", DefaultValue = 0.25, MinValue = 0.05, MaxValue = 1.50, Step = 0.01, Group = "05 Entry Zone")]
        public double BZoneBodyAtr { get; set; }

        [Parameter("B-Zone Prev Body Factor", DefaultValue = 0.60, MinValue = 0.0, MaxValue = 2.0, Step = 0.05, Group = "05 Entry Zone")]
        public double BZonePreviousBodyFactor { get; set; }

        [Parameter("Rejection Wick / Body", DefaultValue = 0.75, MinValue = 0.10, MaxValue = 5.0, Step = 0.05, Group = "05 Entry Zone")]
        public double RejectionWickBodyRatio { get; set; }

        [Parameter("Rejection Close Location", DefaultValue = 0.60, MinValue = 0.50, MaxValue = 0.95, Step = 0.05, Group = "05 Entry Zone")]
        public double RejectionCloseLocation { get; set; }

        [Parameter("Enable Momentum Fallback", DefaultValue = false, Group = "05 Entry Zone")]
        public bool EnableMomentumFallback { get; set; }

        [Parameter("Momentum Minimum Zone Q", DefaultValue = 90, MinValue = 70, MaxValue = 100, Group = "05 Entry Zone")]
        public int MomentumMinimumZoneQuality { get; set; }

        [Parameter("Momentum Max Wait Bars", DefaultValue = 4, MinValue = 1, MaxValue = 12, Group = "05 Entry Zone")]
        public int MomentumMaxWaitBars { get; set; }

        [Parameter("Momentum Max Distance ATR", DefaultValue = 0.60, MinValue = 0.10, MaxValue = 2.0, Step = 0.05, Group = "05 Entry Zone")]
        public double MomentumMaxDistanceAtr { get; set; }

        [Parameter("Momentum Body ATR", DefaultValue = 0.25, MinValue = 0.05, MaxValue = 1.0, Step = 0.05, Group = "05 Entry Zone")]
        public double MomentumBodyAtr { get; set; }


        [Parameter("Use Broad ICT Trade Zone", DefaultValue = true, Group = "05 Entry Zone")]
        public bool UseBroadTradeZone { get; set; }

        [Parameter("Trade Zone Target Pips", DefaultValue = 40, MinValue = 10, MaxValue = 100, Group = "05 Entry Zone")]
        public double TradeZoneTargetPips { get; set; }

        [Parameter("Trade Zone Maximum Pips", DefaultValue = 55, MinValue = 15, MaxValue = 150, Group = "05 Entry Zone")]
        public double TradeZoneMaximumPips { get; set; }

        [Parameter("Bridge Nearby FVG + OB", DefaultValue = true, Group = "05 Entry Zone")]
        public bool BridgeNearbyFvgOb { get; set; }

        [Parameter("Max FVG-OB Bridge Pips", DefaultValue = 25, MinValue = 0, MaxValue = 100, Group = "05 Entry Zone")]
        public double MaxFvgObBridgePips { get; set; }

        [Parameter("Enable Failed Setup Flip", DefaultValue = false, Group = "05 Entry Zone")]
        public bool EnableFailedSetupFlip { get; set; }

        [Parameter("Failed Flip Window Minutes", DefaultValue = 90, MinValue = 10, MaxValue = 240, Group = "05 Entry Zone")]
        public int FailedFlipWindowMinutes { get; set; }

        [Parameter("Failed Flip Retest M5 Bars", DefaultValue = 6, MinValue = 2, MaxValue = 15, Group = "05 Entry Zone")]
        public int FailedFlipRetestBars { get; set; }

        [Parameter("Failed Flip Minimum Q", DefaultValue = 88, MinValue = 70, MaxValue = 100, Group = "05 Entry Zone")]
        public int FailedFlipMinimumQuality { get; set; }

        // ========================= STOP / TARGET =========================
        [Parameter("SL Buffer ATR", DefaultValue = 0.035, MinValue = 0.0, MaxValue = 0.30, Step = 0.005, Group = "06 Stop / Target")]
        public double StopBufferAtr { get; set; }

        [Parameter("SL Buffer Minimum Pips", DefaultValue = 2, MinValue = 0, MaxValue = 30, Group = "06 Stop / Target")]
        public double StopBufferMinimumPips { get; set; }

        [Parameter("Minimum Stop Pips", DefaultValue = 15, MinValue = 1, MaxValue = 100, Group = "06 Stop / Target")]
        public double MinimumStopPips { get; set; }

        [Parameter("Maximum Stop Pips", DefaultValue = 75, MinValue = 5, MaxValue = 200, Group = "06 Stop / Target")]
        public double MaximumStopPips { get; set; }

        [Parameter("A+ Composite Maximum Stop Pips", DefaultValue = 75, MinValue = 5, MaxValue = 200, Group = "06 Stop / Target")]
        public double APlusMaximumStopPips { get; set; }

        [Parameter("Preferred Scalp Target Pips", DefaultValue = 80, MinValue = 10, MaxValue = 500, Group = "06 Stop / Target")]
        public double PreferredScalpTargetPips { get; set; }

        [Parameter("Minimum Target Pips", DefaultValue = 55, MinValue = 5, MaxValue = 500, Group = "06 Stop / Target")]
        public double MinimumTargetPips { get; set; }

        [Parameter("Target Liquidity Buffer Pips", DefaultValue = 2, MinValue = 0, MaxValue = 30, Group = "06 Stop / Target")]
        public double TargetLiquidityBufferPips { get; set; }

        [Parameter("Minimum R/R", DefaultValue = 1.70, MinValue = 1.0, MaxValue = 5.0, Step = 0.05, Group = "06 Stop / Target")]
        public double MinimumRewardRisk { get; set; }

        [Parameter("A+ Composite Minimum R/R", DefaultValue = 1.70, MinValue = 1.0, MaxValue = 5.0, Step = 0.05, Group = "06 Stop / Target")]
        public double APlusMinimumRewardRisk { get; set; }

        [Parameter("Require Liquidity Room", DefaultValue = true, Group = "06 Stop / Target")]
        public bool RequireLiquidityRoom { get; set; }

        [Parameter("Skip Too-Close Liquidity", DefaultValue = true, Group = "06 Stop / Target")]
        public bool SkipTooCloseLiquidity { get; set; }


        [Parameter("Preferred Runner TP2 Pips", DefaultValue = 140, MinValue = 40, MaxValue = 500, Group = "06 Stop / Target")]
        public double PreferredRunnerTargetPips { get; set; }

        [Parameter("Minimum Runner TP2 Pips", DefaultValue = 90, MinValue = 30, MaxValue = 400, Group = "06 Stop / Target")]
        public double MinimumRunnerTargetPips { get; set; }

        [Parameter("Require Liquidity for TP2", DefaultValue = false, Group = "06 Stop / Target")]
        public bool RequireRunnerLiquidityRoom { get; set; }

        // ========================= BREAK-EVEN / MANAGEMENT =========================
        [Parameter("BE Arm Minimum Pips", DefaultValue = 35, MinValue = 5, MaxValue = 200, Group = "07 Trade Management")]
        public double BreakEvenArmMinimumPips { get; set; }

        [Parameter("BE Protected-Swing Min R", DefaultValue = 0.90, MinValue = 0.50, MaxValue = 2.0, Step = 0.05, Group = "07 Trade Management")]
        public double BreakEvenProtectedSwingMinR { get; set; }

        [Parameter("BE Fallback R", DefaultValue = 1.50, MinValue = 0.70, MaxValue = 3.0, Step = 0.05, Group = "07 Trade Management")]
        public double BreakEvenFallbackR { get; set; }

        [Parameter("BE Cost Buffer Pips", DefaultValue = 4, MinValue = 0, MaxValue = 20, Group = "07 Trade Management")]
        public double BreakEvenCostBufferPips { get; set; }

        [Parameter("Enable Structure Profit Lock", DefaultValue = true, Group = "07 Trade Management")]
        public bool EnableStructureProfitLock { get; set; }

        [Parameter("Structure Lock From R", DefaultValue = 1.35, MinValue = 0.8, MaxValue = 3.0, Step = 0.05, Group = "07 Trade Management")]
        public double StructureLockFromR { get; set; }

        [Parameter("Structure Lock Buffer Pips", DefaultValue = 2, MinValue = 0, MaxValue = 20, Group = "07 Trade Management")]
        public double StructureLockBufferPips { get; set; }

        [Parameter("Enable Time Stop", DefaultValue = true, Group = "07 Trade Management")]
        public bool EnableTimeStop { get; set; }

        [Parameter("Time Stop Minutes", DefaultValue = 24, MinValue = 4, MaxValue = 120, Group = "07 Trade Management")]
        public int TimeStopMinutes { get; set; }

        [Parameter("Time Stop Required MFE R", DefaultValue = 0.35, MinValue = 0.0, MaxValue = 2.0, Step = 0.05, Group = "07 Trade Management")]
        public double TimeStopRequiredMfeR { get; set; }

        [Parameter("Close at Session End", DefaultValue = false, Group = "07 Trade Management")]
        public bool CloseAtSessionEnd { get; set; }


        [Parameter("Use TP1 Partial Close", DefaultValue = true, Group = "07 Trade Management")]
        public bool UseTp1PartialClose { get; set; }

        [Parameter("TP1 Close Percent", DefaultValue = 50, MinValue = 10, MaxValue = 90, Group = "07 Trade Management")]
        public double Tp1ClosePercent { get; set; }

        [Parameter("After TP1 BE Buffer Pips", DefaultValue = 4, MinValue = 0, MaxValue = 30, Group = "07 Trade Management")]
        public double AfterTp1BreakEvenBufferPips { get; set; }

        [Parameter("BE Only After TP1", DefaultValue = true, Group = "07 Trade Management")]
        public bool BreakEvenOnlyAfterTp1 { get; set; }

        // v2.35: a protected runner must not block a completely new independent setup.
        [Parameter("Allow Trade with Protected Runner", DefaultValue = true, Group = "07 Trade Management")]
        public bool AllowTradeWithProtectedRunner { get; set; }

        [Parameter("Max Concurrent Positions", DefaultValue = 2, MinValue = 1, MaxValue = 4, Group = "07 Trade Management")]
        public int MaxConcurrentPositions { get; set; }

        [Parameter("Protected Runner Min Locked Pips", DefaultValue = 0, MinValue = 0, MaxValue = 30, Step = 1, Group = "07 Trade Management")]
        public double ProtectedRunnerMinimumLockedPips { get; set; }

        [Parameter("Block Same Liquidity While Runner Open", DefaultValue = true, Group = "07 Trade Management")]
        public bool BlockSameLiquidityWhileRunnerOpen { get; set; }

        [Parameter("Duplicate Liquidity Tolerance Pips", DefaultValue = 10, MinValue = 1, MaxValue = 50, Step = 1, Group = "07 Trade Management")]
        public double DuplicateLiquidityTolerancePips { get; set; }

        // ========================= RISK =========================
        [Parameter("Sizing Mode", DefaultValue = SmcScalpSizingMode.FixedLotsWithRiskCap, Group = "08 Risk")]
        public SmcScalpSizingMode SizingMode { get; set; }

        [Parameter("Fixed Lots", DefaultValue = 0.10, MinValue = 0.01, Step = 0.01, Group = "08 Risk")]
        public double FixedLots { get; set; }

        [Parameter("Risk % per Trade", DefaultValue = 0.50, MinValue = 0.05, MaxValue = 5.0, Step = 0.05, Group = "08 Risk")]
        public double RiskPercentPerTrade { get; set; }

        [Parameter("Max Risk % Hard Cap", DefaultValue = 0.75, MinValue = 0.05, MaxValue = 5.0, Step = 0.05, Group = "08 Risk")]
        public double MaximumRiskPercent { get; set; }

        [Parameter("Daily Realized Loss Limit %", DefaultValue = 2.0, MinValue = 0.5, MaxValue = 10.0, Step = 0.25, Group = "08 Risk")]
        public double DailyRealizedLossLimitPercent { get; set; }

        [Parameter("Max Spread Strategy Pips", DefaultValue = 5, MinValue = 0.5, MaxValue = 30, Step = 0.5, Group = "08 Risk")]
        public double MaximumSpreadPips { get; set; }

        // ========================= LIVE NEWS FILTER =========================
        [Parameter("Use News Filter", DefaultValue = true, Group = "09 Live News")]
        public bool UseNewsFilter { get; set; }

        [Parameter("ForexFactory JSON URL", DefaultValue = "https://nfs.faireconomy.media/ff_calendar_thisweek.json", Group = "09 Live News")]
        public string NewsFeedUrl { get; set; }

        [Parameter("News Currencies", DefaultValue = "USD", Group = "09 Live News")]
        public string NewsCurrencies { get; set; }

        [Parameter("Block Medium Impact", DefaultValue = false, Group = "09 Live News")]
        public bool BlockMediumImpactNews { get; set; }

        [Parameter("High Impact Minutes Before", DefaultValue = 20, MinValue = 0, MaxValue = 180, Group = "09 Live News")]
        public int HighImpactMinutesBefore { get; set; }

        [Parameter("High Impact Minutes After", DefaultValue = 15, MinValue = 0, MaxValue = 180, Group = "09 Live News")]
        public int HighImpactMinutesAfter { get; set; }

        [Parameter("Medium Impact Minutes Before", DefaultValue = 10, MinValue = 0, MaxValue = 120, Group = "09 Live News")]
        public int MediumImpactMinutesBefore { get; set; }

        [Parameter("Medium Impact Minutes After", DefaultValue = 5, MinValue = 0, MaxValue = 120, Group = "09 Live News")]
        public int MediumImpactMinutesAfter { get; set; }

        [Parameter("News Refresh Minutes", DefaultValue = 30, MinValue = 5, MaxValue = 360, Group = "09 Live News")]
        public int NewsRefreshMinutes { get; set; }

        [Parameter("News Fail-Safe Block", DefaultValue = true, Group = "09 Live News")]
        public bool NewsFailSafeBlock { get; set; }

        [Parameter("News Max Stale Minutes", DefaultValue = 720, MinValue = 60, MaxValue = 2880, Group = "09 Live News")]
        public int NewsMaxStaleMinutes { get; set; }

        [Parameter("Position Action", DefaultValue = SmcNewsPositionAction.CloseIfUnprotected, Group = "09 Live News")]
        public SmcNewsPositionAction NewsPositionAction { get; set; }

        [Parameter("Close High News Min Before", DefaultValue = 3, MinValue = 0, MaxValue = 60, Group = "09 Live News")]
        public int CloseHighNewsMinutesBefore { get; set; }

        [Parameter("Use Live Feed in Backtest", DefaultValue = false, Group = "09 Live News")]
        public bool UseLiveNewsInBacktest { get; set; }

        // v2.36-news: offline calendar as the sole backtest data source.
        [Parameter("Use File News Calendar", DefaultValue = false, Group = "09 Live News")]
        public bool UseFileNewsCalendar { get; set; }

        [Parameter("News Calendar Path", DefaultValue = "", Group = "09 Live News")]
        public string NewsCalendarPath { get; set; }

        // v2.61-dev: HIGH events without an exact time (TENTATIVE / ALL_DAY) follow the same rule live and in the backtest
        // calendar (see FailSafe.TentativeNews). v2.60 blocked the whole UTC day live but ignored such rows in backtests.
        [Parameter("Tentative HIGH News Policy", DefaultValue = FailSafe.TentativeNewsPolicy.WholeDay, Group = "09 Live News")]
        public FailSafe.TentativeNewsPolicy TentativeHighNewsPolicy { get; set; }

        // ========================= UI =========================
        [Parameter("Show Dashboard", DefaultValue = true, Group = "10 Dashboard")]
        public bool ShowDashboard { get; set; }

        [Parameter("Verbose Log", DefaultValue = true, Group = "10 Dashboard")]
        public bool VerboseLog { get; set; }

        // ========================= v2.60 LOGIC FIXES =========================
        // Every switch defaults to the v2.59 behaviour, so a v2.59 parameter set trades identically.
        // P1: search the FVG over the whole displacement leg (sweep -> MSS + 2), filter width / discount /
        // freshness per candidate BEFORE selecting. v2.59 only looked at MSS..MSS+2 (the premium end of the
        // leg) and picked the widest gap before the width check.
        [Parameter("FVG Search Whole Displacement Leg", DefaultValue = false, Group = "15 v2.60 Logic")]
        public bool FvgSearchWholeLeg { get; set; }

        // P2: a counter M5 MSS counts as delivery veto only if it closed AFTER this setup's MSS. The bearish M5
        // break that sweeps sell-side liquidity is the manipulation leg of the long, not a veto against it.
        [Parameter("Delivery Veto Only After MSS", DefaultValue = false, Group = "15 v2.60 Logic")]
        public bool DeliveryVetoAfterMssOnly { get; set; }

        // P3: static gates that are already decided when the zone is known (M5 internal quality / CRT P/D) reset
        // the setup at once instead of blocking the direction slot until the order gate.
        [Parameter("Fail-Fast Static Gates", DefaultValue = false, Group = "15 v2.60 Logic")]
        public bool FailFastStaticGates { get; set; }

        // P4: a sweep of stronger external liquidity replaces a pending weaker/internal candidate (before touch).
        [Parameter("Upgrade Slot On Stronger Sweep", DefaultValue = false, Group = "15 v2.60 Logic")]
        public bool UpgradeSlotOnStrongerSweep { get; set; }

        // P5: liquidity that was already traded through after it formed is not raided again (Sweeps) and/or is no TP
        // draw (Targets).
        [Parameter("Ignore Consumed Liquidity", DefaultValue = SmcConsumedLiquidity.Off, Group = "15 v2.60 Logic")]
        public SmcConsumedLiquidity IgnoreConsumedLiquidity { get; set; }

        // P6: a deep first touch (fill > Maximum Zone Fill) is kept when the touch candle closes back beyond the
        // zone midpoint (rejection); v2.59 reset every deep wick.
        [Parameter("Allow Deep Fill With Close Hold", DefaultValue = false, Group = "15 v2.60 Logic")]
        public bool AllowDeepFillWithHold { get; set; }

        // E1: reward/risk basis (see SmcRrBasis).
        [Parameter("R/R Basis", DefaultValue = SmcRrBasis.Tp1, Group = "15 v2.60 Logic")]
        public SmcRrBasis RrBasis { get; set; }

        [Parameter("Structural Minimum R/R (TP2)", DefaultValue = 2.0, MinValue = 1.0, MaxValue = 6.0, Step = 0.1, Group = "15 v2.60 Logic")]
        public double StructuralMinimumRewardRisk { get; set; }

        [Parameter("TP1 Minimum R (structural basis)", DefaultValue = 1.0, MinValue = 0.5, MaxValue = 3.0, Step = 0.1, Group = "15 v2.60 Logic")]
        public double Tp1MinimumR { get; set; }

        // E2: entry mode (see SmcEntryMode). CE entries ignore the broad trade zone and use the true PD array.
        [Parameter("Entry Mode", DefaultValue = SmcEntryMode.ConfirmationClose, Group = "15 v2.60 Logic")]
        public SmcEntryMode EntryMode { get; set; }

        [Parameter("CE Entry Stop Anchor", DefaultValue = SmcCeStopAnchor.SweepExtreme, Group = "15 v2.60 Logic")]
        public SmcCeStopAnchor CeStopAnchor { get; set; }

        // Quality counterweight: no trade against the H4 persistent structure (neutral H4 allowed).
        [Parameter("HTF Bias Filter", DefaultValue = SmcHtfBias.Off, Group = "15 v2.60 Logic")]
        public SmcHtfBias HtfBiasFilter { get; set; }

        // K-Cont: trend-continuation lane (London / NY killzones, M15 + M5 + H1 structure aligned, displacement break of
        // the last execution swing -> FVG of that leg). Uses the Parent zone, score, stop, target and R/R gates.
        [Parameter("Enable Continuation Lane", DefaultValue = false, Group = "15 v2.60 Logic")]
        public bool EnableContinuationLane { get; set; }

        // 1 = every M5 pivot (v2.59), 2 = only equal highs/lows (two or more pivots).
        [Parameter("M5 Internal Minimum Strength", DefaultValue = 1, MinValue = 1, MaxValue = 3, Group = "15 v2.60 Logic")]
        public int M5InternalMinimumStrength { get; set; }

        private Bars _exec;
        private Bars _m5;
        private Bars _m15;
        private Bars _h1;
        private Bars _h4;            // v2.60-dev: only loaded when the HTF bias filter is on
        private int _nsScope; // >0 while NsAdvance runs (NS-only closed-bar indexing)
        private SetupState _longState;
        private SetupState _shortState;
        private DateTime _lastProcessedExecOpen = DateTime.MinValue;
        private DateTime _lastAcceptedSignalUtc = DateTime.MinValue;
        private DateTime _lastLossUtc = DateTime.MinValue;
        private DateTime _nyTradeDate = DateTime.MinValue;
        private int _tradesToday;
        private int _consecutiveLosses;
        private double _dayStartBalance;
        private string _lastEvent = "Initialising";
        private DateTime _lastDashboardUtc = DateTime.MinValue;
        private readonly Dictionary<int, ManagedTrade> _managed = new Dictionary<int, ManagedTrade>();
        private readonly List<EconomicNewsEvent> _newsEvents = new List<EconomicNewsEvent>();
        private readonly HashSet<DateTime> _newsBlockedDays = new HashSet<DateTime>();   // v2.61-dev: backtest tentative/all-day days
        private DateTime _lastNewsRefreshUtc = DateTime.MinValue;
        private DateTime _lastNewsSuccessUtc = DateTime.MinValue;
        private string _newsStatus = "News not loaded";
        private bool _fileCalendarLoaded;
        private DateTime _newsCoverageStartUtc = DateTime.MinValue;
        private DateTime _newsCoverageEndUtc = DateTime.MinValue;
        private string _nextNewsText = "-";
        private FailedFlipCandidate _failedFlip;

        protected override void OnStart()
        {
            // v2.54-dev (F3): in live mode ANY start exception enters safety-only mode (exposure keeps being served,
            // entries locked) instead of propagating. Backtests keep strict start failures.
            StartupGuard.Run(FsLive, OnStartCore, FsEnterSafetyOnly);
        }

        private void OnStartCore()
        {
            // v2.47-dev is the first live-capable candidate. It does NOT auto-start or bypass
            // release approval; when intentionally started in RealTime, FsValidateLiveStart()
            // below enforces G3 configuration/state/journal prerequisites fail-closed.
            if (NsAnyEnabled() && ExecutionTimeframe != SmcScalpExecutionTimeFrame.M2)
                throw new InvalidOperationException("NS-1 requires closed M2 execution bars.");
            ValidateConfiguration();
            _strategyPip = PricePerStrategyPip;

            _exec = MarketData.GetBars(GetExecutionTimeFrame(), SymbolName);
            _m5 = MarketData.GetBars(TimeFrame.Minute5, SymbolName);
            _m15 = MarketData.GetBars(TimeFrame.Minute15, SymbolName);
            _h1 = MarketData.GetBars(TimeFrame.Hour, SymbolName);
            if (HtfBiasFilter != SmcHtfBias.Off)
                _h4 = MarketData.GetBars(TimeFrame.Hour4, SymbolName);

            EnsureHistory(_exec, 1200);
            EnsureHistory(_m5, 800);
            EnsureHistory(_m15, Math.Max(600, M15LiquidityLookback + 100));
            EnsureHistory(_h1, StrategyPipMode == SmcStrategyPipMode.AdrNormalized ? Math.Max(300, 24 * (AdrLookbackDays + 6)) : 300);
            if (_h4 != null)
                EnsureHistory(_h4, 200);
            UpdateStrategyPip(Server.Time, true);

            _longState = new SetupState(1, NsF) { CandidateResetSink = CandReset };
            _shortState = new SetupState(-1, NsF) { CandidateResetSink = CandReset };

            int closed = _exec.Count - 2;
            if (closed >= 0)
                _lastProcessedExecOpen = _exec.OpenTimes[closed];

            FsStartSequence();   // F3/F5: reset day, safety init, ledger restore, live validation (see FailSafeBot.cs)

            // v2.36-news: the offline calendar replaces the data source of
            // _newsEvents; it is verified fail-closed before the first tick.
            if (FileCalendarActive())
            {
                if (FsLive)
                {
                    // v2.54-dev: live reads ONLY the local MQL5 generation (current symlink), hot-reloaded, fail-closed.
                    try { LiveNewsStart(); }
                    catch (Exception ex)
                    {
                        _newsCoverageOk = false; _lastNewsSuccessUtc = DateTime.MinValue;
                        _newsStatus = "live news start failed: " + ex.GetType().Name;
                        FsAlarm("NEWS fail-closed: " + ex.Message);
                    }
                }
                else LoadFileNewsCalendar(); // historical runs retain strict start failure
            }
            else if (NewsFilterActive())
                RefreshNewsFeed(true);

            _lastEvent = "Ready";
            RefreshDashboard(true);
            Log("Ready v2.35. Exec={0}, strategy pip={1:F4}, TP1/TP2={2:F0}/{3:F0}p, stop={4:F0}-{5:F0}p (A+ {6:F0}p), RR={7:F2} (A+ {8:F2}), min score={9}.",
                ExecutionTimeframe, StrategyPip, PreferredScalpTargetPips, PreferredRunnerTargetPips,
                MinimumStopPips, MaximumStopPips, APlusMaximumStopPips, MinimumRewardRisk, APlusMinimumRewardRisk, MinimumSignalScore);
            Log("CRT v2.35: context={0}, H1 trigger={1}, M15 context={2}, M15 trigger={3}, opposite TP2={4}, EQ TP1={5}.",
                EnableCrtContextLayer, UseCrtH1Range, UseCrtM15Context, UseCrtM15Range, PreferCrtOppositeSideTp2, UseCrtEquilibriumAsTp1);
            Log("Frequency v2.35: extendedSessions={0} Q>={1} score>={2}, NYPM-ext={3:F1}-{4:F1}, protectedRunnerOverlap={5}, maxConcurrent={6}.",
                EnableExtendedSessions, ExtendedMinimumZoneQuality, ExtendedMinimumScore,
                ExtendedNyPmStartNy, ExtendedNyPmEndNy, AllowTradeWithProtectedRunner, MaxConcurrentPositions);
            Log("M5 internal v2.35: enabled={0}, Q>={1}, score>={2}, RR>={3:F2}, stop<={4:F0}p, coreOnly={5}, CRT-PD={6}, deliveryAlign={7}.",
                EnableM5InternalLiquidity, M5InternalMinimumZoneQuality, M5InternalMinimumScore,
                M5InternalMinimumRewardRisk, M5InternalMaximumStopPips,
                M5InternalRequireCoreSession, M5InternalRequireCrtPremiumDiscount, M5InternalRequireDeliveryAlignment);
        }

        protected override void OnTick()
        {
            if (FsSafetyOnlyTick()) return;   // F3: failed start -> only serve queued closes / ownership
            CandInitialize();
            CandAdvanceShadows(false);
            NsRetryProtectionFailures();
            ResetNyDay(Server.Time, false);

            if (NewsFilterActive())
            {
                RefreshNewsFeed(false);
                ManageNewsRisk(Server.Time);
            }

            ManageOpenPositions();

            int closed = _exec.Count - 2;
            if (closed >= 5 && _exec.OpenTimes[closed] > _lastProcessedExecOpen)
            {
                _lastProcessedExecOpen = _exec.OpenTimes[closed];
                ProcessClosedExecutionBar(closed);
            }

            if (EntryMode == SmcEntryMode.FvgCeTouch)
                ProcessCeEntries();

            RefreshDashboard(false);
        }

        protected override void OnStop()
        {
            FsOnStop();
            try { NsFunnelSummary(); } catch (Exception ex) { Print("NsFunnelSummary skipped: " + ex.GetType().Name); }
            try { CandOnStop(); } catch (Exception ex) { Print("CandOnStop skipped: " + ex.GetType().Name); }
            if (_longState != null) _longState.FunnelSink = null;
            if (_shortState != null) _shortState.FunnelSink = null;
            Positions.Closed -= OnPositionClosed;
            if (ShowDashboard && _safetyOnlyReason.Length == 0)
                Chart.RemoveObject("SMC_SCALP_DASH");
        }

        // v2.60-dev (E2): the setup is still built on closed bars only; the entry itself is the first tick that trades
        // into the PD array at its consequent encroachment (50 %), i.e. what a resting limit order at CE would fill.
        // Outside the trading sessions nothing triggers and the setup keeps waiting until its normal expiry.
        private void ProcessCeEntries()
        {
            int closed = _exec.Count - 2;
            if (closed < 5)
                return;
            foreach (SetupState s in new[] { _longState, _shortState })
            {
                if (s == null || s.NsNew || s.Stage != SetupStage.WaitingEntry || s.Zone == null || closed < s.Zone.SourceIndex)
                    continue;
                double price = s.Direction > 0 ? Symbol.Ask : Symbol.Bid;
                double ce = s.Zone.Midpoint;
                bool atCe = s.Direction > 0 ? price <= ce && price >= s.Zone.Low : price >= ce && price <= s.Zone.High;
                if (!atCe)
                    continue;
                DateTime now = Server.Time;
                if (UseSessionFilter && !IsTradingSession(now))
                    continue;
                double atr = CalculateAtr(_exec, closed, 14);
                if (atr <= 0)
                    continue;
                s.ZoneTouches = 1;
                s.TouchIndex = closed + 1;
                s.EntryTrigger = "CeTouch";
                s.ConfirmationType = "CE";
                NsF("PARENT", "ce_touch");
                TryExecuteSetup(s, closed, atr, now);
            }
        }

        private void ProcessClosedExecutionBar(int i)
        {
            DateTime decisionUtc = _exec.OpenTimes[i].AddMinutes(ExecutionMinutes());
            ResetNyDay(decisionUtc, false);

            if (CloseAtSessionEnd)
                CloseIfPastTradingSession(decisionUtc);

            double atr = CalculateAtr(_exec, i, 14);
            if (atr <= 0)
                return;

            AdvanceState(_longState, i, atr, decisionUtc);
            AdvanceState(_shortState, i, atr, decisionUtc);
            CandObserveShadowDetectors(i, decisionUtc);
            TryArmFailedSetupFlip(i, atr, decisionUtc);
            if (NsCoresEnabled())
            {
                _nsScope++;
                try { NsAdvance(i, atr, decisionUtc); }
                finally { _nsScope--; }
            }
        }

        private void AdvanceState(SetupState s, int i, double atr, DateTime timeUtc)
        {
            if (s.Stage == SetupStage.ProtectionFailure) return;
            if (s.Direction > 0 && !EnableLongs)
            {
                s.Reset();
                return;
            }
            if (s.Direction < 0 && !EnableShorts)
            {
                s.Reset();
                return;
            }

            if (s.Stage != SetupStage.Waiting && EnableCrtContextLayer)
            {
                RefreshCrtContextState(s, i, atr);
                if (IsCrtReversalInvalidated(s, i, atr))
                {
                    Log("{0}: CRT reversal invalidated after range re-entry; H1 [{1:F2}-{2:F2}] EQ={3:F2}.",
                        DirectionText(s.Direction), s.CrtH1.Low, s.CrtH1.High, s.CrtH1.Equilibrium);
                    _lastEvent = DirectionText(s.Direction) + " CRT invalidated";
                    RegisterFailedSetupFlip(s, timeUtc, "CRT range invalidation");
                    NsF("PARENT", "reset:crt_invalidated");
                    s.Reset();
                    return;
                }
            }

            if (UpgradeSlotOnStrongerSweep && TryUpgradeSlot(s, i, atr, timeUtc))
                return;

            if (s.Stage == SetupStage.Waiting)
            {
                TryArmSetup(s, i, atr, timeUtc);
                if (EnableContinuationLane && s.Stage == SetupStage.Waiting)
                    TryArmContinuation(s, i, atr, timeUtc);
                return;
            }

            if (s.Stage == SetupStage.LiquidityTaken)
            {
                UpdateSweepExtreme(s, i);
                if (IsLevelReclaimed(i, s.Direction, s.LiquidityPrice))
                {
                    s.ReclaimIndex = i;
                    s.Stage = SetupStage.WaitingMss;
                    s.ExpiryIndex = i + ScaleLogicBars(MaxReclaimToMssBars);
                    _lastEvent = DirectionText(s.Direction) + " delayed reclaim";
                    return;
                }

                if (i > s.ExpiryIndex || IsSweepInvalidated(s, i, atr))
                {
                    _lastEvent = DirectionText(s.Direction) + " sweep failed reclaim";
                    NsF("PARENT", "reset:no_reclaim");
                    s.Reset();
                }
                return;
            }

            if (s.Stage == SetupStage.WaitingMss)
            {
                UpdateSweepExtreme(s, i);
                if (i > s.ExpiryIndex || IsSweepInvalidated(s, i, atr))
                {
                    _lastEvent = DirectionText(s.Direction) + " MSS expired";
                    NsF("PARENT", "reset:mss_expired");
                    s.Reset();
                    return;
                }

                double buffer = Math.Max(Symbol.TickSize, atr * MssAtrBuffer);
                if (!ClosesThrough(i, s.Direction, s.MssLevel, buffer))
                    return;

                bool displacement = HasDirectionalDisplacement(_exec, i, s.Direction, atr) || HasMultiCandleDisplacement(_exec, i, s.Direction, atr);
                if (!displacement)
                {
                    _lastEvent = DirectionText(s.Direction) + " MSS without displacement";
                    return;
                }

                s.MssIndex = i;
                s.HasDisplacement = true;
                GetRangeExtremes(s.TakenIndex, i, out s.ImpulseLow, out s.ImpulseHigh);
                s.Stage = SetupStage.WaitingPdArray;
                s.PdArrayWaitUntil = i + Math.Max(2, ScaleLogicBars(2));
                s.ExpiryIndex = s.PdArrayWaitUntil;
                _lastEvent = DirectionText(s.Direction) + " MSS + displacement";
                TryAssignZone(s, i, atr);
                return;
            }

            if (s.Stage == SetupStage.WaitingPdArray)
            {
                UpdateImpulse(s, i);
                if (IsSweepInvalidated(s, i, atr) || i > s.PdArrayWaitUntil)
                {
                    if (s.Zone == null)
                    {
                        _lastEvent = DirectionText(s.Direction) + " no valid PD array";
                        NsF("PARENT", "reset:no_pd_array");
                        s.Reset();
                    }
                    return;
                }

                TryAssignZone(s, i, atr);
                return;
            }

            if (s.Stage == SetupStage.WaitingEntry)
            {
                bool zoneInvalid = IsZoneInvalidatedForDirection(s.Zone, i, s.Direction, atr);
                if (i > s.ExpiryIndex || IsSweepInvalidated(s, i, atr) || zoneInvalid)
                {
                    if (zoneInvalid)
                        RegisterFailedSetupFlip(s, timeUtc, "pre-entry zone invalidation");
                    _lastEvent = DirectionText(s.Direction) + " entry zone expired/invalid";
                    NsF("PARENT", zoneInvalid ? "reset:zone_invalidated_before_touch" : i > s.ExpiryIndex ? "reset:zone_expired_no_touch" : "reset:sweep_invalidated_before_touch");
                    s.Reset();
                    return;
                }

                if (EntryMode == SmcEntryMode.FvgCeTouch && !s.NsNew)
                    return;   // v2.60-dev (E2): the entry is taken on the tick that reaches the CE (ProcessCeEntries)

                if (!BarTouchesZone(i, s.Zone))
                {
                    if (EnableMomentumFallback && IsMomentumFallbackTrigger(s, i, atr))
                    {
                        s.TouchIndex = Math.Max(s.Zone.SourceIndex, i - 1);
                        s.EntryTrigger = "MomentumPullback";
                        s.ConfirmationLatched = true;
                        s.ConfirmationLatchedUtc = timeUtc;
                        _lastEvent = DirectionText(s.Direction) + " momentum confirmation";
                        Log("{0}: momentum fallback {1} Q={2}, distance={3:F2} ATR.",
                            DirectionText(s.Direction), s.Zone.Label, s.Zone.Quality, DistanceFromZoneAtr(s, i, atr));
                        TryExecuteSetup(s, i, atr, timeUtc);
                    }
                    return;
                }

                s.ZoneTouches++;
                s.TouchIndex = i;
                s.EntryTrigger = "ZoneRetest";
                s.MaxFillRatio = Math.Max(s.MaxFillRatio, CalculateFillRatio(s.Zone, i, s.Direction));
                // v2.60-dev (P6): a deep wick that closes back beyond the zone midpoint is a rejection, not over-mitigation.
                bool deepFillHeld = AllowDeepFillWithHold && s.ZoneTouches == 1 &&
                                    (s.Direction > 0 ? _exec.ClosePrices[i] >= s.Zone.Midpoint : _exec.ClosePrices[i] <= s.Zone.Midpoint);
                if (s.ZoneTouches > 1 || (s.MaxFillRatio > MaximumZoneFill && !deepFillHeld))
                {
                    _lastEvent = DirectionText(s.Direction) + " zone over-mitigated";
                    NsF("PARENT", "reset:zone_over_mitigated");
                    s.Reset();
                    return;
                }

                s.Stage = SetupStage.WaitingConfirmation;
                s.ExpiryIndex = i + ScaleLogicBars(TouchToConfirmationBars);
                _lastEvent = DirectionText(s.Direction) + " first zone touch";
                Log("{0}: first zone touch {1}, fill={2:F2}.", DirectionText(s.Direction), s.Zone.Label, s.MaxFillRatio);

                if (IsReactionConfirmation(s, i, atr))
                {
                    s.ConfirmationLatched = true;
                    s.ConfirmationLatchedUtc = timeUtc;
                    TryExecuteSetup(s, i, atr, timeUtc);
                }
                return;
            }

            if (s.Stage == SetupStage.WaitingConfirmation)
            {
                bool confirmationZoneInvalid = IsZoneInvalidatedForDirection(s.Zone, i, s.Direction, atr);
                if (confirmationZoneInvalid)
                {
                    Log("{0}: zone invalidated after touch {1} Q={2}; {3}.",
                        DirectionText(s.Direction), s.Zone == null ? "zone" : s.Zone.Label,
                        s.Zone == null ? 0 : s.Zone.Quality, BuildConfirmationFailureReason(s));
                    RegisterFailedSetupFlip(s, timeUtc, "confirmation zone invalidation");
                    _lastEvent = DirectionText(s.Direction) + " zone invalidated after touch";
                    NsF("PARENT", "reset:zone_invalidated_after_touch");
                    s.Reset();
                    return;
                }

                if (i > s.ExpiryIndex)
                {
                    Log("{0}: confirmation expired tier={1} Q={2}; {3}.",
                        DirectionText(s.Direction), ConfirmationTierName(s),
                        s.Zone == null ? 0 : s.Zone.Quality, BuildConfirmationFailureReason(s));
                    _lastEvent = DirectionText(s.Direction) + " reaction confirmation expired";
                    NsF("PARENT", "reset:confirmation_expired");
                    s.Reset();
                    return;
                }

                if (s.ConfirmationLatched)
                {
                    if ((timeUtc - s.ConfirmationLatchedUtc).TotalMinutes > ParkConfirmationMinutes && !IsTradingSession(timeUtc))
                    {
                        Log("{0}: parked confirmation expired via {1}.", DirectionText(s.Direction), s.ConfirmationType);
                        _lastEvent = DirectionText(s.Direction) + " parked confirmation expired";
                        NsF("PARENT", "reset:parked_expired");
                        s.Reset();
                        return;
                    }

                    if (IsTradingSession(timeUtc))
                    {
                        TryExecuteSetup(s, i, atr, timeUtc);
                        return;
                    }
                }

                if (IsReactionConfirmation(s, i, atr))
                {
                    s.ConfirmationLatched = true;
                    s.ConfirmationLatchedUtc = timeUtc;
                    TryExecuteSetup(s, i, atr, timeUtc);
                }
            }
        }

        // v2.59 Waiting-stage arming, unchanged; extracted so the v2.60 slot upgrade can re-arm on the same bar.
        private void TryArmSetup(SetupState s, int i, double atr, DateTime timeUtc)
        {
            LiquidityLevel level;
            bool reclaimed;
            double extreme;
            if (!TryDetectLiquidityTake(i, s.Direction, atr, timeUtc, out level, out reclaimed, out extreme))
                return;

            if (RequireExternalLiquidity && !level.External && !IsM5InternalLiquidityLevel(level))
                return;

            s.StartIndex = i;
            s.TakenIndex = i;
            s.LiquidityName = level.Name;
            s.LiquidityPrice = level.Price;
            s.LiquidityStrength = level.Strength;
            s.LiquidityExternal = level.External;
            s.SweepExtreme = extreme;
            s.SameBarReclaim = reclaimed;
            s.SetupType = ClassifySetupType(level.Name, reclaimed);
            CaptureCrtContext(s, i, atr, timeUtc);
            s.MssLevel = FindMssLevelBefore(i, s.Direction);
            if (s.MssLevel <= 0)
            {
                s.Reset();
                return;
            }
            if (FailFastStaticGates && StaticGatesRejectAtArm(s, timeUtc))
            {
                NsF("PARENT", "failfast:arm");
                s.Reset();
                return;
            }

            if (reclaimed)
            {
                s.ReclaimIndex = i;
                s.Stage = SetupStage.WaitingMss;
                s.ExpiryIndex = i + ScaleLogicBars(MaxReclaimToMssBars);
                _lastEvent = DirectionText(s.Direction) + " sweep " + level.Name + " reclaimed";
            }
            else
            {
                s.Stage = SetupStage.LiquidityTaken;
                s.ExpiryIndex = i + ScaleLogicBars(ReclaimBars);
                _lastEvent = DirectionText(s.Direction) + " liquidity taken " + level.Name;
            }
            NsF("PARENT", "armed");
            Log("{0}: {1} @ {2:F2}; MSS trigger {3:F2}.", DirectionText(s.Direction), level.Name, level.Price, s.MssLevel);
        }

        // v2.60-dev (P3): gates whose outcome is already fixed when the raid is armed. An M5 internal raid that needs CRT
        // premium/discount can never pass without a qualified H1 CRT range (CrtH1 is captured once, at arming).
        private bool StaticGatesRejectAtArm(SetupState s, DateTime timeUtc)
        {
            if (IsM5InternalSetup(s) && M5InternalRequireCrtPremiumDiscount &&
                (!EnableCrtContextLayer || s.CrtH1 == null || !s.CrtH1.Valid))
                return true;
            return HtfBiasFilter != SmcHtfBias.Off && HtfBiasDirection(timeUtc) == -s.Direction;
        }

        // v2.60-dev (K-Cont): trend-continuation lane. Inside the London / NY killzones, with the M15 anchor, the M5 delivery
        // structure (regime, no counter veto) and the H1 structure all pointing the same way, a displacement candle that closes
        // through the last execution swing is a fresh break of structure. Its leg (origin extreme -> break) is handled exactly
        // like a Parent leg after the MSS: same PD-array search, entry, score, stop, target and R/R gates. No raid is required,
        // so the lane counts as internal liquidity: extended sessions and the A+ stop/RR exceptions never apply to it.
        private void TryArmContinuation(SetupState s, int i, double atr, DateTime timeUtc)
        {
            if (s.NsNew || i < MssLookbackBars + 2)
                return;
            string core = CoreSessionName(timeUtc);
            if (core != "LONDON" && core != "NY-AM" && core != "NY-PM")
                return;
            int pivot = -1;
            for (int k = i - ExecPivotRight - 1; k >= Math.Max(ExecPivotLeft, i - MssLookbackBars); k--)
                if (IsPivot(_exec, k, s.Direction > 0, ExecPivotLeft, ExecPivotRight, i - 1)) { pivot = k; break; }
            if (pivot < 0)
                return;
            double level = s.Direction > 0 ? _exec.HighPrices[pivot] : _exec.LowPrices[pivot];
            double buffer = Math.Max(Symbol.TickSize, atr * MssAtrBuffer);
            if (!ClosesThrough(i, s.Direction, level, buffer) || ClosesThrough(i - 1, s.Direction, level, buffer))
                return;
            if (!(HasDirectionalDisplacement(_exec, i, s.Direction, atr) || HasMultiCandleDisplacement(_exec, i, s.Direction, atr)))
                return;
            RegimeSnapshot regime = GetAdaptiveRegime(timeUtc);
            if (regime.Regime != s.Direction)
                return;
            if (GetPersistentStructureTrend(_h1, GetCompletedBarIndexAtTime(_h1, timeUtc), 2, 2, 120) != s.Direction)
                return;

            int origin = pivot;
            for (int k = pivot; k <= i; k++)
                if (s.Direction > 0 ? _exec.LowPrices[k] < _exec.LowPrices[origin] : _exec.HighPrices[k] > _exec.HighPrices[origin])
                    origin = k;
            if (origin >= i)
                return;

            s.StartIndex = origin;
            s.TakenIndex = origin;
            s.ReclaimIndex = origin;
            s.LiquidityName = "Continuation BOS";
            s.LiquidityPrice = level;
            s.LiquidityStrength = 1;
            s.LiquidityExternal = false;
            s.SweepExtreme = s.Direction > 0 ? _exec.LowPrices[origin] : _exec.HighPrices[origin];
            s.SetupType = "Continuation";
            s.MssLevel = level;
            CaptureCrtContext(s, i, atr, timeUtc);
            s.MssIndex = i;
            s.HasDisplacement = true;
            GetRangeExtremes(origin, i, out s.ImpulseLow, out s.ImpulseHigh);
            s.Stage = SetupStage.WaitingPdArray;
            s.PdArrayWaitUntil = i + Math.Max(2, ScaleLogicBars(2));
            s.ExpiryIndex = s.PdArrayWaitUntil;
            NsF("PARENT", "cont_armed");
            _lastEvent = DirectionText(s.Direction) + " continuation BOS " + level.ToString("F2", CultureInfo.InvariantCulture);
            Log("{0}: continuation BOS through {1:F2} ({2}), origin {3:F2}.", DirectionText(s.Direction), level, core, s.SweepExtreme);
            TryAssignZone(s, i, atr);
        }

        // v2.60-dev (P4): a pending candidate that is not yet touching its zone gives way to a fresh raid of stronger
        // external liquidity in the same direction (deeper/major pool wins). Confirmation-stage setups are never replaced.
        private bool TryUpgradeSlot(SetupState s, int i, double atr, DateTime timeUtc)
        {
            if (s.NsNew || (s.Stage != SetupStage.LiquidityTaken && s.Stage != SetupStage.WaitingMss &&
                            s.Stage != SetupStage.WaitingPdArray && s.Stage != SetupStage.WaitingEntry))
                return false;
            LiquidityLevel level;
            bool reclaimed;
            double extreme;
            if (!TryDetectLiquidityTake(i, s.Direction, atr, timeUtc, out level, out reclaimed, out extreme) || !level.External)
                return false;
            if (s.LiquidityExternal && level.Strength <= s.LiquidityStrength)
                return false;
            if (Math.Abs(level.Price - s.LiquidityPrice) <= Symbol.TickSize)
                return false;
            Log("{0}: slot upgrade {1} -> {2} @ {3:F2}.", DirectionText(s.Direction), s.LiquidityName, level.Name, level.Price);
            NsF("PARENT", "slot_upgrade");
            s.Reset();
            TryArmSetup(s, i, atr, timeUtc);
            return true;
        }

        private void TryAssignZone(SetupState s, int currentIndex, double atr)
        {
            ZoneInfo zone = FindEventEntryZone(s, currentIndex, atr);
            if (zone == null)
                return;
            NsF("PARENT", "parent_zone_found");

            if (EnableOteEntryPolicy)
            {
                var preClip = zone;
                zone = NsClipZone(s, zone, atr, 0, 0, true);
                if (zone == null) { NsFE("OTE", "ote_clip_failed_parent_setup_reset", "dir=" + s.Direction + "|type=" + s.SetupType + "|parentZone=" + Fi(preClip.Low) + "-" + Fi(preClip.High) + "|q=" + preClip.Quality + "|fvg=" + preClip.HasFvg); s.Reset(); return; }
                NsF("OTE", "ote_clip_ok");
                s.NsOte = true;
            }
            else if (EntryMode != SmcEntryMode.FvgCeTouch)
                zone = BuildBroadTradeZone(s, zone);   // v2.60-dev (E2): CE entries rest in the true PD array
            AnnotateZoneWithCrtContext(s, zone);
            s.Zone = zone;
            if (FailFastStaticGates && IsM5InternalSetup(s) && !IsM5InternalStaticQuality(s))
            {
                NsF("PARENT", "failfast:m5_internal_zone");
                _lastEvent = DirectionText(s.Direction) + " M5 internal zone fails static gates";
                s.Reset();
                return;
            }
            s.Stage = SetupStage.WaitingEntry;
            s.ExpiryIndex = currentIndex + ScaleLogicBars(MaxMssToEntryBars);
            _lastEvent = DirectionText(s.Direction) + " zone " + zone.Label + " Q" + zone.Quality;
            Log("{0}: zone {1} [{2:F2}-{3:F2}] Q={4}, composite={5}, PD={6}, CRT-PD={7}, CRT-EQ-near={8}.",
                DirectionText(s.Direction), zone.Label, zone.Low, zone.High, zone.Quality, zone.Composite,
                zone.InCorrectPremiumDiscount, zone.CrtCorrectPremiumDiscount, zone.CrtNearEquilibrium);
        }

        private void TryExecuteSetup(SetupState s, int i, double atr, DateTime timeUtc)
        {
            CandEnsureState(s, timeUtc);
            string fm = NsMod(s);
            NsF(fm, "exec_enter");
            if (s.NsOte && !NewSetups.EntryGeometry.Contains(s.Direction > 0 ? Symbol.Ask : Symbol.Bid, s.Zone.Low, s.Zone.High))
            { NsFE(fm, "rej:exec:quote_outside_ote_zone", "dir=" + s.Direction + "|type=" + s.SetupType + "|quote=" + Fi(s.Direction > 0 ? Symbol.Ask : Symbol.Bid) + "|zone=" + Fi(s.Zone.Low) + "-" + Fi(s.Zone.High)); s.Reset(); return; }
            string gateReason;
            if (!CanOpenNewTrade(timeUtc, s, s.SetupType == "FailedSetupFlip", out gateReason))
            {
                if (!s.NsNew && gateReason == "outside session" && ParkConfirmationMinutes > 0)
                {
                    int minutesToSession = MinutesUntilTradingSession(timeUtc, ParkConfirmationMinutes);
                    if (minutesToSession >= 0)
                    {
                        s.ConfirmationLatched = true;
                        if (s.ConfirmationLatchedUtc == DateTime.MinValue)
                            s.ConfirmationLatchedUtc = timeUtc;
                        s.Stage = SetupStage.WaitingConfirmation;
                        s.ExpiryIndex = Math.Max(s.ExpiryIndex, i + Math.Max(1, (int)Math.Ceiling(ParkConfirmationMinutes / (double)ExecutionMinutes())));
                        NsF(fm, "exec_gate_parked");
                        _lastEvent = DirectionText(s.Direction) + " confirmation parked " + minutesToSession + "m";
                        Log("{0}: confirmation parked; next session in {1}m.", DirectionText(s.Direction), minutesToSession);
                        return;
                    }
                }

                NsFE(fm, "rej:exec:gate:" + gateReason, "dir=" + s.Direction + "|type=" + s.SetupType);
                _lastEvent = DirectionText(s.Direction) + " blocked: " + gateReason;
                Log("{0}: rejected gate {1}.", DirectionText(s.Direction), gateReason);
                LogShadowMetricsAfterGateReject(s, i, atr, timeUtc, gateReason);
                s.Reset();
                return;
            }

            RegimeSnapshot regime = GetSetupRegime(s, timeUtc);
            if (IsM5InternalSetup(s) && !IsM5InternalQualityCandidate(s, regime, timeUtc))
            {
                NsF(fm, "rej:exec:m5_internal_context");
                _lastEvent = DirectionText(s.Direction) + " M5 internal context";
                Log("{0}: rejected M5 internal context; Q={1}, composite={2}, PD={3}, CRT-PD={4}, core={5}, delivery={6}, anchor={7}.",
                    DirectionText(s.Direction), s.Zone == null ? 0 : s.Zone.Quality,
                    s.Zone != null && s.Zone.Composite,
                    s.Zone != null && s.Zone.InCorrectPremiumDiscount,
                    s.Zone != null && s.Zone.CrtCorrectPremiumDiscount,
                    CoreSessionName(timeUtc),
                    regime.DeliveryTrend, regime.AnchorTrend);
                s.Reset();
                return;
            }

            if (HtfBiasFilter != SmcHtfBias.Off && HtfBiasDirection(timeUtc) == -s.Direction)
            {
                NsF(fm, "rej:exec:htf_bias");
                _lastEvent = DirectionText(s.Direction) + " against H4 structure";
                Log("{0}: rejected HTF bias (H4 structure against the trade).", DirectionText(s.Direction));
                s.Reset();
                return;
            }

            bool oppositeDeliveryVeto = BlockDeliveryVeto &&
                                        regime.DeliveryVetoDirection == -s.Direction &&
                                        s.SetupType != "FailedSetupFlip";
            bool aPlusDeliveryException = oppositeDeliveryVeto &&
                                          AllowAPlusCompositeAgainstDeliveryVeto &&
                                          IsAPlusCompositeSetup(s);

            if (oppositeDeliveryVeto && !aPlusDeliveryException)
            {
                NsF(fm, "rej:exec:delivery_veto");
                _lastEvent = DirectionText(s.Direction) + " delivery veto";
                Log("{0}: rejected delivery veto.", DirectionText(s.Direction));
                s.Reset();
                return;
            }

            if (aPlusDeliveryException)
                Log("{0}: A+ composite delivery-veto exception accepted; score penalty retained.", DirectionText(s.Direction));

            int score = ScoreSetup(s, i, atr, timeUtc, regime);
            if (EnableCrtContextLayer && s.CrtH1 != null && s.CrtH1.Valid)
            {
                Log("{0}: CRT eval H1-sweep={1}, reclaim={2}, CRT-PD={3}, M15-align={4}, targetRoom={5}, EQ-near={6}.",
                    DirectionText(s.Direction), s.CrtH1SweepObserved, s.CrtH1SweepReclaimed,
                    s.Zone != null && s.Zone.CrtCorrectPremiumDiscount,
                    s.CrtM15SweepReclaimed, HasCrtOpposingTargetRoom(s, i, atr),
                    s.Zone != null && s.Zone.CrtNearEquilibrium);
            }
            int requiredScore = UseSessionFilter ? Math.Max(MinimumSignalScore, RequiredScoreForSession(timeUtc)) : MinimumSignalScore;
            if (IsM5InternalSetup(s))
                requiredScore = Math.Max(requiredScore, M5InternalMinimumScore);
            if (score < requiredScore)
            {
                NsFE(fm, "rej:exec:score", "dir=" + s.Direction + "|type=" + s.SetupType + "|score=" + score + "|req=" + requiredScore + "|session=" + SessionName(timeUtc));
                _lastEvent = DirectionText(s.Direction) + " score " + score + " < " + requiredScore;
                Log("{0}: rejected score {1}, required={2} for {3}.", DirectionText(s.Direction), score, requiredScore, SessionName(timeUtc));
                s.Reset();
                return;
            }

            TradeType tradeType = s.Direction > 0 ? TradeType.Buy : TradeType.Sell;
            double estimatedEntry = tradeType == TradeType.Buy ? Symbol.Ask : Symbol.Bid;
            double stop = BuildStructuralStop(s, i, atr, estimatedEntry);
            double riskPips = Math.Abs(estimatedEntry - stop) / StrategyPip;
            double maximumStopAllowed = EffectiveMaximumStopPips(s);
            if (s.NsNew || s.NsOte)
            {
                stop = NewSetups.EntryGeometry.StopTick(stop, s.Direction, Symbol.TickSize);
                riskPips = Math.Abs(estimatedEntry - stop) / StrategyPip;
                if (!NsFinite(estimatedEntry) || !NsFinite(stop) || !NsFinite(riskPips) ||
                    s.Direction * (estimatedEntry - stop) <= 0) { NsF(fm, "rej:exec:stop_geometry"); s.Reset(); return; }
            }
            if (riskPips < MinimumStopPips - 1e-9 || riskPips > maximumStopAllowed + 1e-9)
            {
                NsFE(fm, "rej:exec:stop_distance", "dir=" + s.Direction + "|type=" + s.SetupType + "|riskPips=" + Fi(riskPips) + "|max=" + Fi(maximumStopAllowed));
                _lastEvent = DirectionText(s.Direction) + " SL distance " + riskPips.ToString("F1", CultureInfo.InvariantCulture) + "p";
                Log("{0}: rejected SL distance {1:F1}p, allowed={2:F1}p ({3}).",
                    DirectionText(s.Direction), riskPips, maximumStopAllowed, ConfirmationTierName(s));
                s.Reset();
                return;
            }

            double tp1;
            double tp2;
            string tp1Name;
            string tp2Name;
            double tp1Pips;
            double tp2Pips;
            if (!TryBuildTradeTargets(s, estimatedEntry, timeUtc, out tp1, out tp1Name, out tp1Pips, out tp2, out tp2Name, out tp2Pips))
            {
                NsF(fm, "rej:exec:no_target_room");
                _lastEvent = DirectionText(s.Direction) + " no target room";
                Log("{0}: rejected no target room.", DirectionText(s.Direction));
                s.Reset();
                return;
            }

            double rr;
            double minimumRrAllowed;
            bool rewardRiskOk = EvaluateRewardRisk(s, estimatedEntry, riskPips, ref tp1, ref tp1Pips, tp2Pips, tp2Name, out rr, out minimumRrAllowed);
            CandCaptureGeometry(s, timeUtc, estimatedEntry, stop, tp1, rr);
            if (!rewardRiskOk)
            {
                NsFE(fm, "rej:exec:rr_floor", "dir=" + s.Direction + "|type=" + s.SetupType + "|rr=" + Fi(rr) + "|req=" + Fi(minimumRrAllowed));
                _lastEvent = DirectionText(s.Direction) + " TP1 RR " + rr.ToString("F2", CultureInfo.InvariantCulture);
                Log("{0}: rejected " + (RrBasis == SmcRrBasis.Tp1 ? "TP1" : "structural") + " RR {1:F2}, required={2:F2} ({3}).",
                    DirectionText(s.Direction), rr, minimumRrAllowed, ConfirmationTierName(s));
                s.Reset();
                return;
            }

            double volume = CalculateVolumeInUnits(riskPips, tradeType);
            CandCaptureGeometry(s, timeUtc, estimatedEntry, stop, tp1, rr, volume);
            double estimatedMargin = volume > 0 ? Symbol.GetEstimatedMargin(tradeType, volume) : double.NaN;
            if (!NsFinite(Symbol.Bid) || !NsFinite(Symbol.Ask) || Symbol.Bid <= 0 || Symbol.Ask <= Symbol.Bid ||
                !NsFinite(volume) || volume > Symbol.VolumeInUnitsMax + 1e-9 || !NsFinite(estimatedMargin) || estimatedMargin <= 0 || estimatedMargin > Account.FreeMargin)
            {
                NsF(fm, "rej:exec:quote_margin");
                Jr("reject", null, "code", DailyJournal.Q("QUOTE_MARGIN_INVALID"), "message", DailyJournal.Q("invalid quote, volume or insufficient margin"));
                s.Reset();
                return;
            }
            if (volume < Symbol.VolumeInUnitsMin)
            {
                NsF(fm, "rej:exec:volume");
                _lastEvent = DirectionText(s.Direction) + " volume blocked";
                s.Reset();
                return;
            }

            int protectedRunnerCountBeforeEntry = CountProtectedRunners();
            if (protectedRunnerCountBeforeEntry > 0)
                Log("{0}: protected-runner overlap accepted; existing protected runners={1}.", DirectionText(s.Direction), protectedRunnerCountBeforeEntry);

            NsFE(fm, "order_request", "dir=" + s.Direction + "|type=" + s.SetupType + "|entryEst=" + Fi(estimatedEntry) + "|rr=" + Fi(rr));
            // v2.47-dev: SL/TP are sent WITH the order (server applies them at fill) so there is no unprotected window.
            double? atomicSlPips = null, atomicTpPips = null;
            if (AtomicProtection)
            {
                atomicSlPips = Math.Abs(estimatedEntry - stop) / Symbol.PipSize;
                atomicTpPips = Math.Abs(tp2 - estimatedEntry) / Symbol.PipSize;
            }
            // v2.54-dev (V52-2): the last gate and the broker call are ONE production function (FsGuardedMarketOrder, FailSafeBot.cs), so an offline
            // recording broker exercises exactly this boundary. Nothing else in this method may call ExecuteMarketOrder.
            string lane = s.NsNew
                ? NewSetups.NsRules.LaneComment(FsOwnerMarker, s.NsCore, true, s.NsOte, s.NsId)
                : NewSetups.NsRules.LaneComment(FsOwnerMarker, "Parent", false, false, null);
            double balanceBeforeOrder = Account.Balance;
            // v2.60-dev bugfix: the post-fill risk cap is evaluated against the equity the volume was sized with. v2.59 re-read
            // Account.Equity after the fill (already reduced by the spread), so a position sized right at the cap was closed
            // as "post-fill protection invalid" and latched the protection kill switch.
            double sizingEquity = Account.Equity;
            string preOrderBlock;   // F6: ownership/safety re-evaluated immediately before the order
            var result = FsGuardedMarketOrder(tradeType, volume, atomicSlPips, atomicTpPips, lane, out preOrderBlock);
            if (preOrderBlock != null)
            {
                NsF(fm, "rej:exec:g3_block");
                Jr("reject", null, "code", DailyJournal.Q("G3_BLOCK"), "message", DailyJournal.Q(preOrderBlock));
                s.Reset();
                return;
            }
            if (!result.IsSuccessful || result.Position == null)
            {
                Jr("reject", null, "code", DailyJournal.Q(result.Error.HasValue ? result.Error.Value.ToString() : "NO_POSITION"), "message", DailyJournal.Q("order failed"),
                   "side", DailyJournal.Q(tradeType.ToString()), "volume", DailyJournal.N(volume));
                NsF(fm, "rej:exec:order_failed");
                _lastEvent = DirectionText(s.Direction) + " execution failed";
                s.Reset();
                return;
            }

            Position position = result.Position;
            if (_ks != null) _ks.Update(Server.Time, Account.Equity, Account.Balance, Account.Balance - balanceBeforeOrder); // order cost (e.g. commission) is attributable
            // Capture actual filled Parent identity before protection callbacks or Reset.
            NsFE(fm, "fill", "dir=" + s.Direction + "|type=" + s.SetupType + "|entry=" + Fi(position.EntryPrice));
            NsRecordParentFill(s);
            double actualEntry = position.EntryPrice;
            // Journal every broker fill immediately. The same atomic ledger transaction records the fill id and
            // increments the daily entry cap; a persistence failure compensates the real fill and locks entries.
            if (!FsJournalOpened(position, stop, tp2, string.IsNullOrEmpty(s.SetupType) ? "LiquiditySweep" : s.SetupType, timeUtc))
            {
                NsF(fm, "rej:postfill:ledger_failed");
                FsCloseWithRecovery(position, s, "primary fill ledger persistence failed");
                return;
            }
            stop = BuildStructuralStop(s, i, atr, actualEntry);
            if (s.NsNew || s.NsOte) stop = NewSetups.EntryGeometry.StopTick(stop, s.Direction, Symbol.TickSize);
            riskPips = Math.Abs(actualEntry - stop) / StrategyPip;
            double actualStopSymbolPips = Math.Abs(actualEntry - stop) / Symbol.PipSize;
            double actualPostFillRisk = NsFinite(actualStopSymbolPips) && actualStopSymbolPips > 0
                ? Symbol.AmountRisked(position.VolumeInUnits, actualStopSymbolPips) : double.NaN;
            double maximumRiskAmount = FsCapped(sizingEquity * MaximumRiskPercent / 100.0, MaxRiskCapAccount);

            if ((s.NsOte && !NewSetups.EntryGeometry.Contains(actualEntry, s.Zone.Low, s.Zone.High)) ||
                ((s.NsNew || s.NsOte) && (!NsFinite(actualEntry) || !NsFinite(stop) || !NsFinite(riskPips) ||
                    s.Direction * (actualEntry - stop) <= 0 || riskPips < MinimumStopPips - 1e-9)) ||
                !NsFinite(actualPostFillRisk) || actualPostFillRisk > maximumRiskAmount + 1e-9 ||
                !TryBuildTradeTargets(s, actualEntry, timeUtc, out tp1, out tp1Name, out tp1Pips, out tp2, out tp2Name, out tp2Pips) ||
                riskPips > EffectiveMaximumStopPips(s) + 1e-9 ||
                !EvaluateRewardRisk(s, actualEntry, riskPips, ref tp1, ref tp1Pips, tp2Pips, tp2Name, out double postFillRr, out double postFillRrRequired))
            {
                NsF(fm, "rej:postfill:protection_invalid");
                _lastEvent = DirectionText(s.Direction) + " post-fill protection invalid";
                FsCloseWithRecovery(position, s, "post-fill protection invalid");
                return;
            }

            stop = NormalizePrice(stop);
            tp1 = NormalizePrice(tp1);
            tp2 = NormalizePrice(tp2);
            // v2.60-dev bugfix: rounding the stop to the tick grid (and the broker's readback, already accepted within one tick)
            // may add up to one tick of risk. v2.59 compared that against the bare cap and force-closed positions sized at the cap.
            double quantizedCap = maximumRiskAmount + Symbol.AmountRisked(position.VolumeInUnits, Symbol.TickSize / Symbol.PipSize);
            if (!RiskCap.WithinCap(Symbol.AmountRisked(position.VolumeInUnits, Math.Abs(actualEntry - stop) / Symbol.PipSize), quantizedCap))
            {
                NsF(fm, "rej:postfill:normalized_stop_risk_cap");
                _lastEvent = DirectionText(s.Direction) + " normalized stop exceeds risk cap";
                FsCloseWithRecovery(position, s, "normalized stop exceeds risk cap");
                return;
            }
            if (!FsSecureProtection(position, s, stop, tp2, timeUtc))
            {
                NsF(fm, "rej:postfill:protection_failed");
                _lastEvent = DirectionText(s.Direction) + " protection failed";
                return;
            }
            if (!FsFinalRiskOk(position, stop, quantizedCap))   // read-back SL of the live position against the cap
            {
                NsF(fm, "rej:postfill:readback_stop_risk_cap");
                _lastEvent = DirectionText(s.Direction) + " read-back stop exceeds risk cap";
                FsCloseWithRecovery(position, s, "read-back stop exceeds risk cap");
                return;
            }

            _managed[position.Id] = new ManagedTrade
            {
                PositionId = position.Id,
                Direction = s.Direction,
                EntryPrice = actualEntry,
                InitialStop = stop,
                InitialRiskPrice = Math.Abs(actualEntry - stop),
                EntryExecIndex = i,
                EntryTimeUtc = position.EntryTime,
                Score = score,
                SetupType = string.IsNullOrEmpty(s.SetupType) ? "LiquiditySweep" : s.SetupType,
                LiquidityName = s.LiquidityName,
                LiquidityPrice = s.LiquidityPrice,
                SetupName = (string.IsNullOrEmpty(s.SetupType) ? "LiquiditySweep" : s.SetupType) + " | " + s.LiquidityName + " -> MSS -> " + s.Zone.Label + " -> " + (string.IsNullOrEmpty(s.EntryTrigger) ? "Confirm" : s.EntryTrigger) + (string.IsNullOrEmpty(s.ConfirmationType) ? "" : " / " + s.ConfirmationType) + CrtNarrativeTag(s),
                TargetName = tp2Name,
                ZoneLow = s.Zone.Low,
                ZoneHigh = s.Zone.High,
                ZoneQuality = s.Zone.Quality,
                Tp1Price = tp1,
                Tp1Pips = tp1Pips,
                Tp1Name = tp1Name,
                Tp2Price = tp2,
                Tp2Pips = tp2Pips,
                Tp2Name = tp2Name,
                OriginalVolumeInUnits = position.VolumeInUnits,
                PipPrice = StrategyPip
            };

            if (!FsLedgerSync(_managed[position.Id]))
            {
                NsF(fm, "rej:postfill:lifecycle_ledger_failed");
                FsCloseWithRecovery(position, s, "managed lifecycle ledger persistence failed");
                return;
            }
            NsF(fm, "trade_managed");
            CandCaptureGeometry(s, timeUtc, actualEntry, stop, tp1, tp1Pips / Math.Max(riskPips, 0.0001), position.VolumeInUnits);
            CandEnd(s, Server.Time, CandidateTerminalStage.Filled, "managed_fill");
            _lastAcceptedSignalUtc = timeUtc;
            _lastEvent = DirectionText(s.Direction) + " OPEN " + _managed[position.Id].SetupType + " Q" + score;
            Log("OPEN {0}: type={1}, score={2}, entry={3}, SL={4} ({5:F1}p), TP1={6} ({7:F1}p), TP2={8} ({9:F1}p), TP1-RR={10:F2}, setup={11}.",
                DirectionText(s.Direction), _managed[position.Id].SetupType, score, Px(actualEntry), Px(stop), riskPips, Px(tp1), tp1Pips, Px(tp2), tp2Pips, tp1Pips / riskPips, _managed[position.Id].SetupName);

            s.Reset();
        }

        private bool IsAPlusCompositeSetup(SetupState s)
        {
            return s != null &&
                   s.Zone != null &&
                   s.Zone.Quality >= APlusZoneQuality &&
                   s.Zone.Composite &&
                   s.LiquidityExternal;
        }

        private double EffectiveMaximumStopPips(SetupState s)
        {
            if (IsM5InternalSetup(s))
                return Math.Min(MaximumStopPips, M5InternalMaximumStopPips);
            return IsAPlusCompositeSetup(s) ? APlusMaximumStopPips : MaximumStopPips;
        }

        private double EffectiveMinimumRewardRisk(SetupState s)
        {
            if (IsM5InternalSetup(s))
                return Math.Max(MinimumRewardRisk, M5InternalMinimumRewardRisk);
            return IsAPlusCompositeSetup(s) ? APlusMinimumRewardRisk : MinimumRewardRisk;
        }

        // v2.60-dev (E1): the single reward/risk rule for the pre-order gate, the post-fill re-validation and the NS preflight.
        // Tp1 basis = v2.59 (TP1 / risk >= Effective Minimum R/R). Structural basis: TP2 must be a real liquidity objective
        // (not the fixed "Runner TP2" fallback) with TP2 / risk >= Structural Minimum R/R; TP1 stays the partial-profit level
        // but is lifted to at least TP1 Minimum R so the 50 % close always banks >= that multiple.
        private bool EvaluateRewardRisk(SetupState s, double entry, double riskPips, ref double tp1, ref double tp1Pips,
            double tp2Pips, string tp2Name, out double rr, out double required)
        {
            double risk = Math.Max(riskPips, 0.0001);
            if (RrBasis == SmcRrBasis.Tp1)
            {
                rr = tp1Pips / risk;
                required = EffectiveMinimumRewardRisk(s);
                return rr >= required;
            }
            rr = tp2Pips / risk;
            required = StructuralMinimumRewardRisk;
            if (tp2Name == "Runner TP2")
                return false;
            double tp1Floor = Tp1MinimumR * risk;
            if (tp1Pips < tp1Floor)
            {
                if (tp1Floor >= tp2Pips - 1e-9)
                    return false;
                tp1Pips = tp1Floor;
                tp1 = s.Direction > 0 ? entry + tp1Pips * StrategyPip : entry - tp1Pips * StrategyPip;
            }
            return rr >= required;
        }

        // v2.60-dev: H4 persistent market structure as higher-timeframe bias (0 = neutral / not loaded).
        private int HtfBiasDirection(DateTime timeUtc)
        {
            if (HtfBiasFilter == SmcHtfBias.Off || _h4 == null)
                return 0;
            return GetPersistentStructureTrend(_h4, GetCompletedBarIndexAtTime(_h4, timeUtc), 2, 2, 120);
        }

        // v2.60-dev (P2): regime for one setup. With Delivery Veto Only After MSS a counter M5 break that closed before this
        // setup's own MSS candle closed is the raid leg of the setup itself and is not a veto.
        private RegimeSnapshot GetSetupRegime(SetupState s, DateTime timeUtc)
        {
            if (!DeliveryVetoAfterMssOnly || s == null || s.MssIndex < 0 || s.MssIndex >= _exec.Count)
                return GetAdaptiveRegime(timeUtc);
            return GetAdaptiveRegime(timeUtc, _exec.OpenTimes[s.MssIndex].AddMinutes(ExecutionMinutes()));
        }

        private void LogShadowMetricsAfterGateReject(SetupState s, int i, double atr, DateTime timeUtc, string gateReason)
        {
            if (!VerboseLog || s == null || s.Zone == null)
                return;

            TradeType tradeType = s.Direction > 0 ? TradeType.Buy : TradeType.Sell;
            double estimatedEntry = tradeType == TradeType.Buy ? Symbol.Ask : Symbol.Bid;
            double stop = BuildStructuralStop(s, i, atr, estimatedEntry);
            double riskPips = Math.Abs(estimatedEntry - stop) / StrategyPip;
            double tp1;
            double tp2;
            string tp1Name;
            string tp2Name;
            double tp1Pips;
            double tp2Pips;

            if (!TryBuildTradeTargets(s, estimatedEntry, timeUtc,
                                      out tp1, out tp1Name, out tp1Pips,
                                      out tp2, out tp2Name, out tp2Pips))
            {
                Log("{0}: shadow after gate {1}: tier={2}, Q={3}, SL={4:F1}p (max {5:F1}), no valid target room.",
                    DirectionText(s.Direction), gateReason, ConfirmationTierName(s), s.Zone.Quality,
                    riskPips, EffectiveMaximumStopPips(s));
                return;
            }

            double rr = tp1Pips / Math.Max(riskPips, 0.0001);
            Log("{0}: shadow after gate {1}: tier={2}, Q={3}, SL={4:F1}p (max {5:F1}), TP1={6:F1}p, RR={7:F2} (min {8:F2}), TP2={9:F1}p.",
                DirectionText(s.Direction), gateReason, ConfirmationTierName(s), s.Zone.Quality,
                riskPips, EffectiveMaximumStopPips(s), tp1Pips, rr, EffectiveMinimumRewardRisk(s), tp2Pips);
        }

        // ========================= SIGNAL SCORING =========================
        private int ScoreSetup(SetupState s, int i, double atr, DateTime timeUtc, RegimeSnapshot regime)
        {
            int score = 34;
            if (s.LiquidityExternal) score += 8;
            if (s.LiquidityStrength >= 3) score += 7;
            else if (s.LiquidityStrength >= 2) score += 5;
            else score += 2;
            if (s.NsNew && s.LiquidityStrength == 0) score -= 2;

            if (s.SameBarReclaim) score += 3;
            score += 10; // MSS is a hard prerequisite here.
            if (s.HasDisplacement) score += 10;

            if (s.Zone != null)
            {
                score += Math.Max(0, Math.Min(8, (s.Zone.Quality - 60) / 5));
                if (s.Zone.Composite) score += 4;
                if (s.Zone.InCorrectPremiumDiscount) score += 5;
                if (s.Zone.OteConfluence) score += 3;
            }

            if (s.EntryTrigger == "ZoneRetest" || s.EntryTrigger == "CeTouch") score += 3;
            else if (s.EntryTrigger == "MomentumPullback") score -= 1;

            if (s.SetupType == "CRT Sweep") score += 5;
            else if (s.SetupType == "TurtleSoup") score += 4;
            else if (s.SetupType == "SessionSweep") score += 3;
            else if (s.SetupType == "M5 Internal") score += 2;
            else if (s.SetupType == "FailedSetupFlip") score += 7;

            score += CrtContextScore(s, i, atr);

            if (regime.Regime == s.Direction) score += 9;
            else if (regime.TransitionDirection == s.Direction) score += 5;
            else if (regime.DeliveryTrend == s.Direction) score += 3;
            else if (regime.Regime == -s.Direction) score -= 6;

            if (regime.DeliveryVetoDirection == -s.Direction) score -= 8;

            // H1 remains supporting context, not a hard gate for an M2/M1 scalp.
            int h1Index = GetCompletedBarIndexAtTime(_h1, timeUtc);
            int h1Trend = GetPersistentStructureTrend(_h1, h1Index, 2, 2, 120);
            if (h1Trend == s.Direction) score += 3;

            score += SessionScore(timeUtc);

            double efficiency = DirectionalEfficiency(_exec, i, s.Direction, 4);
            if (efficiency >= 0.32) score += 3;

            return Math.Max(0, Math.Min(100, score));
        }

        // ========================= LIQUIDITY =========================
        private bool TryDetectLiquidityTake(int i, int direction, double atr, DateTime timeUtc, out LiquidityLevel chosen, out bool reclaimed, out double extreme)
        {
            chosen = null;
            reclaimed = false;
            extreme = direction > 0 ? _exec.LowPrices[i] : _exec.HighPrices[i];

            List<LiquidityLevel> levels = BuildLiquidityLevels(timeUtc,
                IgnoreConsumedLiquidity == SmcConsumedLiquidity.Sweeps || IgnoreConsumedLiquidity == SmcConsumedLiquidity.Both ? _exec.OpenTimes[i] : DateTime.MinValue);
            int wantedSide = direction > 0 ? -1 : 1;
            double minSweep = Math.Max(MinimumSweepPips * StrategyPip, atr * MinimumSweepAtr);
            double tol = Math.Max(Symbol.TickSize * 2.0, atr * 0.015);
            double prevClose = _exec.ClosePrices[Math.Max(0, i - 1)];

            var candidates = new List<Tuple<LiquidityLevel, double>>();
            foreach (LiquidityLevel level in levels)
            {
                if (level.Side != wantedSide)
                    continue;
                if (RequireExternalLiquidity && !level.External && !IsM5InternalLiquidityLevel(level))
                    continue;

                bool crossed;
                bool approachedFromCorrectSide;
                if (direction > 0)
                {
                    crossed = _exec.LowPrices[i] < level.Price - minSweep;
                    approachedFromCorrectSide = prevClose >= level.Price - tol;
                }
                else
                {
                    crossed = _exec.HighPrices[i] > level.Price + minSweep;
                    approachedFromCorrectSide = prevClose <= level.Price + tol;
                }

                if (!crossed || !approachedFromCorrectSide || WasRecentlyTaken(i, level, direction, minSweep))
                    continue;

                double distance = Math.Abs(prevClose - level.Price);
                candidates.Add(Tuple.Create(level, distance));
            }

            if (candidates.Count == 0)
                return false;

            chosen = candidates
                .OrderByDescending(x => x.Item1.Strength)
                .ThenBy(x => x.Item2)
                .Select(x => x.Item1)
                .First();

            reclaimed = IsLevelReclaimed(i, direction, chosen.Price);
            return true;
        }

        // consumedCutoffUtc: levels traded through between their formation and this instant are dropped (the sweep detector
        // passes the raid candle's open, the target builder the decision time); DateTime.MinValue = keep all (v2.59).
        private List<LiquidityLevel> BuildLiquidityLevels(DateTime timeUtc, DateTime consumedCutoffUtc)
        {
            var levels = new List<LiquidityLevel>();

            if (UsePreviousDayLiquidity)
                AddPreviousNyDayLevels(levels, timeUtc);
            if (UseAsiaLiquidity)
                AddSessionLevels(levels, timeUtc, "Asia", 20, 0, true);
            if (UseLondonLiquidity)
                AddSessionLevels(levels, timeUtc, "London", 2, 5, false);
            if (UseM15Liquidity)
                AddM15SwingLiquidity(levels, timeUtc);
            if (EnableM5InternalLiquidity)
                AddM5InternalLiquidity(levels, timeUtc);
            AddCrtLiquidity(levels, timeUtc);

            if (consumedCutoffUtc != DateTime.MinValue)
                levels.RemoveAll(l => IsLiquidityConsumed(l, consumedCutoffUtc));
            return DeduplicateLiquidity(levels, timeUtc);
        }

        // ---- v2.60-dev (P5): consumed liquidity. Suffix extremes of the M5 bars closed by the cutoff (plus the execution
        // bars after the last M5 close) are built once per cutoff, so each level costs one binary search.
        private DateTime _consumedCutoff = DateTime.MinValue;
        private int _consumedFirst = -1, _consumedLast = -1;
        private double[] _consumedHigh = new double[0], _consumedLow = new double[0];
        private double _consumedTailHigh, _consumedTailLow;

        private void EnsureConsumedIndex(DateTime cutoffUtc)
        {
            if (cutoffUtc == _consumedCutoff)
                return;
            _consumedCutoff = cutoffUtc;
            _consumedLast = GetLastFullyClosedBarIndex(_m5, cutoffUtc, 5);
            _consumedFirst = Math.Max(0, _consumedLast - 1200);
            int n = Math.Max(0, _consumedLast - _consumedFirst + 1);
            if (_consumedHigh.Length < n) { _consumedHigh = new double[n]; _consumedLow = new double[n]; }
            double hi = double.MinValue, lo = double.MaxValue;
            for (int k = _consumedLast; k >= _consumedFirst && k >= 0; k--)
            {
                hi = Math.Max(hi, _m5.HighPrices[k]);
                lo = Math.Min(lo, _m5.LowPrices[k]);
                _consumedHigh[k - _consumedFirst] = hi;
                _consumedLow[k - _consumedFirst] = lo;
            }
            _consumedTailHigh = double.MinValue;
            _consumedTailLow = double.MaxValue;
            DateTime m5Close = _consumedLast >= 0 ? _m5.OpenTimes[_consumedLast].AddMinutes(5) : DateTime.MinValue;
            for (int k = GetLastFullyClosedBarIndex(_exec, cutoffUtc, ExecutionMinutes()); k >= 0 && _exec.OpenTimes[k] >= m5Close; k--)
            {
                _consumedTailHigh = Math.Max(_consumedTailHigh, _exec.HighPrices[k]);
                _consumedTailLow = Math.Min(_consumedTailLow, _exec.LowPrices[k]);
            }
        }

        private bool IsLiquidityConsumed(LiquidityLevel level, DateTime cutoffUtc)
        {
            if (level == null || level.FormedUtc == DateTime.MinValue || cutoffUtc == DateTime.MinValue || level.FormedUtc >= cutoffUtc)
                return false;
            EnsureConsumedIndex(cutoffUtc);
            double hi = _consumedTailHigh, lo = _consumedTailLow;
            if (_consumedLast >= 0)
            {
                int k = _m5.OpenTimes.GetIndexByTime(level.FormedUtc);
                if (k < _consumedFirst) k = _consumedFirst;
                while (k > _consumedFirst && _m5.OpenTimes[k - 1] >= level.FormedUtc) k--;
                while (k <= _consumedLast && _m5.OpenTimes[k] < level.FormedUtc) k++;
                if (k <= _consumedLast)
                {
                    hi = Math.Max(hi, _consumedHigh[k - _consumedFirst]);
                    lo = Math.Min(lo, _consumedLow[k - _consumedFirst]);
                }
            }
            double through = Math.Max(Symbol.TickSize * 2.0, MinimumSweepPips * StrategyPip);
            return level.Side > 0 ? hi > level.Price + through : lo < level.Price - through;
        }

        private void AddCrtLiquidity(List<LiquidityLevel> levels, DateTime timeUtc)
        {
            // CRT liquidity must come from fully CLOSED candles. v2.32 used the generic
            // completed-index helper which could still point at the active HTF candle
            // in historical replay. v2.33 deliberately anchors to a closed dealing range.
            if (UseCrtH1Range)
                AddCrtRangeLiquidity(levels, FindRecentCrtRange(_h1, timeUtc, "CRT H1", 60, CrtH1ContextLookbackBars, CrtMinimumCandleAtr), 3, true);
            if (UseCrtM15Range)
                AddCrtRangeLiquidity(levels, FindRecentCrtRange(_m15, timeUtc, "CRT M15", 15, CrtM15ContextLookbackBars, CrtM15MinimumCandleAtr), 2, true);
        }

        private void AddCrtRangeLiquidity(List<LiquidityLevel> levels, CrtRangeContext range, int strength, bool external)
        {
            if (range == null || !range.Valid)
                return;
            DateTime formed = range.SourceOpenTime.AddMinutes(range.TimeframeMinutes);
            levels.Add(new LiquidityLevel(range.Label + " H", range.High, 1, strength, external) { FormedUtc = formed });
            levels.Add(new LiquidityLevel(range.Label + " L", range.Low, -1, strength, external) { FormedUtc = formed });
        }

        private CrtRangeContext FindRecentCrtRange(Bars bars, DateTime timeUtc, string label, int timeframeMinutes, int lookbackBars, double minimumCandleAtr)
        {
            if (bars == null || bars.Count < 20)
                return null;

            int end = GetLastFullyClosedBarIndex(bars, timeUtc, timeframeMinutes);
            if (end < 14)
                return null;

            int earliest = Math.Max(14, end - Math.Max(1, lookbackBars) + 1);
            for (int i = end; i >= earliest; i--)
            {
                double atr = CalculateAtr(bars, i, 14);
                double high = bars.HighPrices[i];
                double low = bars.LowPrices[i];
                double range = high - low;
                if (atr <= 0 || range <= 0 || range < atr * minimumCandleAtr)
                    continue;

                bool highConsumed = false;
                bool lowConsumed = false;
                for (int k = i + 1; k <= end; k++)
                {
                    if (bars.HighPrices[k] > high)
                        highConsumed = true;
                    if (bars.LowPrices[k] < low)
                        lowConsumed = true;
                }
                if (highConsumed && lowConsumed)
                    continue;

                return new CrtRangeContext
                {
                    Valid = true,
                    Label = label,
                    SourceIndex = i,
                    SourceOpenTime = bars.OpenTimes[i],
                    High = high,
                    Low = low,
                    Equilibrium = (high + low) / 2.0,
                    Atr = atr,
                    Range = range,
                    TimeframeMinutes = timeframeMinutes
                };
            }

            return null;
        }

        private static int GetLastFullyClosedBarIndex(Bars bars, DateTime timeUtc, int timeframeMinutes)
        {
            if (bars == null || bars.Count == 0 || timeframeMinutes <= 0)
                return -1;

            DateTime latestAllowedOpen = timeUtc.AddMinutes(-timeframeMinutes);
            int idx = bars.OpenTimes.GetIndexByTime(latestAllowedOpen);
            if (idx < 0)
            {
                for (int i = bars.Count - 1; i >= 0; i--)
                {
                    if (bars.OpenTimes[i] <= latestAllowedOpen)
                        return i;
                }
                return -1;
            }

            while (idx + 1 < bars.Count && bars.OpenTimes[idx + 1] <= latestAllowedOpen)
                idx++;
            while (idx >= 0 && bars.OpenTimes[idx] > latestAllowedOpen)
                idx--;

            return Math.Max(-1, Math.Min(idx, bars.Count - 1));
        }

        private string ClassifySetupType(string liquidityName, bool sameBarReclaim)
        {
            if (IsM5InternalLiquidityName(liquidityName))
                return "M5 Internal";
            if (!string.IsNullOrEmpty(liquidityName) && liquidityName.IndexOf("CRT", StringComparison.OrdinalIgnoreCase) >= 0)
                return "CRT Sweep";
            if (sameBarReclaim)
                return "TurtleSoup";
            if (!string.IsNullOrEmpty(liquidityName) &&
                (liquidityName.IndexOf("Asia", StringComparison.OrdinalIgnoreCase) >= 0 ||
                 liquidityName.IndexOf("London", StringComparison.OrdinalIgnoreCase) >= 0 ||
                 liquidityName.IndexOf("PDH", StringComparison.OrdinalIgnoreCase) >= 0 ||
                 liquidityName.IndexOf("PDL", StringComparison.OrdinalIgnoreCase) >= 0))
                return "SessionSweep";
            return "LiquiditySweep";
        }

        private void CaptureCrtContext(SetupState s, int i, double atr, DateTime timeUtc)
        {
            if (s == null || !EnableCrtContextLayer)
                return;

            s.CrtH1 = FindRecentCrtRange(_h1, timeUtc, "CRT H1", 60, CrtH1ContextLookbackBars, CrtMinimumCandleAtr);
            s.CrtM15 = UseCrtM15Context
                ? FindRecentCrtRange(_m15, timeUtc, "CRT M15", 15, CrtM15ContextLookbackBars, CrtM15MinimumCandleAtr)
                : null;

            RefreshCrtContextState(s, i, atr);

            if (VerboseLog && s.CrtH1 != null)
            {
                Log("{0}: CRT context H1 [{1:F2}-{2:F2}] EQ={3:F2}, sweep={4}, reclaim={5}{6}.",
                    DirectionText(s.Direction), s.CrtH1.Low, s.CrtH1.High, s.CrtH1.Equilibrium,
                    s.CrtH1SweepObserved, s.CrtH1SweepReclaimed,
                    s.CrtM15 == null ? "" :
                        string.Format(CultureInfo.InvariantCulture, ", M15 [{0:F2}-{1:F2}] align={2}",
                            s.CrtM15.Low, s.CrtM15.High, s.CrtM15SweepReclaimed));
            }
        }

        private void RefreshCrtContextState(SetupState s, int i, double atr)
        {
            if (s == null || !EnableCrtContextLayer || i < 0)
                return;

            double minSweep = Math.Max(MinimumSweepPips * StrategyPip, atr * MinimumSweepAtr);
            double close = _exec.ClosePrices[i];

            if (s.CrtH1 != null && s.CrtH1.Valid)
            {
                if (s.Direction > 0)
                {
                    if (_exec.LowPrices[i] < s.CrtH1.Low - minSweep)
                        s.CrtH1SweepObserved = true;
                    if (s.CrtH1SweepObserved && close > s.CrtH1.Low)
                        s.CrtH1SweepReclaimed = true;
                }
                else
                {
                    if (_exec.HighPrices[i] > s.CrtH1.High + minSweep)
                        s.CrtH1SweepObserved = true;
                    if (s.CrtH1SweepObserved && close < s.CrtH1.High)
                        s.CrtH1SweepReclaimed = true;
                }
            }

            if (s.CrtM15 != null && s.CrtM15.Valid)
            {
                if (s.Direction > 0)
                {
                    if (_exec.LowPrices[i] < s.CrtM15.Low - minSweep)
                        s.CrtM15SweepObserved = true;
                    if (s.CrtM15SweepObserved && close > s.CrtM15.Low)
                        s.CrtM15SweepReclaimed = true;
                }
                else
                {
                    if (_exec.HighPrices[i] > s.CrtM15.High + minSweep)
                        s.CrtM15SweepObserved = true;
                    if (s.CrtM15SweepObserved && close < s.CrtM15.High)
                        s.CrtM15SweepReclaimed = true;
                }
            }
        }

        private bool IsCrtReversalInvalidated(SetupState s, int i, double atr)
        {
            if (!EnableCrtContextLayer || !CrtInvalidateAfterReentry || s == null ||
                s.CrtH1 == null || !s.CrtH1.Valid || !s.CrtH1SweepReclaimed)
                return false;

            double buffer = Math.Max(Symbol.TickSize * 2.0, atr * CrtOutsideCloseBufferAtr);
            if (s.Direction > 0)
                return _exec.ClosePrices[i] < s.CrtH1.Low - buffer;
            return _exec.ClosePrices[i] > s.CrtH1.High + buffer;
        }

        private void AnnotateZoneWithCrtContext(SetupState s, ZoneInfo zone)
        {
            if (s == null || zone == null || !EnableCrtContextLayer || s.CrtH1 == null || !s.CrtH1.Valid)
                return;

            zone.CrtCorrectPremiumDiscount = s.Direction > 0
                ? zone.Midpoint <= s.CrtH1.Equilibrium
                : zone.Midpoint >= s.CrtH1.Equilibrium;

            double eqDistance = Math.Abs(zone.Midpoint - s.CrtH1.Equilibrium);
            zone.CrtNearEquilibrium = eqDistance <= s.CrtH1.Range * CrtEquilibriumToleranceRange;
        }

        private bool HasCrtOpposingTargetRoom(SetupState s, int i, double atr)
        {
            if (s == null || s.Zone == null || s.CrtH1 == null || !s.CrtH1.Valid ||
                !s.CrtH1SweepReclaimed || s.CrtH1.Range <= 0)
                return false;

            double entry = s.Direction > 0 ? Symbol.Ask : Symbol.Bid;
            double opposite = s.Direction > 0 ? s.CrtH1.High : s.CrtH1.Low;
            bool correctSide = s.Direction > 0 ? opposite > entry : opposite < entry;
            if (!correctSide)
                return false;

            double stop = BuildStructuralStop(s, i, atr, entry);
            double riskPips = Math.Abs(entry - stop) / StrategyPip;
            double roomPips = Math.Max(0, Math.Abs(opposite - entry) / StrategyPip - TargetLiquidityBufferPips);
            return riskPips > 0 && roomPips / riskPips >= CrtTargetRoomMinimumR;
        }

        private int CrtContextScore(SetupState s, int i, double atr)
        {
            if (!EnableCrtContextLayer || s == null || s.CrtH1 == null || !s.CrtH1.Valid)
                return 0;

            int score = 0;

            if (s.CrtH1SweepReclaimed)
                score += CrtSweepReclaimScore;

            if (s.Zone != null && zoneHasCorrectCrtPd(s.Zone))
                score += CrtCorrectPremiumDiscountScore;

            if (s.CrtH1SweepReclaimed && s.CrtM15SweepReclaimed)
                score += CrtH1M15AlignmentScore;

            if (HasCrtOpposingTargetRoom(s, i, atr))
                score += CrtOpposingTargetRoomScore;

            if (s.Zone != null && s.Zone.CrtNearEquilibrium && !s.CrtH1SweepReclaimed)
                score -= CrtEquilibriumPenalty;

            return score;
        }

        private static bool zoneHasCorrectCrtPd(ZoneInfo zone)
        {
            return zone != null && zone.CrtCorrectPremiumDiscount;
        }

        private string CrtNarrativeTag(SetupState s)
        {
            if (!EnableCrtContextLayer || s == null || s.CrtH1 == null || !s.CrtH1.Valid)
                return "";

            string side = s.Direction > 0 ? "L" : "H";
            string pd = s.Zone == null ? "" : (s.Zone.CrtCorrectPremiumDiscount ? " PD-ok" : " PD-x");
            string align = s.CrtM15SweepReclaimed ? " M15-align" : "";
            return " | CRT H1 " + side +
                   (s.CrtH1SweepReclaimed ? " sweep+reclaim" : s.CrtH1SweepObserved ? " swept" : " context") +
                   pd + align;
        }

        private void AddPreviousNyDayLevels(List<LiquidityLevel> levels, DateTime timeUtc)
        {
            DateTime currentNyDate = ToNewYork(timeUtc).Date;
            int end = GetCompletedBarIndexAtTime(_m5, timeUtc);
            DateTime previousDate = DateTime.MinValue;
            DateTime formedUtc = DateTime.MinValue;
            for (int i = end; i >= Math.Max(0, end - 900); i--)
            {
                DateTime d = ToNewYork(_m5.OpenTimes[i]).Date;
                if (d < currentNyDate)
                {
                    previousDate = d;
                    formedUtc = _m5.OpenTimes[i].AddMinutes(5);
                    break;
                }
            }
            if (previousDate == DateTime.MinValue)
                return;

            double high = double.MinValue;
            double low = double.MaxValue;
            for (int i = end; i >= Math.Max(0, end - 900); i--)
            {
                DateTime d = ToNewYork(_m5.OpenTimes[i]).Date;
                if (d < previousDate)
                    break;
                if (d != previousDate)
                    continue;
                high = Math.Max(high, _m5.HighPrices[i]);
                low = Math.Min(low, _m5.LowPrices[i]);
            }

            if (high > low && low > 0)
            {
                levels.Add(new LiquidityLevel("PDH", high, 1, 3, true) { FormedUtc = formedUtc });
                levels.Add(new LiquidityLevel("PDL", low, -1, 3, true) { FormedUtc = formedUtc });
            }
        }

        private void AddSessionLevels(List<LiquidityLevel> levels, DateTime timeUtc, string name, int startHourNy, int endHourNy, bool startsPreviousDay)
        {
            DateTime nowNy = ToNewYork(timeUtc);
            DateTime sessionDate = startsPreviousDay ? nowNy.Date.AddDays(-1) : nowNy.Date;

            // For Asia 20:00 -> 00:00, the session is completed after midnight.
            // For London 02:00 -> 05:00, only publish the level once 05:00 NY has passed.
            if (!startsPreviousDay && nowNy.TimeOfDay < TimeSpan.FromHours(endHourNy))
                return;

            int end = GetCompletedBarIndexAtTime(_m5, timeUtc);
            double high = double.MinValue;
            double low = double.MaxValue;
            bool any = false;
            DateTime formedUtc = DateTime.MinValue;

            for (int i = end; i >= Math.Max(0, end - 500); i--)
            {
                DateTime ny = ToNewYork(_m5.OpenTimes[i]);
                bool inSession;
                if (startsPreviousDay)
                {
                    inSession = ny.Date == sessionDate && ny.Hour >= startHourNy;
                }
                else
                {
                    inSession = ny.Date == sessionDate && ny.Hour >= startHourNy && ny.Hour < endHourNy;
                }

                if (inSession)
                {
                    if (!any)
                        formedUtc = _m5.OpenTimes[i].AddMinutes(5);
                    any = true;
                    high = Math.Max(high, _m5.HighPrices[i]);
                    low = Math.Min(low, _m5.LowPrices[i]);
                }
                else if (any)
                {
                    break;
                }
            }

            if (any && high > low)
            {
                levels.Add(new LiquidityLevel(name + " H", high, 1, 3, true) { FormedUtc = formedUtc });
                levels.Add(new LiquidityLevel(name + " L", low, -1, 3, true) { FormedUtc = formedUtc });
            }
        }

        private bool IsM5InternalLiquidityName(string name)
        {
            return EnableM5InternalLiquidity &&
                   !string.IsNullOrEmpty(name) &&
                   name.StartsWith("M5 i", StringComparison.OrdinalIgnoreCase);
        }

        private bool IsM5InternalLiquidityLevel(LiquidityLevel level)
        {
            return level != null && !level.External && IsM5InternalLiquidityName(level.Name);
        }

        private bool IsM5InternalSetup(SetupState s)
        {
            return s != null && !s.LiquidityExternal && IsM5InternalLiquidityName(s.LiquidityName);
        }

        private bool IsM5InternalQualityCandidate(SetupState s, RegimeSnapshot regime, DateTime timeUtc)
        {
            if (!EnableM5InternalLiquidity || s == null || s.Zone == null || s.LiquidityExternal)
                return false;
            if (!IsM5InternalLiquidityName(s.LiquidityName))
                return false;
            if (M5InternalRequireCoreSession && CoreSessionName(timeUtc) == "OFF")
                return false;
            if (!IsM5InternalStaticQuality(s))
                return false;

            if (M5InternalRequireDeliveryAlignment)
            {
                bool aligned = regime != null &&
                               (regime.Regime == s.Direction ||
                                regime.DeliveryTrend == s.Direction ||
                                regime.TransitionDirection == s.Direction);
                if (!aligned)
                    return false;
            }
            return true;
        }

        // Zone/CRT part of the M5 internal gate: fixed once the zone exists (time-dependent parts stay at the order gate).
        private bool IsM5InternalStaticQuality(SetupState s)
        {
            if (s.Zone.Quality < M5InternalMinimumZoneQuality)
                return false;
            if (M5InternalRequireComposite && !s.Zone.Composite)
                return false;
            if (!s.Zone.InCorrectPremiumDiscount)
                return false;
            if (M5InternalRequireCrtPremiumDiscount &&
                (!EnableCrtContextLayer || s.CrtH1 == null || !s.CrtH1.Valid || !s.Zone.CrtCorrectPremiumDiscount || s.Zone.CrtNearEquilibrium))
                return false;
            return true;
        }

        private void AddM5InternalLiquidity(List<LiquidityLevel> levels, DateTime timeUtc)
        {
            int end = GetCompletedBarIndexAtTime(_m5, timeUtc);
            if (end < M5InternalPivotLeft + M5InternalPivotRight + 5)
                return;

            int start = Math.Max(M5InternalPivotLeft, end - M5InternalLookback);
            double atr = CalculateAtr(_m5, end, 14);
            double tolerance = Math.Max(Symbol.TickSize * 2.0, atr * M5InternalEqualToleranceAtr);
            var raw = new List<LiquidityLevel>();

            for (int i = end - M5InternalPivotRight; i >= start; i--)
            {
                DateTime formed = _m5.OpenTimes[i + M5InternalPivotRight].AddMinutes(5);
                if (IsPivot(_m5, i, true, M5InternalPivotLeft, M5InternalPivotRight, end))
                    raw.Add(new LiquidityLevel("M5 iBSL", _m5.HighPrices[i], 1, 1, false) { FormedUtc = formed });
                if (IsPivot(_m5, i, false, M5InternalPivotLeft, M5InternalPivotRight, end))
                    raw.Add(new LiquidityLevel("M5 iSSL", _m5.LowPrices[i], -1, 1, false) { FormedUtc = formed });
                if (raw.Count >= 36)
                    break;
            }

            foreach (int side in new[] { -1, 1 })
            {
                var sideLevels = raw.Where(x => x.Side == side).ToList();
                var used = new bool[sideLevels.Count];
                for (int a = 0; a < sideLevels.Count; a++)
                {
                    if (used[a]) continue;
                    double sum = sideLevels[a].Price;
                    int count = 1;
                    used[a] = true;
                    DateTime formed = sideLevels[a].FormedUtc;

                    for (int b = a + 1; b < sideLevels.Count; b++)
                    {
                        if (used[b]) continue;
                        if (Math.Abs(sideLevels[b].Price - sideLevels[a].Price) <= tolerance)
                        {
                            used[b] = true;
                            sum += sideLevels[b].Price;
                            count++;
                            if (sideLevels[b].FormedUtc > formed) formed = sideLevels[b].FormedUtc;
                        }
                    }

                    if (Math.Min(3, count) < M5InternalMinimumStrength)
                        continue;   // v2.60-dev: optionally only equal highs/lows count as internal liquidity
                    string label = side > 0
                        ? (count >= 2 ? "M5 iEQH" : "M5 iBSL")
                        : (count >= 2 ? "M5 iEQL" : "M5 iSSL");
                    levels.Add(new LiquidityLevel(label, sum / count, side, Math.Min(3, count), false) { FormedUtc = formed });
                }
            }
        }

        private void AddM15SwingLiquidity(List<LiquidityLevel> levels, DateTime timeUtc)
        {
            int end = GetCompletedBarIndexAtTime(_m15, timeUtc);
            if (end < M15PivotLeft + M15PivotRight + 5)
                return;

            int start = Math.Max(M15PivotLeft, end - M15LiquidityLookback);
            double atr = CalculateAtr(_m15, end, 14);
            double tolerance = Math.Max(Symbol.TickSize * 2.0, atr * EqualLiquidityToleranceAtr);
            var raw = new List<LiquidityLevel>();

            for (int i = end - M15PivotRight; i >= start; i--)
            {
                DateTime formed = _m15.OpenTimes[i + M15PivotRight].AddMinutes(15);
                if (IsPivot(_m15, i, true, M15PivotLeft, M15PivotRight, end))
                    raw.Add(new LiquidityLevel("M15 BSL", _m15.HighPrices[i], 1, 1, true) { FormedUtc = formed });
                if (IsPivot(_m15, i, false, M15PivotLeft, M15PivotRight, end))
                    raw.Add(new LiquidityLevel("M15 SSL", _m15.LowPrices[i], -1, 1, true) { FormedUtc = formed });
                if (raw.Count >= 24)
                    break;
            }

            foreach (int side in new[] { -1, 1 })
            {
                var sideLevels = raw.Where(x => x.Side == side).ToList();
                var used = new bool[sideLevels.Count];
                for (int a = 0; a < sideLevels.Count; a++)
                {
                    if (used[a]) continue;
                    double sum = sideLevels[a].Price;
                    int count = 1;
                    used[a] = true;
                    DateTime formed = sideLevels[a].FormedUtc;
                    for (int b = a + 1; b < sideLevels.Count; b++)
                    {
                        if (used[b]) continue;
                        if (Math.Abs(sideLevels[b].Price - sideLevels[a].Price) <= tolerance)
                        {
                            used[b] = true;
                            sum += sideLevels[b].Price;
                            count++;
                            if (sideLevels[b].FormedUtc > formed) formed = sideLevels[b].FormedUtc;
                        }
                    }

                    string label = side > 0 ? (count >= 2 ? "M15 EQH" : "M15 BSL") : (count >= 2 ? "M15 EQL" : "M15 SSL");
                    levels.Add(new LiquidityLevel(label, sum / count, side, Math.Min(3, count), true) { FormedUtc = formed });
                }
            }
        }

        private List<LiquidityLevel> DeduplicateLiquidity(List<LiquidityLevel> input, DateTime timeUtc)
        {
            double atr = CalculateAtr(_m5, GetCompletedBarIndexAtTime(_m5, timeUtc), 14);
            double tolerance = Math.Max(Symbol.TickSize * 2.0, atr * 0.02);
            var result = new List<LiquidityLevel>();

            foreach (LiquidityLevel level in input.OrderByDescending(x => x.External).ThenByDescending(x => x.Strength))
            {
                LiquidityLevel existing = result.FirstOrDefault(x => x.Side == level.Side && Math.Abs(x.Price - level.Price) <= tolerance);
                if (existing == null)
                {
                    result.Add(level);
                }
                else
                {
                    existing.Strength = Math.Max(existing.Strength, level.Strength);
                    existing.External = existing.External || level.External;
                    if (!existing.Name.Contains(level.Name))
                        existing.Name = existing.Name + "/" + level.Name;
                }
            }
            return result;
        }

        private bool WasRecentlyTaken(int i, LiquidityLevel level, int direction, double minSweep)
        {
            int from = Math.Max(0, i - 5);
            for (int k = from; k < i; k++)
            {
                if (direction > 0 && _exec.LowPrices[k] < level.Price - minSweep)
                    return true;
                if (direction < 0 && _exec.HighPrices[k] > level.Price + minSweep)
                    return true;
            }
            return false;
        }

        // ========================= MSS / REGIME =========================
        private double FindMssLevelBefore(int eventIndex, int direction)
        {
            int end = eventIndex - ExecPivotRight - 1;
            int start = Math.Max(ExecPivotLeft, eventIndex - MssLookbackBars);
            for (int i = end; i >= start; i--)
            {
                bool high = direction > 0;
                if (IsPivot(_exec, i, high, ExecPivotLeft, ExecPivotRight, eventIndex - 1))
                    return high ? _exec.HighPrices[i] : _exec.LowPrices[i];
            }
            return 0;
        }

        private RegimeSnapshot GetAdaptiveRegime(DateTime timeUtc)
        {
            return GetAdaptiveRegime(timeUtc, DateTime.MinValue);
        }

        private RegimeSnapshot GetAdaptiveRegime(DateTime timeUtc, DateTime vetoMustCloseAfterUtc)
        {
            var r = new RegimeSnapshot();
            r.AnchorTrend = GetPersistentStructureTrend(_m15, GetCompletedBarIndexAtTime(_m15, timeUtc), 2, 2, 120);
            r.DeliveryTrend = GetPersistentStructureTrend(_m5, GetCompletedBarIndexAtTime(_m5, timeUtc), 2, 1, 120);
            r.ExecTrend = GetPersistentStructureTrend(_exec, GetCompletedBarIndexAtTime(_exec, timeUtc), ExecPivotLeft, ExecPivotRight, 120);

            if (r.AnchorTrend != 0 && r.AnchorTrend == r.DeliveryTrend)
                r.Regime = r.AnchorTrend;
            else if (r.DeliveryTrend != 0)
                r.TransitionDirection = r.DeliveryTrend;

            DateTime vetoCloseUtc;
            r.DeliveryVetoDirection = GetRecentDeliveryVeto(_m5, timeUtc, r.AnchorTrend, out vetoCloseUtc);
            if (r.DeliveryVetoDirection != 0 && vetoMustCloseAfterUtc != DateTime.MinValue && vetoCloseUtc <= vetoMustCloseAfterUtc)
                r.DeliveryVetoDirection = 0;
            if (r.DeliveryVetoDirection != 0 && r.DeliveryVetoDirection != r.Regime)
            {
                r.Regime = 0;
                r.TransitionDirection = r.DeliveryVetoDirection;
            }
            return r;
        }

        private int GetRecentDeliveryVeto(Bars bars, DateTime timeUtc, int anchorTrend, out DateTime vetoCloseUtc)
        {
            vetoCloseUtc = DateTime.MinValue;
            int veto = GetRecentDeliveryVetoAt(bars, timeUtc, anchorTrend, out int vetoIndex);
            if (veto != 0)
                vetoCloseUtc = bars.OpenTimes[vetoIndex].AddMinutes(5);
            return veto;
        }

        private int GetRecentDeliveryVetoAt(Bars bars, DateTime timeUtc, int anchorTrend, out int vetoIndex)
        {
            vetoIndex = -1;
            int end = GetCompletedBarIndexAtTime(bars, timeUtc);
            if (end < 8)
                return 0;

            for (int i = end; i >= Math.Max(6, end - 2); i--)
            {
                double atr = CalculateAtr(bars, i, 14);
                if (atr <= 0) continue;
                int ph = FindPriorPivot(bars, i - 1, true, 2, 1, 24);
                int pl = FindPriorPivot(bars, i - 1, false, 2, 1, 24);
                double buffer = Math.Max(Symbol.TickSize, atr * 0.01);
                bool up = ph >= 0 && bars.ClosePrices[i] > bars.HighPrices[ph] + buffer && bars.ClosePrices[i - 1] <= bars.HighPrices[ph] + buffer;
                bool down = pl >= 0 && bars.ClosePrices[i] < bars.LowPrices[pl] - buffer && bars.ClosePrices[i - 1] >= bars.LowPrices[pl] - buffer;

                if (anchorTrend > 0 && down && HasDirectionalDisplacement(bars, i, -1, atr)) { vetoIndex = i; return -1; }
                if (anchorTrend < 0 && up && HasDirectionalDisplacement(bars, i, 1, atr)) { vetoIndex = i; return 1; }
                if (anchorTrend == 0)
                {
                    if (up && HasDirectionalDisplacement(bars, i, 1, atr)) { vetoIndex = i; return 1; }
                    if (down && HasDirectionalDisplacement(bars, i, -1, atr)) { vetoIndex = i; return -1; }
                }
            }
            return 0;
        }

        private int GetPersistentStructureTrend(Bars bars, int endIndex, int left, int right, int lookback)
        {
            if (bars == null || endIndex < left + right + 5)
                return 0;

            int start = Math.Max(left + right + 2, endIndex - lookback);
            int trend = 0;
            int lastHigh = FindPriorPivot(bars, start - 1, true, left, right, lookback);
            int lastLow = FindPriorPivot(bars, start - 1, false, left, right, lookback);
            int brokenHigh = -1;
            int brokenLow = -1;

            for (int i = start; i <= endIndex; i++)
            {
                int candidate = i - right;
                if (candidate >= left)
                {
                    if (IsPivot(bars, candidate, true, left, right, i)) lastHigh = candidate;
                    if (IsPivot(bars, candidate, false, left, right, i)) lastLow = candidate;
                }

                if (i < 1) continue;
                double atr = CalculateAtr(bars, i, 14);
                double buffer = Math.Max(Symbol.TickSize, atr * 0.005);

                bool up = lastHigh >= 0 && lastHigh != brokenHigh && bars.ClosePrices[i] > bars.HighPrices[lastHigh] + buffer && bars.ClosePrices[i - 1] <= bars.HighPrices[lastHigh] + buffer;
                bool down = lastLow >= 0 && lastLow != brokenLow && bars.ClosePrices[i] < bars.LowPrices[lastLow] - buffer && bars.ClosePrices[i - 1] >= bars.LowPrices[lastLow] - buffer;

                if (up)
                {
                    trend = 1;
                    brokenHigh = lastHigh;
                }
                else if (down)
                {
                    trend = -1;
                    brokenLow = lastLow;
                }
            }
            return trend;
        }

        private bool HasDirectionalDisplacement(Bars bars, int i, int direction, double atr)
        {
            if (i < 0 || i >= bars.Count || atr <= 0)
                return false;
            double range = bars.HighPrices[i] - bars.LowPrices[i];
            double body = Math.Abs(bars.ClosePrices[i] - bars.OpenPrices[i]);
            if (range <= 0) return false;
            bool directional = direction > 0 ? bars.ClosePrices[i] > bars.OpenPrices[i] : bars.ClosePrices[i] < bars.OpenPrices[i];
            return directional && body >= atr * DisplacementBodyAtr && range >= atr * DisplacementRangeAtr && body / range >= DisplacementMinBodyPercent / 100.0;
        }

        private bool HasMultiCandleDisplacement(Bars bars, int i, int direction, double atr)
        {
            if (i < 2 || atr <= 0)
                return false;
            double net = direction > 0 ? bars.ClosePrices[i] - bars.OpenPrices[i - 2] : bars.OpenPrices[i - 2] - bars.ClosePrices[i];
            double withDirection = 0;
            double against = 0;
            for (int k = i - 2; k <= i; k++)
            {
                double body = Math.Abs(bars.ClosePrices[k] - bars.OpenPrices[k]);
                bool dir = direction > 0 ? bars.ClosePrices[k] >= bars.OpenPrices[k] : bars.ClosePrices[k] <= bars.OpenPrices[k];
                if (dir) withDirection += body; else against += body;
            }
            return net >= atr * 0.65 && withDirection >= atr * 0.90 && withDirection > against * 1.8;
        }

        // ========================= ENTRY ZONE =========================
        private ZoneInfo FindEventEntryZone(SetupState s, int currentIndex, double atr)
        {
            if (s.MssIndex < 2 || currentIndex < s.MssIndex)
                return null;
            if (FvgSearchWholeLeg)
                return FindLegEntryZone(s, currentIndex, atr);

            ZoneInfo bestFvg = null;
            int last = Math.Min(currentIndex, s.MssIndex + 2);
            for (int j = s.MssIndex; j <= last; j++)
            {
                ZoneInfo fvg = TryCreateFvg(j, s.Direction, atr);
                if (fvg == null) continue;
                if (bestFvg == null || fvg.Width > bestFvg.Width)
                    bestFvg = fvg;
            }
            if (bestFvg == null)
                return null;

            return QualifyEventZone(s, bestFvg, FindOriginOrderBlock(s, atr), atr);
        }

        // v2.60-dev (P1): every FVG printed by the displacement leg (sweep candle .. MSS + 2) is a candidate. Composite,
        // width, discount, quality and freshness (price has not traded back into it) are checked per candidate; the best
        // surviving zone wins (higher quality, then the more recent one). v2.59 only looked at the premium end of the leg.
        private ZoneInfo FindLegEntryZone(SetupState s, int currentIndex, double atr)
        {
            int first = Math.Max(2, s.TakenIndex + 2);
            int last = Math.Min(currentIndex, s.MssIndex + 2);
            ZoneInfo ob = FindOriginOrderBlock(s, atr);
            ZoneInfo best = null;
            for (int j = first; j <= last; j++)
            {
                ZoneInfo fvg = TryCreateFvg(j, s.Direction, atr);
                if (fvg == null || !IsFvgUntouchedSince(fvg, j, currentIndex, s.Direction))
                    continue;
                ZoneInfo zone = QualifyEventZone(s, fvg, ob, atr);
                if (zone == null)
                    continue;
                if (best == null || zone.Quality > best.Quality || (zone.Quality == best.Quality && zone.SourceIndex > best.SourceIndex))
                    best = zone;
            }
            return best;
        }

        private bool IsFvgUntouchedSince(ZoneInfo fvg, int sourceIndex, int currentIndex, int direction)
        {
            for (int k = sourceIndex + 1; k <= currentIndex; k++)
                if (direction > 0 ? _exec.LowPrices[k] <= fvg.High : _exec.HighPrices[k] >= fvg.Low)
                    return false;
            return true;
        }

        private ZoneInfo QualifyEventZone(SetupState s, ZoneInfo bestFvg, ZoneInfo ob, double atr)
        {
            ZoneInfo zone = bestFvg;
            bool overlaps = ob != null && Math.Min(bestFvg.High, ob.High) > Math.Max(bestFvg.Low, ob.Low);
            double obGapPips = double.MaxValue;
            if (ob != null && !overlaps)
            {
                double gap = bestFvg.High < ob.Low ? ob.Low - bestFvg.High : bestFvg.Low > ob.High ? bestFvg.Low - ob.High : 0;
                obGapPips = gap / StrategyPip;
            }
            bool bridge = ob != null && !overlaps && BridgeNearbyFvgOb && obGapPips <= MaxFvgObBridgePips;
            if (overlaps)
            {
                zone = new ZoneInfo
                {
                    Low = Math.Max(bestFvg.Low, ob.Low),
                    High = Math.Min(bestFvg.High, ob.High),
                    SourceIndex = Math.Max(bestFvg.SourceIndex, ob.SourceIndex),
                    Composite = true,
                    HasFvg = true,
                    HasOrderBlock = true,
                    Label = "FVG+OB"
                };
            }
            else if (bridge)
            {
                zone = new ZoneInfo
                {
                    Low = Math.Min(bestFvg.Low, ob.Low),
                    High = Math.Max(bestFvg.High, ob.High),
                    SourceIndex = Math.Max(bestFvg.SourceIndex, ob.SourceIndex),
                    Composite = true,
                    HasFvg = true,
                    HasOrderBlock = true,
                    Label = "FVG~OB"
                };
            }
            else
            {
                zone.HasFvg = true;
                zone.HasOrderBlock = ob != null;
                zone.Composite = false;
                zone.Label = "FVG";
            }

            if (RequireCompositeZone && !zone.Composite)
                return null;

            zone.Width = zone.High - zone.Low;
            if (zone.Width <= 0)
                return null;
            zone.WidthAtr = zone.Width / atr;
            if (zone.WidthAtr > MaximumZoneWidthAtr)
                return null;

            zone.HasDisplacement = s.HasDisplacement;
            zone.InCorrectPremiumDiscount = IsCorrectPremiumDiscount(s, zone);
            zone.OteConfluence = HasOteConfluence(s, zone);
            zone.Quality = EvaluateZoneQuality(zone);
            zone.Label = (zone.Quality >= 80 ? "A " : zone.Quality >= 65 ? "B " : "C ") + zone.Label;

            if (!zone.HasDisplacement || !zone.HasFvg || !zone.InCorrectPremiumDiscount || zone.Quality < MinimumZoneQuality)
                return null;

            return zone;
        }

        private ZoneInfo BuildBroadTradeZone(SetupState s, ZoneInfo zone)
        {
            if (!UseBroadTradeZone || zone == null || s.ImpulseHigh <= s.ImpulseLow)
                return zone;

            double maxWidth = TradeZoneMaximumPips * StrategyPip;
            double targetWidth = Math.Min(TradeZoneMaximumPips, Math.Max(0, TradeZoneTargetPips)) * StrategyPip;
            if (targetWidth <= 0)
                return zone;
            if (zone.Width >= targetWidth && zone.Width <= maxWidth)
                return zone;

            double eq = (s.ImpulseHigh + s.ImpulseLow) / 2.0;
            double mid = zone.Midpoint;
            double low = mid - targetWidth / 2.0;
            double high = mid + targetWidth / 2.0;

            low = Math.Max(low, s.ImpulseLow);
            high = Math.Min(high, s.ImpulseHigh);
            if (s.Direction > 0)
                high = Math.Min(high, eq);
            else
                low = Math.Max(low, eq);

            // Never cut away the source PD array itself.
            low = Math.Min(low, zone.Low);
            high = Math.Max(high, zone.High);

            if (high - low > maxWidth)
            {
                if (s.Direction > 0)
                    low = high - maxWidth;
                else
                    high = low + maxWidth;
            }

            if (high <= low)
                return zone;

            zone.Low = low;
            zone.High = high;
            zone.Width = high - low;
            zone.Label += " TradeZone";
            return zone;
        }

        private ZoneInfo TryCreateFvg(int i, int direction, double atr)
        {
            if (i < 2 || atr <= 0)
                return null;

            double minGap = atr * FvgMinimumAtr;
            if (direction > 0)
            {
                double low = _exec.HighPrices[i - 2];
                double high = _exec.LowPrices[i];
                if (high - low < minGap)
                    return null;
                return new ZoneInfo { Low = low, High = high, SourceIndex = i, HasFvg = true, Label = "FVG" };
            }
            else
            {
                double low = _exec.HighPrices[i];
                double high = _exec.LowPrices[i - 2];
                if (high - low < minGap)
                    return null;
                return new ZoneInfo { Low = low, High = high, SourceIndex = i, HasFvg = true, Label = "FVG" };
            }
        }

        private ZoneInfo FindOriginOrderBlock(SetupState s, double atr)
        {
            int from = Math.Max(s.TakenIndex, s.MssIndex - ObSearchBackBars);
            for (int i = s.MssIndex - 1; i >= from; i--)
            {
                bool opposite = s.Direction > 0 ? _exec.ClosePrices[i] < _exec.OpenPrices[i] : _exec.ClosePrices[i] > _exec.OpenPrices[i];
                if (!opposite) continue;

                double low;
                double high;
                if (s.Direction > 0)
                {
                    low = _exec.LowPrices[i];
                    high = Math.Max(_exec.OpenPrices[i], _exec.ClosePrices[i]);
                }
                else
                {
                    low = Math.Min(_exec.OpenPrices[i], _exec.ClosePrices[i]);
                    high = _exec.HighPrices[i];
                }

                if (high <= low || (high - low) > atr * 1.50)
                    continue;

                return new ZoneInfo { Low = low, High = high, SourceIndex = i, HasOrderBlock = true, Label = "OB" };
            }
            return null;
        }

        private int EvaluateZoneQuality(ZoneInfo z)
        {
            int q = 50;
            if (z.HasFvg) q += 10;
            if (z.HasDisplacement) q += 12;
            if (z.InCorrectPremiumDiscount) q += 8; else q -= 12;
            if (z.Composite) q += 10;
            else if (z.HasOrderBlock) q += 4;
            if (z.WidthAtr <= 0.65) q += 7;
            else if (z.WidthAtr <= 1.00) q += 4;
            else q -= 8;
            if (z.OteConfluence) q += 3;
            return Math.Max(0, Math.Min(100, q));
        }

        private bool IsCorrectPremiumDiscount(SetupState s, ZoneInfo z)
        {
            if (s.ImpulseHigh <= s.ImpulseLow)
                return false;
            double eq = (s.ImpulseHigh + s.ImpulseLow) / 2.0;
            return s.Direction > 0 ? z.Midpoint <= eq : z.Midpoint >= eq;
        }

        private bool HasOteConfluence(SetupState s, ZoneInfo z)
        {
            if (s.ImpulseHigh <= s.ImpulseLow)
                return false;
            double range = s.ImpulseHigh - s.ImpulseLow;
            double mid = z.Midpoint;
            double retracement;
            if (s.Direction > 0)
                retracement = (s.ImpulseHigh - mid) / range;
            else
                retracement = (mid - s.ImpulseLow) / range;
            return retracement >= 0.62 && retracement <= 0.79;
        }

        private bool IsReactionConfirmation(SetupState s, int i, double atr)
        {
            string confirmationType;
            if (!EvaluateReactionConfirmation(s, i, atr, out confirmationType))
                return false;

            s.ConfirmationType = confirmationType;
            Log("{0}: confirmation accepted tier={1} via {2}, Q={3}.",
                DirectionText(s.Direction), ConfirmationTierName(s), confirmationType,
                s.Zone == null ? 0 : s.Zone.Quality);
            return true;
        }

        private bool EvaluateReactionConfirmation(SetupState s, int i, double atr, out string confirmationType)
        {
            confirmationType = "";
            if (s.Zone == null || s.TouchIndex < 0 || i < s.TouchIndex || atr <= 0)
                return false;

            double open = _exec.OpenPrices[i];
            double close = _exec.ClosePrices[i];
            double high = _exec.HighPrices[i];
            double low = _exec.LowPrices[i];
            double body = Math.Abs(close - open);
            double prevBody = i > 0 ? Math.Abs(_exec.ClosePrices[i - 1] - _exec.OpenPrices[i - 1]) : 0;
            double range = Math.Max(Symbol.TickSize, high - low);

            bool directional = s.Direction > 0 ? close > open : close < open;
            bool midpointReclaim = s.Direction > 0 ? close > s.Zone.Midpoint : close < s.Zone.Midpoint;
            bool progress = i > 0 && (s.Direction > 0 ? close > _exec.ClosePrices[i - 1] : close < _exec.ClosePrices[i - 1]);
            bool microBreak = HasMicroBreakAfterTouch(s, i, atr);

            double bodyAtr = body / atr;
            double bodyVsPrevious = prevBody > 0 ? body / prevBody : 99.0;
            bool aPlusBodyOk = bodyAtr >= APlusBodyAtr && bodyVsPrevious >= APlusPreviousBodyFactor;
            bool aBodyOk = bodyAtr >= ReactionBodyAtr && bodyVsPrevious >= ReactionVsPreviousBody;
            bool bBodyOk = bodyAtr >= BZoneBodyAtr && bodyVsPrevious >= BZonePreviousBodyFactor;

            double directionalWick = s.Direction > 0 ? Math.Max(0, Math.Min(open, close) - low) : Math.Max(0, high - Math.Max(open, close));
            double closeLocation = s.Direction > 0 ? (close - low) / range : (high - close) / range;
            bool touchesArray = BarTouchesZone(i, s.Zone) || i == s.TouchIndex;
            bool strongRejection = touchesArray && directional && aPlusBodyOk &&
                                   directionalWick >= body * RejectionWickBodyRatio &&
                                   closeLocation >= RejectionCloseLocation;

            bool aPlusTier = s.Zone.Quality >= APlusZoneQuality;
            bool aTier = !aPlusTier && s.Zone.Quality >= AZoneFastReactionQuality;
            bool selectedBodyOk = aPlusTier ? aPlusBodyOk : aTier ? aBodyOk : bBodyOk;

            s.ConfirmationSawDirectional |= directional;
            s.ConfirmationSawMidpointReclaim |= midpointReclaim;
            s.ConfirmationSawProgress |= progress;
            s.ConfirmationSawMicroBreak |= microBreak;
            s.ConfirmationSawBodyOk |= selectedBodyOk;
            s.ConfirmationSawStrongRejection |= strongRejection;

            if (aPlusTier)
            {
                // A+ follows the reconstructed Telegram/ICT behavior: one clean proof of rejection
                // is enough. It does NOT require midpoint + progress + body + micro-break together.
                if (microBreak)
                {
                    confirmationType = "A+ MicroBreak";
                    return true;
                }
                if (directional && midpointReclaim)
                {
                    confirmationType = "A+ MidpointReclaim";
                    return true;
                }
                if (strongRejection)
                {
                    confirmationType = "A+ Rejection";
                    return true;
                }
                return false;
            }

            if (aTier)
            {
                // Normal A zones need a directional reaction with a moderate body plus either
                // a midpoint reclaim or a micro structure break.
                if (directional && aBodyOk && (midpointReclaim || microBreak))
                {
                    confirmationType = midpointReclaim && microBreak ? "A Midpoint+MicroBreak" : midpointReclaim ? "A MidpointReclaim" : "A MicroBreak";
                    return true;
                }
                return false;
            }

            // B zones remain deliberately strict and need actual structural follow-through.
            if (directional && progress && bBodyOk && midpointReclaim && microBreak)
            {
                confirmationType = "B FullConfirmation";
                return true;
            }
            return false;
        }

        private string ConfirmationTierName(SetupState s)
        {
            if (s == null || s.Zone == null) return "?";
            if (s.Zone.Quality >= APlusZoneQuality) return "A+";
            if (s.Zone.Quality >= AZoneFastReactionQuality) return "A";
            return "B";
        }

        private string BuildConfirmationFailureReason(SetupState s)
        {
            if (s == null || s.Zone == null)
                return "no active zone";

            var missing = new List<string>();
            string tier = ConfirmationTierName(s);

            if (tier == "A+")
            {
                if (!s.ConfirmationSawMicroBreak) missing.Add("no micro break");
                if (!s.ConfirmationSawDirectional) missing.Add("no directional candle");
                if (!s.ConfirmationSawMidpointReclaim) missing.Add("midpoint not reclaimed");
                if (!s.ConfirmationSawStrongRejection) missing.Add("no strong rejection");
            }
            else if (tier == "A")
            {
                if (!s.ConfirmationSawDirectional) missing.Add("no directional candle");
                if (!s.ConfirmationSawBodyOk) missing.Add("body too small");
                if (!s.ConfirmationSawMidpointReclaim && !s.ConfirmationSawMicroBreak) missing.Add("no midpoint reclaim / micro break");
            }
            else
            {
                if (!s.ConfirmationSawDirectional) missing.Add("no directional candle");
                if (!s.ConfirmationSawBodyOk) missing.Add("body too small");
                if (!s.ConfirmationSawProgress) missing.Add("no directional progress");
                if (!s.ConfirmationSawMidpointReclaim) missing.Add("midpoint not reclaimed");
                if (!s.ConfirmationSawMicroBreak) missing.Add("no micro break");
            }

            string missingText = missing.Count == 0 ? "criteria never aligned on same bar" : string.Join(" | ", missing.ToArray());
            return missingText + string.Format(CultureInfo.InvariantCulture,
                " [seen dir={0}, mid={1}, micro={2}, body={3}, progress={4}, reject={5}]",
                s.ConfirmationSawDirectional, s.ConfirmationSawMidpointReclaim,
                s.ConfirmationSawMicroBreak, s.ConfirmationSawBodyOk,
                s.ConfirmationSawProgress, s.ConfirmationSawStrongRejection);
        }

        private bool IsMomentumFallbackTrigger(SetupState s, int i, double atr)
        {
            if (s.Zone == null || s.Zone.Quality < MomentumMinimumZoneQuality || i < 2 || atr <= 0)
                return false;
            if (i <= s.Zone.SourceIndex || i > s.Zone.SourceIndex + ScaleLogicBars(MomentumMaxWaitBars))
                return false;

            // Never chase a move that has already separated materially from the entry array.
            double distanceAtr = DistanceFromZoneAtr(s, i, atr);
            if (distanceAtr > MomentumMaxDistanceAtr)
                return false;

            int p = i - 1;
            double body = Math.Abs(_exec.ClosePrices[i] - _exec.OpenPrices[i]);
            double prevBody = Math.Abs(_exec.ClosePrices[p] - _exec.OpenPrices[p]);
            bool directional = s.Direction > 0 ? _exec.ClosePrices[i] > _exec.OpenPrices[i] : _exec.ClosePrices[i] < _exec.OpenPrices[i];
            bool breakResume = s.Direction > 0 ? _exec.ClosePrices[i] > _exec.HighPrices[p] : _exec.ClosePrices[i] < _exec.LowPrices[p];
            bool pauseBar = s.Direction > 0 ? _exec.ClosePrices[p] <= _exec.OpenPrices[p] : _exec.ClosePrices[p] >= _exec.OpenPrices[p];
            pauseBar = pauseBar || prevBody <= atr * 0.22;
            bool bodyOk = body >= atr * MomentumBodyAtr;

            // The pause must stay on the valid side of the PD array; otherwise this is not a shallow continuation.
            bool holdsArray = s.Direction > 0 ? _exec.LowPrices[p] > s.Zone.Low - atr * 0.10 : _exec.HighPrices[p] < s.Zone.High + atr * 0.10;
            return directional && breakResume && pauseBar && bodyOk && holdsArray;
        }

        private double DistanceFromZoneAtr(SetupState s, int i, double atr)
        {
            if (s.Zone == null || atr <= 0) return 999;
            if (s.Direction > 0)
                return Math.Max(0, _exec.LowPrices[i] - s.Zone.High) / atr;
            return Math.Max(0, s.Zone.Low - _exec.HighPrices[i]) / atr;
        }

        private bool HasMicroBreakAfterTouch(SetupState s, int i, double atr)
        {
            if (i <= s.TouchIndex || i < 2)
                return false;
            int from = Math.Max(s.TouchIndex, i - 3);
            if (s.Direction > 0)
            {
                double high = double.MinValue;
                for (int k = from; k < i; k++) high = Math.Max(high, _exec.HighPrices[k]);
                return _exec.ClosePrices[i] > high + Math.Max(Symbol.TickSize, atr * 0.005);
            }
            else
            {
                double low = double.MaxValue;
                for (int k = from; k < i; k++) low = Math.Min(low, _exec.LowPrices[k]);
                return _exec.ClosePrices[i] < low - Math.Max(Symbol.TickSize, atr * 0.005);
            }
        }

        private bool BarTouchesZone(int i, ZoneInfo z)
        {
            return z != null && _exec.LowPrices[i] <= z.High && _exec.HighPrices[i] >= z.Low;
        }

        private bool IsZoneInvalidatedForDirection(ZoneInfo z, int i, int direction, double atr)
        {
            if (z == null) return true;
            double buffer = Math.Max(Symbol.TickSize, atr * 0.01);
            return direction > 0 ? _exec.ClosePrices[i] < z.Low - buffer : _exec.ClosePrices[i] > z.High + buffer;
        }

        private double CalculateFillRatio(ZoneInfo z, int i, int direction)
        {
            if (z == null || z.High <= z.Low) return 1;
            double width = z.High - z.Low;
            if (direction > 0)
                return Math.Max(0, Math.Min(1, (z.High - Math.Max(z.Low, _exec.LowPrices[i])) / width));
            return Math.Max(0, Math.Min(1, (Math.Min(z.High, _exec.HighPrices[i]) - z.Low) / width));
        }

        // ========================= STOP / TARGET =========================
        private double BuildStructuralStop(SetupState s, int i, double atr, double entry)
        {
            double localExtreme;
            if (s.Direction > 0)
            {
                localExtreme = s.Zone.Low;
                for (int k = Math.Max(0, s.TouchIndex); k <= i; k++)
                    localExtreme = Math.Min(localExtreme, _exec.LowPrices[k]);
            }
            else
            {
                localExtreme = s.Zone.High;
                for (int k = Math.Max(0, s.TouchIndex); k <= i; k++)
                    localExtreme = Math.Max(localExtreme, _exec.HighPrices[k]);
            }

            // v2.60-dev (E2): a CE entry is invalidated by the raid extreme, not by the edge of the PD array.
            if (s.EntryTrigger == "CeTouch" && CeStopAnchor == SmcCeStopAnchor.SweepExtreme && s.SweepExtreme > 0)
                localExtreme = s.Direction > 0 ? Math.Min(localExtreme, s.SweepExtreme) : Math.Max(localExtreme, s.SweepExtreme);

            double buffer = Math.Max(StopBufferMinimumPips * StrategyPip, Math.Max(Symbol.Spread * 1.2, atr * StopBufferAtr));
            double stop = s.Direction > 0 ? localExtreme - buffer : localExtreme + buffer;
            double riskPips = Math.Abs(entry - stop) / StrategyPip;

            if (riskPips < MinimumStopPips)
                stop = s.Direction > 0 ? entry - MinimumStopPips * StrategyPip : entry + MinimumStopPips * StrategyPip;
            return stop;
        }

        private bool TryBuildTradeTargets(SetupState s, double entry, DateTime timeUtc,
            out double tp1, out string tp1Name, out double tp1Pips,
            out double tp2, out string tp2Name, out double tp2Pips)
        {
            tp1 = tp2 = 0;
            tp1Pips = tp2Pips = 0;
            tp1Name = tp2Name = "";

            if (s == null)
                return false;

            int direction = s.Direction;
            List<LiquidityLevel> levels = BuildLiquidityLevels(timeUtc,
                IgnoreConsumedLiquidity == SmcConsumedLiquidity.Targets || IgnoreConsumedLiquidity == SmcConsumedLiquidity.Both ? timeUtc : DateTime.MinValue);
            var candidates = levels
                .Where(x => direction > 0 ? (x.Side > 0 && x.Price > entry) : (x.Side < 0 && x.Price < entry))
                .Select(x => new { Level = x, Pips = Math.Abs(x.Price - entry) / StrategyPip })
                .OrderBy(x => x.Pips)
                .ToList();

            var first = candidates.FirstOrDefault(x => x.Pips - TargetLiquidityBufferPips >= MinimumTargetPips);
            if (first == null)
            {
                if (RequireLiquidityRoom)
                    return false;
                tp1Pips = PreferredScalpTargetPips;
                tp1Name = "Fixed TP1";
            }
            else
            {
                double room = first.Pips - TargetLiquidityBufferPips;
                tp1Pips = Math.Min(PreferredScalpTargetPips, room);
                if (tp1Pips < MinimumTargetPips)
                    return false;
                tp1Name = tp1Pips + TargetLiquidityBufferPips >= first.Pips - 0.01 ? first.Level.Name : "Before " + first.Level.Name;
            }

            // Optional CRT equilibrium objective. Disabled by default because the
            // validated v2.32 TP1 logic remains the baseline. When enabled, EQ only
            // replaces TP1 if it offers at least the configured minimum distance.
            if (UseCrtEquilibriumAsTp1 && EnableCrtContextLayer &&
                s.CrtH1 != null && s.CrtH1.Valid && s.CrtH1SweepReclaimed)
            {
                double eq = s.CrtH1.Equilibrium;
                bool eqAhead = direction > 0 ? eq > entry : eq < entry;
                if (eqAhead)
                {
                    double eqPips = Math.Abs(eq - entry) / StrategyPip - TargetLiquidityBufferPips;
                    if (eqPips >= MinimumTargetPips && eqPips < tp1Pips)
                    {
                        tp1Pips = eqPips;
                        tp1Name = "Before CRT H1 EQ";
                    }
                }
            }

            tp1 = direction > 0 ? entry + tp1Pips * StrategyPip : entry - tp1Pips * StrategyPip;

            double tp1PipsForRunner = tp1Pips;
            var runner = candidates.FirstOrDefault(x => x.Pips - TargetLiquidityBufferPips >= Math.Max(MinimumRunnerTargetPips, tp1PipsForRunner + 10));
            if (runner != null)
            {
                double room = runner.Pips - TargetLiquidityBufferPips;
                tp2Pips = Math.Min(PreferredRunnerTargetPips, room);
                tp2Pips = Math.Max(tp2Pips, Math.Min(room, Math.Max(MinimumRunnerTargetPips, tp1Pips + 10)));
                tp2Name = tp2Pips + TargetLiquidityBufferPips >= runner.Pips - 0.01 ? runner.Level.Name : "Before " + runner.Level.Name;
            }
            else
            {
                if (RequireRunnerLiquidityRoom)
                    return false;
                tp2Pips = Math.Max(PreferredRunnerTargetPips, tp1Pips + 20);
                tp2Name = "Runner TP2";
            }

            // Full CRT delivery model: after a confirmed H1 range-side raid and
            // re-entry, the opposing side of the captured H1 dealing range becomes
            // the preferred structural runner objective. This does NOT relax TP1/RR.
            if (PreferCrtOppositeSideTp2 && EnableCrtContextLayer &&
                s.CrtH1 != null && s.CrtH1.Valid && s.CrtH1SweepReclaimed)
            {
                double opposite = direction > 0 ? s.CrtH1.High : s.CrtH1.Low;
                bool targetAhead = direction > 0 ? opposite > entry : opposite < entry;
                if (targetAhead)
                {
                    double crtRoom = Math.Abs(opposite - entry) / StrategyPip - TargetLiquidityBufferPips;
                    if (crtRoom >= Math.Max(MinimumRunnerTargetPips, tp1Pips + 10))
                    {
                        double crtTp2Pips = Math.Min(PreferredRunnerTargetPips, crtRoom);
                        crtTp2Pips = Math.Max(crtTp2Pips, Math.Min(crtRoom, Math.Max(MinimumRunnerTargetPips, tp1Pips + 10)));
                        tp2Pips = crtTp2Pips;
                        tp2Name = crtTp2Pips + TargetLiquidityBufferPips >=
                                  Math.Abs(opposite - entry) / StrategyPip - 0.01
                            ? (direction > 0 ? "CRT H1 High" : "CRT H1 Low")
                            : (direction > 0 ? "Toward CRT H1 High" : "Toward CRT H1 Low");
                    }
                }
            }

            tp2 = direction > 0 ? entry + tp2Pips * StrategyPip : entry - tp2Pips * StrategyPip;
            return tp2Pips > tp1Pips;
        }

        // ========================= POSITION MANAGEMENT =========================
        private void ManageOpenPositions()
        {
            foreach (ManagedTrade state in _managed.Values.ToList())
            {
                Position position = Positions.FindById(state.PositionId);
                if (position == null)
                {
                    _managed.Remove(state.PositionId);
                    continue;
                }

                double exitPrice = position.TradeType == TradeType.Buy ? Symbol.Bid : Symbol.Ask;
                double signed = state.Direction > 0 ? exitPrice - state.EntryPrice : state.EntryPrice - exitPrice;
                double pip = TradePip(state, StrategyPip);   // v2.61-dev: the pip the trade was opened with
                double currentPips = signed / pip;
                double riskPips = state.InitialRiskPrice / pip;
                if (riskPips <= 0) continue;

                state.MaxFavorablePips = Math.Max(state.MaxFavorablePips, currentPips);
                state.MaxAdversePips = Math.Max(state.MaxAdversePips, Math.Max(0, -currentPips));
                double currentR = currentPips / riskPips;

                if (!state.Tp1Taken && currentPips >= state.Tp1Pips - 0.05)
                {
                    bool partialDone = false;
                    bool partialRequired = false;
                    double remaining = 0;
                    if (UseTp1PartialClose && Tp1ClosePercent > 0 && Tp1ClosePercent < 100)
                    {
                        double desiredRemaining = position.VolumeInUnits * (1.0 - Tp1ClosePercent / 100.0);
                        remaining = Symbol.NormalizeVolumeInUnits(desiredRemaining, RoundingMode.Down);
                        partialRequired = remaining >= Symbol.VolumeInUnitsMin && remaining < position.VolumeInUnits;
                    }

                    if (partialRequired)
                    {
                        // Durable intent is a hard precondition for the irreversible broker action.
                        state.Tp1ClosePending = true;
                        state.Tp1RemainingVolume = remaining;
                        if (!FsLedgerSync(state))
                        {
                            FsAlarm("TP1 partial suppressed #" + state.PositionId + ": intent persistence failed");
                            continue;
                        }
                        double beforeVolume = position.VolumeInUnits;
                        double beforeBalance = Account.Balance;
                        TradeResult partial = position.ModifyVolume(remaining);
                        partialDone = partial.IsSuccessful;
                        if (partialDone)
                        {
                            double balanceDelta = Account.Balance - beforeBalance;
                            if (_ks != null) _ks.Update(Server.Time, Account.Equity, Account.Balance, balanceDelta);
                            double closedVolume = beforeVolume - remaining;
                            HistoricalTrade ph = History.LastOrDefault(x => x.PositionId == position.Id);
                            double? gross = ph != null ? (double?)ph.GrossProfit : null;
                            double? commission = ph != null ? (double?)ph.Commissions : null;
                            double? swap = ph != null ? (double?)ph.Swap : null;
                            Jr("trade", FsKeyFor(position.Id), "position_event", DailyJournal.Q("partial-close"), "position_id", position.Id.ToString(CultureInfo.InvariantCulture),
                               "side", DailyJournal.Q(position.TradeType.ToString()), "volume", DailyJournal.N(closedVolume), "volume_unit", DailyJournal.Q("units"),
                               "entry_time", DailyJournal.Q(DailyJournal.T(position.EntryTime)), "entry_price", DailyJournal.N(position.EntryPrice),
                               "exit_time", DailyJournal.Q(DailyJournal.T(Server.Time)), "exit_price", DailyJournal.N(exitPrice),
                               "gross_pnl", DailyJournal.N(gross), "commission", DailyJournal.N(commission), "swap", DailyJournal.N(swap),
                               "net_pnl", DailyJournal.N(balanceDelta), "currency", DailyJournal.Q(Account.Asset.Name),
                               "slippage", "null", "slippage_unit", DailyJournal.Q("price"), "slippage_reference", DailyJournal.Q("not recorded for partial close"),
                               "spread", DailyJournal.N(Symbol.Ask - Symbol.Bid), "spread_unit", DailyJournal.Q("price"),
                               "protection_orders_set", position.StopLoss.HasValue ? "true" : "false", "stop_loss", DailyJournal.N(position.StopLoss), "take_profit", DailyJournal.N(position.TakeProfit));
                            position = Positions.FindById(state.PositionId) ?? position;
                        }
                        state.Tp1Taken = partialDone;
                        state.Tp1ClosePending = false;
                        if (!FsLedgerSync(state))
                        {
                            FsAlarm("TP1 outcome persistence failed #" + state.PositionId + "; restart must reconcile broker volume");
                            continue;
                        }
                        if (!partialDone) continue;
                    }
                    else
                    {
                        state.Tp1Taken = true;
                        state.Tp1ClosePending = false;
                        state.Tp1RemainingVolume = position.VolumeInUnits;
                        if (!FsLedgerSync(state)) { FsAlarm("TP1 state persistence failed #" + state.PositionId); continue; }
                    }

                    double tp1Be = state.Direction > 0
                        ? state.EntryPrice + AfterTp1BreakEvenBufferPips * pip
                        : state.EntryPrice - AfterTp1BreakEvenBufferPips * pip;
                    if (MoveStopIfBetter(position, tp1Be))
                        state.BreakEvenApplied = true;

                    _lastEvent = DirectionText(state.Direction) + " TP1 secured";
                    Log("TP1 {0}: {1:F1}p reached, partial={2}, runner TP2={3:F1}p ({4}).",
                        DirectionText(state.Direction), state.Tp1Pips, partialDone, state.Tp2Pips, state.Tp2Name);
                }

                int closed = _exec.Count - 2;
                double? protectedSwing = FindProtectedSwing(state, closed);
                if (protectedSwing.HasValue)
                    state.LastProtectedSwing = protectedSwing.Value;

                bool armed = state.MaxFavorablePips >= BreakEvenArmMinimumPips;
                bool beAllowed = !BreakEvenOnlyAfterTp1 || state.Tp1Taken;
                bool protectedTrigger = beAllowed && armed && protectedSwing.HasValue && currentR >= BreakEvenProtectedSwingMinR;
                bool fallbackTrigger = beAllowed && armed && currentR >= BreakEvenFallbackR;
                if (!state.BreakEvenApplied && (protectedTrigger || fallbackTrigger))
                {
                    double spreadPips = TradingCostPrice() / pip;
                    double protectPips = Math.Max(BreakEvenCostBufferPips, spreadPips + 0.5);
                    double beStop = state.Direction > 0 ? state.EntryPrice + protectPips * pip : state.EntryPrice - protectPips * pip;
                    if (MoveStopIfBetter(position, beStop))
                    {
                        state.BreakEvenApplied = true;
                        _lastEvent = DirectionText(state.Direction) + " BE protected";
                    }
                }

                if (EnableStructureProfitLock && state.BreakEvenApplied && state.LastProtectedSwing != 0 && currentR >= StructureLockFromR)
                {
                    double lockStop = state.Direction > 0
                        ? state.LastProtectedSwing - StructureLockBufferPips * pip
                        : state.LastProtectedSwing + StructureLockBufferPips * pip;
                    MoveStopIfBetter(position, lockStop);
                }

                if (EnableTimeStop && !state.TimeStopApplied && Server.Time >= state.EntryTimeUtc.AddMinutes(TimeStopMinutes))
                {
                    state.TimeStopApplied = true;
                    double mfeR = state.MaxFavorablePips / riskPips;
                    if (!state.Tp1Taken && mfeR < TimeStopRequiredMfeR)
                    {
                        state.ExitOverride = "TimeStop";
                        FsRequestClose(position, "time stop");
                        _lastEvent = DirectionText(state.Direction) + " time stop";
                    }
                }
                FsLedgerSync(state);
            }
        }

        private double? FindProtectedSwing(ManagedTrade state, int closed)
        {
            if (closed < state.EntryExecIndex + 3)
                return null;

            int from = Math.Max(state.EntryExecIndex + 1, closed - 12);
            for (int i = closed - ExecPivotRight; i >= from; i--)
            {
                bool lookingForHigh = state.Direction < 0;
                if (!IsPivot(_exec, i, lookingForHigh, ExecPivotLeft, ExecPivotRight, closed))
                    continue;

                double swing = state.Direction > 0 ? _exec.LowPrices[i] : _exec.HighPrices[i];
                bool sensibleSide = state.Direction > 0
                    ? swing > state.InitialStop + Symbol.TickSize
                    : swing < state.InitialStop - Symbol.TickSize;
                if (!sensibleSide)
                    continue;

                // A swing becomes "protected" only after price breaks away from it.
                if (state.Direction > 0)
                {
                    double priorHigh = double.MinValue;
                    for (int k = Math.Max(i - 2, state.EntryExecIndex); k <= i; k++) priorHigh = Math.Max(priorHigh, _exec.HighPrices[k]);
                    if (_exec.ClosePrices[closed] > priorHigh)
                        return swing;
                }
                else
                {
                    double priorLow = double.MaxValue;
                    for (int k = Math.Max(i - 2, state.EntryExecIndex); k <= i; k++) priorLow = Math.Min(priorLow, _exec.LowPrices[k]);
                    if (_exec.ClosePrices[closed] < priorLow)
                        return swing;
                }
            }
            return null;
        }

        private bool MoveStopIfBetter(Position position, double candidate)
        {
            candidate = NormalizePrice(candidate);
            bool valid = position.TradeType == TradeType.Buy ? candidate < Symbol.Bid - Symbol.TickSize : candidate > Symbol.Ask + Symbol.TickSize;
            if (!valid) return false;

            bool better = !position.StopLoss.HasValue || (position.TradeType == TradeType.Buy ? candidate > position.StopLoss.Value + Symbol.TickSize / 2.0 : candidate < position.StopLoss.Value - Symbol.TickSize / 2.0);
            if (!better) return false;

            return FsStopModify(position, candidate);   // F4: modify + SL/TP readback + failure policy
        }

        private void OnPositionClosed(PositionClosedEventArgs args)
        {
            Position position = args.Position;
            if (position.Label != BotLabel || position.SymbolName != SymbolName || !FsOwned(position))
                return;

            ManagedTrade state;
            _managed.TryGetValue(position.Id, out state);
            if (state != null)
                _managed.Remove(position.Id);
            FsJournalClosed(position);

            if (position.NetProfit < 0)
            {
                _consecutiveLosses++;
                _lastLossUtc = Server.Time;
                if (state != null)
                    RegisterFailedSetupFlip(state, Server.Time, "stopped/losing trade");
            }
            else if (position.NetProfit > 0)
            {
                _consecutiveLosses = 0;
            }

            FsLedgerLosses(_consecutiveLosses);
            string extra = state == null ? "" : " | MFE " + state.MaxFavorablePips.ToString("F1", CultureInfo.InvariantCulture) + "p | MAE " + state.MaxAdversePips.ToString("F1", CultureInfo.InvariantCulture) + "p";
            Log("CLOSED #{0}: net={1:F2}{2}.", position.Id, position.NetProfit, extra);
        }

        private void RegisterFailedSetupFlip(SetupState s, DateTime timeUtc, string reason)
        {
            if (s != null && s.NsNew) return;
            if (!EnableFailedSetupFlip || s == null || s.Zone == null)
                return;
            _failedFlip = new FailedFlipCandidate
            {
                OriginalDirection = s.Direction,
                ZoneLow = s.Zone.Low,
                ZoneHigh = s.Zone.High,
                Quality = Math.Max(FailedFlipMinimumQuality, s.Zone.Quality),
                Source = string.IsNullOrEmpty(s.SetupType) ? s.LiquidityName : s.SetupType + " " + s.LiquidityName,
                CreatedUtc = timeUtc,
                ExpiryUtc = timeUtc.AddMinutes(FailedFlipWindowMinutes)
            };
            Log("FLIP watch armed from {0}: zone [{1:F2}-{2:F2}], reason={3}.", DirectionText(s.Direction), s.Zone.Low, s.Zone.High, reason);
        }

        private void RegisterFailedSetupFlip(ManagedTrade state, DateTime timeUtc, string reason)
        {
            if (state != null && NsPrimaryType(state.SetupType)) return;
            if (!EnableFailedSetupFlip || state == null || state.ZoneHigh <= state.ZoneLow)
                return;
            _failedFlip = new FailedFlipCandidate
            {
                OriginalDirection = state.Direction,
                ZoneLow = state.ZoneLow,
                ZoneHigh = state.ZoneHigh,
                Quality = Math.Max(FailedFlipMinimumQuality, state.ZoneQuality),
                Source = state.SetupType + " trade",
                CreatedUtc = timeUtc,
                ExpiryUtc = timeUtc.AddMinutes(FailedFlipWindowMinutes)
            };
            Log("FLIP watch armed after trade {0}: zone [{1:F2}-{2:F2}], reason={3}.", DirectionText(state.Direction), state.ZoneLow, state.ZoneHigh, reason);
        }

        private void TryArmFailedSetupFlip(int i, double atr, DateTime timeUtc)
        {
            if (!EnableFailedSetupFlip || _failedFlip == null)
                return;
            if (timeUtc > _failedFlip.ExpiryUtc)
            {
                _failedFlip = null;
                return;
            }

            int direction = -_failedFlip.OriginalDirection;
            SetupState targetState = direction > 0 ? _longState : _shortState;
            if (targetState == null || targetState.Stage != SetupStage.Waiting)
                return;

            double boundary = direction > 0 ? _failedFlip.ZoneHigh : _failedFlip.ZoneLow;
            double buffer = Math.Max(Symbol.TickSize, atr * MssAtrBuffer);
            if (!ClosesThrough(i, direction, boundary, buffer))
                return;
            if (!(HasDirectionalDisplacement(_exec, i, direction, atr) || HasMultiCandleDisplacement(_exec, i, direction, atr)))
                return;

            targetState.Reset();
            targetState.StartIndex = i;
            targetState.TakenIndex = i;
            targetState.ReclaimIndex = i;
            targetState.MssIndex = i;
            targetState.LiquidityName = "FailedSetupFlip " + _failedFlip.Source;
            targetState.LiquidityPrice = boundary;
            targetState.LiquidityStrength = 3;
            targetState.LiquidityExternal = true;
            targetState.SweepExtreme = direction > 0 ? _failedFlip.ZoneLow : _failedFlip.ZoneHigh;
            targetState.MssLevel = boundary;
            targetState.HasDisplacement = true;
            targetState.SetupType = "FailedSetupFlip";
            GetRangeExtremes(Math.Max(0, i - 3), i, out targetState.ImpulseLow, out targetState.ImpulseHigh);
            targetState.Zone = new ZoneInfo
            {
                Low = _failedFlip.ZoneLow,
                High = _failedFlip.ZoneHigh,
                Width = _failedFlip.ZoneHigh - _failedFlip.ZoneLow,
                SourceIndex = i,
                HasFvg = true,
                HasOrderBlock = true,
                Composite = true,
                HasDisplacement = true,
                InCorrectPremiumDiscount = true,
                OteConfluence = false,
                Quality = _failedFlip.Quality,
                Label = "A FlipZone"
            };
            if (EnableOteEntryPolicy)
            {
                var clipped = NsClipZone(targetState, targetState.Zone, atr, 0, 0, true);
                if (clipped == null) { NsF("OTE", "ote_clip_failed_flip_reset"); targetState.Reset(); _failedFlip = null; return; }
                targetState.Zone = clipped; targetState.NsOte = true;
            }
            CaptureCrtContext(targetState, i, atr, timeUtc);
            AnnotateZoneWithCrtContext(targetState, targetState.Zone);
            targetState.Stage = SetupStage.WaitingEntry;
            targetState.ExpiryIndex = i + ScaleLogicBars(FailedFlipRetestBars);
            Log("{0}: FAILED-SETUP-FLIP armed after displacement through {1:F2}; retest zone [{2:F2}-{3:F2}].",
                DirectionText(direction), boundary, targetState.Zone.Low, targetState.Zone.High);
            _failedFlip = null;
        }

        // ========================= GATES / RISK =========================
        private int CountProtectedRunners()
        {
            int count = 0;
            foreach (ManagedTrade state in _managed.Values)
            {
                Position p = Positions.FindById(state.PositionId);
                if (p != null && IsProtectedRunner(state, p))
                    count++;
            }
            return count;
        }

        private bool CanOpenNewTrade(DateTime timeUtc, SetupState setup, bool isFailedFlip, out string reason)
        {
            reason = "";
            if (_nsProtectionFailures.Count > 0) { reason = "ProtectionFailure"; return false; }
            string fsBlock = FsEntryBlock();
            if (fsBlock != null) { reason = fsBlock; return false; }
            // v2.48-dev: the NS history gate guards NS-core requests only. v2.47 applied it to Parent orders as soon as any NS flag
            // was on, which blocked Parent for days after Easter (gap > 72 h) and made every ON arm differ from OFF.
            if (NewSetups.NsRules.HistoryGateApplies(NsAnyEnabled(), setup != null && setup.NsNew) && !NsGateHistoryValid(timeUtc)) { reason = "InvalidHistory"; return false; }
            if (_tradesToday >= MaxTradesPerNyDay) { reason = "daily trade cap"; return false; }
            if (_consecutiveLosses >= MaxConsecutiveLosses) { reason = "loss streak"; return false; }

            Position[] existing = Positions.FindAll(BotLabel, SymbolName);
            if (existing.Length > 0)
            {
                if (!AllowTradeWithProtectedRunner)
                {
                    reason = "position already open";
                    return false;
                }
                if (existing.Length >= MaxConcurrentPositions)
                {
                    reason = "concurrent position cap";
                    return false;
                }
                foreach (Position p in existing)
                {
                    ManagedTrade state;
                    if (!_managed.TryGetValue(p.Id, out state) || !IsProtectedRunner(state, p))
                    {
                        reason = "unprotected position already open";
                        return false;
                    }
                }
                if (BlockSameLiquidityWhileRunnerOpen && IsDuplicateLiquidityOfActiveRunner(setup))
                {
                    reason = "same liquidity runner active";
                    return false;
                }
            }

            if (CurrentSpreadStrategyPips() > MaximumSpreadPips) { reason = "spread"; return false; }

            string session = SessionName(timeUtc);
            if (UseSessionFilter && session == "OFF")
            {
                reason = "outside session";
                return false;
            }
            if (UseSessionFilter && IsExtendedSession(session) && !IsExtendedSessionQualityCandidate(setup))
            {
                reason = "extended session quality";
                return false;
            }

            if (!isFailedFlip && _lastAcceptedSignalUtc != DateTime.MinValue && timeUtc < _lastAcceptedSignalUtc.AddMinutes(SignalCooldownMinutes)) { reason = "signal cooldown"; return false; }
            if (!isFailedFlip && _lastLossUtc != DateTime.MinValue && timeUtc < _lastLossUtc.AddMinutes(LossCooldownMinutes)) { reason = "loss cooldown"; return false; }

            string newsReason;
            if (IsNewsBlocked(timeUtc, out newsReason))
            {
                reason = newsReason;
                return false;
            }

            double realizedLossPct = _dayStartBalance > 0 && Account.Balance < _dayStartBalance
                ? (_dayStartBalance - Account.Balance) / _dayStartBalance * 100.0
                : 0;
            if (realizedLossPct >= DailyRealizedLossLimitPercent) { reason = "daily loss limit"; return false; }
            return true;
        }

        private bool IsProtectedRunner(ManagedTrade state, Position position)
        {
            if (state == null || position == null || !state.Tp1Taken || !state.BreakEvenApplied || !position.StopLoss.HasValue)
                return false;

            double pip = TradePip(state, StrategyPip);
            double lockedPips = state.Direction > 0
                ? (position.StopLoss.Value - state.EntryPrice) / pip
                : (state.EntryPrice - position.StopLoss.Value) / pip;
            return lockedPips + 1e-9 >= ProtectedRunnerMinimumLockedPips;
        }

        private bool IsDuplicateLiquidityOfActiveRunner(SetupState setup)
        {
            if (setup == null || setup.LiquidityPrice <= 0)
                return false;

            double tolerancePrice = DuplicateLiquidityTolerancePips * StrategyPip;
            foreach (ManagedTrade state in _managed.Values)
            {
                Position p = Positions.FindById(state.PositionId);
                if (p == null || !IsProtectedRunner(state, p))
                    continue;
                if (state.Direction != setup.Direction || state.LiquidityPrice <= 0)
                    continue;
                if (Math.Abs(state.LiquidityPrice - setup.LiquidityPrice) <= tolerancePrice)
                    return true;
            }
            return false;
        }

        private double CalculateVolumeInUnits(double riskStrategyPips, TradeType sizingSide, bool quiet = false)
        {
            double stopPriceDistance = riskStrategyPips * StrategyPip;
            double stopSymbolPips = stopPriceDistance / Symbol.PipSize;
            if (stopSymbolPips <= 0) return 0;

            double maxRiskAmount = FsCapped(Account.Equity * MaximumRiskPercent / 100.0, MaxRiskCapAccount);
            double desiredRiskAmount = FsCapped(Account.Equity * RiskPercentPerTrade / 100.0, RiskCapPerTradeAccount);
            double units;

            if (SizingMode == SmcScalpSizingMode.RiskPercent)
            {
                double oneLotUnits = Symbol.QuantityToVolumeInUnits(1.0);
                double riskOneLot = Symbol.AmountRisked(oneLotUnits, stopSymbolPips);
                if (riskOneLot <= 0) return 0;
                units = oneLotUnits * desiredRiskAmount / riskOneLot;
            }
            else
            {
                units = Symbol.QuantityToVolumeInUnits(FixedLots);
            }

            units = Symbol.NormalizeVolumeInUnits(units, RoundingMode.Down);
            if (units < Symbol.VolumeInUnitsMin) return 0;

            double actualRisk = Symbol.AmountRisked(units, stopSymbolPips);
            if (actualRisk > maxRiskAmount && actualRisk > 0)
            {
                units *= maxRiskAmount / actualRisk;
                units = Symbol.NormalizeVolumeInUnits(units, RoundingMode.Down);
            }
            if (units < Symbol.VolumeInUnitsMin) return 0;

            // v2.54-dev: margin cap. Reduce volume instead of provoking a broker reject; effective risk is logged.
            if (MaxMarginUsePercent > 0)
            {
                double requestedUnits = units;
                double marginForUnits = Symbol.GetEstimatedMargin(sizingSide, units);
                double budget = Math.Min(Account.Equity * MaxMarginUsePercent / 100.0 - Account.Margin, Account.FreeMargin);
                double capped = Sizing.MarginCapUnits(units, marginForUnits, budget, Symbol.VolumeInUnitsMin, Symbol.VolumeInUnitsStep);
                if (capped < units - 1e-9)
                {
                    double cappedRisk = capped > 0 ? Symbol.AmountRisked(capped, stopSymbolPips) : 0;
                    if (!quiet) Jr("size_capped_by_margin", null, "requested_units", DailyJournal.N(requestedUnits), "capped_units", DailyJournal.N(capped),
                       "margin_for_requested", DailyJournal.N(marginForUnits), "margin_budget", DailyJournal.N(budget), "effective_risk", DailyJournal.N(cappedRisk),
                       "target_risk", DailyJournal.N(desiredRiskAmount), "currency", DailyJournal.Q(Account.Asset.Name));
                    if (!quiet) Print("SIZE CAPPED BY MARGIN: requested={0:F2}u -> {1:F2}u, margin budget={2:F2}, effective risk={3:F2} (target {4:F2}).", requestedUnits, capped, budget, cappedRisk, desiredRiskAmount);   // v2.54-dev: not gated by VerboseLog
                    units = capped;
                }
                if (units < Symbol.VolumeInUnitsMin) return 0;
            }
            if (!FsSizingAgrees(units, stopSymbolPips, stopPriceDistance)) return 0;
            if (!quiet) Print("SIZE: mode={4}, units={0:F2}, stopPips={5:F1}, effective risk={1:F2} (target {2:F2}, hard cap {3:F2}).", units, Symbol.AmountRisked(units, stopSymbolPips), desiredRiskAmount, maxRiskAmount, SizingMode, stopSymbolPips);   // v2.54-dev (B2): not gated by VerboseLog
            return units;
        }

        // ========================= LIVE NEWS =========================
        private bool NewsFilterActive()
        {
            if (!UseNewsFilter)
                return false;
            if (RunningMode == RunningMode.RealTime)
                return true;
            return UseLiveNewsInBacktest || FileCalendarActive();
        }

        // v2.36-news: the offline calendar is the only admissible backtest source.
        private bool FileCalendarActive()
        {
            return UseNewsFilter && UseFileNewsCalendar;
        }

        private void RefreshNewsFeed(bool force)
        {
            // First barrier: with the file calendar active the HTTP live path must
            // never fire. The calendar was verified fail-closed at start, so it can
            // not go stale inside the verified coverage window.
            if (FileCalendarActive())
            {
                if (RunningMode == RunningMode.RealTime)
                {
                    LiveNewsPoll(false);   // v2.54-dev: hot reload at most every 60 s; age is never rejuvenated
                    return;
                }
                EnsureNewsCoverage(Server.Time);
                _lastNewsSuccessUtc = Server.Time;
                return;
            }

            // v2.54-dev hard barrier: the HTTP adapter is unreachable in live mode even if a future
            // configuration change accidentally bypasses ValidateConfiguration(). There is no fallback.
            if (RunningMode == RunningMode.RealTime)
            {
                _newsStatus = "local MQL5 generation required; HTTP disabled";
                _lastNewsSuccessUtc = DateTime.MinValue;
                return;
            }

            // v2.47-dev: HTTP is admissible only in live mode, never in a backtest, whatever the parameters say.
            if (!NewsGuard.HttpAllowed(RunningMode == RunningMode.RealTime, FileCalendarActive()))
            {
                _newsStatus = "HTTP barred outside live mode";
                return;
            }
            DateTime now = Server.Time;
            if (!force && _lastNewsRefreshUtc != DateTime.MinValue &&
                now < _lastNewsRefreshUtc.AddMinutes(NewsRefreshMinutes))
                return;

            _lastNewsRefreshUtc = now;
            try
            {
                HttpResponse response = Http.Get(NewsFeedUrl);
                if (!response.IsSuccessful || string.IsNullOrWhiteSpace(response.Body))
                {
                    _newsStatus = "HTTP feed failed";
                    _lastNewsSuccessUtc = DateTime.MinValue; // immediate live fail-closed; do not retain stale success
                    Log("NEWS: feed request failed.");
                    return;
                }

                List<ForexFactoryNewsDto> rows;
                var serializer = new DataContractJsonSerializer(typeof(List<ForexFactoryNewsDto>));
                using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(response.Body)))
                    rows = serializer.ReadObject(stream) as List<ForexFactoryNewsDto>;

                if (rows == null)
                {
                    _newsStatus = "JSON parse failed";
                    _lastNewsSuccessUtc = DateTime.MinValue;
                    return;
                }

                // v2.54-dev (F2): schema, impact vocabulary and explicit UTC/offset are validated for EVERY row before any
                // filtering. One defective row rejects the whole refresh (fail-closed); no offset-less local-time guessing.
                var currencies = ParseCsvSet(NewsCurrencies);
                var rawRows = rows.Select(r => r == null ? null : new NewsRow { Title = r.Title, Country = r.Country, Date = r.Date, Impact = r.Impact }).ToList();
                List<NewsItem> items; string schemaError;
                if (!NewsFeedValidator.Validate(rawRows, currencies, out items, out schemaError))
                {
                    _newsStatus = "feed schema invalid: " + schemaError;
                    _lastNewsSuccessUtc = DateTime.MinValue;
                    FsAlarm("NEWS fail-closed: " + _newsStatus);
                    return;
                }
                var parsed = items.Select(i => new EconomicNewsEvent { Title = i.Title, Currency = i.Currency, Impact = i.Impact, TimeUtc = i.TimeUtc }).ToList();

                parsed.Sort((a, b) => a.TimeUtc.CompareTo(b.TimeUtc));
                // A transport success is not a usable calendar. Empty/all-filtered and obsolete
                // payloads fail closed immediately; refresh time must never masquerade as coverage.
                if (parsed.Count == 0 || parsed[parsed.Count - 1].TimeUtc < now.AddDays(-1) || parsed[0].TimeUtc > now.AddDays(14))
                {
                    _newsStatus = "feed has no current usable coverage";
                    _lastNewsSuccessUtc = DateTime.MinValue;
                    FsAlarm(_newsStatus);
                    return;
                }
                _newsEvents.Clear();
                _newsEvents.AddRange(parsed);
                _lastNewsSuccessUtc = now;
                _newsStatus = "OK " + parsed.Count + " events";
                UpdateNextNewsText(now);
                Log("NEWS: loaded {0} filtered events from Forex Factory weekly JSON export.", parsed.Count);
            }
            catch (Exception ex)
            {
                _newsStatus = "Error: " + ex.GetType().Name;
                _lastNewsSuccessUtc = DateTime.MinValue;
                Log("NEWS: refresh error {0}.", ex.Message);
            }
        }

        // ================= v2.54-dev LIVE NEWS (local MQL5 generation) =================
        private string _liveNewsGen = "";

        private void LiveNewsStart()
        {
            _liveNews = new LiveNewsGate(new LiveNewsFeed(NewsCalendarPath, ParseCsvSet(NewsCurrencies)) { TentativePolicy = TentativeHighNewsPolicy });
            LiveNewsPoll(true);
        }

        // Publication hook (called by LiveNewsRefresh exactly once per newly accepted snapshot, whoever polled).
        private void LiveNewsPublish(LiveNewsSnapshot s)
        {
            _newsEvents.Clear();
            _newsEvents.AddRange(s.Events.Select(i => new EconomicNewsEvent { Title = i.Title, Currency = i.Currency, Impact = i.Impact, TimeUtc = i.TimeUtc }));
            _newsCoverageStartUtc = s.CoverageStartUtc; _newsCoverageEndUtc = s.CoverageEndUtc;
            _fileCalendarLoaded = true;
            if (s.Generation != _liveNewsGen)
            {
                Log("NEWS: live generation {0} sha256 {1} as_of {2:yyyy-MM-ddTHH:mm:ssZ}, {3} blocking events, coverage {4:yyyy-MM-ddTHH:mm:ssZ}..{5:yyyy-MM-ddTHH:mm:ssZ}, tentative days {6}.",
                    s.Generation, s.Sha256, s.SourceAsOfUtc, s.Events.Count, s.CoverageStartUtc, s.CoverageEndUtc, s.BlockedDays.Count);
                _liveNewsGen = s.Generation;
            }
            UpdateNextNewsText(Server.Time);
        }

        // ================= v2.36-news OFFLINE FILE CALENDAR =================
        // Fail-closed load path for the canonical MQL5 export. Every deviation
        // aborts the start; nothing here touches IsNewsBlocked/ManageNewsRisk.
        private void LoadFileNewsCalendar()
        {
            string csvPath = (NewsCalendarPath ?? "").Trim();
            if (csvPath.Length == 0)
                throw new InvalidOperationException("NEWS: file calendar enabled but News Calendar Path is empty.");

            string manifestPath = System.IO.Path.Combine(
                System.IO.Path.GetDirectoryName(csvPath) ?? "",
                "news-calendar.manifest.json");

            if (!System.IO.File.Exists(csvPath))
                throw new InvalidOperationException("NEWS: calendar CSV not found: " + csvPath);
            if (!System.IO.File.Exists(manifestPath))
                throw new InvalidOperationException("NEWS: calendar manifest not found: " + manifestPath);

            byte[] csvBytes = System.IO.File.ReadAllBytes(csvPath);
            string manifestText = System.IO.File.ReadAllText(manifestPath, Encoding.UTF8);

            string expectedHash = ReadJsonString(manifestText, "calendar_sha256");
            if (string.IsNullOrEmpty(expectedHash))
                throw new InvalidOperationException("NEWS: manifest lacks calendar_sha256.");

            string actualHash;
            using (SHA256 sha = SHA256.Create())
            {
                var sb = new StringBuilder(64);
                foreach (byte b in sha.ComputeHash(csvBytes))
                    sb.Append(b.ToString("x2", CultureInfo.InvariantCulture));
                actualHash = sb.ToString();
            }
            if (!string.Equals(actualHash, expectedHash.ToLowerInvariant(), StringComparison.Ordinal))
                throw new InvalidOperationException(
                    "NEWS: calendar hash mismatch. manifest=" + expectedHash + " file=" + actualHash);

            string validationStatus = ReadJsonString(manifestText, "validation_status");
            if (!string.Equals(validationStatus, "VALID", StringComparison.Ordinal))
                throw new InvalidOperationException(
                    "NEWS: manifest validation_status must be VALID, found '" + validationStatus + "'.");

            _newsCoverageStartUtc = ParseManifestUtc(manifestText, "coverage_start_utc");
            _newsCoverageEndUtc = ParseManifestUtc(manifestText, "coverage_end_utc");
            if (_newsCoverageEndUtc <= _newsCoverageStartUtc)
                throw new InvalidOperationException("NEWS: manifest coverage window is empty or inverted.");

            List<EconomicNewsEvent> parsed = ParseNewsCalendarCsv(Encoding.UTF8.GetString(csvBytes));
            if (parsed.Count == 0 && _newsBlockedDays.Count == 0 && !ReadJsonBool(manifestText, "empty_coverage_confirmed"))
                throw new InvalidOperationException(
                    "NEWS: calendar yields no blocking events and empty_coverage_confirmed is not set.");

            parsed.Sort((a, b) => a.TimeUtc.CompareTo(b.TimeUtc));
            _newsEvents.Clear();
            _newsEvents.AddRange(parsed);
            _fileCalendarLoaded = true;
            _lastNewsRefreshUtc = Server.Time;
            _lastNewsSuccessUtc = Server.Time;
            _newsStatus = "FILE " + parsed.Count + " events";

            EnsureNewsCoverage(Server.Time);
            UpdateNextNewsText(Server.Time);
            Log("NEWS: file calendar loaded, {0} blocking events, sha256 {1}, coverage {2:yyyy-MM-ddTHH:mm:ssZ}..{3:yyyy-MM-ddTHH:mm:ssZ}, tentative policy {4}, blocked days {5}.",
                parsed.Count, actualHash, _newsCoverageStartUtc, _newsCoverageEndUtc, TentativeHighNewsPolicy, _newsBlockedDays.Count);
        }

        // Coverage must include the widest filter window in use, otherwise a
        // silent edge-of-dataset gap would look like "no news".
        private void EnsureNewsCoverage(DateTime utc)
        {
            if (!_fileCalendarLoaded)
                throw new InvalidOperationException("NEWS: file calendar was never loaded.");

            int lead = Math.Max(HighImpactMinutesBefore, MediumImpactMinutesBefore);
            lead = Math.Max(lead, CloseHighNewsMinutesBefore);
            int lag = Math.Max(HighImpactMinutesAfter, MediumImpactMinutesAfter);

            DateTime required0 = utc.AddMinutes(-lead);
            DateTime required1 = utc.AddMinutes(lag);
            if (required0 < _newsCoverageStartUtc || required1 > _newsCoverageEndUtc)
                throw new InvalidOperationException(string.Format(CultureInfo.InvariantCulture,
                    "NEWS: calendar coverage {0:yyyy-MM-ddTHH:mm:ssZ}..{1:yyyy-MM-ddTHH:mm:ssZ} does not cover {2:yyyy-MM-ddTHH:mm:ssZ}..{3:yyyy-MM-ddTHH:mm:ssZ} (window -{4}/+{5} min).",
                    _newsCoverageStartUtc, _newsCoverageEndUtc, required0, required1, lead, lag));
        }

        // v1 blocking rule: only time_status EXACT and enabled true.
        private List<EconomicNewsEvent> ParseNewsCalendarCsv(string text)
        {
            var events = new List<EconomicNewsEvent>();
            List<string> lines = SplitCalendarLines(text);
            if (lines.Count == 0)
                throw new InvalidOperationException("NEWS: calendar CSV is empty.");

            List<string> header = SplitCalendarRow(lines[0]);
            int cTime = header.IndexOf("event_time_utc");
            int cCurrency = header.IndexOf("currency");
            int cImpact = header.IndexOf("impact");
            int cEnabled = header.IndexOf("enabled");
            int cStatus = header.IndexOf("time_status");
            int cTitle = header.IndexOf("title");
            if (cTime < 0 || cCurrency < 0 || cImpact < 0 || cEnabled < 0 || cStatus < 0 || cTitle < 0)
                throw new InvalidOperationException("NEWS: calendar CSV header does not match the schema contract.");

            var currencies = ParseCsvSet(NewsCurrencies);
            int max = Math.Max(cTime, Math.Max(cCurrency, Math.Max(cImpact,
                Math.Max(cEnabled, Math.Max(cStatus, cTitle)))));
            _newsBlockedDays.Clear();
            var tentativeEvents = new List<FailSafe.NewsItem>();

            for (int i = 1; i < lines.Count; i++)
            {
                List<string> row = SplitCalendarRow(lines[i]);
                if (row.Count <= max)
                    throw new InvalidOperationException("NEWS: calendar CSV row " + (i + 1) + " has too few columns.");

                FileNewsRow valid;
                string validationError;
                if (!FileNewsValidator.Validate(row[cTime], row[cCurrency], row[cImpact], row[cEnabled], row[cStatus], row[cTitle], out valid, out validationError))
                    throw new InvalidOperationException("NEWS: calendar CSV row " + (i + 1) + " " + validationError + ".");

                // v2.61-dev: rows without an exact time follow the live rule (FailSafe.TentativeNews), whatever "enabled" says.
                if (string.Equals(valid.Status, "TENTATIVE", StringComparison.Ordinal) || string.Equals(valid.Status, "ALL_DAY", StringComparison.Ordinal))
                {
                    if (currencies.Count == 0 || currencies.Contains(valid.Currency))
                        FailSafe.TentativeNews.Apply(TentativeHighNewsPolicy, valid.TimeUtc, valid.Currency, valid.Title, MapCalendarImpact(valid.Impact), _newsBlockedDays, tentativeEvents);
                    continue;
                }
                // The whole row is schema-validated before any policy filtering. v1 blocks only exact, enabled events.
                if (!valid.Enabled || !string.Equals(valid.Status, "EXACT", StringComparison.Ordinal))
                    continue;
                if (currencies.Count > 0 && !currencies.Contains(valid.Currency))
                    continue;
                int impact = MapCalendarImpact(valid.Impact);
                if (impact <= 0)
                    continue;

                events.Add(new EconomicNewsEvent
                {
                    Title = valid.Title,
                    Currency = valid.Currency,
                    Impact = impact,
                    TimeUtc = valid.TimeUtc
                });
            }
            events.AddRange(tentativeEvents.Select(x => new EconomicNewsEvent { Title = x.Title, Currency = x.Currency, Impact = x.Impact, TimeUtc = x.TimeUtc }));
            return events;
        }

        // Canonical impact labels map onto the unchanged internal scale.
        private int MapCalendarImpact(string impact)
        {
            string value = (impact ?? "").Trim().ToUpperInvariant();
            if (string.Equals(value, "HIGH", StringComparison.Ordinal))
                return 3;
            if (string.Equals(value, "MEDIUM", StringComparison.Ordinal))
                return 2;
            return 0;
        }

        private List<string> SplitCalendarLines(string text)
        {
            try { return StrictCsv.SplitRecords(text); }
            catch (InvalidOperationException ex) { throw new InvalidOperationException("NEWS: calendar " + ex.Message + ".", ex); }
        }

        private List<string> SplitCalendarRow(string line)
        {
            try { return StrictCsv.SplitRow(line); }
            catch (InvalidOperationException ex) { throw new InvalidOperationException("NEWS: calendar " + ex.Message + ".", ex); }
        }

        private DateTime ParseManifestUtc(string json, string key)
        {
            string raw = ReadJsonString(json, key);
            DateTime utc;
            if (string.IsNullOrEmpty(raw) ||
                !DateTime.TryParseExact(raw, "yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture,
                    DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out utc))
                throw new InvalidOperationException("NEWS: manifest field " + key + " is missing or malformed.");
            return utc;
        }

        private string ReadJsonString(string json, string key)
        {
            int at = FindJsonValue(json, key);
            if (at < 0)
                return null;
            int open = json.IndexOf('"', at);
            if (open < 0)
                return null;
            var sb = new StringBuilder();
            for (int i = open + 1; i < json.Length; i++)
            {
                char c = json[i];
                if (c == '\\' && i + 1 < json.Length)
                {
                    sb.Append(json[i + 1]);
                    i++;
                    continue;
                }
                if (c == '"')
                    break;
                sb.Append(c);
            }
            return sb.ToString();
        }

        private bool ReadJsonBool(string json, string key)
        {
            int at = FindJsonValue(json, key);
            if (at < 0)
                return false;
            string rest = json.Substring(at).TrimStart();
            return rest.StartsWith("true", StringComparison.Ordinal);
        }

        private int FindJsonValue(string json, string key)
        {
            int idx = json.IndexOf("\"" + key + "\"", StringComparison.Ordinal);
            if (idx < 0)
                return -1;
            int colon = json.IndexOf(':', idx);
            return colon < 0 ? -1 : colon + 1;
        }

        private HashSet<string> ParseCsvSet(string value)
        {
            var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(value))
                return result;
            foreach (string part in value.Split(','))
            {
                string v = part.Trim();
                if (!string.IsNullOrEmpty(v))
                    result.Add(v.ToUpperInvariant());
            }
            return result;
        }

        private int ParseImpact(string impact)
        {
            if (string.IsNullOrWhiteSpace(impact))
                return 0;
            if (impact.Equals("High", StringComparison.OrdinalIgnoreCase))
                return 3;
            if (impact.Equals("Medium", StringComparison.OrdinalIgnoreCase))
                return 2;
            if (impact.Equals("Low", StringComparison.OrdinalIgnoreCase))
                return 1;
            return 0;
        }

        private bool IsNewsBlocked(DateTime utc, out string reason)
        {
            reason = "";
            string liveBlock = FsLiveNewsBlock(utc);
            if (liveBlock != null) { reason = liveBlock; FsJournalNewsBlock(reason, utc); return true; }
            if (!NewsFilterActive())
                return false;
            if (FsLive && FileCalendarActive())
            {
                string feedBlock = LiveNewsBlock();   // v2.54-dev: stale / coverage / future / fault / tentative day
                if (feedBlock != null) { reason = feedBlock; FsJournalNewsBlock(reason, utc); return true; }
            }

            if (_lastNewsSuccessUtc == DateTime.MinValue)
            {
                if (NewsFailSafeBlock || FsLive)
                {
                    reason = "news feed unavailable";
                    return true;
                }
                return false;
            }

            if ((NewsFailSafeBlock || FsLive) && utc > _lastNewsSuccessUtc.AddMinutes(NewsMaxStaleMinutes))
            {
                reason = "news feed stale";
                return true;
            }

            // v2.61-dev: backtest twin of the live tentative-day check (live: LiveNewsBlock above), same windows as LiveNewsWindows().
            if (!FsLive && FileCalendarActive())
            {
                FailSafe.NewsWindows w = LiveNewsWindows();
                if (FailSafe.TentativeNews.DayBlocked(_newsBlockedDays, utc, w.Lead, w.Lag))
                {
                    reason = "news USD/HIGH tentative or all-day event on this UTC day";
                    FsJournalNewsBlock(reason, utc);
                    return true;
                }
            }

            foreach (EconomicNewsEvent e in _newsEvents)
            {
                if (e.Impact < 2)
                    continue;
                if (e.Impact == 2 && !BlockMediumImpactNews)
                    continue;

                int before = e.Impact >= 3 ? HighImpactMinutesBefore : MediumImpactMinutesBefore;
                int after = e.Impact >= 3 ? HighImpactMinutesAfter : MediumImpactMinutesAfter;
                if (utc >= e.TimeUtc.AddMinutes(-before) && utc <= e.TimeUtc.AddMinutes(after))
                {
                    reason = "news " + e.Currency + " " + e.Title;
                    FsJournalNewsBlock(reason, utc);
                    return true;
                }
            }
            return false;
        }

        private void ManageNewsRisk(DateTime utc)
        {
            UpdateNextNewsText(utc);
            if (NewsPositionAction == SmcNewsPositionAction.KeepOpen || CloseHighNewsMinutesBefore <= 0)
                return;

            FailSafe.NewsItem next = FailSafe.PositionNews.NextCloseEvent(
                _newsEvents.Select(x => new FailSafe.NewsItem { Title = x.Title, Currency = x.Currency, Impact = x.Impact, TimeUtc = x.TimeUtc }), utc, CloseHighNewsMinutesBefore);
            if (next == null)
                return;

            foreach (Position p in Positions.FindAll(BotLabel, SymbolName))
            {
                if (NewsPositionAction == SmcNewsPositionAction.CloseAll)
                {
                    FsRequestClose(p, "close before news " + next.Title);
                    _lastEvent = "Close requested before " + next.Title;
                    continue;
                }

                if (NewsPositionAction == SmcNewsPositionAction.CloseIfUnprotected)
                {
                    bool protectedPosition = p.StopLoss.HasValue &&
                        (p.TradeType == TradeType.Buy ? p.StopLoss.Value >= p.EntryPrice : p.StopLoss.Value <= p.EntryPrice);
                    if (!protectedPosition)
                    {
                        FsRequestClose(p, "unprotected close before news " + next.Title);
                        _lastEvent = "Unprotected position close requested before " + next.Title;
                    }
                }
            }
        }

        private void UpdateNextNewsText(DateTime utc)
        {
            EconomicNewsEvent next = _newsEvents
                .Where(x => x.Impact >= 2 && (x.Impact >= 3 || BlockMediumImpactNews) && x.TimeUtc >= utc.AddMinutes(-HighImpactMinutesAfter))
                .OrderBy(x => x.TimeUtc)
                .FirstOrDefault();

            if (next == null)
            {
                _nextNewsText = "-";
                return;
            }

            _nextNewsText = next.Currency + " " + (next.Impact >= 3 ? "HIGH" : "MED") + " " +
                            next.TimeUtc.ToString("MM-dd HH:mm", CultureInfo.InvariantCulture) + "Z " + next.Title;
        }

        // ========================= SESSION / NY TIME =========================
        private bool IsTradingSession(DateTime utc)
        {
            return SessionName(utc) != "OFF";
        }

        private string CoreSessionName(DateTime utc)
        {
            DateTime ny = ToNewYork(utc);
            double h = ny.Hour + ny.Minute / 60.0;
            if (TradeAsiaOpen && InHourWindow(h, AsiaStartNy, AsiaEndNy)) return "ASIA";
            if (TradeLondon && InHourWindow(h, LondonStartNy, LondonEndNy)) return "LONDON";
            if (TradeNyAm && InHourWindow(h, NyAmStartNy, NyAmEndNy)) return "NY-AM";
            if (TradeNyPm && InHourWindow(h, NyPmStartNy, NyPmEndNy)) return "NY-PM";
            return "OFF";
        }

        private string SessionName(DateTime utc)
        {
            string core = CoreSessionName(utc);
            if (core != "OFF")
                return core;
            if (!EnableExtendedSessions)
                return "OFF";

            DateTime ny = ToNewYork(utc);
            double h = ny.Hour + ny.Minute / 60.0;
            if (InHourWindow(h, ExtendedAsiaStartNy, ExtendedAsiaEndNy)) return "EXT-ASIA";
            if (InHourWindow(h, ExtendedLondonStartNy, ExtendedLondonEndNy)) return "EXT-LONDON";
            if (InHourWindow(h, ExtendedNyAmStartNy, ExtendedNyAmEndNy)) return "EXT-NY-AM";
            if (TradeExtendedNyPm && InHourWindow(h, ExtendedNyPmStartNy, ExtendedNyPmEndNy)) return "EXT-NY-PM";
            return "OFF";
        }

        private static bool InHourWindow(double h, double start, double end)
        {
            if (Math.Abs(end - start) < 0.0001) return false;
            if (end > start) return h >= start && h < end;
            return h >= start || h < end;
        }

        private bool IsExtendedSession(string name)
        {
            return !string.IsNullOrEmpty(name) && name.StartsWith("EXT-", StringComparison.Ordinal);
        }

        private bool IsExtendedSessionQualityCandidate(SetupState s)
        {
            if (s == null || s.Zone == null || !s.LiquidityExternal)
                return false;
            if (s.Zone.Quality < ExtendedMinimumZoneQuality)
                return false;
            if (ExtendedRequireComposite && !s.Zone.Composite)
                return false;

            bool aPlus = IsAPlusCompositeSetup(s);
            bool fullCrt = EnableCrtContextLayer &&
                           s.CrtH1SweepReclaimed &&
                           s.Zone.CrtCorrectPremiumDiscount &&
                           (s.CrtM15SweepReclaimed ||
                            s.SetupType == "CRT Sweep" ||
                            (!string.IsNullOrEmpty(s.LiquidityName) && s.LiquidityName.Contains("CRT H1")));

            bool sessionExternal = !string.IsNullOrEmpty(s.LiquidityName) &&
                                   (s.LiquidityName.IndexOf("Asia", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                    s.LiquidityName.IndexOf("London", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                    s.LiquidityName.IndexOf("PDH", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                    s.LiquidityName.IndexOf("PDL", StringComparison.OrdinalIgnoreCase) >= 0);

            bool crtDeliveryConfluence = EnableCrtContextLayer &&
                                         s.Zone.CrtCorrectPremiumDiscount &&
                                         s.CrtM15SweepReclaimed;

            if (ExtendedRequireStrongContext && !(fullCrt || sessionExternal || crtDeliveryConfluence))
                return false;

            return aPlus || (ExtendedAllowAWithFullCrt && fullCrt);
        }

        private int RequiredScoreForSession(DateTime utc)
        {
            string name = SessionName(utc);
            if (name == "ASIA") return AsiaMinimumScore;
            if (name == "LONDON") return LondonMinimumScore;
            if (name == "NY-AM") return NyAmMinimumScore;
            if (name == "NY-PM") return NyPmMinimumScore;
            if (IsExtendedSession(name)) return ExtendedMinimumScore;
            return 100;
        }

        private int MinutesUntilTradingSession(DateTime utc, int maxMinutes)
        {
            if (IsTradingSession(utc)) return 0;
            for (int m = 1; m <= maxMinutes; m++)
                if (IsTradingSession(utc.AddMinutes(m))) return m;
            return -1;
        }

        private int SessionScore(DateTime utc)
        {
            DateTime ny = ToNewYork(utc);
            double h = ny.Hour + ny.Minute / 60.0;
            string name = SessionName(utc);
            if (name == "NY-AM" && h >= 8.5 && h < 11.0) return CoreNyScoreBonus;
            if (name == "NY-AM") return 7;
            if (name == "LONDON") return 6;
            if (name == "NY-PM") return 4;
            if (name == "ASIA") return 2;
            if (IsExtendedSession(name)) return 0;
            return UseSessionFilter ? -12 : 0;
        }

        private void CloseIfPastTradingSession(DateTime utc)
        {
            DateTime ny = ToNewYork(utc);
            double h = ny.Hour + ny.Minute / 60.0;
            bool hardClose = h >= 16.0 && h < 20.0;
            if (!hardClose) return;
            foreach (Position p in Positions.FindAll(BotLabel, SymbolName))
                FsRequestClose(p, "session end");
        }

        private void ResetNyDay(DateTime utc, bool force)
        {
            DateTime d = ToNewYork(utc).Date;
            if (!force && d == _nyTradeDate) return;
            _nyTradeDate = d;
            UpdateStrategyPip(utc, false);
            _tradesToday = 0;
            _consecutiveLosses = 0;
            _dayStartBalance = Account.Balance;
            FsLedgerRollDay(d);
            // An unresolved broker failure is not a daily signal lifecycle reset.
            if (_longState?.Stage != SetupStage.ProtectionFailure) _longState?.Reset();
            if (_shortState?.Stage != SetupStage.ProtectionFailure) _shortState?.Reset();
        }

        private static DateTime ToNewYork(DateTime utc)
        {
            int year = utc.Year;
            DateTime dstStartLocal = NthWeekdayOfMonth(year, 3, DayOfWeek.Sunday, 2).AddHours(2);
            DateTime dstEndLocal = NthWeekdayOfMonth(year, 11, DayOfWeek.Sunday, 1).AddHours(2);
            DateTime dstStartUtc = dstStartLocal.AddHours(5); // 02:00 EST = 07:00 UTC
            DateTime dstEndUtc = dstEndLocal.AddHours(4);     // 02:00 EDT = 06:00 UTC
            bool dst = utc >= dstStartUtc && utc < dstEndUtc;
            return utc.AddHours(dst ? -4 : -5);
        }

        private static DateTime NthWeekdayOfMonth(int year, int month, DayOfWeek day, int occurrence)
        {
            DateTime d = new DateTime(year, month, 1);
            int delta = ((int)day - (int)d.DayOfWeek + 7) % 7;
            return d.AddDays(delta + 7 * (occurrence - 1));
        }

        // ========================= HELPERS =========================
        private bool IsSweepInvalidated(SetupState s, int i, double atr)
        {
            double buffer = Math.Max(Symbol.Spread, atr * 0.03);
            return s.Direction > 0 ? _exec.ClosePrices[i] < s.SweepExtreme - buffer : _exec.ClosePrices[i] > s.SweepExtreme + buffer;
        }

        private bool IsLevelReclaimed(int i, int direction, double level)
        {
            return direction > 0 ? _exec.ClosePrices[i] > level : _exec.ClosePrices[i] < level;
        }

        private void UpdateSweepExtreme(SetupState s, int i)
        {
            if (s.Direction > 0) s.SweepExtreme = Math.Min(s.SweepExtreme, _exec.LowPrices[i]);
            else s.SweepExtreme = Math.Max(s.SweepExtreme, _exec.HighPrices[i]);
        }

        private void UpdateImpulse(SetupState s, int i)
        {
            if (s.ImpulseLow == 0 || _exec.LowPrices[i] < s.ImpulseLow) s.ImpulseLow = _exec.LowPrices[i];
            if (_exec.HighPrices[i] > s.ImpulseHigh) s.ImpulseHigh = _exec.HighPrices[i];
        }

        private bool ClosesThrough(int i, int direction, double level, double buffer)
        {
            return direction > 0 ? _exec.ClosePrices[i] > level + buffer : _exec.ClosePrices[i] < level - buffer;
        }

        private void GetRangeExtremes(int from, int to, out double low, out double high)
        {
            low = double.MaxValue;
            high = double.MinValue;
            for (int i = Math.Max(0, from); i <= Math.Min(to, _exec.Count - 1); i++)
            {
                low = Math.Min(low, _exec.LowPrices[i]);
                high = Math.Max(high, _exec.HighPrices[i]);
            }
            if (low == double.MaxValue) low = 0;
            if (high == double.MinValue) high = 0;
        }

        private static double DirectionalEfficiency(Bars bars, int i, int direction, int lookback)
        {
            int from = Math.Max(0, i - lookback + 1);
            if (i <= from) return 0;
            double net = direction > 0 ? bars.ClosePrices[i] - bars.OpenPrices[from] : bars.OpenPrices[from] - bars.ClosePrices[i];
            double path = 0;
            for (int k = from; k <= i; k++) path += Math.Abs(bars.ClosePrices[k] - bars.OpenPrices[k]);
            return path > 0 ? Math.Max(0, net) / path : 0;
        }

        private int FindPriorPivot(Bars bars, int end, bool high, int left, int right, int lookback)
        {
            int start = Math.Max(left, end - lookback);
            for (int i = end - right; i >= start; i--)
                if (IsPivot(bars, i, high, left, right, end)) return i;
            return -1;
        }

        private static bool IsPivot(Bars bars, int index, bool high, int left, int right, int knownEnd)
        {
            if (bars == null || index < left || index + right > knownEnd || index + right >= bars.Count)
                return false;
            double p = high ? bars.HighPrices[index] : bars.LowPrices[index];
            for (int k = 1; k <= left; k++)
            {
                if (high && p <= bars.HighPrices[index - k]) return false;
                if (!high && p >= bars.LowPrices[index - k]) return false;
            }
            for (int k = 1; k <= right; k++)
            {
                if (high && p <= bars.HighPrices[index + k]) return false;
                if (!high && p >= bars.LowPrices[index + k]) return false;
            }
            return true;
        }

        private static double CalculateAtr(Bars bars, int end, int period)
        {
            if (bars == null || end < 1) return 0;
            int from = Math.Max(1, end - period + 1);
            double sum = 0;
            int count = 0;
            for (int i = from; i <= end; i++)
            {
                double pc = bars.ClosePrices[i - 1];
                double tr = Math.Max(bars.HighPrices[i] - bars.LowPrices[i], Math.Max(Math.Abs(bars.HighPrices[i] - pc), Math.Abs(bars.LowPrices[i] - pc)));
                sum += tr;
                count++;
            }
            return count > 0 ? sum / count : 0;
        }

        private int GetCompletedBarIndexAtTime(Bars bars, DateTime time)
        {
            // v2.48-dev: NS closed-bar indexing is confined to the NS pipeline (NsAdvance). Parent code paths always use the
            // legacy indexing, whatever NS flags are on, so Parent stays byte-identical to OFF.
            if (_nsScope > 0)
            {
                int minutes = ReferenceEquals(bars, _h1) ? 60 : _h4 != null && ReferenceEquals(bars, _h4) ? 240 : ReferenceEquals(bars, _m15) ? 15 :
                    ReferenceEquals(bars, _m5) ? 5 : ReferenceEquals(bars, _exec) ? ExecutionMinutes() : 0;
                return minutes > 0 ? NsClosedIndex(bars, minutes, time) : -1;
            }
            if (bars == null || bars.Count == 0) return -1;
            int idx = bars.OpenTimes.GetIndexByTime(time);
            if (idx < 0)
            {
                for (int i = bars.Count - 1; i >= 0; i--)
                    if (bars.OpenTimes[i] < time) return Math.Min(i, bars.Count - 2);
                return -1;
            }
            if (idx < bars.Count && bars.OpenTimes[idx] >= time) idx--;
            return Math.Max(0, Math.Min(idx, bars.Count - 2));
        }

        private void EnsureHistory(Bars bars, int minimum)
        {
            int guard = 0;
            while (bars.Count < minimum && guard++ < 30)
            {
                int loaded = bars.LoadMoreHistory();
                if (loaded <= 0) break;
            }
        }

        private TimeFrame GetExecutionTimeFrame()
        {
            if (ExecutionTimeframe == SmcScalpExecutionTimeFrame.M1) return TimeFrame.Minute;
            if (ExecutionTimeframe == SmcScalpExecutionTimeFrame.M2) return TimeFrame.Minute2;
            return TimeFrame.Minute5;
        }

        private int ExecutionMinutes()
        {
            if (ExecutionTimeframe == SmcScalpExecutionTimeFrame.M1) return 1;
            if (ExecutionTimeframe == SmcScalpExecutionTimeFrame.M2) return 2;
            return 5;
        }

        private int ScaleLogicBars(int m5Bars)
        {
            if (!ScaleM5LogicWindows || m5Bars <= 0)
                return Math.Max(1, m5Bars);
            return Math.Max(1, (int)Math.Ceiling(m5Bars * 5.0 / ExecutionMinutes()));
        }

        private double CurrentSpreadStrategyPips()
        {
            return TradingCostPrice() / StrategyPip;
        }

        private double NormalizePrice(double price)
        {
            return Math.Round(price / Symbol.TickSize) * Symbol.TickSize;
        }

        private void ValidateConfiguration()
        {
            if (!string.IsNullOrWhiteSpace(RequiredSymbolPrefix) && !SymbolName.StartsWith(RequiredSymbolPrefix, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("This bot is configured for symbols beginning with " + RequiredSymbolPrefix + ".");
            if (PricePerStrategyPip <= 0) throw new InvalidOperationException("Price per Strategy Pip must be > 0.");
            if (StrategyPipMode == SmcStrategyPipMode.AdrNormalized && (AdrReferenceStrategyPips <= 0 || AdrLookbackDays < 5))
                throw new InvalidOperationException("ADR-normalised strategy pip needs ADR Reference Strategy Pips > 0 and ADR Lookback Days >= 5.");
            if (LondonEndNy <= LondonStartNy) throw new InvalidOperationException("London End NY must be above London Start NY.");
            if (NyAmEndNy <= NyAmStartNy) throw new InvalidOperationException("NY AM End NY must be above NY AM Start NY.");
            if (NyPmEndNy <= NyPmStartNy) throw new InvalidOperationException("NY PM End NY must be above NY PM Start NY.");
            if (AsiaEndNy <= AsiaStartNy) throw new InvalidOperationException("Asia End NY must be above Asia Start NY.");
            if (ExtendedLondonEndNy <= ExtendedLondonStartNy) throw new InvalidOperationException("Extended London End NY must be above start.");
            if (ExtendedNyAmEndNy <= ExtendedNyAmStartNy) throw new InvalidOperationException("Extended NY AM End NY must be above start.");
            if (ExtendedNyPmEndNy <= ExtendedNyPmStartNy) throw new InvalidOperationException("Extended NY PM End NY must be above start.");
            if (MaxConcurrentPositions < 1) throw new InvalidOperationException("Max Concurrent Positions must be >= 1.");
            if (MinimumStopPips >= MaximumStopPips) throw new InvalidOperationException("Minimum Stop Pips must be below Maximum Stop Pips.");
            if (MinimumTargetPips > PreferredScalpTargetPips) throw new InvalidOperationException("Minimum Target Pips must not exceed Preferred Scalp Target Pips.");
            if (MinimumRunnerTargetPips > PreferredRunnerTargetPips) throw new InvalidOperationException("Minimum Runner TP2 Pips must not exceed Preferred Runner TP2 Pips.");
            if (PreferredRunnerTargetPips <= PreferredScalpTargetPips) throw new InvalidOperationException("Runner TP2 must be above TP1.");
            if (TradeZoneTargetPips > TradeZoneMaximumPips) throw new InvalidOperationException("Trade Zone Target Pips must not exceed Trade Zone Maximum Pips.");
            if (MinimumRewardRisk < 1.0) throw new InvalidOperationException("Minimum R/R must be >= 1.");
            if (APlusMinimumRewardRisk < 1.0) throw new InvalidOperationException("A+ Composite Minimum R/R must be >= 1.");
            if (APlusMaximumStopPips < MinimumStopPips) throw new InvalidOperationException("A+ Composite Maximum Stop Pips must be >= Minimum Stop Pips.");
            if (AZoneFastReactionQuality < MinimumZoneQuality) throw new InvalidOperationException("A-Zone Fast Reaction Quality must be >= Minimum Zone Quality.");
            if (APlusZoneQuality < AZoneFastReactionQuality) throw new InvalidOperationException("A+ Zone Quality must be >= A-Zone Fast Reaction Quality.");
            if (ReactionBodyAtr <= 0 || APlusBodyAtr <= 0 || BZoneBodyAtr <= 0) throw new InvalidOperationException("Confirmation body ATR thresholds must be > 0.");
            if (RejectionCloseLocation < 0.5 || RejectionCloseLocation > 1.0) throw new InvalidOperationException("Rejection Close Location must be between 0.5 and 1.0.");
            if (CrtMinimumCandleAtr <= 0 || CrtM15MinimumCandleAtr <= 0) throw new InvalidOperationException("CRT minimum candle ATR values must be > 0.");
            if (CrtTargetRoomMinimumR < 1.0) throw new InvalidOperationException("CRT Target Room Minimum R must be >= 1.");
            if (CrtEquilibriumToleranceRange <= 0 || CrtEquilibriumToleranceRange > 0.5) throw new InvalidOperationException("CRT EQ tolerance must be > 0 and <= 0.5.");
            if (string.IsNullOrWhiteSpace(NewsFeedUrl) && UseNewsFilter) throw new InvalidOperationException("News feed URL must not be empty when news filter is enabled.");
            // v2.36-news second barrier: no silent switch between the offline
            // calendar and the HTTP live feed. The combination aborts the start.
            if (UseFileNewsCalendar && UseLiveNewsInBacktest)
                throw new InvalidOperationException("UseLiveNewsInBacktest must be False while UseFileNewsCalendar is True: the HTTP live feed is not admissible in a backtest.");
            if (UseFileNewsCalendar && !UseNewsFilter)
                throw new InvalidOperationException("UseFileNewsCalendar requires UseNewsFilter=True.");
            if (RunningMode == RunningMode.RealTime && TentativeHighNewsPolicy == FailSafe.TentativeNewsPolicy.Ignore)
                throw new InvalidOperationException("Tentative HIGH News Policy = Ignore is a backtest comparison setting and not admissible live.");
            if (RunningMode == RunningMode.RealTime && UseNewsFilter && !UseFileNewsCalendar)
                throw new InvalidOperationException("v2.50 live: news comes only from the local MQL5 generation; Use File News Calendar must be True (HTTP is not reachable for news).");
            if (UseFileNewsCalendar && string.IsNullOrWhiteSpace(NewsCalendarPath))
                throw new InvalidOperationException("News Calendar Path must not be empty when the file news calendar is enabled.");
        }

        private void RefreshDashboard(bool force)
        {
            if (!ShowDashboard) return;
            if (!force && Server.Time - _lastDashboardUtc < TimeSpan.FromSeconds(1)) return;
            _lastDashboardUtc = Server.Time;

            RegimeSnapshot r = GetAdaptiveRegime(Server.Time);
            var sb = new StringBuilder();
            sb.AppendLine("SMC PRECISION SCALPER v2.35");
            sb.AppendLine("Exec " + ExecutionTimeframe + " | Spread " + CurrentSpreadStrategyPips().ToString("F1", CultureInfo.InvariantCulture) + "p");
            sb.AppendLine("Regime " + TrendText(r.Regime) + " | M15 " + TrendText(r.AnchorTrend) + " | M5 " + TrendText(r.DeliveryTrend) + (r.DeliveryVetoDirection == 0 ? "" : " | VETO " + TrendText(r.DeliveryVetoDirection)));
            if (EnableCrtContextLayer)
            {
                CrtRangeContext dashCrt = FindRecentCrtRange(_h1, Server.Time, "CRT H1", 60, CrtH1ContextLookbackBars, CrtMinimumCandleAtr);
                if (dashCrt != null)
                    sb.AppendLine("CRT H1 " + dashCrt.Low.ToString("F2", CultureInfo.InvariantCulture) + "-" + dashCrt.High.ToString("F2", CultureInfo.InvariantCulture) + " | EQ " + dashCrt.Equilibrium.ToString("F2", CultureInfo.InvariantCulture));
                else
                    sb.AppendLine("CRT H1 no active qualified range");
            }
            sb.AppendLine("Long " + _longState.Stage + " | Short " + _shortState.Stage);
            sb.AppendLine("Session " + SessionName(Server.Time) + " | Trades " + _tradesToday + "/" + MaxTradesPerNyDay + " | Loss streak " + _consecutiveLosses);
            sb.AppendLine("Open " + _managed.Count + " (protected " + CountProtectedRunners() + ") | TP1/TP2 " + PreferredScalpTargetPips.ToString("F0", CultureInfo.InvariantCulture) + "/" + PreferredRunnerTargetPips.ToString("F0", CultureInfo.InvariantCulture) + "p | SL max " + MaximumStopPips.ToString("F0", CultureInfo.InvariantCulture) + "p");
            sb.AppendLine("News " + (NewsFilterActive() ? _newsStatus : "OFF") + " | Next " + _nextNewsText);
            sb.AppendLine("Last: " + _lastEvent);
            Chart.DrawStaticText("SMC_SCALP_DASH", sb.ToString(), VerticalAlignment.Top, HorizontalAlignment.Right, Color.White);
        }

        private void Log(string format, params object[] args)
        {
            if (!VerboseLog) return;
            Print(format, args);
        }

        private static string DirectionText(int direction) { return direction > 0 ? "LONG" : "SHORT"; }
        private static string TrendText(int direction) { return direction > 0 ? "BULL" : direction < 0 ? "BEAR" : "TRANS"; }

        // ========================= INTERNAL TYPES =========================
        private enum SetupStage
        {
            Waiting,
            LiquidityTaken,
            WaitingMss,
            WaitingPdArray,
            WaitingEntry,
            WaitingConfirmation,
            ProtectionFailure
        }

        private sealed class SetupState
        {
            public readonly int Direction;
            public SetupStage Stage;
            public int StartIndex;
            public int TakenIndex;
            public int ReclaimIndex;
            public int MssIndex;
            public int TouchIndex;
            public int ExpiryIndex;
            public int PdArrayWaitUntil;
            public string LiquidityName;
            public double LiquidityPrice;
            public int LiquidityStrength;
            public bool LiquidityExternal;
            public double SweepExtreme;
            public double MssLevel;
            public double ImpulseLow;
            public double ImpulseHigh;
            public bool SameBarReclaim;
            public bool HasDisplacement;
            public ZoneInfo Zone;
            public int ZoneTouches;
            public double MaxFillRatio;
            public string EntryTrigger;
            public bool ConfirmationLatched;
            public DateTime ConfirmationLatchedUtc;
            public string ConfirmationType;
            public bool ConfirmationSawDirectional;
            public bool ConfirmationSawMidpointReclaim;
            public bool ConfirmationSawProgress;
            public bool ConfirmationSawMicroBreak;
            public bool ConfirmationSawBodyOk;
            public bool ConfirmationSawStrongRejection;
            public CrtRangeContext CrtH1;
            public CrtRangeContext CrtM15;
            public bool CrtH1SweepObserved;
            public bool CrtH1SweepReclaimed;
            public bool CrtM15SweepObserved;
            public bool CrtM15SweepReclaimed;
            public string SetupType;
            public bool NsNew, NsOte;
            public string NsCore, NsId;
            public string CandidateTelemetryId;
            public Action<SetupState, int> CandidateResetSink; // observer only

            public SetupState(int direction, Action<string, string> funnelSink = null)
            {
                Direction = direction;
                FunnelSink = funnelSink;
                Reset();
            }

            // v2.48-dev: telemetry sink is instance-local (wired by the owning bot at construction), never static,
            // so two bot instances cannot cross-count and no static field keeps a Robot alive after OnStop.
            public Action<string, string> FunnelSink; // telemetry only
            public void Reset([System.Runtime.CompilerServices.CallerLineNumber] int line = 0)
            {
                if (CandidateResetSink != null && !string.IsNullOrEmpty(CandidateTelemetryId)) CandidateResetSink(this, line);
                if (NsOte && FunnelSink != null) FunnelSink("OTE", "reset:L" + line + ":" + Stage);
                Stage = SetupStage.Waiting;
                StartIndex = -1;
                TakenIndex = -1;
                ReclaimIndex = -1;
                MssIndex = -1;
                TouchIndex = -1;
                ExpiryIndex = -1;
                PdArrayWaitUntil = -1;
                LiquidityName = "";
                LiquidityPrice = 0;
                LiquidityStrength = 0;
                LiquidityExternal = false;
                SweepExtreme = 0;
                MssLevel = 0;
                ImpulseLow = 0;
                ImpulseHigh = 0;
                SameBarReclaim = false;
                HasDisplacement = false;
                Zone = null;
                ZoneTouches = 0;
                MaxFillRatio = 0;
                EntryTrigger = "";
                ConfirmationLatched = false;
                ConfirmationLatchedUtc = DateTime.MinValue;
                ConfirmationType = "";
                ConfirmationSawDirectional = false;
                ConfirmationSawMidpointReclaim = false;
                ConfirmationSawProgress = false;
                ConfirmationSawMicroBreak = false;
                ConfirmationSawBodyOk = false;
                ConfirmationSawStrongRejection = false;
                CrtH1 = null;
                CrtM15 = null;
                CrtH1SweepObserved = false;
                CrtH1SweepReclaimed = false;
                CrtM15SweepObserved = false;
                CrtM15SweepReclaimed = false;
                SetupType = "";
                NsNew = NsOte = false;
                NsCore = NsId = "";
                CandidateTelemetryId = "";
            }
        }

        private sealed class LiquidityLevel
        {
            public string Name;
            public double Price;
            public int Side;
            public int Strength;
            public bool External;
            public DateTime FormedUtc = DateTime.MinValue;   // v2.60-dev: when the level became known (MinValue = unknown)

            public LiquidityLevel(string name, double price, int side, int strength, bool external)
            {
                Name = name;
                Price = price;
                Side = side;
                Strength = strength;
                External = external;
            }
        }

        private sealed class ZoneInfo
        {
            public double Low;
            public double High;
            public double Width;
            public double WidthAtr;
            public int SourceIndex;
            public bool HasFvg;
            public bool HasOrderBlock;
            public bool Composite;
            public bool HasDisplacement;
            public bool InCorrectPremiumDiscount;
            public bool OteConfluence;
            public bool CrtCorrectPremiumDiscount;
            public bool CrtNearEquilibrium;
            public int Quality;
            public string Label;
            public double Midpoint { get { return (Low + High) / 2.0; } }
        }

        private sealed class CrtRangeContext
        {
            public bool Valid;
            public string Label;
            public int SourceIndex;
            public DateTime SourceOpenTime;
            public double High;
            public double Low;
            public double Equilibrium;
            public double Atr;
            public double Range;
            public int TimeframeMinutes;
        }

        private sealed class RegimeSnapshot
        {
            public int AnchorTrend;
            public int DeliveryTrend;
            public int ExecTrend;
            public int Regime;
            public int TransitionDirection;
            public int DeliveryVetoDirection;
        }

        [DataContract]
        private sealed class ForexFactoryNewsDto
        {
            [DataMember(Name = "title")]
            public string Title { get; set; }

            [DataMember(Name = "country")]
            public string Country { get; set; }

            [DataMember(Name = "date")]
            public string Date { get; set; }

            [DataMember(Name = "impact")]
            public string Impact { get; set; }
        }

        private sealed class EconomicNewsEvent
        {
            public string Title;
            public string Currency;
            public DateTime TimeUtc;
            public int Impact;
        }

        private sealed class FailedFlipCandidate
        {
            public int OriginalDirection;
            public double ZoneLow;
            public double ZoneHigh;
            public int Quality;
            public string Source;
            public DateTime CreatedUtc;
            public DateTime ExpiryUtc;
        }

        private sealed class ManagedTrade
        {
            public int PositionId;
            public int Direction;
            public double EntryPrice;
            public double InitialStop;
            public double InitialRiskPrice;
            public int EntryExecIndex;
            public DateTime EntryTimeUtc;
            public int Score;
            public string SetupType;
            public string LiquidityName;
            public double LiquidityPrice;
            public string SetupName;
            public string TargetName;
            public double ZoneLow;
            public double ZoneHigh;
            public int ZoneQuality;
            public double Tp1Price;
            public double Tp1Pips;
            public string Tp1Name;
            public double Tp2Price;
            public double Tp2Pips;
            public string Tp2Name;
            public double OriginalVolumeInUnits;
            public bool Tp1Taken;
            public bool Tp1ClosePending;
            public double Tp1RemainingVolume;
            public double MaxFavorablePips;
            public double MaxAdversePips;
            public bool BreakEvenApplied;
            public bool TimeStopApplied;
            public double LastProtectedSwing;
            public string ExitOverride;
            public string PendingCloseReason;
            public double PipPrice;            // v2.61-dev: strategy pip at entry (0 = unknown, e.g. restored from the ledger)
        }
    }
}
