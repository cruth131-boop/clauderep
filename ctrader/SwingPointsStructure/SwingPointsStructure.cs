// Swing Points Structure for cTrader (indicator, overlay).
// Swing highs/lows (fractal pivots, confirmed after "Right Bars" closed bars, never repainted afterwards), labelled
// HH / LH / EQH and HL / LL / EQL against the previous swing of the same side; market structure (Uptrend / Downtrend / Range)
// from the swing labels or from closes beyond the last swing (BOS / CHoCH); dotted support / resistance lines from the last
// unbroken swing levels, ended when a candle closes through them; optional liquidity-sweep marks (wick through, close back);
// info table top right. Outputs SwingHigh / SwingLow (value at the pivot bar) for use from a cBot.
//
// All swing logic lives in SwingEngine (no cTrader types), so it is identical in the indicator and in offline tests.
using System;
using System.Collections.Generic;
using System.Globalization;
using cAlgo.API;

namespace cAlgo.Indicators
{
    public enum SwingStructureMode
    {
        SwingLabels,     // Uptrend = last high HH and last low HL, Downtrend = LH and LL, otherwise Range
        CloseBreak       // trend flips when a candle CLOSES beyond the last swing high / low (BOS = with trend, CHoCH = against)
    }

    [Indicator(IsOverlay = true, TimeZone = TimeZones.UTC, AccessRights = AccessRights.None, AutoRescale = false)]
    public class SwingPointsStructure : Indicator
    {
        [Parameter("Left Bars", DefaultValue = 5, MinValue = 1, MaxValue = 50, Group = "Swings")]
        public int LeftBars { get; set; }

        [Parameter("Right Bars (confirmation)", DefaultValue = 5, MinValue = 1, MaxValue = 50, Group = "Swings")]
        public int RightBars { get; set; }

        [Parameter("Alternate Highs/Lows", DefaultValue = true, Group = "Swings")]
        public bool Alternate { get; set; }

        [Parameter("Min Swing Size (ATR, 0=off)", DefaultValue = 0.0, MinValue = 0.0, MaxValue = 10.0, Step = 0.1, Group = "Swings")]
        public double MinSwingAtr { get; set; }

        [Parameter("Equal High/Low Tolerance (ATR, 0=off)", DefaultValue = 0.1, MinValue = 0.0, MaxValue = 2.0, Step = 0.05, Group = "Swings")]
        public double EqualToleranceAtr { get; set; }

        [Parameter("ATR Period", DefaultValue = 14, MinValue = 2, MaxValue = 200, Group = "Swings")]
        public int AtrPeriod { get; set; }

        [Parameter("Structure Mode", DefaultValue = SwingStructureMode.SwingLabels, Group = "Structure")]
        public SwingStructureMode StructureMode { get; set; }

        [Parameter("Show BOS / CHoCH", DefaultValue = false, Group = "Structure")]
        public bool ShowBreaks { get; set; }

        [Parameter("Show Table", DefaultValue = true, Group = "Display")]
        public bool ShowTable { get; set; }

        [Parameter("Show Labels", DefaultValue = true, Group = "Display")]
        public bool ShowLabels { get; set; }

        [Parameter("Max Labels", DefaultValue = 150, MinValue = 10, MaxValue = 2000, Group = "Display")]
        public int MaxLabels { get; set; }

        [Parameter("S/R Levels per Side", DefaultValue = 3, MinValue = 0, MaxValue = 20, Group = "Display")]
        public int LevelsPerSide { get; set; }

        [Parameter("Keep Broken Levels", DefaultValue = false, Group = "Display")]
        public bool KeepBrokenLevels { get; set; }

        [Parameter("Mark Liquidity Sweeps", DefaultValue = true, Group = "Display")]
        public bool ShowSweeps { get; set; }

        [Parameter("Label Font Size", DefaultValue = 9, MinValue = 6, MaxValue = 20, Group = "Display")]
        public int FontSize { get; set; }

        [Parameter("High Color", DefaultValue = "Red", Group = "Colors")]
        public Color HighColor { get; set; }

        [Parameter("Low Color", DefaultValue = "LimeGreen", Group = "Colors")]
        public Color LowColor { get; set; }

        [Parameter("Resistance Color", DefaultValue = "IndianRed", Group = "Colors")]
        public Color ResistanceColor { get; set; }

        [Parameter("Support Color", DefaultValue = "MediumSeaGreen", Group = "Colors")]
        public Color SupportColor { get; set; }

