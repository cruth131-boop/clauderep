// Swing Points Structure v2 for cTrader (indicator, overlay). Built for manual XAUUSD trading on M1-M5 charts.
//
//  * Main structure on its own timeframe (default M5), also drawn on smaller charts (M1, M2, M3): swing highs/lows as fractal
//    pivots, confirmed after "Right Bars" CLOSED candles and never moved afterwards; labels HH / LH / EQH and HL / LL / EQL.
//  * Structure (default ICT): the trend flips only when a candle CLOSES beyond the last swing high / low. A break with the trend
//    is a BOS, a break against it a CHoCH. Alternative "SwingLabels": Uptrend = HH + HL, Downtrend = LH + LL (MATA style).
//  * Liquidity zones: unbroken swing levels; levels of one side closer than "Zone Tolerance x ATR" merge into one zone
//    (equal highs/lows = resting liquidity). A close beyond the zone's outer edge ends it; a wick through with the close back
//    is a liquidity sweep (x).
//  * Pending swings: a potential pivot whose confirmation candles are not complete yet (grey, "?"), may still disappear.
//  * Higher timeframes (H1, H4, each switchable): their zones and structure (table row), optionally their labels.
//  * Alerts on CHoCH / BOS / sweep (each switchable): popup on the desktop, e-mail through cTrader's e-mail settings,
//    Telegram (push to the phone). Alerts fire only for candles that close while the chart is running, never for history.
//
// All swing logic lives in SwingEngine (no cTrader types), so it is the same in the indicator and in offline tests.
using System;
using System.Collections.Generic;
using System.Globalization;
using cAlgo.API;

namespace cAlgo.Indicators
{
    public enum SwingStructureMode
    {
        CloseBreak,      // ICT: trend flips on a candle CLOSE beyond the last swing high / low (BOS / CHoCH)
        SwingLabels      // Uptrend = last high HH and last low HL, Downtrend = LH and LL, otherwise Range
    }

    [Indicator(IsOverlay = true, TimeZone = TimeZones.UTC, AccessRights = AccessRights.None, AutoRescale = false)]
    public class SwingPointsStructure : Indicator
    {
        // ---------------- main structure
        [Parameter("Structure Timeframe", DefaultValue = "Minute5", Group = "1 Structure")]
        public TimeFrame StructureTimeFrame { get; set; }

        [Parameter("Left Bars", DefaultValue = 5, MinValue = 1, MaxValue = 50, Group = "1 Structure")]
        public int LeftBars { get; set; }

        [Parameter("Right Bars (confirmation)", DefaultValue = 5, MinValue = 1, MaxValue = 50, Group = "1 Structure")]
        public int RightBars { get; set; }

        [Parameter("Structure Mode", DefaultValue = SwingStructureMode.CloseBreak, Group = "1 Structure")]
        public SwingStructureMode StructureMode { get; set; }

        [Parameter("Alternate Highs/Lows", DefaultValue = true, Group = "1 Structure")]
        public bool Alternate { get; set; }

        [Parameter("Min Swing Size (ATR, 0=off)", DefaultValue = 0.0, MinValue = 0.0, MaxValue = 10.0, Step = 0.1, Group = "1 Structure")]
        public double MinSwingAtr { get; set; }

        [Parameter("Equal High/Low Tolerance (ATR)", DefaultValue = 0.1, MinValue = 0.0, MaxValue = 2.0, Step = 0.05, Group = "1 Structure")]
        public double EqualToleranceAtr { get; set; }

        [Parameter("ATR Period", DefaultValue = 14, MinValue = 2, MaxValue = 200, Group = "1 Structure")]
        public int AtrPeriod { get; set; }

        [Parameter("Show Pending Swings", DefaultValue = true, Group = "1 Structure")]
        public bool ShowPending { get; set; }

        [Parameter("Show BOS / CHoCH", DefaultValue = true, Group = "1 Structure")]
        public bool ShowBreaks { get; set; }

        // ---------------- zones
        [Parameter("Zones per Side", DefaultValue = 3, MinValue = 0, MaxValue = 20, Group = "2 Liquidity Zones")]
        public int ZonesPerSide { get; set; }

        [Parameter("Zone Tolerance (ATR)", DefaultValue = 0.25, MinValue = 0.0, MaxValue = 3.0, Step = 0.05, Group = "2 Liquidity Zones")]
        public double ZoneToleranceAtr { get; set; }

        [Parameter("Mark Liquidity Sweeps", DefaultValue = true, Group = "2 Liquidity Zones")]
        public bool ShowSweeps { get; set; }

        [Parameter("Keep Broken Zones", DefaultValue = false, Group = "2 Liquidity Zones")]
        public bool KeepBroken { get; set; }

        // ---------------- higher timeframes
        [Parameter("Show H1 Structure", DefaultValue = true, Group = "3 Higher Timeframes")]
        public bool ShowH1 { get; set; }

