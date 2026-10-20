// Minimal stand-in for the cAlgo.API surface the indicator uses (same names and signatures as cTrader Automate).
// Test only: chart objects are recorded so the test can check and render them.
using System;
using System.Collections.Generic;

namespace cAlgo.API
{
    public enum TimeZones { UTC }
    public enum AccessRights { None, FullAccess }
    public enum PlotType { Line, Points, Histogram, DiscontinuousLine }
    public enum LineStyle { Solid, Dots, DotsRare, DotsVeryRare, Lines, LinesDots }
    public enum VerticalAlignment { Top, Center, Bottom }
    public enum HorizontalAlignment { Left, Center, Right }
    public enum PopupNotificationState { InProgress, Success, Error, Partial, Information }

    public sealed class TimeFrame
    {
        public readonly int Minutes; public readonly string Name;
        private TimeFrame(int m, string n) { Minutes = m; Name = n; }
        public static readonly TimeFrame Minute = new TimeFrame(1, "Minute"), Minute2 = new TimeFrame(2, "Minute2"), Minute3 = new TimeFrame(3, "Minute3"),
            Minute5 = new TimeFrame(5, "Minute5"), Minute10 = new TimeFrame(10, "Minute10"), Minute15 = new TimeFrame(15, "Minute15"),
            Minute30 = new TimeFrame(30, "Minute30"), Hour = new TimeFrame(60, "Hour"), Hour4 = new TimeFrame(240, "Hour4"), Daily = new TimeFrame(1440, "Daily");
        public static TimeFrame Parse(string n)
        {
            foreach (var t in new[] { Minute, Minute2, Minute3, Minute5, Minute10, Minute15, Minute30, Hour, Hour4, Daily }) if (t.Name == n) return t;
            throw new ArgumentException(n);
        }
        public override string ToString() { return Name; }
    }

    [AttributeUsage(AttributeTargets.Class)]
    public sealed class IndicatorAttribute : Attribute
    {
        public bool IsOverlay { get; set; }
        public TimeZones TimeZone { get; set; }
        public AccessRights AccessRights { get; set; }
        public bool AutoRescale { get; set; }
    }

    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ParameterAttribute : Attribute
    {
        public ParameterAttribute(string name) { Name = name; }
        public string Name { get; set; }
        public object DefaultValue { get; set; }
        public double MinValue { get; set; }
        public double MaxValue { get; set; }
        public double Step { get; set; }
        public string Group { get; set; }
    }

    [AttributeUsage(AttributeTargets.Property)]
    public sealed class OutputAttribute : Attribute
    {
        public OutputAttribute(string name) { Name = name; }
        public string Name { get; set; }
        public string LineColor { get; set; }
        public PlotType PlotType { get; set; }
        public int Thickness { get; set; }
    }

    public struct Color
    {
        public readonly string Name; public readonly int A;
        private Color(string n, int a) { Name = n; A = a; }
        public static Color FromName(string n) { return new Color(n, 255); }
        public static Color FromArgb(int a, Color c) { return new Color(c.Name, a); }
        public static Color Red { get { return FromName("Red"); } }
        public static Color LimeGreen { get { return FromName("LimeGreen"); } }
        public static Color IndianRed { get { return FromName("IndianRed"); } }
        public static Color MediumSeaGreen { get { return FromName("MediumSeaGreen"); } }
        public static Color Silver { get { return FromName("Silver"); } }
        public static Color DodgerBlue { get { return FromName("DodgerBlue"); } }
        public static Color Gray { get { return FromName("Gray"); } }
        public override string ToString() { return Name + (A < 255 ? "@" + A : ""); }
    }