        [Parameter("Table Color", DefaultValue = "Silver", Group = "Colors")]
        public Color TableColor { get; set; }

        [Output("Swing High", LineColor = "Red", PlotType = PlotType.Points, Thickness = 1)]
        public IndicatorDataSeries SwingHigh { get; set; }

        [Output("Swing Low", LineColor = "LimeGreen", PlotType = PlotType.Points, Thickness = 1)]
        public IndicatorDataSeries SwingLow { get; set; }

        private const string Prefix = "SPS_";
        private SwingEngine _engine;
        private int _lastClosed = -1;
        private readonly Queue<string[]> _labelNames = new Queue<string[]>();
        private readonly Queue<string[]> _sweepNames = new Queue<string[]>();
        private readonly Queue<string[]> _breakNames = new Queue<string[]>();
        private readonly HashSet<int> _drawnLevels = new HashSet<int>();
        private readonly Queue<string[]> _brokenNames = new Queue<string[]>();
        private string _lastTable = "";
        private int _renderedIndex = -1;
        private bool _dirty = true;

        protected override void Initialize()
        {
            _engine = new SwingEngine(LeftBars, RightBars, Alternate, MinSwingAtr, EqualToleranceAtr, AtrPeriod, StructureMode,
                i => Bars.OpenPrices[i], i => Bars.HighPrices[i], i => Bars.LowPrices[i], i => Bars.ClosePrices[i]);
        }

        public override void Calculate(int index)
        {
            // Only closed candles drive the logic: the forming candle (index) is never part of a swing or a break.
            int closed = index - 1;
            if (closed <= _lastClosed)
            {
                if (IsLastBar) RenderLive(index);
                return;
            }
            for (int k = _lastClosed + 1; k <= closed; k++)
                _engine.OnBarClosed(k);
            _lastClosed = closed;
            ApplyEvents();
            if (IsLastBar) RenderLive(index);
        }

        private void ApplyEvents()
        {
            foreach (SwingEvent e in _engine.TakeEvents())
            {
                switch (e.Kind)
                {
                    case SwingEventKind.SwingAdded:
                        _dirty = true;
                        Swing s = e.Swing;
                        if (s.IsHigh) SwingHigh[s.Index] = s.Price; else SwingLow[s.Index] = s.Price;
                        if (ShowLabels) DrawLabel(s);
                        break;
                    case SwingEventKind.SwingRemoved:
                        if (e.Swing.IsHigh) SwingHigh[e.Swing.Index] = double.NaN; else SwingLow[e.Swing.Index] = double.NaN;
                        Chart.RemoveObject(LabelName(e.Swing));
                        break;
                    case SwingEventKind.LevelEnded:
                        _drawnLevels.Remove(e.Level.Id);
                        Chart.RemoveObject(LevelName(e.Level) + "_t");
                        if (KeepBrokenLevels && e.Text != "replaced")
                        {
                            DrawLevel(e.Level, e.Index, true);
                            Track(_brokenNames, LevelName(e.Level));
                        }
                        else Chart.RemoveObject(LevelName(e.Level));
                        _dirty = true;
                        break;
                    case SwingEventKind.Sweep:
                        if (ShowSweeps)
                        {
                            string name = Prefix + "sw_" + e.Level.Id;
                            ChartText t = Chart.DrawText(name, "x", e.Index, e.Level.Price, e.Level.IsHigh ? ResistanceColor : SupportColor);
                            Track(_sweepNames, name);
                            t.HorizontalAlignment = HorizontalAlignment.Center;
                            t.VerticalAlignment = e.Level.IsHigh ? VerticalAlignment.Top : VerticalAlignment.Bottom;
                            t.FontSize = FontSize;
                        }
                        break;
                    case SwingEventKind.StructureBreak:
                        if (ShowBreaks)
                        {
                            Color c = e.Level.IsHigh ? LowColor : HighColor;   // a break of a high is bullish
                            Chart.DrawTrendLine(Prefix + "br_" + e.Level.Id, e.Level.Index, e.Level.Price, e.Index, e.Level.Price, c, 1, LineStyle.Solid);
                            ChartText t = Chart.DrawText(Prefix + "brt_" + e.Level.Id, e.Text, (e.Level.Index + e.Index) / 2, e.Level.Price, c);
                            Track(_breakNames, Prefix + "br_" + e.Level.Id, Prefix + "brt_" + e.Level.Id);
                            t.HorizontalAlignment = HorizontalAlignment.Center;
                            t.VerticalAlignment = e.Level.IsHigh ? VerticalAlignment.Top : VerticalAlignment.Bottom;
                            t.FontSize = FontSize;
                        }
                        break;
                }
            }
        }