        [Parameter("Show H4 Structure", DefaultValue = true, Group = "3 Higher Timeframes")]
        public bool ShowH4 { get; set; }

        [Parameter("HTF Left/Right Bars", DefaultValue = 3, MinValue = 1, MaxValue = 20, Group = "3 Higher Timeframes")]
        public int HtfBars { get; set; }

        [Parameter("HTF Zones per Side", DefaultValue = 2, MinValue = 0, MaxValue = 10, Group = "3 Higher Timeframes")]
        public int HtfZonesPerSide { get; set; }

        [Parameter("Show HTF Labels", DefaultValue = false, Group = "3 Higher Timeframes")]
        public bool ShowHtfLabels { get; set; }

        // ---------------- alerts
        [Parameter("Alerts", DefaultValue = true, Group = "4 Alerts")]
        public bool AlertsOn { get; set; }

        [Parameter("Alert on CHoCH", DefaultValue = true, Group = "4 Alerts")]
        public bool AlertChoch { get; set; }

        [Parameter("Alert on BOS", DefaultValue = false, Group = "4 Alerts")]
        public bool AlertBos { get; set; }

        [Parameter("Alert on Sweep", DefaultValue = true, Group = "4 Alerts")]
        public bool AlertSweep { get; set; }

        // A sweep of a single swing happens many times a day; a pool of equal highs/lows (or a H1/H4 zone) is real liquidity.
        [Parameter("Sweep Alert Min Equal Swings", DefaultValue = 2, MinValue = 1, MaxValue = 5, Group = "4 Alerts")]
        public int SweepAlertMinSwings { get; set; }

        [Parameter("Alert From Hour (UTC)", DefaultValue = 6, MinValue = 0, MaxValue = 23, Group = "4 Alerts")]
        public int AlertFromHourUtc { get; set; }

        [Parameter("Alert To Hour (UTC)", DefaultValue = 20, MinValue = 1, MaxValue = 24, Group = "4 Alerts")]
        public int AlertToHourUtc { get; set; }

        [Parameter("Alert on H1/H4 Events", DefaultValue = true, Group = "4 Alerts")]
        public bool AlertHtf { get; set; }

        [Parameter("Popup (desktop)", DefaultValue = true, Group = "4 Alerts")]
        public bool AlertPopup { get; set; }

        [Parameter("E-Mail (cTrader e-mail settings)", DefaultValue = false, Group = "4 Alerts")]
        public bool AlertEmail { get; set; }

        [Parameter("E-Mail From", DefaultValue = "", Group = "4 Alerts")]
        public string EmailFrom { get; set; }

        [Parameter("E-Mail To", DefaultValue = "", Group = "4 Alerts")]
        public string EmailTo { get; set; }

        [Parameter("Telegram Push", DefaultValue = false, Group = "4 Alerts")]
        public bool AlertTelegram { get; set; }

        [Parameter("Telegram Bot Token", DefaultValue = "", Group = "4 Alerts")]
        public string TelegramToken { get; set; }

        [Parameter("Telegram Chat Id", DefaultValue = "", Group = "4 Alerts")]
        public string TelegramChatId { get; set; }

        // ---------------- display
        [Parameter("Show Table", DefaultValue = true, Group = "5 Display")]
        public bool ShowTable { get; set; }

        [Parameter("Show Labels", DefaultValue = true, Group = "5 Display")]
        public bool ShowLabels { get; set; }

        [Parameter("Max Objects per Kind", DefaultValue = 150, MinValue = 10, MaxValue = 2000, Group = "5 Display")]
        public int MaxLabels { get; set; }

        [Parameter("Label Font Size", DefaultValue = 9, MinValue = 6, MaxValue = 20, Group = "5 Display")]
        public int FontSize { get; set; }

        [Parameter("High Color", DefaultValue = "Red", Group = "6 Colors")]
        public Color HighColor { get; set; }

        [Parameter("Low Color", DefaultValue = "LimeGreen", Group = "6 Colors")]
        public Color LowColor { get; set; }

        [Parameter("Resistance Color", DefaultValue = "IndianRed", Group = "6 Colors")]
        public Color ResistanceColor { get; set; }

        [Parameter("Support Color", DefaultValue = "MediumSeaGreen", Group = "6 Colors")]
        public Color SupportColor { get; set; }

        [Parameter("HTF Color", DefaultValue = "DodgerBlue", Group = "6 Colors")]
        public Color HtfColor { get; set; }

        [Parameter("Pending Color", DefaultValue = "Gray", Group = "6 Colors")]
        public Color PendingColor { get; set; }

        [Parameter("Table Color", DefaultValue = "Silver", Group = "6 Colors")]
        public Color TableColor { get; set; }

        [Output("Swing High", LineColor = "Red", PlotType = PlotType.Points, Thickness = 1)]
        public IndicatorDataSeries SwingHigh { get; set; }