    public interface DataSeries { double this[int index] { get; } int Count { get; } }
    public sealed class ListSeries : DataSeries
    {
        internal readonly List<double> V = new List<double>();
        public double this[int i] { get { return V[i]; } }
        public int Count { get { return V.Count; } }
    }
    public sealed class TimeSeries
    {
        internal readonly List<DateTime> V = new List<DateTime>();
        public DateTime this[int i] { get { return V[i]; } }
        public int Count { get { return V.Count; } }
        // index of the last bar that opened at or before t (-1 if none)
        public int GetIndexByTime(DateTime t)
        {
            int lo = 0, hi = V.Count - 1, ans = -1;
            while (lo <= hi) { int m = (lo + hi) / 2; if (V[m] <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
            return ans;
        }
    }

    public sealed class IndicatorDataSeries
    {
        public readonly Dictionary<int, double> V = new Dictionary<int, double>();
        public double this[int i] { get { double v; return V.TryGetValue(i, out v) ? v : double.NaN; } set { V[i] = value; } }
    }

    public sealed class Bars
    {
        public readonly TimeSeries OpenTimes = new TimeSeries();
        public readonly ListSeries OpenPrices = new ListSeries(), HighPrices = new ListSeries(), LowPrices = new ListSeries(), ClosePrices = new ListSeries();
        public int Count { get { return OpenTimes.Count; } }
        public void Add(DateTime t, double o, double h, double l, double c) { OpenTimes.V.Add(t); OpenPrices.V.Add(o); HighPrices.V.Add(h); LowPrices.V.Add(l); ClosePrices.V.Add(c); }
        // aggregation helper of the test: a lower-timeframe candle updates or opens the bar containing its time
        public void Merge(DateTime open, double o, double h, double l, double c)
        {
            int n = Count - 1;
            if (n >= 0 && OpenTimes.V[n] == open)
            {
                HighPrices.V[n] = Math.Max(HighPrices.V[n], h); LowPrices.V[n] = Math.Min(LowPrices.V[n], l); ClosePrices.V[n] = c;
            }
            else Add(open, o, h, l, c);
        }
    }

    public sealed class Symbol { public double TickSize { get; set; } = 0.01; }

    public class ChartObject { public string Name; public Color Color; }
    public sealed class ChartText : ChartObject
    {
        public string Text; public int BarIndex; public DateTime Time; public double Y;
        public VerticalAlignment VerticalAlignment { get; set; }
        public HorizontalAlignment HorizontalAlignment { get; set; }
        public double FontSize { get; set; }
    }
    public sealed class ChartTrendLine : ChartObject { public int Index1, Index2; public double Y1, Y2; public int Thickness; public LineStyle LineStyle; }
    public sealed class ChartStaticText : ChartObject { public string Text; public VerticalAlignment V; public HorizontalAlignment H; }
    public sealed class ChartRectangle : ChartObject { public DateTime T1, T2; public double Y1, Y2; public bool IsFilled { get; set; } public LineStyle LineStyle; }

    public sealed class Chart
    {
        public readonly Dictionary<string, ChartObject> Objects = new Dictionary<string, ChartObject>();
        public int Draws, Removes;
        public Func<DateTime, int> IndexOf = t => -1;   // set by the test: chart bar index of a time
        public ChartText DrawText(string name, string text, DateTime time, double y, Color color)
        { Draws++; var t = new ChartText { Name = name, Text = text, BarIndex = IndexOf(time), Time = time, Y = y, Color = color }; Objects[name] = t; return t; }
        public ChartTrendLine DrawTrendLine(string name, DateTime time1, double y1, DateTime time2, double y2, Color color, int thickness = 1, LineStyle lineStyle = LineStyle.Solid)
        { Draws++; var t = new ChartTrendLine { Name = name, Index1 = IndexOf(time1), Y1 = y1, Index2 = IndexOf(time2), Y2 = y2, Color = color, Thickness = thickness, LineStyle = lineStyle }; Objects[name] = t; return t; }
        public ChartRectangle DrawRectangle(string name, DateTime time1, double y1, DateTime time2, double y2, Color color, int thickness = 1, LineStyle lineStyle = LineStyle.Solid)
        { Draws++; var t = new ChartRectangle { Name = name, T1 = time1, Y1 = y1, T2 = time2, Y2 = y2, Color = color, LineStyle = lineStyle }; Objects[name] = t; return t; }
        public ChartStaticText DrawStaticText(string name, string text, VerticalAlignment verticalAlignment, HorizontalAlignment horizontalAlignment, Color color)
        { Draws++; var t = new ChartStaticText { Name = name, Text = text, V = verticalAlignment, H = horizontalAlignment, Color = color }; Objects[name] = t; return t; }
        public void RemoveObject(string name) { Removes++; Objects.Remove(name); }
    }

    public sealed class MarketData
    {
        public readonly Dictionary<TimeFrame, Bars> Series = new Dictionary<TimeFrame, Bars>();
        public Bars GetBars(TimeFrame tf) { return Series[tf]; }
    }

    public sealed class Notifications
    {
        public readonly List<string> Popups = new List<string>(), Emails = new List<string>();
        public void ShowPopup(string caption, string message, PopupNotificationState state) { Popups.Add(message); }
        public void SendEmail(string from, string to, string subject, string text) { Emails.Add(subject + " | " + text); }
    }

    public sealed class HttpResponse { public bool IsSuccessful { get; internal set; } public int StatusCode { get; internal set; } public string Body { get; internal set; } }
    public sealed class Http
    {
        public readonly List<string> Urls = new List<string>();
        public HttpResponse Get(string uri) { Urls.Add(uri); return new HttpResponse { IsSuccessful = true, StatusCode = 200, Body = "{}" }; }
    }

    public abstract class Indicator
    {
        public Bars Bars { get; internal set; } = new Bars();
        public TimeFrame TimeFrame { get; set; } = TimeFrame.Minute5;
        public MarketData MarketData { get; } = new MarketData();
        public Notifications Notifications { get; } = new Notifications();
        public Http Http { get; } = new Http();
        public string SymbolName { get { return "XAUUSD"; } }
        public Chart Chart { get; internal set; } = new Chart();
        public Symbol Symbol { get; internal set; } = new Symbol();
        public bool IsLastBar { get; internal set; }
        protected virtual void Initialize() { }
        public abstract void Calculate(int index);
        public void Print(string s) { Console.WriteLine(s); }
        public void TestInit() { Initialize(); }
        public void TestSetLast(bool v) { IsLastBar = v; }
    }
}
