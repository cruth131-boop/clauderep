// Führt XauM2SignalGenerator (unveränderter Quelltext) über historische Kerzen aus
// und schreibt alle Signale als CSV.
//
//   dotnet run -c Release -- --bars m2.csv [--ticks m1.csv] [--live] [--tf Minute2]
//                            [--spread 0.20] [--out signals.csv] [Param=Wert ...]
//
// --live simuliert den Echtzeitbetrieb: jede Kerze wird zuerst unfertig (erste M1-Kerze)
// und dann fertig an Calculate() übergeben, IsLastBar ist immer true. So lässt sich
// prüfen, dass Live- und Historienmodus identische Signale liefern (kein Repainting).

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using cAlgo.API;
using cAlgo.API.Indicators;
using cAlgo.API.Internals;

namespace Harness
{
    internal sealed class Store
    {
        public DateTime[] T; public double[] O, H, L, C;
        public int Count;          // sichtbare Kerzen
        public double PO, PH, PL, PC; public bool Partial; // unfertige letzte Kerze

        public static Store Load(string path)
        {
            var t = new List<DateTime>(); var o = new List<double>(); var h = new List<double>(); var l = new List<double>(); var c = new List<double>();
            foreach (var line in File.ReadLines(path))
            {
                var p = line.Split(',');
                t.Add(DateTime.ParseExact(p[0], "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture));
                o.Add(double.Parse(p[1], CultureInfo.InvariantCulture)); h.Add(double.Parse(p[2], CultureInfo.InvariantCulture));
                l.Add(double.Parse(p[3], CultureInfo.InvariantCulture)); c.Add(double.Parse(p[4], CultureInfo.InvariantCulture));
            }
            return new Store { T = t.ToArray(), O = o.ToArray(), H = h.ToArray(), L = l.ToArray(), C = c.ToArray() };
        }

        public double Get(double[] a, char f, int i)
        {
            if (i < 0) return double.NaN;
            if (i >= Count) throw new InvalidOperationException($"Lookahead: Zugriff auf Kerze {i}, sichtbar sind {Count}");
            if (Partial && i == Count - 1) return f switch { 'o' => PO, 'h' => PH, 'l' => PL, _ => PC };
            return a[i];
        }
    }

    internal sealed class PriceSeries : DataSeries
    {
        private readonly Store _s; private readonly double[] _a; private readonly char _f;
        public PriceSeries(Store s, double[] a, char f) { _s = s; _a = a; _f = f; }
        public double this[int index] => _s.Get(_a, _f, index);
        public int Count => _s.Count;
        public double LastValue => this[Count - 1];
        public double Last(int i) => this[Count - 1 - i];
    }

    internal sealed class Times : TimeSeries
    {
        private readonly Store _s;
        public Times(Store s) { _s = s; }
        public DateTime this[int i] { get { if (i >= _s.Count) throw new InvalidOperationException("Lookahead (Zeit)"); return _s.T[i]; } }
        public int Count => _s.Count;
        public DateTime LastValue => this[Count - 1];
    }

    internal sealed class MockBars : Bars
    {
        public MockBars(Store s)
        {
            S = s; OpenPrices = new PriceSeries(s, s.O, 'o'); HighPrices = new PriceSeries(s, s.H, 'h');
            LowPrices = new PriceSeries(s, s.L, 'l'); ClosePrices = new PriceSeries(s, s.C, 'c'); OpenTimes = new Times(s);
        }
        public Store S { get; }
        public DataSeries OpenPrices { get; } public DataSeries HighPrices { get; } public DataSeries LowPrices { get; }
        public DataSeries ClosePrices { get; } public TimeSeries OpenTimes { get; }
        public int Count => S.Count;
    }

    internal sealed class Series : IndicatorDataSeries
    {
        private readonly List<double> _v = new List<double>();
        public double this[int index]
        {
            get => index >= 0 && index < _v.Count ? _v[index] : double.NaN;
            set { while (_v.Count <= index) _v.Add(double.NaN); _v[index] = value; }
        }
        public int Count => _v.Count;
        public double LastValue => this[Count - 1];
        public double Last(int i) => this[Count - 1 - i];
    }

    // Berechnete Reihe: Werte der fertigen Kerzen werden gecacht, die letzte (evtl. unfertige) neu berechnet.
    internal abstract class Lazy : IndicatorDataSeries
    {
        protected readonly Store S; private readonly List<double> _cache = new List<double>();
        protected Lazy(Store s) { S = s; }
        protected abstract double Compute(int i, double prev);
        public double this[int index]
        {
            get
            {
                if (index < 0) return double.NaN;
                if (index >= S.Count) throw new InvalidOperationException("Lookahead (Indikator)");
                int finalCount = S.Partial ? S.Count - 1 : S.Count;
                while (_cache.Count < Math.Min(index + 1, finalCount))
                    _cache.Add(Compute(_cache.Count, _cache.Count > 0 ? _cache[_cache.Count - 1] : double.NaN));
                if (index < _cache.Count) return _cache[index];
                return Compute(index, index > 0 ? this[index - 1] : double.NaN);
            }
            set => throw new NotSupportedException();
        }
        public int Count => S.Count;
        public double LastValue => this[Count - 1];
        public double Last(int i) => this[Count - 1 - i];
        protected double Val(char f, int i) => S.Get(f == 'h' ? S.H : f == 'l' ? S.L : f == 'o' ? S.O : S.C, f, i);
    }

    internal sealed class AtrImpl : Lazy, AverageTrueRange
    {
        private readonly int _n;
        public AtrImpl(Store s, int n) : base(s) { _n = n; }
        public IndicatorDataSeries Result => this;
        private double Tr(int i) => i == 0 ? Val('h', 0) - Val('l', 0)
            : Math.Max(Val('h', i) - Val('l', i), Math.Max(Math.Abs(Val('h', i) - Val('c', i - 1)), Math.Abs(Val('l', i) - Val('c', i - 1))));
        protected override double Compute(int i, double prev)
        {
            if (i < _n - 1) return double.NaN;
            if (i == _n - 1) { double s = 0; for (int k = 0; k < _n; k++) s += Tr(k); return s / _n; }
            return prev + (Tr(i) - prev) / _n;
        }
    }

    internal sealed class EmaImpl : Lazy, ExponentialMovingAverage
    {
        private readonly DataSeries _src; private readonly double _k;
        public EmaImpl(Store s, DataSeries src, int n) : base(s) { _src = src; _k = 2.0 / (n + 1); }
        public IndicatorDataSeries Result => this;
        protected override double Compute(int i, double prev) => i == 0 || double.IsNaN(prev) ? _src[i] : prev + _k * (_src[i] - prev);
    }

    internal sealed class RsiImpl : Lazy, RelativeStrengthIndex
    {
        private readonly DataSeries _src; private readonly int _n;
        private readonly List<double> _up = new List<double>(), _dn = new List<double>();
        public RsiImpl(Store s, DataSeries src, int n) : base(s) { _src = src; _n = n; }
        public IndicatorDataSeries Result => this;
        protected override double Compute(int i, double prev)
        {
            // Wilder-Glättung von Gewinnen/Verlusten (entspricht cTrader-RSI)
            double ch = i == 0 ? 0 : _src[i] - _src[i - 1];
            double pu = i == 0 ? 0 : AvgUp(i - 1), pd = i == 0 ? 0 : AvgDn(i - 1);
            double u = i == 0 ? 0 : pu + (Math.Max(ch, 0) - pu) / _n;
            double d = i == 0 ? 0 : pd + (Math.Max(-ch, 0) - pd) / _n;
            if (i < _up.Count) { _up[i] = u; _dn[i] = d; } else { _up.Add(u); _dn.Add(d); }
            if (i < _n) return double.NaN;
            return d == 0 ? 100 : 100 - 100 / (1 + u / d);
        }
        private double AvgUp(int i) { _ = this[i]; return _up[i]; }
        private double AvgDn(int i) { _ = this[i]; return _dn[i]; }
    }

    internal sealed class Accessor : IIndicatorsAccessor
    {
        private readonly Store _s;
        public Accessor(Store s) { _s = s; }
        public AverageTrueRange AverageTrueRange(int periods, MovingAverageType maType) => new AtrImpl(_s, periods);
        public ExponentialMovingAverage ExponentialMovingAverage(DataSeries source, int periods) => new EmaImpl(_s, source, periods);
        public RelativeStrengthIndex RelativeStrengthIndex(DataSeries source, int periods) => new RsiImpl(_s, source, periods);
    }

    internal sealed class Sym : Symbol
    {
        public string Name => "XAUUSD"; public int Digits => 2; public double PipSize => 0.01; public double TickSize => 0.01;
        public double Spread { get; set; } = 0.20; public double Bid => 0; public double Ask => 0;
    }

    internal sealed class Notes : INotifications
    {
        public readonly List<string> Popups = new List<string>();
        public void ShowPopup(string caption, string message, PopupNotificationState state) => Popups.Add(message);
        public void SendEmail(string from, string to, string subject, string text) { }
        public void PlaySound(SoundType type) { }
    }

    internal static class Program
    {
        private static int Main(string[] args)
        {
            string bars = null, ticks = null, outPath = "signals.csv", tf = "Minute2", typeName = "cAlgo.Indicators.XauM2SignalGenerator";
            bool live = false; double spread = 0.20;
            var sets = new Dictionary<string, string>();
            for (int a = 0; a < args.Length; a++)
            {
                switch (args[a])
                {
                    case "--bars": bars = args[++a]; break;
                    case "--ticks": ticks = args[++a]; break;
                    case "--out": outPath = args[++a]; break;
                    case "--tf": tf = args[++a]; break;
                    case "--live": live = true; break;
                    case "--spread": spread = double.Parse(args[++a], CultureInfo.InvariantCulture); break;
                    default:
                        int eq = args[a].IndexOf('=');
                        if (eq <= 0) { Console.Error.WriteLine("Unbekanntes Argument " + args[a]); return 2; }
                        sets[args[a].Substring(0, eq)] = args[a].Substring(eq + 1); break;
                }
            }

            var store = Store.Load(bars);
            Dictionary<DateTime, int> m1Index = null; Store m1 = null;
            if (live)
            {
                m1 = Store.Load(ticks);
                m1Index = new Dictionary<DateTime, int>();
                for (int k = 0; k < m1.T.Length; k++) m1Index[m1.T[k]] = k;
            }

            var type = Assembly.GetExecutingAssembly().GetType(typeName);
            var ind = (Indicator)Activator.CreateInstance(type);
            var notes = new Notes();
            var chart = new Chart();
            var signalBars = new List<(int bar, string text)>();
            ind.Bars = new MockBars(store); ind.Chart = chart; ind.Symbol = new Sym { Spread = spread };
            ind.TimeFrame = TimeFrame.FromName(tf); ind.Notifications = notes; ind.Indicators = new Accessor(store);
            ind.SeriesFactory = () => new Series();
            ind.PrintSink = _ => { };

            foreach (var p in type.GetProperties())
            {
                var pa = p.GetCustomAttribute<ParameterAttribute>();
                if (pa != null)
                {
                    object v = pa.DefaultValue;
                    string key = sets.Keys.FirstOrDefault(k => k == p.Name || k == pa.Name);
                    if (key != null) { v = sets[key]; sets.Remove(key); }
                    p.SetValue(ind, Convert.ChangeType(v ?? "", p.PropertyType, CultureInfo.InvariantCulture));
                }
                else if (p.GetCustomAttribute<OutputAttribute>() != null)
                    p.SetValue(ind, new Series());
            }
            if (sets.Count > 0) { Console.Error.WriteLine("Unbekannte Parameter: " + string.Join(", ", sets.Keys)); return 2; }

            store.Count = 0;
            ind.InvokeInitialize();
            for (int i = 0; i < store.T.Length; i++)
            {
                store.Count = i + 1;
                if (live && m1Index.TryGetValue(store.T[i], out int k) && (m1.H[k] != store.H[i] || m1.L[k] != store.L[i] || m1.C[k] != store.C[i]))
                {
                    store.Partial = true; store.PO = m1.O[k]; store.PH = m1.H[k]; store.PL = m1.L[k]; store.PC = m1.C[k];
                    ind.IsLastBar = true;
                    ind.Calculate(i);
                }
                store.Partial = false;
                ind.IsLastBar = live || i == store.T.Length - 1;
                ind.Calculate(i);
            }

            // Signale: bevorzugt über die öffentliche SignalLog-Liste des Indikators
            var logProp = type.GetProperty("SignalLog");
            using (var w = new StreamWriter(outPath))
            {
                if (logProp != null)
                {
                    var list = (System.Collections.IEnumerable)logProp.GetValue(ind);
                    var props = list.GetType().GetGenericArguments()[0].GetProperties();
                    w.WriteLine(string.Join(",", props.Select(p => p.Name)));
                    foreach (var r in list)
                        w.WriteLine(string.Join(",", props.Select(p => Format(p.GetValue(r)))));
                }
                else
                {
                    w.WriteLine("BarIndex,Time,Direction,Entry,StopLoss,TakeProfit");
                    foreach (var kv in chart.Objects.Where(o => o.Key.StartsWith("sig_")))
                    {
                        var txt = ((ChartText)kv.Value).Text.Split('\n');
                        var t = new DateTime(long.Parse(kv.Key.Substring(4)));
                        int bi = Array.BinarySearch(store.T, t);
                        int dir = txt[0] == "KAUF" ? 1 : -1;
                        w.WriteLine($"{bi},{t:yyyy-MM-dd HH:mm:ss},{dir},{Format(store.C[bi])},{txt[1].Substring(3)},{txt[2].Substring(3)}");
                    }
                }
            }
            Console.WriteLine($"Kerzen={store.T.Length} Popups={notes.Popups.Count} Chartobjekte={chart.Objects.Count}");
            return 0;
        }

        private static string Format(object v) => v switch
        {
            DateTime d => d.ToString("yyyy-MM-dd HH:mm:ss"),
            double x => x.ToString("R", CultureInfo.InvariantCulture),
            null => "",
            _ => Convert.ToString(v, CultureInfo.InvariantCulture)
        };
    }
}