        [Output("Swing Low", LineColor = "LimeGreen", PlotType = PlotType.Points, Thickness = 1)]
        public IndicatorDataSeries SwingLow { get; set; }

        private const string Prefix = "SPS_";
        private readonly List<Layer> _layers = new List<Layer>();
        private Layer _main;
        private DateTime _liveSinceUtc = DateTime.MaxValue;   // alerts only for candles closed after the chart went live
        private string _lastTable = "";
        private readonly HashSet<string> _alerted = new HashSet<string>();

        protected override void Initialize()
        {
            _main = new Layer(this, "M", StructureTimeFrame, LeftBars, RightBars, ZonesPerSide, true);
            _layers.Add(_main);
            if (ShowH1) _layers.Add(new Layer(this, "H1", TimeFrame.Hour, HtfBars, HtfBars, HtfZonesPerSide, false));
            if (ShowH4) _layers.Add(new Layer(this, "H4", TimeFrame.Hour4, HtfBars, HtfBars, HtfZonesPerSide, false));
        }

        public override void Calculate(int index)
        {
            if (IsLastBar && _liveSinceUtc == DateTime.MaxValue)
                _liveSinceUtc = Bars.OpenTimes[index];
            bool changed = false;
            foreach (Layer l in _layers)
                changed |= l.Advance(index);
            if (IsLastBar)
            {
                foreach (Layer l in _layers)
                    l.RenderLive(index, changed);
                if (ShowTable) DrawTable();
            }
        }

        // ------------------------------------------------------------------ table
        private void DrawTable()
        {
            Swing h = _main.Engine.LastHigh, l = _main.Engine.LastLow;
            string text = "Swing Structure " + _main.Name + "   " + TrendText(_main.Engine.Trend) + "\n" +
                          "Last High   " + (h == null ? "-" : h.Label + " " + Px(h.Price)) + "\n" +
                          "Last Low    " + (l == null ? "-" : l.Label + " " + Px(l.Price));
            foreach (Layer x in _layers)
                if (!x.IsMain) text += "\n" + x.Name + " Structure   " + TrendText(x.Engine.Trend);
            if (text == _lastTable) return;
            _lastTable = text;
            int t = _main.Engine.Trend;
            Chart.DrawStaticText(Prefix + "table", text, VerticalAlignment.Top, HorizontalAlignment.Right, t > 0 ? LowColor : t < 0 ? HighColor : TableColor);
        }

        private static string TrendText(int t) { return t > 0 ? "Uptrend" : t < 0 ? "Downtrend" : "Range"; }

        private string Px(double p)
        {
            int digits = Math.Max(0, Math.Min(8, (int)Math.Round(-Math.Log10(Symbol.TickSize))));
            return p.ToString("F" + digits, CultureInfo.InvariantCulture);
        }

        // ------------------------------------------------------------------ alerts
        // barCloseUtc = close time of the candle that triggered the event; candles that closed before the chart went live never alert.
        private void Alert(Layer layer, string what, double price, DateTime barCloseUtc)
        {
            if (!AlertsOn || barCloseUtc <= _liveSinceUtc) return;
            if (!layer.IsMain && !AlertHtf) return;
            int hour = barCloseUtc.Hour;
            bool inHours = AlertFromHourUtc < AlertToHourUtc ? hour >= AlertFromHourUtc && hour < AlertToHourUtc
                                                             : hour >= AlertFromHourUtc || hour < AlertToHourUtc;
            if (!inHours) return;
            string key = layer.Name + "|" + what + "|" + barCloseUtc.Ticks + "|" + price;
            if (!_alerted.Add(key)) return;
            string msg = SymbolName + " " + layer.Name + ": " + what + " @ " + Px(price) + " (candle closed " + barCloseUtc.ToString("HH:mm", CultureInfo.InvariantCulture) + " UTC)";
            if (AlertPopup)
                Notifications.ShowPopup("Swing Points Structure", msg, PopupNotificationState.Information);
            if (AlertEmail && EmailFrom.Length > 0 && EmailTo.Length > 0)
                Notifications.SendEmail(EmailFrom, EmailTo, "Swing Points: " + SymbolName + " " + what, msg);
            if (AlertTelegram && TelegramToken.Length > 0 && TelegramChatId.Length > 0)
            {
                try
                {
                    HttpResponse r = Http.Get("https://api.telegram.org/bot" + TelegramToken.Trim() + "/sendMessage?chat_id=" +
                                              Uri.EscapeDataString(TelegramChatId.Trim()) + "&text=" + Uri.EscapeDataString(msg));
                    if (!r.IsSuccessful) Print("Telegram alert failed: HTTP " + r.StatusCode);
                }
                catch (Exception ex) { Print("Telegram alert failed: " + ex.GetType().Name); }
            }
        }

