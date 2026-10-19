// XAUUSD M2 Signalgeber für cTrader (Automate / C#) – Version 2 (Fibonacci)
//
// Setup 1 – Asia-Range-Ausbruch mit Fibonacci-Levels (Standard: aktiv)
//   Range 00–07 UTC. Schließt eine M2-Kerze zwischen 07 und 12 UTC erstmals außerhalb der Range,
//   entsteht ein Signal in Ausbruchsrichtung (max. eines pro Tag).
//   SL = 50-%-Retracement der Range, TP1 = 127,2-%-Extension, TP2 = 161,8-%-Extension.
//
// Setup 2 – Fibonacci-Rücksetzer im Impuls (Standard: aus)
//   ATR-ZigZag erkennt Impulse. Rücksetzer in die Zone 38,2–78,6 % plus UT-Bot-Wende
//   (QuantNomad, Originalparameter 1 / 10) in Impulsrichtung. SL hinter dem Rücksetzer-Extrem,
//   TP1 = 0-%-Level (Impulsende), TP2 = 127,2-%-Extension.
//   Im Backtest 2025 ohne Vorteil nach Kosten, deshalb standardmäßig ausgeschaltet.
//
// Alle Fibonacci-Werte sind Standardwerte und wurden nicht auf die Testdaten optimiert.
// Nach TP1 wird der Rest mit Stop auf Einstand weitergeführt.
//
// Jede Kerze wird genau einmal ausgewertet, und zwar wenn sie geschlossen ist. Live- und
// Historienmodus liefern daher dieselben Signale (kein Repainting).
// Es werden KEINE Orders platziert. Ein virtueller Trade je Signal wird verfolgt, um auf dem
// Chart eine Statistik (inkl. Kosten) für die geladene Historie anzuzeigen.

using System;
using System.Collections.Generic;
using cAlgo.API;
using cAlgo.API.Indicators;
using cAlgo.API.Internals;

namespace cAlgo.Indicators
{
    [Indicator(IsOverlay = true, TimeZone = TimeZones.UTC, AccessRights = AccessRights.None)]
    public class XauM2SignalGenerator : Indicator
    {
        // ---- Setup 1: Range-Ausbruch ----
        [Parameter("Range-Ausbruch aktiv", DefaultValue = true, Group = "Setup 1: Range-Ausbruch (Fibonacci)")]
        public bool UseRangeSetup { get; set; }

        [Parameter("Range Start (Stunde UTC)", DefaultValue = 0, MinValue = 0, MaxValue = 23, Group = "Setup 1: Range-Ausbruch (Fibonacci)")]
        public int RangeStartHour { get; set; }

        [Parameter("Range Ende (Stunde UTC)", DefaultValue = 7, MinValue = 1, MaxValue = 23, Group = "Setup 1: Range-Ausbruch (Fibonacci)")]
        public int RangeEndHour { get; set; }

        [Parameter("Einstieg bis (Stunde UTC)", DefaultValue = 12, MinValue = 1, MaxValue = 24, Group = "Setup 1: Range-Ausbruch (Fibonacci)")]
        public int EntryEndHour { get; set; }

        [Parameter("SL-Level (Retracement der Range)", DefaultValue = 0.5, MinValue = 0.0, MaxValue = 1.0, Group = "Setup 1: Range-Ausbruch (Fibonacci)")]
        public double RangeSlLevel { get; set; }

        [Parameter("TP1 Extension", DefaultValue = 1.272, MinValue = 1.0, Group = "Setup 1: Range-Ausbruch (Fibonacci)")]
        public double RangeTp1Extension { get; set; }

        [Parameter("TP2 Extension", DefaultValue = 1.618, MinValue = 1.0, Group = "Setup 1: Range-Ausbruch (Fibonacci)")]
        public double RangeTp2Extension { get; set; }

        // ---- Setup 2: Fibonacci-Rücksetzer ----
        [Parameter("Fib-Rücksetzer aktiv", DefaultValue = false, Group = "Setup 2: Fib-Rücksetzer")]
        public bool UsePullbackSetup { get; set; }

