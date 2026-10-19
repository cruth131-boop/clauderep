// XAUUSD M2 Signalgeber für cTrader (Automate / C#)
//
// Kombiniert die Logik mehrerer beliebter TradingView-Community-Strategien:
//   1. UT Bot (ATR-Trailing-Stop)        -> Einstiegs-Trigger
//   2. SuperTrend (KivancOzbilgic)       -> Trendrichtung
//   3. EMA 200                           -> übergeordneter Trendfilter
//   4. RSI                               -> Momentum / Überkauft-Überverkauft-Filter
//   5. Squeeze Momentum (LazyBear)       -> Momentum-Bestätigung
// plus Session-, Abstands- und Spread-Filter sowie ATR-basierte SL/TP-Vorschläge.
//
// Signale werden ausschließlich auf geschlossenen Kerzen berechnet (kein Repainting).
// Es werden KEINE Orders platziert – das Tool zeigt nur Signale an und benachrichtigt.

using System;
using cAlgo.API;
using cAlgo.API.Indicators;
using cAlgo.API.Internals;

namespace cAlgo.Indicators
{
    [Indicator(IsOverlay = true, TimeZone = TimeZones.UTC, AccessRights = AccessRights.None)]
    public class XauM2SignalGenerator : Indicator
    {
        // ---- UT Bot ----
        [Parameter("UT Bot Key Value", DefaultValue = 2.0, MinValue = 0.1, Group = "UT Bot")]
        public double UtKeyValue { get; set; }

        [Parameter("UT Bot ATR Periode", DefaultValue = 10, MinValue = 1, Group = "UT Bot")]
        public int UtAtrPeriod { get; set; }

        // ---- SuperTrend ----
        [Parameter("SuperTrend ATR Periode", DefaultValue = 10, MinValue = 1, Group = "SuperTrend")]
        public int StAtrPeriod { get; set; }

        [Parameter("SuperTrend Multiplikator", DefaultValue = 3.0, MinValue = 0.1, Group = "SuperTrend")]
        public double StMultiplier { get; set; }

        // ---- Filter ----
        [Parameter("EMA Trendfilter Periode", DefaultValue = 200, MinValue = 1, Group = "Filter")]
        public int EmaPeriod { get; set; }

        [Parameter("RSI Periode", DefaultValue = 14, MinValue = 2, Group = "Filter")]
        public int RsiPeriod { get; set; }

        [Parameter("RSI Long max", DefaultValue = 70, MinValue = 50, MaxValue = 100, Group = "Filter")]
        public double RsiLongMax { get; set; }

        [Parameter("RSI Short min", DefaultValue = 30, MinValue = 0, MaxValue = 50, Group = "Filter")]
        public double RsiShortMin { get; set; }

        [Parameter("Squeeze Momentum verwenden", DefaultValue = true, Group = "Filter")]
        public bool UseSqueeze { get; set; }

        [Parameter("Squeeze Länge", DefaultValue = 20, MinValue = 2, Group = "Filter")]
        public int SqueezeLength { get; set; }

        [Parameter("Mindestabstand Signale (Bars)", DefaultValue = 5, MinValue = 0, Group = "Filter")]
        public int CooldownBars { get; set; }

        // ---- Session (UTC) ----
        [Parameter("Session-Filter aktiv", DefaultValue = true, Group = "Session (UTC)")]
        public bool UseSession { get; set; }

        [Parameter("Session Start (Stunde UTC)", DefaultValue = 7, MinValue = 0, MaxValue = 23, Group = "Session (UTC)")]
        public int SessionStartHour { get; set; }

        [Parameter("Session Ende (Stunde UTC)", DefaultValue = 20, MinValue = 0, MaxValue = 24, Group = "Session (UTC)")]
        public int SessionEndHour { get; set; }

        // ---- Risiko ----
        [Parameter("SL ATR Multiplikator", DefaultValue = 1.5, MinValue = 0.1, Group = "Risiko")]
        public double SlAtrMultiplier { get; set; }