        // ------------------------------------------------------------------ one structure layer (main or HTF)
        private sealed class Layer
        {
            private readonly SwingPointsStructure _ind;
            public readonly string Name;
            public readonly bool IsMain;
            public readonly SwingEngine Engine;
            private readonly Bars _src;
            private readonly TimeFrame _tf;
            private readonly int _tfMinutes, _zonesPerSide, _right;
            private readonly string _p;
            private int _done = -1;
            private bool _dirty = true;
            private int _renderedIndex = -1;
            private readonly HashSet<int> _drawnZones = new HashSet<int>();
            private readonly Queue<string[]> _labels = new Queue<string[]>(), _sweeps = new Queue<string[]>(), _breaks = new Queue<string[]>(), _broken = new Queue<string[]>();

            public Layer(SwingPointsStructure ind, string name, TimeFrame tf, int left, int right, int zonesPerSide, bool isMain)
            {
                _ind = ind; IsMain = isMain; _tf = tf; _zonesPerSide = zonesPerSide; _right = right;
                _tfMinutes = Minutes(tf);
                Name = isMain ? TfName(tf) : name;
                _p = Prefix + (isMain ? "" : name + "_");
                _src = tf == ind.TimeFrame ? ind.Bars : ind.MarketData.GetBars(tf);
                Bars s = _src;
                Engine = new SwingEngine(left, right, isMain ? ind.Alternate : true, isMain ? ind.MinSwingAtr : 0, ind.EqualToleranceAtr,
                    ind.ZoneToleranceAtr, ind.AtrPeriod, ind.StructureMode,
                    i => s.OpenPrices[i], i => s.HighPrices[i], i => s.LowPrices[i], i => s.ClosePrices[i]);
            }

            // Processes every source candle that closed before the chart candle "index" (history) or before now (live).
            public bool Advance(int index)
            {
                int closed;
                if (ReferenceEquals(_src, _ind.Bars))
                    closed = index - 1;
                else if (_ind.IsLastBar)
                    closed = _src.Count - 2;
                else
                {
                    DateTime t = _ind.Bars.OpenTimes[index];
                    int k = _src.OpenTimes.GetIndexByTime(t);
                    closed = k < 0 ? -1 : (_src.OpenTimes[k].AddMinutes(_tfMinutes) <= t ? k : k - 1);
                }
                if (closed <= _done) return false;
                for (int k = _done + 1; k <= closed; k++)
                    Engine.OnBarClosed(k);
                _done = closed;
                ApplyEvents();
                return true;
            }

            private void ApplyEvents()
            {
                foreach (SwingEvent e in Engine.TakeEvents())
                {
                    _dirty = true;
                    switch (e.Kind)
                    {
                        case SwingEventKind.SwingAdded:
                            if (IsMain && ReferenceEquals(_src, _ind.Bars))
                            {
                                if (e.Swing.IsHigh) _ind.SwingHigh[e.Swing.Index] = e.Swing.Price; else _ind.SwingLow[e.Swing.Index] = e.Swing.Price;
                            }
                            if (IsMain ? _ind.ShowLabels : _ind.ShowHtfLabels) DrawLabel(e.Swing);
                            break;
                        case SwingEventKind.SwingRemoved:
                            if (IsMain && ReferenceEquals(_src, _ind.Bars))
                            {
                                if (e.Swing.IsHigh) _ind.SwingHigh[e.Swing.Index] = double.NaN; else _ind.SwingLow[e.Swing.Index] = double.NaN;
                            }
                            _ind.Chart.RemoveObject(_p + "lb_" + e.Swing.Id);
                            break;
                        case SwingEventKind.ZoneEnded:
                            _drawnZones.Remove(e.Zone.Id);
                            _ind.Chart.RemoveObject(ZoneName(e.Zone) + "_t");
                            if (_ind.KeepBroken && e.Text != "replaced")
                            {
                                DrawZone(e.Zone, Time(e.Index), true);
                                Track(_broken, ZoneName(e.Zone));
                            }
                            else _ind.Chart.RemoveObject(ZoneName(e.Zone));
                            break;
                        case SwingEventKind.Sweep:
                            if (_ind.ShowSweeps)
                            {
                                double y = e.Zone.IsHigh ? e.Zone.High : e.Zone.Low;
                                string n = _p + "sw_" + e.Zone.Id;
                                ChartText t = _ind.Chart.DrawText(n, "x", Time(e.Index), y, IsMain ? (e.Zone.IsHigh ? _ind.ResistanceColor : _ind.SupportColor) : _ind.HtfColor);
                                Style(t, HorizontalAlignment.Center, e.Zone.IsHigh ? VerticalAlignment.Top : VerticalAlignment.Bottom, _ind.FontSize);
                                Track(_sweeps, n);
                            }
                            if (_ind.AlertSweep && (!IsMain || e.Zone.Count >= _ind.SweepAlertMinSwings))
                                _ind.Alert(this, (e.Zone.IsHigh ? "buy-side" : "sell-side") + " liquidity swept" + (e.Zone.Count > 1 ? " (" + e.Zone.Count + "x equal)" : ""),
                                    e.Zone.IsHigh ? e.Zone.High : e.Zone.Low, CloseTime(e.Index));
                            break;
                        case SwingEventKind.StructureBreak:
                            Swing b = e.Swing;
                            if (IsMain && _ind.ShowBreaks)
                            {
                                Color c = b.IsHigh ? _ind.LowColor : _ind.HighColor;   // a break of a high is bullish
                                _ind.Chart.DrawTrendLine(_p + "br_" + b.Id, Time(b.Index), b.Price, Time(e.Index), b.Price, c, 1, LineStyle.Solid);
                                ChartText t = _ind.Chart.DrawText(_p + "brt_" + b.Id, e.Text, Time((b.Index + e.Index) / 2), b.Price, c);
                                Style(t, HorizontalAlignment.Center, b.IsHigh ? VerticalAlignment.Top : VerticalAlignment.Bottom, _ind.FontSize);
                                Track(_breaks, _p + "br_" + b.Id, _p + "brt_" + b.Id);
                            }
                            bool choch = e.Text == "CHoCH";
                            if (choch ? _ind.AlertChoch : _ind.AlertBos)
                                _ind.Alert(this, e.Text + (b.IsHigh ? " bullish" : " bearish"), b.Price, CloseTime(e.Index));
                            break;
                    }
                }
            }