        [Parameter("Swing-Umkehr (ATR)", DefaultValue = 3.0, MinValue = 0.5, Group = "Setup 2: Fib-Rücksetzer")]
        public double SwingAtr { get; set; }

        [Parameter("Mindestimpuls (ATR)", DefaultValue = 6.0, MinValue = 1.0, Group = "Setup 2: Fib-Rücksetzer")]
        public double MinImpulseAtr { get; set; }

        [Parameter("Zone von (Retracement)", DefaultValue = 0.382, MinValue = 0.0, MaxValue = 1.0, Group = "Setup 2: Fib-Rücksetzer")]
        public double FibZoneMin { get; set; }

        [Parameter("Zone bis (Retracement)", DefaultValue = 0.786, MinValue = 0.0, MaxValue = 1.0, Group = "Setup 2: Fib-Rücksetzer")]
        public double FibZoneMax { get; set; }

        [Parameter("TP2 Extension", DefaultValue = 1.272, MinValue = 1.0, Group = "Setup 2: Fib-Rücksetzer")]
        public double Tp2Extension { get; set; }

        [Parameter("UT Bot Key Value", DefaultValue = 1.0, MinValue = 0.1, Group = "Setup 2: Fib-Rücksetzer")]
        public double UtKeyValue { get; set; }

        [Parameter("UT Bot ATR Periode", DefaultValue = 10, MinValue = 1, Group = "Setup 2: Fib-Rücksetzer")]
        public int UtAtrPeriod { get; set; }

        [Parameter("EMA-Trendfilter aktiv", DefaultValue = true, Group = "Setup 2: Fib-Rücksetzer")]
        public bool UseEmaFilter { get; set; }

        [Parameter("EMA Periode", DefaultValue = 200, MinValue = 1, Group = "Setup 2: Fib-Rücksetzer")]
        public int EmaPeriod { get; set; }

        [Parameter("Session Start (Stunde UTC)", DefaultValue = 7, MinValue = 0, MaxValue = 23, Group = "Setup 2: Fib-Rücksetzer")]
        public int SessionStartHour { get; set; }

        [Parameter("Session Ende (Stunde UTC)", DefaultValue = 20, MinValue = 0, MaxValue = 24, Group = "Setup 2: Fib-Rücksetzer")]
        public int SessionEndHour { get; set; }

        [Parameter("SL-Puffer hinter Rücksetzer (ATR)", DefaultValue = 0.5, MinValue = 0.0, Group = "Setup 2: Fib-Rücksetzer")]
        public double SlBufferAtr { get; set; }

        [Parameter("Mindest-SL (ATR)", DefaultValue = 1.0, MinValue = 0.1, Group = "Setup 2: Fib-Rücksetzer")]
        public double MinSlAtr { get; set; }

        [Parameter("Mindest-CRV bis TP1", DefaultValue = 1.0, MinValue = 0.0, Group = "Setup 2: Fib-Rücksetzer")]
        public double MinRewardRisk { get; set; }

        // ---- Trade-Verwaltung ----
        [Parameter("Anteil TP1 (%)", DefaultValue = 50, MinValue = 0, MaxValue = 100, Group = "Trade-Verwaltung")]
        public double Tp1SharePercent { get; set; }

        [Parameter("Zeitstopp (Bars, 0 = aus)", DefaultValue = 300, MinValue = 0, Group = "Trade-Verwaltung")]
        public int MaxBarsInTrade { get; set; }

        [Parameter("Nur ein Signal gleichzeitig", DefaultValue = true, Group = "Trade-Verwaltung")]
        public bool OneSignalAtATime { get; set; }

        [Parameter("Max. Spread (Pips, nur live)", DefaultValue = 40, MinValue = 0, Group = "Trade-Verwaltung")]
        public double MaxSpreadPips { get; set; }

        [Parameter("Kosten je Trade für Statistik (Preis)", DefaultValue = 0.35, MinValue = 0, Group = "Trade-Verwaltung")]
        public double CostPerTrade { get; set; }

