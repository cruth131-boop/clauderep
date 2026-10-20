// Offline test of SwingPointsStructure on real XAUUSD M15 candles (ejtraderLabs/historical-data, broker time -> UTC).
//   SwingTest --m15 XAUUSDm15.csv --from 2021-01-01 --to 2022-01-01 [--set Name=Value ...] [--dump out.csv --window 160]
// Checks: swing pivots vs. a brute-force reference, label rules, alternation, level breaks, chart object limits;
// dumps the last bars plus all chart objects for the SVG preview (render_svg.py).
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using cAlgo.API;
using cAlgo.Indicators;

public static class Program
{
    public static int Main(string[] args)
    {
        string m15 = null, dump = null;
        DateTime from = new DateTime(2021, 1, 1), to = new DateTime(2022, 1, 1);
        int window = 160;
        var sets = new List<string[]>();
        for (int a = 0; a < args.Length; a++)
        {
            switch (args[a])
            {
                case "--m15": m15 = args[++a]; break;
                case "--from": from = DateTime.Parse(args[++a], CultureInfo.InvariantCulture); break;
                case "--to": to = DateTime.Parse(args[++a], CultureInfo.InvariantCulture); break;
                case "--dump": dump = args[++a]; break;
                case "--window": window = int.Parse(args[++a]); break;
                case "--set": sets.Add(args[++a].Split(new[] { '=' }, 2)); break;
                default: throw new ArgumentException(args[a]);
            }
        }
        var bars = LoadM15(m15, from, to);
        Console.WriteLine("bars: " + bars.Count + " (" + bars[0].Item1.ToString("yyyy-MM-dd") + " .. " + bars[bars.Count - 1].Item1.ToString("yyyy-MM-dd") + ")");

        var ind = new SwingPointsStructure();
        ApplyDefaults(ind, sets);
        ind.TestInit();
        int liveFrom = bars.Count - 400;   // the last 400 candles are replayed "live" (IsLastBar, two calls per candle)
        for (int i = 0; i < bars.Count; i++)
        {
            var b = bars[i];
            ind.Bars.Add(b.Item1, b.Item2, b.Item3, b.Item4, b.Item5);
            bool live = i >= liveFrom;
            ind.TestSetLast(live);
            ind.Calculate(i);
            if (live) ind.Calculate(i);
        }

        var engine = (SwingEngine)typeof(SwingPointsStructure).GetField("_engine", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(ind);
        int failures = Check(ind, engine, bars);
        if (dump != null) Dump(ind, bars, window, dump);
        Console.WriteLine(failures == 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED");
        return failures == 0 ? 0 : 1;
    }

    private static int Check(SwingPointsStructure ind, SwingEngine engine, List<Tuple<DateTime, double, double, double, double>> bars)
    {
        int fail = 0;
        int left = ind.LeftBars, right = ind.RightBars, lastClosed = bars.Count - 2;
        var sw = engine.Swings;
        Console.WriteLine("swings: " + sw.Count + " (" + sw.Count(s => s.IsHigh) + " highs, " + sw.Count(s => !s.IsHigh) + " lows), labels: " +
            string.Join(", ", sw.GroupBy(s => s.Label).OrderBy(g => g.Key).Select(g => g.Key + "=" + g.Count())));

        // 1) every swing is a fractal pivot (strict left, non-exceeded right) on closed candles
        foreach (var s in sw)
        {
            double v = s.IsHigh ? bars[s.Index].Item3 : bars[s.Index].Item4;
            bool ok = s.Index - left >= 0 && s.Index + right <= lastClosed;
            for (int j = s.Index - left; ok && j < s.Index; j++) ok = s.IsHigh ? bars[j].Item3 < v : bars[j].Item4 > v;
            for (int j = s.Index + 1; ok && j <= s.Index + right; j++) ok = s.IsHigh ? bars[j].Item3 <= v : bars[j].Item4 >= v;
            if (!ok) { fail++; Console.WriteLine("  not a pivot: " + s.Index + " " + s.Label); break; }
        }
        // 2) without alternation and filters the engine finds exactly the brute-force pivots
        if (!ind.Alternate && ind.MinSwingAtr == 0)
        {
            var bf = new List<string>();
            for (int p = left; p + right <= lastClosed; p++)
                foreach (bool hi in new[] { true, false })
                {
                    double v = hi ? bars[p].Item3 : bars[p].Item4;
                    bool ok = true;
                    for (int j = p - left; ok && j < p; j++) ok = hi ? bars[j].Item3 < v : bars[j].Item4 > v;
                    for (int j = p + 1; ok && j <= p + right; j++) ok = hi ? bars[j].Item3 <= v : bars[j].Item4 >= v;
                    if (ok) bf.Add(p + (hi ? "H" : "L"));
                }
            var en = sw.Select(s => s.Index + (s.IsHigh ? "H" : "L")).ToList();
            bool same = new HashSet<string>(bf).SetEquals(en);
            Console.WriteLine("brute-force pivots " + bf.Count + ", engine " + en.Count + ": " + (same ? "identical" : "DIFFERENT"));
            if (!same) fail++;
        }
        // 3) alternation
        if (ind.Alternate)
        {
            int bad = 0;
            for (int k = 1; k < sw.Count; k++) if (sw[k].IsHigh == sw[k - 1].IsHigh) bad++;
            Console.WriteLine("alternation violations: " + bad);
            if (bad > 0) fail++;
        }
        // 4) labels against the previous swing of the same side
        int labelBad = 0;
        for (int k = 0; k < sw.Count; k++)
        {
            Swing prev = null;
            for (int j = k - 1; j >= 0; j--) if (sw[j].IsHigh == sw[k].IsHigh) { prev = sw[j]; break; }
            if (prev == null) continue;
            string l = sw[k].Label;
            bool eq = l == "EQH" || l == "EQL";
            if (eq) continue;
            bool ok = sw[k].IsHigh ? (l == "HH") == (sw[k].Price > prev.Price) : (l == "LL") == (sw[k].Price < prev.Price);
            if (!ok) labelBad++;
        }
        Console.WriteLine("label rule violations: " + labelBad);
        if (labelBad > 0) fail++;
        // 5) active levels: no close beyond them since they formed
        int lvBad = 0, active = 0;
        foreach (bool hi in new[] { true, false })
            foreach (var l in engine.ActiveLevels(hi))
            {
                active++;
                for (int j = l.Index + 1; j <= lastClosed; j++)
                    if (hi ? bars[j].Item5 > l.Price : bars[j].Item5 < l.Price) { lvBad++; break; }
            }
        Console.WriteLine("active levels " + active + ", closed through but still active: " + lvBad);
        if (lvBad > 0) fail++;
        // 6) chart object budget
        int labels = ind.Chart.Objects.Keys.Count(k => k.StartsWith("SPS_lb_"));
        Console.WriteLine("replaced swings (label shown, later removed by a more extreme swing of the same side): " + engine.Replacements);
        int cap = 5 * ind.MaxLabels + 4 * ind.LevelsPerSide + 1;   // labels, sweeps, broken levels, 2 per break; live levels with text; table
        if (ind.Chart.Objects.Count > cap) { fail++; Console.WriteLine("  too many chart objects, cap " + cap); }
        Console.WriteLine("chart objects " + ind.Chart.Objects.Count + " (labels " + labels + ", max " + ind.MaxLabels + "), draws " + ind.Chart.Draws + ", removes " + ind.Chart.Removes);
        if (labels > ind.MaxLabels) fail++;
        int removed = ind.Chart.Removes;
        var table = ind.Chart.Objects.Values.OfType<ChartStaticText>().FirstOrDefault();
        Console.WriteLine("table:\n  " + (table == null ? "-" : table.Text.Replace("\n", "\n  ")) + "\n  colour " + (table == null ? "" : table.Color.ToString()));
        return fail;
    }

    private static void Dump(SwingPointsStructure ind, List<Tuple<DateTime, double, double, double, double>> bars, int window, string path)
    {
        int start = bars.Count - window;
        using (var w = new StreamWriter(path))
        {
            for (int i = start; i < bars.Count; i++)
                w.WriteLine(string.Join(",", "bar", i, bars[i].Item1.ToString("yyyy-MM-dd HH:mm"), F(bars[i].Item2), F(bars[i].Item3), F(bars[i].Item4), F(bars[i].Item5)));
            foreach (var o in ind.Chart.Objects.Values)
            {
                var t = o as ChartText; var l = o as ChartTrendLine; var s = o as ChartStaticText;
                if (t != null && t.BarIndex >= start) w.WriteLine(string.Join(",", "text", t.BarIndex, F(t.Y), t.Text, t.Color, t.VerticalAlignment, t.HorizontalAlignment));
                if (l != null && l.Index2 >= start) w.WriteLine(string.Join(",", "line", l.Index1, F(l.Y1), l.Index2, F(l.Y2), l.Color, l.LineStyle));
                if (s != null) w.WriteLine(string.Join(",", "static", s.Text.Replace("\n", "|"), s.Color));
            }
        }
    }

    private static string F(double v) { return v.ToString("0.00", CultureInfo.InvariantCulture); }

    private static void ApplyDefaults(object ind, List<string[]> sets)
    {
        foreach (var p in ind.GetType().GetProperties())
        {
            var a = p.GetCustomAttribute<ParameterAttribute>();
            if (a == null) continue;
            object def = a.DefaultValue;
            var kv = sets.FirstOrDefault(x => x[0] == p.Name);
            if (kv != null) def = kv[1];
            p.SetValue(ind, Convert(def, p.PropertyType));
        }
        foreach (var p in ind.GetType().GetProperties().Where(x => x.PropertyType == typeof(IndicatorDataSeries)))
            p.SetValue(ind, new IndicatorDataSeries());
    }

    private static object Convert(object v, Type t)
    {
        if (t == typeof(Color)) return Color.FromName((string)v);
        if (t.IsEnum) return v is string ? Enum.Parse(t, (string)v) : Enum.ToObject(t, v);
        return System.Convert.ChangeType(v, t, CultureInfo.InvariantCulture);
    }

    // broker clock = NY + 7 h (UTC+3 in US DST, UTC+2 otherwise), prices x100 in the source
    private static List<Tuple<DateTime, double, double, double, double>> LoadM15(string path, DateTime from, DateTime to)
    {
        var r = new List<Tuple<DateTime, double, double, double, double>>();
        foreach (var line in File.ReadLines(path).Skip(1))
        {
            var f = line.Split(',');
            DateTime t = DateTime.ParseExact(f[0], "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
            DateTime u = t.AddHours(-3);
            if (!UsDst(u)) u = t.AddHours(-2);
            if (u < from || u >= to) continue;
            double o = double.Parse(f[1], CultureInfo.InvariantCulture) / 100, h = double.Parse(f[2], CultureInfo.InvariantCulture) / 100,
                   l = double.Parse(f[3], CultureInfo.InvariantCulture) / 100, c = double.Parse(f[4], CultureInfo.InvariantCulture) / 100;
            if (h < Math.Max(o, c) || l > Math.Min(o, c)) continue;
            r.Add(Tuple.Create(u, o, h, l, c));
        }
        return r;
    }

    private static bool UsDst(DateTime t)
    {
        Func<int, int, int, DateTime> nth = (y, m, n) => { var d = new DateTime(y, m, 1); d = d.AddDays((7 - (int)d.DayOfWeek) % 7); return d.AddDays(7 * (n - 1)); };
        return t >= nth(t.Year, 3, 2).AddHours(7) && t < nth(t.Year, 11, 1).AddHours(6);
    }
}