            private void DrawLabel(Swing s)
            {
                string n = _p + "lb_" + s.Id;
                Color c = IsMain ? (s.IsHigh ? _ind.HighColor : _ind.LowColor) : _ind.HtfColor;
                ChartText t = _ind.Chart.DrawText(n, IsMain ? s.Label : Name + " " + s.Label, ExtremeTime(s.Index, s.IsHigh, s.Price), s.Price, c);
                Style(t, HorizontalAlignment.Center, s.IsHigh ? VerticalAlignment.Top : VerticalAlignment.Bottom, IsMain ? _ind.FontSize : Math.Max(6, _ind.FontSize - 1));
                Track(_labels, n);
            }

            // Live drawing (last chart candle only): newest zones per side extended to now, pending swings.
            public void RenderLive(int index, bool changed)
            {
                if (index == _renderedIndex && !_dirty && !changed) return;
                _renderedIndex = index;
                _dirty = false;
                DateTime now = _ind.Bars.OpenTimes[index];
                var keep = new HashSet<int>();
                foreach (bool high in new[] { true, false })
                {
                    int n = 0;
                    foreach (Zone z in Engine.ActiveZones(high))
                    {
                        if (n >= _zonesPerSide) break;
                        if (CoveredByHigherLayer(z)) continue;   // the same liquidity is already drawn by H1/H4
                        n++;
                        keep.Add(z.Id);
                        DrawZone(z, now, false);
                        _drawnZones.Add(z.Id);
                    }
                }
                foreach (int id in new List<int>(_drawnZones))
                    if (!keep.Contains(id))
                    {
                        _drawnZones.Remove(id);
                        _ind.Chart.RemoveObject(_p + "zn_" + id);
                        _ind.Chart.RemoveObject(_p + "zn_" + id + "_t");
                    }
                if (IsMain) DrawPending(now);
            }

            private void DrawPending(DateTime now)
            {
                foreach (bool high in new[] { true, false })
                {
                    string n = _p + "pd_" + (high ? "h" : "l");
                    Swing s = _ind.ShowPending ? Engine.PendingSwing(high, _done) : null;
                    if (s == null) { _ind.Chart.RemoveObject(n); _ind.Chart.RemoveObject(n + "_l"); continue; }
                    DateTime t = ExtremeTime(s.Index, high, s.Price);
                    ChartText tx = _ind.Chart.DrawText(n, s.Label + "?", t, s.Price, _ind.PendingColor);
                    Style(tx, HorizontalAlignment.Center, high ? VerticalAlignment.Top : VerticalAlignment.Bottom, _ind.FontSize);
                    _ind.Chart.DrawTrendLine(n + "_l", t, s.Price, now, s.Price, _ind.PendingColor, 1, LineStyle.LinesDots);
                }
            }

            private void DrawZone(Zone z, DateTime end, bool broken)
            {
                Color c = !IsMain ? _ind.HtfColor : z.IsHigh ? _ind.ResistanceColor : _ind.SupportColor;
                string n = ZoneName(z);
                DateTime start = Time(z.Index);
                if (z.High - z.Low <= _ind.Symbol.TickSize * 0.5)
                    _ind.Chart.DrawTrendLine(n, start, z.High, end, z.High, broken ? Color.FromArgb(110, c) : c, 1, LineStyle.Dots);
                else
                {
                    ChartRectangle r = _ind.Chart.DrawRectangle(n, start, z.Low, end, z.High, Color.FromArgb(broken ? 25 : 45, c), 1, LineStyle.Dots);
                    r.IsFilled = true;
                }
                if (broken) return;
                string text = (IsMain ? "" : Name + " ") + (z.IsHigh ? "RESISTANCE" : "SUPPORT") + (z.Count > 1 ? " ZONE (" + z.Count + "x)" : "");
                ChartText t = _ind.Chart.DrawText(n + "_t", text, end, z.IsHigh ? z.High : z.Low, c);
                Style(t, HorizontalAlignment.Left, z.IsHigh ? VerticalAlignment.Top : VerticalAlignment.Bottom, Math.Max(6, _ind.FontSize - 2));
            }