        // ---- Anzeige / Benachrichtigung ----
        [Parameter("Fibonacci-Level zeichnen", DefaultValue = true, Group = "Anzeige")]
        public bool DrawFib { get; set; }

        [Parameter("Statistik anzeigen", DefaultValue = true, Group = "Anzeige")]
        public bool ShowStats { get; set; }

        [Parameter("Popup-Alarm", DefaultValue = true, Group = "Alarm")]
        public bool PopupAlert { get; set; }

        [Parameter("Ton-Alarm", DefaultValue = true, Group = "Alarm")]
        public bool SoundAlert { get; set; }

        [Parameter("E-Mail-Alarm", DefaultValue = false, Group = "Alarm")]
        public bool EmailAlert { get; set; }

        [Parameter("E-Mail Absender", DefaultValue = "", Group = "Alarm")]
        public string EmailFrom { get; set; }

        [Parameter("E-Mail Empfänger", DefaultValue = "", Group = "Alarm")]
        public string EmailTo { get; set; }

        // ---- Ausgaben ----
        [Output("UT Trailing Stop", LineColor = "Orange", Thickness = 1)]
        public IndicatorDataSeries UtTrail { get; set; }

        [Output("EMA", LineColor = "Gray", Thickness = 1)]
        public IndicatorDataSeries EmaLine { get; set; }

        [Output("Kauf-Signal", LineColor = "Lime", PlotType = PlotType.Points, Thickness = 6)]
        public IndicatorDataSeries BuySignal { get; set; }

        [Output("Verkauf-Signal", LineColor = "Red", PlotType = PlotType.Points, Thickness = 6)]
        public IndicatorDataSeries SellSignal { get; set; }

        public sealed class SignalRecord
        {
            public int BarIndex { get; set; }
            public DateTime Time { get; set; }
            public string Setup { get; set; }
            public int Direction { get; set; }
            public double Entry { get; set; }
            public double StopLoss { get; set; }
            public double TakeProfit1 { get; set; }
            public double TakeProfit2 { get; set; }
            public double TP1Share { get; set; }
            public double Level0 { get; set; }      // Fib 0 % (Range-Kante bzw. Impulsende)
            public double Level100 { get; set; }    // Fib 100 % (andere Range-Kante bzw. Impulsstart)
            public double Retracement { get; set; } // Rücksetzer-Tiefe (nur Setup 2)
            public double ResultR { get; set; } = double.NaN;
            public string Exit { get; set; } = "";
        }

        // Alle Signale der geladenen Historie (auch für Auswertungen außerhalb von cTrader)
        public List<SignalRecord> SignalLog { get; } = new List<SignalRecord>();

        private sealed class FibSetup
        {
            public double Start, End;       // Impuls: 100 % = Start, 0 % = End
            public int StartIdx, EndIdx;
            public double Extreme;          // tiefster (Long) bzw. höchster (Short) Kurs seit Impulsende
            public bool Active, Used;
            public double Size => Math.Abs(End - Start);
            public double Depth(int dir) => dir > 0 ? (End - Extreme) / Size : (Extreme - End) / Size;
        }

        private const string SetupRange = "RANGE";
        private const string SetupPullback = "FIB";
        private static readonly double[] PullbackLevels = { 0.0, 0.382, 0.5, 0.618, 0.786, 1.0 };

        private AverageTrueRange _atr;
        private AverageTrueRange _utAtr;
        private ExponentialMovingAverage _ema;

        private int _processed = -1;
        private int _warmup;
        private bool _rangeConfigValid;

        // Tages-Range
        private DateTime _rangeDay = DateTime.MinValue;
        private double _rangeHi, _rangeLo;
        private DateTime _rangeFirst, _rangeLast;
        private bool _rangeTraded, _rangeDrawn;

        // ATR-ZigZag
        private int _legDir;
        private double _legExt;
        private int _legExtIdx;
        private int _pivType;   // +1 = letzter Pivot ein Hoch, -1 = ein Tief, 0 = keiner
        private double _pivPrice;
        private int _pivIdx;

        private FibSetup _long;
        private FibSetup _short;