        [Parameter("Chance-Risiko-Verhältnis (TP)", DefaultValue = 1.5, MinValue = 0.1, Group = "Risiko")]
        public double RewardRisk { get; set; }

        [Parameter("Max. Spread (Pips, nur live)", DefaultValue = 40, MinValue = 0, Group = "Risiko")]
        public double MaxSpreadPips { get; set; }

        // ---- Benachrichtigung ----
        [Parameter("Popup-Alarm", DefaultValue = true, Group = "Alarm")]
        public bool PopupAlert { get; set; }

        [Parameter("E-Mail-Alarm", DefaultValue = false, Group = "Alarm")]
        public bool EmailAlert { get; set; }

        [Parameter("E-Mail Absender", DefaultValue = "", Group = "Alarm")]
        public string EmailFrom { get; set; }

        [Parameter("E-Mail Empfänger", DefaultValue = "", Group = "Alarm")]
        public string EmailTo { get; set; }

        // ---- Ausgaben ----
        [Output("UT Trailing Stop", LineColor = "Orange", Thickness = 1)]
        public IndicatorDataSeries UtTrail { get; set; }

        [Output("SuperTrend", LineColor = "DodgerBlue", Thickness = 2)]
        public IndicatorDataSeries SuperTrendLine { get; set; }

        [Output("EMA", LineColor = "Gray", Thickness = 1)]
        public IndicatorDataSeries EmaLine { get; set; }

        [Output("Kauf-Signal", LineColor = "Lime", PlotType = PlotType.Points, Thickness = 6)]
        public IndicatorDataSeries BuySignal { get; set; }

        [Output("Verkauf-Signal", LineColor = "Red", PlotType = PlotType.Points, Thickness = 6)]
        public IndicatorDataSeries SellSignal { get; set; }

        private AverageTrueRange _utAtr;
        private AverageTrueRange _stAtr;
        private AverageTrueRange _riskAtr;
        private ExponentialMovingAverage _ema;
        private RelativeStrengthIndex _rsi;

        private IndicatorDataSeries _stDirection; // +1 = Aufwärtstrend, -1 = Abwärtstrend
        private IndicatorDataSeries _stUpper;
        private IndicatorDataSeries _stLower;
        private IndicatorDataSeries _squeeze;

        private int _lastSignalIndex = -1;
        private int _lastAlertIndex = -1;

        protected override void Initialize()
        {
            _utAtr = Indicators.AverageTrueRange(UtAtrPeriod, MovingAverageType.WilderSmoothing);
            _stAtr = Indicators.AverageTrueRange(StAtrPeriod, MovingAverageType.WilderSmoothing);
            _riskAtr = Indicators.AverageTrueRange(14, MovingAverageType.WilderSmoothing);
            _ema = Indicators.ExponentialMovingAverage(Bars.ClosePrices, EmaPeriod);
            _rsi = Indicators.RelativeStrengthIndex(Bars.ClosePrices, RsiPeriod);

            _stDirection = CreateDataSeries();
            _stUpper = CreateDataSeries();
            _stLower = CreateDataSeries();
            _squeeze = CreateDataSeries();

            if (TimeFrame != TimeFrame.Minute2)
                Print("Hinweis: Der Signalgeber ist für den M2-Chart optimiert (aktuell: {0}).", TimeFrame);
        }

