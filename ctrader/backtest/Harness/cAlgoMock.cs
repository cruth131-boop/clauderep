// Minimaler Nachbau der cTrader-Automate-API (cAlgo.API), gerade genug, um
// XauM2SignalGenerator.cs unverändert außerhalb von cTrader auszuführen.
// Signaturen entsprechen cTrader.Automate 1.0.21. Zugriffe auf Kerzen, die
// "in der Zukunft" liegen, lösen eine Exception aus – so fällt Lookahead sofort auf.

using System;
using System.Collections.Generic;

namespace cAlgo.API
{
    public enum TimeZones { UTC }
    public enum AccessRights { None, FullAccess }
    public enum PlotType { Line, Points, Histogram, DiscontinuousLine }
    public enum LineStyle { Solid, Dots, DotsRare, DotsVeryRare, Lines, LinesDots }
    public enum MovingAverageType { Simple, Exponential, WilderSmoothing }
    public enum HorizontalAlignment { Left, Center, Right }
    public enum VerticalAlignment { Top, Center, Bottom }
    public enum PopupNotificationState { InProgress, Success, Error, Partial, Information }
    public enum SoundType { Announcement, Buzzer, Confirmation, DoorBell, Error, PositiveNotification, NegativeNotification }

    [AttributeUsage(AttributeTargets.Class)]
    public sealed class IndicatorAttribute : Attribute
    {
        public bool IsOverlay { get; set; }
        public TimeZones TimeZone { get; set; }
        public AccessRights AccessRights { get; set; }
    }

    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ParameterAttribute : Attribute
    {
        public ParameterAttribute() { }
        public ParameterAttribute(string name) { Name = name; }
        public string Name { get; }
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
        public string Name { get; }
        public string LineColor { get; set; }
        public PlotType PlotType { get; set; }
        public LineStyle LineStyle { get; set; }
        public float Thickness { get; set; }
    }

    public sealed class Color
    {
        private readonly string _name;
        private Color(string name) { _name = name; }
        public static Color FromHex(string hex) => new Color(hex);
        public static Color FromArgb(int a, int r, int g, int b) => new Color($"#{a:X2}{r:X2}{g:X2}{b:X2}");
        public static Color FromArgb(int a, Color c) => new Color($"{a}:{c}");
        public static Color Lime => new Color("Lime");
        public static Color Red => new Color("Red");
        public static Color Orange => new Color("Orange");
        public static Color DodgerBlue => new Color("DodgerBlue");
        public static Color Gray => new Color("Gray");
        public static Color White => new Color("White");
        public static Color Gold => new Color("Gold");
        public static Color Yellow => new Color("Yellow");
        public static Color Silver => new Color("Silver");
        public static Color LimeGreen => new Color("LimeGreen");
        public static Color Tomato => new Color("Tomato");
        public static Color DarkGoldenrod => new Color("DarkGoldenrod");
        public override string ToString() => _name;
    }

    public sealed class TimeFrame
    {
        private readonly string _name;
        private TimeFrame(string name) { _name = name; }
        public static readonly TimeFrame Minute = new TimeFrame("Minute");
        public static readonly TimeFrame Minute2 = new TimeFrame("Minute2");
        public static readonly TimeFrame Minute3 = new TimeFrame("Minute3");
        public static readonly TimeFrame Minute5 = new TimeFrame("Minute5");
        public static readonly TimeFrame Minute15 = new TimeFrame("Minute15");
        public static TimeFrame FromName(string n) => n switch { "Minute" => Minute, "Minute3" => Minute3, "Minute5" => Minute5, "Minute15" => Minute15, _ => Minute2 };
        public override string ToString() => _name;
    }

    public interface DataSeries
    {
        double this[int index] { get; }
        int Count { get; }
        double LastValue { get; }
        double Last(int index);
    }

    public interface IndicatorDataSeries : DataSeries
    {
        new double this[int index] { get; set; }
    }

    public interface TimeSeries
    {
        DateTime this[int index] { get; }
        int Count { get; }
        DateTime LastValue { get; }
    }

    public interface Bars
    {
        DataSeries OpenPrices { get; }
        DataSeries HighPrices { get; }
        DataSeries LowPrices { get; }
        DataSeries ClosePrices { get; }
        TimeSeries OpenTimes { get; }
        int Count { get; }
    }