        // virtueller Trade
        private SignalRecord _open;
        private double _openStop, _openRealized, _openRemaining;
        private bool _tp1Done;

        protected override void Initialize()
        {
            _atr = Indicators.AverageTrueRange(14, MovingAverageType.WilderSmoothing);
            _utAtr = Indicators.AverageTrueRange(UtAtrPeriod, MovingAverageType.WilderSmoothing);
            _ema = Indicators.ExponentialMovingAverage(Bars.ClosePrices, EmaPeriod);
            _warmup = Math.Max(EmaPeriod, 50);

            _rangeConfigValid = RangeStartHour < RangeEndHour && RangeEndHour < EntryEndHour;
            if (UseRangeSetup && !_rangeConfigValid)
                Print("Range-Ausbruch deaktiviert: es muss Range Start < Range Ende < Einstieg bis gelten (alles UTC, ein Kalendertag).");

            if (TimeFrame != TimeFrame.Minute2)
                Print("Hinweis: Der Signalgeber ist für den M2-Chart ausgelegt (aktuell: {0}).", TimeFrame);
        }

        public override void Calculate(int index)
        {
            // Nur geschlossene Kerzen auswerten, jede genau einmal
            for (int i = _processed + 1; i < index; i++)
            {
                Process(i);
                _processed = i;
            }

            if (IsLastBar && ShowStats)
                DrawStats();
        }

        private void Process(int i)
        {
            BuySignal[i] = double.NaN;
            SellSignal[i] = double.NaN;
            if (UsePullbackSetup)
            {
                EmaLine[i] = _ema.Result[i];
                CalculateUtTrail(i);
            }

            double atr = _atr.Result[i];
            if (double.IsNaN(atr) || atr <= 0)
                return;

            ManageOpenTrade(i);
            UpdateRange(i);
            if (UsePullbackSetup)
            {
                UpdateZigZag(i, atr);
                UpdateSetup(_long, 1, i);
                UpdateSetup(_short, -1, i);
            }

            if (CheckRangeBreakout(i, atr))
                return;

            if (!UsePullbackSetup || i < _warmup || (OneSignalAtATime && _open != null))
                return;

            bool longOk = CheckPullback(_long, 1, i);
            bool shortOk = CheckPullback(_short, -1, i);
            if (longOk && !shortOk)
                EmitPullback(_long, 1, i, atr);
            else if (shortOk && !longOk)
                EmitPullback(_short, -1, i, atr);
        }

        // ---------------- Setup 1: Range-Ausbruch ----------------

        private void UpdateRange(int i)
        {
            DateTime t = Bars.OpenTimes[i];
            if (t.Date != _rangeDay)
            {
                _rangeDay = t.Date;
                _rangeHi = double.MinValue;
                _rangeLo = double.MaxValue;
                _rangeFirst = DateTime.MinValue;
                _rangeTraded = false;
                _rangeDrawn = false;
            }

            if (t.Hour >= RangeStartHour && t.Hour < RangeEndHour)
            {
                _rangeHi = Math.Max(_rangeHi, Bars.HighPrices[i]);
                _rangeLo = Math.Min(_rangeLo, Bars.LowPrices[i]);
                if (_rangeFirst == DateTime.MinValue)
                    _rangeFirst = t;
                _rangeLast = t;
            }
        }

        // Range gilt nur, wenn sie mindestens die Hälfte ihres Zeitfensters abdeckt (Datenlücken, Feiertage)
        private bool RangeComplete => _rangeFirst != DateTime.MinValue
            && (_rangeLast - _rangeFirst).TotalHours >= 0.5 * (RangeEndHour - RangeStartHour);