        public override void Calculate(int index)
        {
            EmaLine[index] = _ema.Result[index];
            CalculateUtTrail(index);
            CalculateSuperTrend(index);
            CalculateSqueeze(index);

            // Signale nur auf der zuletzt geschlossenen Kerze auswerten (kein Repainting)
            int i = index - 1;
            if (i < Math.Max(EmaPeriod, SqueezeLength * 2) + 2)
                return;

            BuySignal[i] = double.NaN;
            SellSignal[i] = double.NaN;

            int direction = EvaluateSignal(i);
            if (direction == 0)
                return;

            double close = Bars.ClosePrices[i];
            double slDistance = _riskAtr.Result[i] * SlAtrMultiplier;
            double sl = close - direction * slDistance;
            double tp = close + direction * slDistance * RewardRisk;
            string side = direction > 0 ? "KAUF" : "VERKAUF";

            if (direction > 0)
                BuySignal[i] = Bars.LowPrices[i] - _riskAtr.Result[i] * 0.5;
            else
                SellSignal[i] = Bars.HighPrices[i] + _riskAtr.Result[i] * 0.5;

            _lastSignalIndex = i;

            string label = string.Format("{0}\nSL {1}\nTP {2}", side,
                Math.Round(sl, Symbol.Digits), Math.Round(tp, Symbol.Digits));
            var text = Chart.DrawText("sig_" + Bars.OpenTimes[i].Ticks, label, i,
                direction > 0 ? Bars.LowPrices[i] - _riskAtr.Result[i] * 1.5 : Bars.HighPrices[i] + _riskAtr.Result[i] * 1.5,
                direction > 0 ? Color.Lime : Color.Red);
            text.HorizontalAlignment = HorizontalAlignment.Center;
            text.VerticalAlignment = direction > 0 ? VerticalAlignment.Bottom : VerticalAlignment.Top;

            // Alarm nur für das jeweils neueste Signal im Live-Betrieb
            if (IsLastBar && i != _lastAlertIndex)
            {
                _lastAlertIndex = i;
                SendAlert(side, close, sl, tp, Bars.OpenTimes[i]);
            }
        }

        // Liefert +1 (Kauf), -1 (Verkauf) oder 0 (kein Signal) für die geschlossene Kerze i
        private int EvaluateSignal(int i)
        {
            if (CooldownBars > 0 && _lastSignalIndex >= 0 && i - _lastSignalIndex < CooldownBars && i != _lastSignalIndex)
                return 0;

            if (UseSession && !InSession(Bars.OpenTimes[i]))
                return 0;

            if (IsLastBar && MaxSpreadPips > 0 && Symbol.Spread / Symbol.PipSize > MaxSpreadPips)
                return 0;

            double close = Bars.ClosePrices[i];
            double prevClose = Bars.ClosePrices[i - 1];

            bool utBuy = close > UtTrail[i] && prevClose <= UtTrail[i - 1];
            bool utSell = close < UtTrail[i] && prevClose >= UtTrail[i - 1];

            double rsi = _rsi.Result[i];
            bool squeezeLong = !UseSqueeze || (_squeeze[i] > 0 && _squeeze[i] > _squeeze[i - 1]);
            bool squeezeShort = !UseSqueeze || (_squeeze[i] < 0 && _squeeze[i] < _squeeze[i - 1]);

            if (utBuy && _stDirection[i] > 0 && close > _ema.Result[i] && rsi > 50 && rsi < RsiLongMax && squeezeLong)
                return 1;

            if (utSell && _stDirection[i] < 0 && close < _ema.Result[i] && rsi < 50 && rsi > RsiShortMin && squeezeShort)
                return -1;

            return 0;
        }

        private bool InSession(DateTime utcTime)
        {
            int h = utcTime.Hour;
            return SessionStartHour <= SessionEndHour
                ? h >= SessionStartHour && h < SessionEndHour
                : h >= SessionStartHour || h < SessionEndHour;
        }

        // UT Bot: ATR-Trailing-Stop (Portierung der bekannten Pine-Script-Logik)
        private void CalculateUtTrail(int index)
        {
            double src = Bars.ClosePrices[index];
            double nLoss = UtKeyValue * _utAtr.Result[index];

            if (index == 0 || double.IsNaN(UtTrail[index - 1]) || double.IsNaN(nLoss))
            {
                UtTrail[index] = double.IsNaN(nLoss) ? double.NaN : src - nLoss;
                return;
            }

            double prevTrail = UtTrail[index - 1];
            double prevSrc = Bars.ClosePrices[index - 1];

            if (src > prevTrail && prevSrc > prevTrail)
                UtTrail[index] = Math.Max(prevTrail, src - nLoss);
            else if (src < prevTrail && prevSrc < prevTrail)
                UtTrail[index] = Math.Min(prevTrail, src + nLoss);
            else if (src > prevTrail)
                UtTrail[index] = src - nLoss;
            else
                UtTrail[index] = src + nLoss;
        }