        private void DrawLabel(Swing s)
        {
            string name = LabelName(s);
            ChartText t = Chart.DrawText(name, s.Label, s.Index, s.Price, s.IsHigh ? HighColor : LowColor);
            t.HorizontalAlignment = HorizontalAlignment.Center;
            t.VerticalAlignment = s.IsHigh ? VerticalAlignment.Top : VerticalAlignment.Bottom;
            t.FontSize = FontSize;
            Track(_labelNames, name);
        }

        // Every history-type object (labels, sweeps, breaks, broken levels) is kept to the newest Max Labels per kind.
        private void Track(Queue<string[]> queue, params string[] names)
        {
            queue.Enqueue(names);
            while (queue.Count > MaxLabels)
                foreach (string n in queue.Dequeue())
                    Chart.RemoveObject(n);
        }

        // Active levels (newest LevelsPerSide per side) are extended to the current candle on the last bar only.
        private void RenderLive(int index)
        {
            if (index == _renderedIndex && !_dirty)
                return;
            _renderedIndex = index;
            _dirty = false;
            var keep = new HashSet<int>();
            foreach (bool high in new[] { true, false })
            {
                int n = 0;
                foreach (Level l in _engine.ActiveLevels(high))
                {
                    if (n++ >= LevelsPerSide) break;
                    keep.Add(l.Id);
                    DrawLevel(l, index, false);
                    _drawnLevels.Add(l.Id);
                }
            }
            foreach (int id in new List<int>(_drawnLevels))
                if (!keep.Contains(id))
                {
                    _drawnLevels.Remove(id);
                    Chart.RemoveObject(Prefix + "lv_" + id);
                    Chart.RemoveObject(Prefix + "lv_" + id + "_t");
                }
            if (ShowTable) DrawTable();
        }

        private void DrawLevel(Level l, int endIndex, bool broken)
        {
            Color c = l.IsHigh ? ResistanceColor : SupportColor;
            Chart.DrawTrendLine(LevelName(l), l.Index, l.Price, endIndex, l.Price, broken ? Color.FromArgb(110, c) : c, 1, LineStyle.Dots);
            if (broken)
                return;
            ChartText t = Chart.DrawText(LevelName(l) + "_t", l.IsHigh ? "RESISTANCE" : "SUPPORT", endIndex, l.Price, c);
            t.HorizontalAlignment = HorizontalAlignment.Left;
            t.VerticalAlignment = VerticalAlignment.Center;
            t.FontSize = Math.Max(6, FontSize - 2);
        }

        private void DrawTable()
        {
            Swing h = _engine.LastHigh, l = _engine.LastLow;
            string trend = _engine.Trend > 0 ? "Uptrend" : _engine.Trend < 0 ? "Downtrend" : "Range";
            string text = "Swing Structure   " + trend + "\n" +
                          "Last High   " + (h == null ? "-" : h.Label + " " + Px(h.Price)) + "\n" +
                          "Last Low    " + (l == null ? "-" : l.Label + " " + Px(l.Price));
            if (text == _lastTable) return;
            _lastTable = text;
            Color c = _engine.Trend > 0 ? LowColor : _engine.Trend < 0 ? HighColor : TableColor;
            Chart.DrawStaticText(Prefix + "table", text, VerticalAlignment.Top, HorizontalAlignment.Right, c);
        }

        private string Px(double p)
        {
            int digits = Math.Max(0, Math.Min(8, (int)Math.Round(-Math.Log10(Symbol.TickSize))));
            return p.ToString("F" + digits, CultureInfo.InvariantCulture);
        }

        private static string LabelName(Swing s) { return Prefix + "lb_" + s.Id; }
        private static string LevelName(Level l) { return Prefix + "lv_" + l.Id; }
    }

    // ------------------------------------------------------------------ pure logic (no cTrader types)
    public sealed class Swing
    {
        public int Id, Index;
        public bool IsHigh;
        public double Price;
        public string Label = "";
    }