        private bool CheckRangeBreakout(int i, double atr)
        {
            if (!UseRangeSetup || !_rangeConfigValid || _rangeTraded || !RangeComplete)
                return false;

            int h = Bars.OpenTimes[i].Hour;
            if (h < RangeEndHour || h >= EntryEndHour)
                return false;

            if (DrawFib && !_rangeDrawn)
            {
                DrawRangeLevels();
                _rangeDrawn = true;
            }

            double close = Bars.ClosePrices[i];
            int dir = close > _rangeHi ? 1 : close < _rangeLo ? -1 : 0;
            if (dir == 0)
                return false;

            // Nur der erste Ausbruch des Tages zählt
            _rangeTraded = true;
            if (OneSignalAtATime && _open != null)
                return false;
            if (IsLastBar && MaxSpreadPips > 0 && Symbol.Spread / Symbol.PipSize > MaxSpreadPips)
                return false;

            double size = _rangeHi - _rangeLo;
            double edge = dir > 0 ? _rangeHi : _rangeLo;
            double other = dir > 0 ? _rangeLo : _rangeHi;
            double sl = edge - dir * RangeSlLevel * size;
            double tp1 = other + dir * RangeTp1Extension * size;
            double tp2 = other + dir * RangeTp2Extension * size;
            if (dir * (tp1 - close) <= 0 || dir * (close - sl) <= 0)
                return false;   // Ausbruchskerze schon über TP1 hinaus bzw. Range entartet

            Emit(new SignalRecord
            {
                Setup = SetupRange,
                Direction = dir,
                StopLoss = sl,
                TakeProfit1 = tp1,
                TakeProfit2 = tp2,
                Level0 = edge,
                Level100 = other,
                Retracement = double.NaN,
            }, i, atr, string.Format("Range-Ausbruch\nSL (Fib {0:0.#}%)", RangeSlLevel * 100));
            return true;
        }

        private void DrawRangeLevels()
        {
            DateTime t1 = _rangeDay.AddHours(RangeStartHour);
            DateTime t2 = _rangeDay.AddHours(EntryEndHour);
            double size = _rangeHi - _rangeLo;
            Chart.DrawTrendLine("rng_hi", t1, _rangeHi, t2, _rangeHi, Color.Silver, 1, LineStyle.Solid);
            Chart.DrawTrendLine("rng_lo", t1, _rangeLo, t2, _rangeLo, Color.Silver, 1, LineStyle.Solid);
            double mid = _rangeHi - RangeSlLevel * size;
            Chart.DrawTrendLine("rng_sl", t1, mid, t2, mid, Color.Gray, 1, LineStyle.Dots);
            DrawLevel("rng_up1", t1, t2, _rangeLo + RangeTp1Extension * size, Color.LimeGreen);
            DrawLevel("rng_up2", t1, t2, _rangeLo + RangeTp2Extension * size, Color.LimeGreen);
            DrawLevel("rng_dn1", t1, t2, _rangeHi - RangeTp1Extension * size, Color.Tomato);
            DrawLevel("rng_dn2", t1, t2, _rangeHi - RangeTp2Extension * size, Color.Tomato);
        }

        private void DrawLevel(string name, DateTime t1, DateTime t2, double y, Color color)
        {
            var line = Chart.DrawTrendLine(name, t1, y, t2, y, color, 1, LineStyle.Lines);
            line.ShowAngle = false;
        }

        // ---------------- Setup 2: Fibonacci-Rücksetzer ----------------

        private void UpdateZigZag(int i, double atr)
        {
            double hi = Bars.HighPrices[i], lo = Bars.LowPrices[i];
            double threshold = SwingAtr * atr;

            if (_legDir == 0)
            {
                _legDir = 1;
                _legExt = hi;
                _legExtIdx = i;
                return;
            }

            if (_legDir > 0)
            {
                if (hi > _legExt)
                {
                    _legExt = hi;
                    _legExtIdx = i;
                }
                else if (lo <= _legExt - threshold)
                {
                    ConfirmPivot(1, _legExt, _legExtIdx, i, atr);
                    _legDir = -1;
                    _legExtIdx = LowestIndex(_pivIdx + 1, i);
                    _legExt = Bars.LowPrices[_legExtIdx];
                }
            }
            else
            {
                if (lo < _legExt)
                {
                    _legExt = lo;
                    _legExtIdx = i;
                }
                else if (hi >= _legExt + threshold)
                {
                    ConfirmPivot(-1, _legExt, _legExtIdx, i, atr);
                    _legDir = 1;
                    _legExtIdx = HighestIndex(_pivIdx + 1, i);
                    _legExt = Bars.HighPrices[_legExtIdx];
                }
            }
        }