            // Time of the chart candle that printed the extreme inside the source candle (exact label position on M1/M2 charts).
            private DateTime ExtremeTime(int srcIndex, bool high, double price)
            {
                DateTime t0 = _src.OpenTimes[srcIndex];
                if (ReferenceEquals(_src, _ind.Bars)) return t0;
                Bars b = _ind.Bars;
                int k = b.OpenTimes.GetIndexByTime(t0);
                if (k < 0) return t0;
                DateTime t1 = t0.AddMinutes(_tfMinutes);
                for (int j = Math.Max(0, k); j < b.Count && b.OpenTimes[j] < t1; j++)
                    if (b.OpenTimes[j] >= t0 && Math.Abs((high ? b.HighPrices[j] : b.LowPrices[j]) - price) < _ind.Symbol.TickSize * 0.5)
                        return b.OpenTimes[j];
                return t0;
            }

            // Higher layers come later in the list (main, H1, H4). A zone overlapping one of theirs is not drawn twice.
            private bool CoveredByHigherLayer(Zone z)
            {
                bool higher = false;
                foreach (Layer other in _ind._layers)
                {
                    if (ReferenceEquals(other, this)) { higher = true; continue; }
                    if (!higher || other._zonesPerSide == 0) continue;
                    double tol = other.Engine.LastAtr * _ind.ZoneToleranceAtr;
                    int n = 0;
                    foreach (Zone o in other.Engine.ActiveZones(z.IsHigh))
                    {
                        if (n++ >= other._zonesPerSide) break;
                        if (z.High >= o.Low - tol && z.Low <= o.High + tol) return true;
                    }
                }
                return false;
            }

            private DateTime CloseTime(int srcIndex) { return _src.OpenTimes[srcIndex].AddMinutes(_tfMinutes); }
            private DateTime Time(int srcIndex) { return _src.OpenTimes[Math.Max(0, Math.Min(srcIndex, _src.Count - 1))]; }
            private string ZoneName(Zone z) { return _p + "zn_" + z.Id; }

            private void Track(Queue<string[]> q, params string[] names)
            {
                q.Enqueue(names);
                while (q.Count > _ind.MaxLabels)
                    foreach (string n in q.Dequeue()) _ind.Chart.RemoveObject(n);
            }

            private static void Style(ChartText t, HorizontalAlignment h, VerticalAlignment v, int size)
            {
                t.HorizontalAlignment = h;
                t.VerticalAlignment = v;
                t.FontSize = size;
            }

            private static int Minutes(TimeFrame tf)
            {
                if (tf == TimeFrame.Minute) return 1;
                if (tf == TimeFrame.Minute2) return 2;
                if (tf == TimeFrame.Minute3) return 3;
                if (tf == TimeFrame.Minute5) return 5;
                if (tf == TimeFrame.Minute10) return 10;
                if (tf == TimeFrame.Minute15) return 15;
                if (tf == TimeFrame.Minute30) return 30;
                if (tf == TimeFrame.Hour) return 60;
                if (tf == TimeFrame.Hour4) return 240;
                if (tf == TimeFrame.Daily) return 1440;
                return 5;
            }

            private static string TfName(TimeFrame tf)
            {
                int m = Minutes(tf);
                return m >= 1440 ? "D1" : m >= 60 ? "H" + (m / 60) : "M" + m;
            }
        }
    }

    // ------------------------------------------------------------------ pure logic (no cTrader types)
    public sealed class Swing
    {
        public int Id, Index;
        public bool IsHigh;
        public double Price;
        public string Label = "";
        public bool Broken;                // a candle has closed beyond it (structure break consumed)
    }

    public sealed class Zone
    {
        public int Id, Index;              // Id / Index of the first swing of the zone (drawing starts there)
        public int FirstIndex;
        public bool IsHigh;
        public double Low, High;
        public int Count = 1;              // swings merged into the zone
        public int EndIndex = -1;          // close beyond the outer edge, -1 = active
        public int SweepIndex = -1;        // first wick through the outer edge with the close back, -1 = none
        public List<int> SwingIds = new List<int>();
    }

    public enum SwingEventKind { SwingAdded, SwingRemoved, ZoneEnded, Sweep, StructureBreak }

    public sealed class SwingEvent
    {
        public SwingEventKind Kind;
        public Swing Swing;
        public Zone Zone;
        public int Index;
        public string Text;
    }