    public sealed class Level
    {
        public int Id, Index;
        public bool IsHigh;
        public double Price;
        public int EndIndex = -1;          // close-through candle, -1 = active
        public int SweepIndex = -1;        // first wick-through candle that closed back (liquidity taken), -1 = none
    }

    public enum SwingEventKind { SwingAdded, SwingRemoved, LevelEnded, Sweep, StructureBreak }

    public sealed class SwingEvent
    {
        public SwingEventKind Kind;
        public Swing Swing;
        public Level Level;
        public int Index;
        public string Text;
    }

    public sealed class SwingEngine
    {
        private readonly int _left, _right, _atrPeriod;
        private readonly bool _alternate;
        private readonly double _minAtr, _eqAtr;
        private readonly SwingStructureMode _mode;
        private readonly Func<int, double> _o, _h, _l, _c;
        private readonly List<Swing> _swings = new List<Swing>();
        private readonly List<Level> _levels = new List<Level>();      // active (unbroken) levels, oldest first
        private readonly List<SwingEvent> _events = new List<SwingEvent>();
        private readonly List<double> _atr = new List<double>();
        private int _nextId = 1;
        private int _breakTrend;

        public SwingEngine(int left, int right, bool alternate, double minSwingAtr, double equalAtr, int atrPeriod, SwingStructureMode mode,
            Func<int, double> open, Func<int, double> high, Func<int, double> low, Func<int, double> close)
        {
            _left = left; _right = right; _alternate = alternate; _minAtr = minSwingAtr; _eqAtr = equalAtr; _atrPeriod = atrPeriod; _mode = mode;
            _o = open; _h = high; _l = low; _c = close;
        }

        public IReadOnlyList<Swing> Swings { get { return _swings; } }
        public Swing LastHigh { get; private set; }
        public Swing LastLow { get; private set; }
        public int Trend { get { return _mode == SwingStructureMode.CloseBreak ? _breakTrend : LabelTrend(); } }

        public List<SwingEvent> TakeEvents()
        {
            var e = new List<SwingEvent>(_events);
            _events.Clear();
            return e;
        }

        // Newest first.
        public IEnumerable<Level> ActiveLevels(bool high)
        {
            for (int k = _levels.Count - 1; k >= 0; k--)
                if (_levels[k].IsHigh == high)
                    yield return _levels[k];
        }

        private int LabelTrend()
        {
            if (LastHigh == null || LastLow == null) return 0;
            if (LastHigh.Label == "HH" && LastLow.Label == "HL") return 1;
            if (LastHigh.Label == "LH" && LastLow.Label == "LL") return -1;
            return 0;
        }

        // Call once for every CLOSED candle k, in order.
        public void OnBarClosed(int k)
        {
            UpdateAtr(k);
            CheckLevels(k);
            int p = k - _right;
            if (p - _left < 0) return;
            bool ph = IsPivot(p, true), pl = IsPivot(p, false);
            if (ph && pl)
            {
                // outside candle: a bullish candle usually printed its low first
                bool lowFirst = _c(p) >= _o(p);
                AddSwing(p, !lowFirst); AddSwing(p, lowFirst);
            }
            else if (ph) AddSwing(p, true);
            else if (pl) AddSwing(p, false);
        }

        private void UpdateAtr(int k)
        {
            double tr = k == 0 ? _h(k) - _l(k) : Math.Max(_h(k), _c(k - 1)) - Math.Min(_l(k), _c(k - 1));
            double prev = k > 0 && _atr.Count == k ? _atr[k - 1] : double.NaN;
            double v = double.IsNaN(prev) || k < _atrPeriod ? tr : prev + (tr - prev) / _atrPeriod;   // Wilder
            if (_atr.Count == k) _atr.Add(v); else _atr[k] = v;
        }

        private double Atr(int k) { return k >= 0 && k < _atr.Count ? _atr[k] : 0; }

        private bool IsPivot(int p, bool high)
        {
            double v = high ? _h(p) : _l(p);
            for (int j = p - _left; j < p; j++)
                if (high ? _h(j) >= v : _l(j) <= v) return false;      // strictly beyond the left side
            for (int j = p + 1; j <= p + _right; j++)
                if (high ? _h(j) > v : _l(j) < v) return false;        // not exceeded on the right side
            return true;
        }