        private void ConfirmPivot(int type, double price, int idx, int i, double atr)
        {
            int prevType = _pivType;
            double prevPrice = _pivPrice;
            int prevIdx = _pivIdx;
            _pivType = type;
            _pivPrice = price;
            _pivIdx = idx;

            if (prevType != -type || Math.Abs(price - prevPrice) < MinImpulseAtr * atr)
                return;

            // Neuer Impuls: Hoch nach Tief = Long-Setup, Tief nach Hoch = Short-Setup
            var setup = new FibSetup { Start = prevPrice, StartIdx = prevIdx, End = price, EndIdx = idx, Active = true };
            if (type > 0)
            {
                setup.Extreme = Bars.LowPrices[LowestIndex(idx + 1, i)];
                _long = setup;
            }
            else
            {
                setup.Extreme = Bars.HighPrices[HighestIndex(idx + 1, i)];
                _short = setup;
            }

            if (DrawFib)
                DrawPullbackLevels(setup, type);
        }

        private int LowestIndex(int from, int to)
        {
            int best = to;
            for (int k = Math.Max(from, 0); k <= to; k++)
                if (Bars.LowPrices[k] < Bars.LowPrices[best])
                    best = k;
            return best;
        }

        private int HighestIndex(int from, int to)
        {
            int best = to;
            for (int k = Math.Max(from, 0); k <= to; k++)
                if (Bars.HighPrices[k] > Bars.HighPrices[best])
                    best = k;
            return best;
        }

        private void UpdateSetup(FibSetup s, int dir, int i)
        {
            if (s == null || !s.Active || i <= s.EndIdx)
                return;

            if (dir > 0)
            {
                s.Extreme = Math.Min(s.Extreme, Bars.LowPrices[i]);
                if (Bars.HighPrices[i] > s.End)
                    s.Active = false;   // Impuls läuft weiter, Rücksetzer vorbei
            }
            else
            {
                s.Extreme = Math.Max(s.Extreme, Bars.HighPrices[i]);
                if (Bars.LowPrices[i] < s.End)
                    s.Active = false;
            }

            if (s.Depth(dir) > FibZoneMax)
                s.Active = false;       // zu tief: Impuls gilt als gescheitert
        }

        private bool CheckPullback(FibSetup s, int dir, int i)
        {
            if (s == null || !s.Active || s.Used || i <= s.EndIdx)
                return false;

            double depth = s.Depth(dir);
            if (depth < FibZoneMin || depth > FibZoneMax)
                return false;

            double close = Bars.ClosePrices[i];
            double prevClose = Bars.ClosePrices[i - 1];
            bool trigger = dir > 0
                ? close > UtTrail[i] && prevClose <= UtTrail[i - 1]
                : close < UtTrail[i] && prevClose >= UtTrail[i - 1];
            if (!trigger)
                return false;

            if (dir > 0 ? close >= s.End : close <= s.End)
                return false;

            if (UseEmaFilter && (dir > 0 ? close < _ema.Result[i] : close > _ema.Result[i]))
                return false;

            if (!InHours(Bars.OpenTimes[i], SessionStartHour, SessionEndHour))
                return false;

            if (IsLastBar && MaxSpreadPips > 0 && Symbol.Spread / Symbol.PipSize > MaxSpreadPips)
                return false;

            return true;
        }

        private void EmitPullback(FibSetup s, int dir, int i, double atr)
        {
            double close = Bars.ClosePrices[i];
            double sl = dir > 0
                ? Math.Min(s.Extreme - SlBufferAtr * atr, close - MinSlAtr * atr)
                : Math.Max(s.Extreme + SlBufferAtr * atr, close + MinSlAtr * atr);
            double tp1 = s.End;
            if (Math.Abs(tp1 - close) < MinRewardRisk * Math.Abs(close - sl))
                return;

            s.Used = true;
            Emit(new SignalRecord
            {
                Setup = SetupPullback,
                Direction = dir,
                StopLoss = sl,
                TakeProfit1 = tp1,
                TakeProfit2 = s.Start + dir * Tp2Extension * s.Size,
                Level0 = s.End,
                Level100 = s.Start,
                Retracement = s.Depth(dir),
            }, i, atr, string.Format("Fib-Rücksetzer {0:0.0}%\nSL", s.Depth(dir) * 100));
        }