    public sealed class SwingEngine
    {
        private readonly int _left, _right, _atrPeriod;
        private readonly bool _alternate;
        private readonly double _minAtr, _eqAtr, _zoneAtr;
        private readonly SwingStructureMode _mode;
        private readonly Func<int, double> _o, _h, _l, _c;
        private readonly List<Swing> _swings = new List<Swing>();
        private readonly List<Zone> _zones = new List<Zone>();          // active zones, oldest first
        private readonly List<SwingEvent> _events = new List<SwingEvent>();
        private readonly List<double> _atr = new List<double>();
        private int _nextId = 1;
        private int _breakTrend;
        private int _closed = -1;

        public SwingEngine(int left, int right, bool alternate, double minSwingAtr, double equalAtr, double zoneAtr, int atrPeriod,
            SwingStructureMode mode, Func<int, double> open, Func<int, double> high, Func<int, double> low, Func<int, double> close)
        {
            _left = left; _right = right; _alternate = alternate; _minAtr = minSwingAtr; _eqAtr = equalAtr; _zoneAtr = zoneAtr;
            _atrPeriod = atrPeriod; _mode = mode; _o = open; _h = high; _l = low; _c = close;
        }

        public IReadOnlyList<Swing> Swings { get { return _swings; } }
        public Swing LastHigh { get; private set; }
        public Swing LastLow { get; private set; }
        public int Replacements { get; private set; }
        public double LastAtr { get { return _atr.Count > 0 ? _atr[_atr.Count - 1] : 0; } }
        public int Trend { get { return _mode == SwingStructureMode.CloseBreak ? _breakTrend : LabelTrend(); } }

        public List<SwingEvent> TakeEvents()
        {
            var e = new List<SwingEvent>(_events);
            _events.Clear();
            return e;
        }

        // Newest first.
        public IEnumerable<Zone> ActiveZones(bool high)
        {
            for (int k = _zones.Count - 1; k >= 0; k--)
                if (_zones[k].IsHigh == high)
                    yield return _zones[k];
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
            _closed = k;
            UpdateAtr(k);
            CheckStructure(k);
            CheckZones(k);
            int p = k - _right;
            if (p - _left < 0) return;
            bool ph = IsPivot(p, true, k), pl = IsPivot(p, false, k);
            if (ph && pl)
            {
                bool lowFirst = _c(p) >= _o(p);   // a bullish outside candle usually printed its low first
                AddSwing(p, !lowFirst); AddSwing(p, lowFirst);
            }
            else if (ph) AddSwing(p, true);
            else if (pl) AddSwing(p, false);
        }

        // A potential pivot whose right side is not complete yet (needs fewer than Right more closed candles), most extreme first.
        public Swing PendingSwing(bool high, int closed)
        {
            Swing best = null;
            for (int p = Math.Max(_left, closed - _right + 1); p <= closed; p++)
            {
                double v = high ? _h(p) : _l(p);
                bool ok = true;
                for (int j = p - _left; ok && j < p; j++) ok = high ? _h(j) < v : _l(j) > v;
                for (int j = p + 1; ok && j <= closed; j++) ok = high ? _h(j) <= v : _l(j) >= v;
                if (!ok || (best != null && (high ? v <= best.Price : v >= best.Price))) continue;
                best = new Swing { Index = p, IsHigh = high, Price = v, Label = LabelFor(high, v, p, PrevSame(high)) };
            }
            return best;
        }

        private void UpdateAtr(int k)
        {
            double tr = k == 0 ? _h(k) - _l(k) : Math.Max(_h(k), _c(k - 1)) - Math.Min(_l(k), _c(k - 1));
            double prev = k > 0 && _atr.Count == k ? _atr[k - 1] : double.NaN;
            double v = double.IsNaN(prev) || k < _atrPeriod ? tr : prev + (tr - prev) / _atrPeriod;   // Wilder
            if (_atr.Count == k) _atr.Add(v); else _atr[k] = v;
        }

        private double Atr(int k) { return k >= 0 && k < _atr.Count ? _atr[k] : 0; }

        private bool IsPivot(int p, bool high, int end)
        {
            double v = high ? _h(p) : _l(p);
            for (int j = p - _left; j < p; j++)
                if (high ? _h(j) >= v : _l(j) <= v) return false;      // strictly beyond the left side
            for (int j = p + 1; j <= end; j++)
                if (high ? _h(j) > v : _l(j) < v) return false;        // not exceeded on the right side
            return true;
        }

        private Swing PrevSame(bool high)
        {
            for (int k = _swings.Count - 1; k >= 0; k--)
                if (_swings[k].IsHigh == high) return _swings[k];
            return null;
        }