    public class ChartText
    {
        public string Text { get; set; }
        public HorizontalAlignment HorizontalAlignment { get; set; }
        public VerticalAlignment VerticalAlignment { get; set; }
        public double FontSize { get; set; }
        public bool IsBold { get; set; }
    }

    public class ChartStaticText
    {
        public string Text { get; set; }
        public double FontSize { get; set; }
        public string FontFamily { get; set; }
    }

    public class ChartTrendLine
    {
        public LineStyle LineStyle { get; set; }
        public int Thickness { get; set; }
        public bool ShowAngle { get; set; }
    }

    public class Chart
    {
        public readonly Dictionary<string, object> Objects = new Dictionary<string, object>();
        public ChartText DrawText(string name, string text, int barIndex, double y, Color color) { var t = new ChartText { Text = text }; Objects[name] = t; return t; }
        public ChartStaticText DrawStaticText(string name, string text, VerticalAlignment v, HorizontalAlignment h, Color color) { var t = new ChartStaticText { Text = text }; Objects[name] = t; return t; }
        public ChartTrendLine DrawTrendLine(string name, int i1, double y1, int i2, double y2, Color color, int thickness, LineStyle style) { var l = new ChartTrendLine { LineStyle = style, Thickness = thickness }; Objects[name] = l; return l; }
        public ChartTrendLine DrawTrendLine(string name, int i1, double y1, int i2, double y2, Color color) => DrawTrendLine(name, i1, y1, i2, y2, color, 1, LineStyle.Solid);
        public ChartTrendLine DrawTrendLine(string name, DateTime t1, double y1, DateTime t2, double y2, Color color, int thickness, LineStyle style) { var l = new ChartTrendLine { LineStyle = style, Thickness = thickness }; Objects[name] = l; return l; }
        public bool RemoveObject(string name) => Objects.Remove(name);
    }
}

namespace cAlgo.API.Internals
{
    using cAlgo.API.Indicators;

    public interface Symbol
    {
        string Name { get; }
        int Digits { get; }
        double PipSize { get; }
        double TickSize { get; }
        double Spread { get; }
        double Bid { get; }
        double Ask { get; }
    }

    public interface INotifications
    {
        void ShowPopup(string caption, string message, PopupNotificationState state);
        void SendEmail(string from, string to, string subject, string text);
        void PlaySound(SoundType type);
    }

    public interface IIndicatorsAccessor
    {
        AverageTrueRange AverageTrueRange(int periods, MovingAverageType maType);
        ExponentialMovingAverage ExponentialMovingAverage(DataSeries source, int periods);
        RelativeStrengthIndex RelativeStrengthIndex(DataSeries source, int periods);
    }

    public abstract class Algo
    {
        public Bars Bars { get; internal set; }
        public Chart Chart { get; internal set; }
        public Symbol Symbol { get; internal set; }
        public string SymbolName => Symbol.Name;
        public TimeFrame TimeFrame { get; internal set; }
        public INotifications Notifications { get; internal set; }
        public IIndicatorsAccessor Indicators { get; internal set; }
        public Action<string> PrintSink { get; set; } = Console.Error.WriteLine;
        public void Print(string message, params object[] args) => PrintSink(args.Length == 0 ? message : string.Format(message, args));
        public void Print(object message) => PrintSink(message?.ToString());
    }
}

namespace cAlgo.API
{
    using cAlgo.API.Internals;

    public abstract class Indicator : Algo
    {
        public bool IsLastBar { get; internal set; }
        internal Func<IndicatorDataSeries> SeriesFactory { get; set; }
        protected IndicatorDataSeries CreateDataSeries() => SeriesFactory();
        protected virtual void Initialize() { }
        public abstract void Calculate(int index);
        internal void InvokeInitialize() => Initialize();
    }
}

namespace cAlgo.API.Indicators
{
    public interface AverageTrueRange { IndicatorDataSeries Result { get; } }
    public interface ExponentialMovingAverage { IndicatorDataSeries Result { get; } }
    public interface RelativeStrengthIndex { IndicatorDataSeries Result { get; } }
}