        // UT Bot: ATR-Trailing-Stop (Portierung des Pine-Skripts "UT Bot Alerts" von QuantNomad)
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

        private void DrawPullbackLevels(FibSetup s, int dir)
        {
            var color = dir > 0 ? Color.LimeGreen : Color.Tomato;
            DateTime t1 = Bars.OpenTimes[s.StartIdx];
            DateTime t2 = Bars.OpenTimes[s.EndIdx] + TimeSpan.FromMinutes(2 * Math.Max(30, s.EndIdx - s.StartIdx));

            foreach (double level in PullbackLevels)
            {
                double y = s.End - dir * level * s.Size;
                var line = Chart.DrawTrendLine("fib_" + level, t1, y, t2, y, color, 1, level == 0.5 || level == 0.618 ? LineStyle.Solid : LineStyle.Dots);
                line.ShowAngle = false;
            }
            DrawLevel("fib_ext", t1, t2, s.Start + dir * Tp2Extension * s.Size, Color.Gold);
            Chart.DrawTrendLine("fib_impulse", s.StartIdx, s.Start, s.EndIdx, s.End, color, 2, LineStyle.Solid);
        }

        // ---------------- Signal und virtueller Trade ----------------

        private void Emit(SignalRecord rec, int i, double atr, string labelHead)
        {
            rec.BarIndex = i;
            rec.Time = Bars.OpenTimes[i];
            rec.Entry = Bars.ClosePrices[i];
            rec.TP1Share = Tp1SharePercent / 100.0;
            SignalLog.Add(rec);

            _open = rec;
            _openStop = rec.StopLoss;
            _openRealized = 0;
            _openRemaining = 1;
            _tp1Done = rec.TP1Share <= 0;

            int dir = rec.Direction;
            string side = dir > 0 ? "KAUF" : "VERKAUF";
            if (dir > 0)
                BuySignal[i] = Bars.LowPrices[i] - atr * 0.5;
            else
                SellSignal[i] = Bars.HighPrices[i] + atr * 0.5;

            string label = string.Format("{0} · {1} {2}\nTP1 {3}\nTP2 {4}", side, labelHead, Fmt(rec.StopLoss), Fmt(rec.TakeProfit1), Fmt(rec.TakeProfit2));
            var text = Chart.DrawText("sig_" + rec.Time.Ticks, label, i,
                dir > 0 ? Bars.LowPrices[i] - atr * 1.5 : Bars.HighPrices[i] + atr * 1.5,
                dir > 0 ? Color.Lime : Color.Red);
            text.HorizontalAlignment = HorizontalAlignment.Center;
            text.VerticalAlignment = dir > 0 ? VerticalAlignment.Bottom : VerticalAlignment.Top;

            // Alarm nur im Live-Betrieb (die Kerze ist gerade geschlossen worden)
            if (IsLastBar)
                SendAlert(side, rec);
        }