        private void AddSwing(int p, bool high)
        {
            double price = high ? _h(p) : _l(p);
            Swing last = _swings.Count > 0 ? _swings[_swings.Count - 1] : null;
            if (_alternate && last != null && last.IsHigh == high)
            {
                bool moreExtreme = high ? price > last.Price : price < last.Price;
                if (!moreExtreme) return;
                RemoveLast();   // the more extreme swing of a same-side run wins
                last = _swings.Count > 0 ? _swings[_swings.Count - 1] : null;
            }
            // noise filter: distance to the previous opposite swing must be at least MinSwingAtr x ATR
            if (_minAtr > 0 && last != null && last.IsHigh != high && Math.Abs(price - last.Price) < _minAtr * Atr(p)) return;

            Swing prevSame = null;
            for (int k = _swings.Count - 1; k >= 0; k--)
                if (_swings[k].IsHigh == high) { prevSame = _swings[k]; break; }
            var s = new Swing { Id = _nextId++, Index = p, IsHigh = high, Price = price };
            double tol = _eqAtr > 0 ? _eqAtr * Atr(p) : 0;
            if (prevSame == null) s.Label = high ? "H" : "L";
            else if (tol > 0 && Math.Abs(price - prevSame.Price) <= tol) s.Label = high ? "EQH" : "EQL";
            else if (high) s.Label = price > prevSame.Price ? "HH" : "LH";
            else s.Label = price < prevSame.Price ? "LL" : "HL";
            _swings.Add(s);
            if (high) LastHigh = s; else LastLow = s;
            _events.Add(new SwingEvent { Kind = SwingEventKind.SwingAdded, Swing = s });

            var lv = new Level { Id = s.Id, Index = p, IsHigh = high, Price = price };
            _levels.Add(lv);
            // the swing may already have been closed through by the confirmation candles
            for (int j = p + 1; j <= p + _right && lv.EndIndex < 0; j++)
                CheckLevel(lv, j);
            if (lv.EndIndex >= 0) _levels.Remove(lv);
        }

        public int Replacements { get; private set; }   // confirmed swings later replaced by a more extreme one (Alternate)

        private void RemoveLast()
        {
            Replacements++;
            Swing s = _swings[_swings.Count - 1];
            _swings.RemoveAt(_swings.Count - 1);
            _events.Add(new SwingEvent { Kind = SwingEventKind.SwingRemoved, Swing = s });
            int li = _levels.FindLastIndex(x => x.Id == s.Id);
            if (li >= 0)
            {
                Level l = _levels[li];
                _levels.RemoveAt(li);
                l.EndIndex = l.Index;
                _events.Add(new SwingEvent { Kind = SwingEventKind.LevelEnded, Level = l, Index = l.Index, Text = "replaced" });
            }
            Swing h = null, lo = null;
            for (int k = _swings.Count - 1; k >= 0 && (h == null || lo == null); k--)
            {
                if (_swings[k].IsHigh && h == null) h = _swings[k];
                if (!_swings[k].IsHigh && lo == null) lo = _swings[k];
            }
            LastHigh = h; LastLow = lo;
        }

        private void CheckLevels(int k)
        {
            for (int n = 0; n < _levels.Count; n++)
            {
                Level l = _levels[n];
                if (k <= l.Index) continue;
                CheckLevel(l, k);
                if (l.EndIndex >= 0) { _levels.RemoveAt(n); n--; }
            }
        }

        // Close beyond = broken (structure break if it is the latest swing of its side); wick beyond with close back = sweep.
        private void CheckLevel(Level l, int k)
        {
            bool closeThrough = l.IsHigh ? _c(k) > l.Price : _c(k) < l.Price;
            bool wickThrough = l.IsHigh ? _h(k) > l.Price : _l(k) < l.Price;
            if (closeThrough)
            {
                l.EndIndex = k;
                _events.Add(new SwingEvent { Kind = SwingEventKind.LevelEnded, Level = l, Index = k });
                Swing latest = l.IsHigh ? LastHigh : LastLow;
                if (latest != null && latest.Id == l.Id)
                {
                    int dir = l.IsHigh ? 1 : -1;
                    string text = _breakTrend == -dir ? "CHoCH" : "BOS";
                    _breakTrend = dir;
                    _events.Add(new SwingEvent { Kind = SwingEventKind.StructureBreak, Level = l, Index = k, Text = text });
                }
            }
            else if (wickThrough && l.SweepIndex < 0)
            {
                l.SweepIndex = k;
                _events.Add(new SwingEvent { Kind = SwingEventKind.Sweep, Level = l, Index = k });
            }
        }
    }
}