        // SuperTrend (ATR-Bänder um hl2, mit Trendwechsel bei Schlusskurs-Durchbruch)
        private void CalculateSuperTrend(int index)
        {
            double atr = _stAtr.Result[index];
            double hl2 = (Bars.HighPrices[index] + Bars.LowPrices[index]) / 2.0;
            double basicUpper = hl2 + StMultiplier * atr;
            double basicLower = hl2 - StMultiplier * atr;

            if (index == 0 || double.IsNaN(atr) || double.IsNaN(_stUpper[index - 1]))
            {
                _stUpper[index] = basicUpper;
                _stLower[index] = basicLower;
                _stDirection[index] = 1;
                SuperTrendLine[index] = double.NaN;
                return;
            }

            double prevClose = Bars.ClosePrices[index - 1];
            double close = Bars.ClosePrices[index];

            _stUpper[index] = basicUpper < _stUpper[index - 1] || prevClose > _stUpper[index - 1] ? basicUpper : _stUpper[index - 1];
            _stLower[index] = basicLower > _stLower[index - 1] || prevClose < _stLower[index - 1] ? basicLower : _stLower[index - 1];

            double dir = _stDirection[index - 1];
            if (dir < 0 && close > _stUpper[index - 1])
                dir = 1;
            else if (dir > 0 && close < _stLower[index - 1])
                dir = -1;

            _stDirection[index] = dir;
            SuperTrendLine[index] = dir > 0 ? _stLower[index] : _stUpper[index];
        }

        // Squeeze Momentum (LazyBear): lineare Regression von close - Mittelwert(Donchian-Mitte, SMA)
        private void CalculateSqueeze(int index)
        {
            int len = SqueezeLength;
            if (index < len * 2)
            {
                _squeeze[index] = double.NaN;
                return;
            }

            // Werte der letzten len Kerzen, von alt (x = 0) nach neu (x = len - 1)
            double sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            for (int k = 0; k < len; k++)
            {
                int bar = index - (len - 1) + k;
                double y = Bars.ClosePrices[bar] - SqueezeBaseline(bar, len);
                sumX += k;
                sumY += y;
                sumXY += k * y;
                sumXX += k * k;
            }

            double slope = (len * sumXY - sumX * sumY) / (len * sumXX - sumX * sumX);
            double intercept = (sumY - slope * sumX) / len;
            _squeeze[index] = intercept + slope * (len - 1);
        }

        private double SqueezeBaseline(int bar, int len)
        {
            double highest = double.MinValue, lowest = double.MaxValue, sum = 0;
            for (int j = bar - len + 1; j <= bar; j++)
            {
                highest = Math.Max(highest, Bars.HighPrices[j]);
                lowest = Math.Min(lowest, Bars.LowPrices[j]);
                sum += Bars.ClosePrices[j];
            }
            double donchianMid = (highest + lowest) / 2.0;
            double sma = sum / len;
            return (donchianMid + sma) / 2.0;
        }

        private void SendAlert(string side, double price, double sl, double tp, DateTime time)
        {
            string msg = string.Format("{0} {1} M2 @ {2} | SL {3} | TP {4} | {5:yyyy-MM-dd HH:mm} UTC",
                side, SymbolName,
                Math.Round(price, Symbol.Digits), Math.Round(sl, Symbol.Digits), Math.Round(tp, Symbol.Digits), time);

            Print(msg);

            if (PopupAlert)
                Notifications.ShowPopup("XAUUSD M2 Signal", msg,
                    side == "KAUF" ? PopupNotificationState.Success : PopupNotificationState.Error);

            if (EmailAlert && !string.IsNullOrWhiteSpace(EmailFrom) && !string.IsNullOrWhiteSpace(EmailTo))
                Notifications.SendEmail(EmailFrom, EmailTo, "XAUUSD M2 Signal: " + side, msg);
        }
    }
}