        private void ManageOpenTrade(int i)
        {
            var t = _open;
            if (t == null || i <= t.BarIndex)
                return;

            int dir = t.Direction;
            double hi = Bars.HighPrices[i], lo = Bars.LowPrices[i];
            double exitPrice = double.NaN;
            string reason = null;

            // Stop zuerst prüfen (konservativ, falls SL und TP in derselben Kerze liegen)
            if (dir > 0 ? lo <= _openStop : hi >= _openStop)
            {
                exitPrice = _openStop;
                reason = _tp1Done ? "Einstand nach TP1" : "SL";
            }
            else
            {
                if (!_tp1Done && (dir > 0 ? hi >= t.TakeProfit1 : lo <= t.TakeProfit1))
                {
                    _openRealized += t.TP1Share * dir * (t.TakeProfit1 - t.Entry);
                    _openRemaining -= t.TP1Share;
                    _tp1Done = true;
                    _openStop = t.Entry;
                }
                if (_openRemaining <= 0)
                {
                    exitPrice = t.TakeProfit1;
                    reason = "TP1";
                }
                else if (dir > 0 ? hi >= t.TakeProfit2 : lo <= t.TakeProfit2)
                {
                    exitPrice = t.TakeProfit2;
                    reason = "TP2";
                }
                else if (MaxBarsInTrade > 0 && i - t.BarIndex >= MaxBarsInTrade)
                {
                    exitPrice = Bars.ClosePrices[i];
                    reason = "Zeitstopp";
                }
            }

            if (reason == null)
                return;

            double pnl = _openRealized + _openRemaining * dir * (exitPrice - t.Entry);
            t.ResultR = (pnl - CostPerTrade) / Math.Abs(t.Entry - t.StopLoss);
            t.Exit = reason;
            _open = null;
        }

        // ---------------- Hilfsfunktionen ----------------

        private static bool InHours(DateTime utcTime, int start, int end)
        {
            int h = utcTime.Hour;
            return start <= end ? h >= start && h < end : h >= start || h < end;
        }

        private void DrawStats()
        {
            int n = 0, wins = 0;
            double sum = 0, gross = 0, loss = 0;
            foreach (var r in SignalLog)
            {
                if (double.IsNaN(r.ResultR))
                    continue;
                n++;
                sum += r.ResultR;
                if (r.ResultR > 0) { wins++; gross += r.ResultR; }
                else loss -= r.ResultR;
            }

            double days = SignalLog.Count > 0
                ? Math.Max(1.0, (Bars.OpenTimes[Bars.Count - 1] - SignalLog[0].Time).TotalDays * 5.0 / 7.0)
                : 1.0;
            string text = n == 0
                ? "XAUUSD Fib-Signalgeber: noch keine abgeschlossenen Signale in der geladenen Historie"
                : string.Format("XAUUSD Fib-Signalgeber · Historie inkl. Kosten {0}: {1} Trades · {2:0.00}/Tag · Treffer {3:0}% · Ø {4:+0.00;-0.00}R · Summe {5:+0.0;-0.0}R · PF {6}",
                    CostPerTrade, n, n / days, 100.0 * wins / n, sum / n, sum, loss > 0 ? (gross / loss).ToString("0.00") : "–");
            if (_open != null)
                text += string.Format("\nOffen: {0} {1} ab {2} · Stop {3} · TP1 {4} · TP2 {5}", _open.Direction > 0 ? "KAUF" : "VERKAUF",
                    _open.Setup, Fmt(_open.Entry), Fmt(_openStop), Fmt(_open.TakeProfit1), Fmt(_open.TakeProfit2));
            Chart.DrawStaticText("stats", text, VerticalAlignment.Top, HorizontalAlignment.Left, Color.Silver);
        }

        private string Fmt(double v) => Math.Round(v, Symbol.Digits).ToString();

        private void SendAlert(string side, SignalRecord rec)
        {
            string msg = string.Format("{0} {1} ({2}) @ {3} | SL {4} | TP1 {5} | TP2 {6} | {7:yyyy-MM-dd HH:mm} UTC",
                side, SymbolName, rec.Setup == SetupRange ? "Range-Ausbruch" : "Fib-Rücksetzer",
                Fmt(rec.Entry), Fmt(rec.StopLoss), Fmt(rec.TakeProfit1), Fmt(rec.TakeProfit2), rec.Time);

            Print(msg);

            if (PopupAlert)
                Notifications.ShowPopup("XAUUSD Signal", msg,
                    rec.Direction > 0 ? PopupNotificationState.Success : PopupNotificationState.Error);

            if (SoundAlert)
                Notifications.PlaySound(SoundType.PositiveNotification);

            if (EmailAlert && !string.IsNullOrWhiteSpace(EmailFrom) && !string.IsNullOrWhiteSpace(EmailTo))
                Notifications.SendEmail(EmailFrom, EmailTo, "XAUUSD Signal: " + side, msg);
        }
    }
}