        private string LabelFor(bool high, double price, int p, Swing prevSame)
        {
            double tol = _eqAtr > 0 ? _eqAtr * Atr(p) : 0;
            if (prevSame == null) return high ? "H" : "L";
            if (tol > 0 && Math.Abs(price - prevSame.Price) <= tol) return high ? "EQH" : "EQL";
            if (high) return price > prevSame.Price ? "HH" : "LH";
            return price < prevSame.Price ? "LL" : "HL";
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
            if (_minAtr > 0 && last != null && last.IsHigh != high && Math.Abs(price - last.Price) < _minAtr * Atr(p)) return;

            var s = new Swing { Id = _nextId++, Index = p, IsHigh = high, Price = price, Label = LabelFor(high, price, p, PrevSame(high)) };
            _swings.Add(s);
            if (high) LastHigh = s; else LastLow = s;
            _events.Add(new SwingEvent { Kind = SwingEventKind.SwingAdded, Swing = s });
            // the confirmation candles may already have closed beyond it
            for (int j = p + 1; j <= _closed && !s.Broken; j++)
                CheckBreak(s, j);
            if (!s.Broken) AddToZone(s);
        }

        private void RemoveLast()
        {
            Replacements++;
            Swing s = _swings[_swings.Count - 1];
            _swings.RemoveAt(_swings.Count - 1);
            _events.Add(new SwingEvent { Kind = SwingEventKind.SwingRemoved, Swing = s });
            for (int n = 0; n < _zones.Count; n++)
            {
                Zone z = _zones[n];
                if (!z.SwingIds.Contains(s.Id)) continue;
                if (z.Count == 1)
                {
                    _zones.RemoveAt(n);
                    z.EndIndex = z.Index;
                    _events.Add(new SwingEvent { Kind = SwingEventKind.ZoneEnded, Zone = z, Index = z.Index, Text = "replaced" });
                }
                // a merged zone keeps its extent; the replacing (more extreme) swing will extend it if it is close enough
                break;
            }
            Swing h = null, lo = null;
            for (int k = _swings.Count - 1; k >= 0 && (h == null || lo == null); k--)
            {
                if (_swings[k].IsHigh && h == null) h = _swings[k];
                if (!_swings[k].IsHigh && lo == null) lo = _swings[k];
            }
            LastHigh = h; LastLow = lo;
        }

        // Equal swings (within Zone Tolerance x ATR of an active zone of the same side) merge into one liquidity zone.
        private void AddToZone(Swing s)
        {
            double tol = _zoneAtr * Atr(s.Index);
            Zone hit = null;
            foreach (Zone z in ActiveZones(s.IsHigh))
                if (s.Price >= z.Low - tol && s.Price <= z.High + tol) { hit = z; break; }
            if (hit == null)
            {
                var z = new Zone { Id = s.Id, Index = s.Index, FirstIndex = s.Index, IsHigh = s.IsHigh, Low = s.Price, High = s.Price };
                z.SwingIds.Add(s.Id);
                _zones.Add(z);
                return;
            }
            hit.Low = Math.Min(hit.Low, s.Price);
            hit.High = Math.Max(hit.High, s.Price);
            hit.Count++;
            hit.SwingIds.Add(s.Id);
            hit.SweepIndex = -1;   // fresh liquidity on top of the zone
        }

        // Structure: a close beyond the last (unbroken) swing high / low. BOS with the trend, CHoCH against it.
        private void CheckStructure(int k)
        {
            if (LastHigh != null && !LastHigh.Broken && k > LastHigh.Index) CheckBreak(LastHigh, k);
            if (LastLow != null && !LastLow.Broken && k > LastLow.Index) CheckBreak(LastLow, k);
        }

        private void CheckBreak(Swing s, int k)
        {
            if (!(s.IsHigh ? _c(k) > s.Price : _c(k) < s.Price)) return;
            s.Broken = true;
            if (!ReferenceEquals(s, s.IsHigh ? LastHigh : LastLow)) return;
            int dir = s.IsHigh ? 1 : -1;
            string text = _breakTrend == -dir ? "CHoCH" : "BOS";
            _breakTrend = dir;
            _events.Add(new SwingEvent { Kind = SwingEventKind.StructureBreak, Swing = s, Index = k, Text = text });
        }

        // Zones: a close beyond the outer edge ends the zone, a wick through it with the close back is a sweep.
        private void CheckZones(int k)
        {
            for (int n = 0; n < _zones.Count; n++)
            {
                Zone z = _zones[n];
                if (k <= z.Index) continue;
                double edge = z.IsHigh ? z.High : z.Low;
                if (z.IsHigh ? _c(k) > edge : _c(k) < edge)
                {
                    z.EndIndex = k;
                    _zones.RemoveAt(n--);
                    _events.Add(new SwingEvent { Kind = SwingEventKind.ZoneEnded, Zone = z, Index = k });
                }
                else if ((z.IsHigh ? _h(k) > edge : _l(k) < edge) && z.SweepIndex < 0)
                {
                    z.SweepIndex = k;
                    _events.Add(new SwingEvent { Kind = SwingEventKind.Sweep, Zone = z, Index = k });
                }
            }
        }
    }
}
