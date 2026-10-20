// Offline test of SwingPointsStructure v2.
//   SwingTest --m15 XAUUSDm15.csv [--from 2021-01-01 --to 2022-01-01]         real M15 candles, chart M15 = structure M15
//   SwingTest --m1 xau_m1.csv --chart Minute --structure Minute5 [...]          M1 chart with M5 structure (+ H1/H4 layers)
//   common: [--set Name=Value ...] [--live 400] [--dump out.csv --window 160]
// Checks: swing pivots vs. brute force, label rules, alternation, active zones never closed through, no look-ahead of any layer,
// the M5 structure on an M1 chart equals a standalone engine on the M5 candles, alerts only for live candles, object limits.
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
    private sealed class Bar { public DateTime T; public double O, H, L, C; }

    public static int Main(string[] args)
    {
        string m15 = null, m1 = null, dump = null;
        DateTime from = new DateTime(2021, 1, 1), to = new DateTime(2022, 1, 1);
        int window = 160, live = 400;
        TimeFrame chart = null, structure = null;
        var sets = new List<string[]>();
        for (int a = 0; a < args.Length; a++)
        {
            switch (args[a])
            {
                case "--m15": m15 = args[++a]; break;
                case "--m1": m1 = args[++a]; break;
                case "--from": from = DateTime.Parse(args[++a], CultureInfo.InvariantCulture); break;
                case "--to": to = DateTime.Parse(args[++a], CultureInfo.InvariantCulture); break;
                case "--chart": chart = TimeFrame.Parse(args[++a]); break;
                case "--structure": structure = TimeFrame.Parse(args[++a]); break;
                case "--dump": dump = args[++a]; break;
                case "--window": window = int.Parse(args[++a]); break;
                case "--live": live = int.Parse(args[++a]); break;
                case "--set": sets.Add(args[++a].Split(new[] { '=' }, 2)); break;
                default: throw new ArgumentException(args[a]);
            }
        }
        List<Bar> baseBars = m15 != null ? LoadM15(m15, from, to) : LoadM1(m1, from, to);
        TimeFrame baseTf = m15 != null ? TimeFrame.Minute15 : TimeFrame.Minute;
        chart = chart ?? baseTf;
        structure = structure ?? (m15 != null ? TimeFrame.Minute15 : TimeFrame.Minute5);
        Console.WriteLine("base candles: " + baseBars.Count + " " + baseTf + " (" + baseBars[0].T.ToString("yyyy-MM-dd") + " .. " + baseBars[baseBars.Count - 1].T.ToString("yyyy-MM-dd") + "), chart " + chart + ", structure " + structure);

        int fail = 0;
        var ind = Run(baseBars, baseTf, chart, structure, sets, live, ref fail);
        var main = Layer(ind, 0);
        Bars src = (Bars)Field(main, "_src");
        var engine = (SwingEngine)Field(main, "Engine");
        fail += CheckEngine(ind, engine, src);

        // the same structure computed standalone on the source candles (every closed one) must match exactly
        var solo = new SwingEngine(ind.LeftBars, ind.RightBars, ind.Alternate, ind.MinSwingAtr, ind.EqualToleranceAtr, ind.ZoneToleranceAtr, ind.AtrPeriod,
            ind.StructureMode, i => src.OpenPrices[i], i => src.HighPrices[i], i => src.LowPrices[i], i => src.ClosePrices[i]);
        for (int k = 0; k <= src.Count - 2; k++) solo.OnBarClosed(k);
        bool same = solo.Swings.Select(Sig).SequenceEqual(engine.Swings.Select(Sig)) && solo.Trend == engine.Trend;
        Console.WriteLine("indicator on " + chart + " chart vs standalone engine on " + structure + " candles: " + (same ? "identical" : "DIFFERENT"));
        if (!same) fail++;

        // alerts
        var n = ind.Notifications;
        Console.WriteLine("alerts (live part only): popups " + n.Popups.Count + ", e-mails " + n.Emails.Count + ", telegram " + ind.Http.Urls.Count);
        foreach (string p in n.Popups.Take(4)) Console.WriteLine("  " + p);
        DateTime liveSince = (DateTime)typeof(SwingPointsStructure).GetField("_liveSinceUtc", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(ind);
        Console.WriteLine("  live since " + liveSince.ToString("yyyy-MM-dd HH:mm"));
        var table = ind.Chart.Objects.Values.OfType<ChartStaticText>().FirstOrDefault();
        Console.WriteLine("table:\n  " + (table == null ? "-" : table.Text.Replace("\n", "\n  ")));
        if (dump != null) Dump(ind, window, dump);
        Console.WriteLine(fail == 0 ? "ALL CHECKS PASSED" : fail + " CHECK(S) FAILED");
        return fail == 0 ? 0 : 1;
    }

    private static string Sig(Swing s) { return s.Index + (s.IsHigh ? "H" : "L") + s.Label + s.Price.ToString("R", CultureInfo.InvariantCulture); }

    private static SwingPointsStructure Run(List<Bar> baseBars, TimeFrame baseTf, TimeFrame chartTf, TimeFrame structureTf, List<string[]> sets, int live, ref int fail)
    {
        var ind = new SwingPointsStructure();
        ApplyDefaults(ind, sets);
        ind.TimeFrame = chartTf;
        ind.StructureTimeFrame = structureTf;
        var series = new Dictionary<TimeFrame, Bars>();
        foreach (var tf in new[] { TimeFrame.Minute5, TimeFrame.Minute15, TimeFrame.Hour, TimeFrame.Hour4 })
            if (tf.Minutes >= baseTf.Minutes && tf != chartTf) { series[tf] = new Bars(); ind.MarketData.Series[tf] = series[tf]; }
        ind.Chart.IndexOf = t => ind.Bars.OpenTimes.GetIndexByTime(t);
        ind.TestInit();
        var layers = Layers(ind);
        int liveFrom = baseBars.Count - live * Math.Max(1, chartTf.Minutes / baseTf.Minutes);
        int lookAhead = 0;
        for (int i = 0; i < baseBars.Count; i++)
        {
            Bar b = baseBars[i];
            int before = ind.Bars.Count;
            ind.Bars.Merge(Floor(b.T, chartTf.Minutes), b.O, b.H, b.L, b.C);
            foreach (var kv in series) kv.Value.Merge(Floor(b.T, kv.Key.Minutes), b.O, b.H, b.L, b.C);
            bool newBar = ind.Bars.Count > before, isLive = i >= liveFrom;
            if (!newBar && !isLive) continue;   // history: one Calculate per chart candle; live: every base candle is a tick update
            int index = ind.Bars.Count - 1;
            ind.TestSetLast(isLive);
            ind.Calculate(index);
            // no layer may have processed a candle that is not closed at the time of this call
            DateTime now = isLive ? b.T.AddMinutes(baseTf.Minutes) : ind.Bars.OpenTimes[index];
            foreach (object l in layers)
            {
                int done = (int)Field(l, "_done");
                if (done < 0) continue;
                Bars s = (Bars)Field(l, "_src");
                int minutes = (int)Field(l, "_tfMinutes");
                if (s.OpenTimes[done].AddMinutes(minutes) > now) lookAhead++;
            }
        }
        Console.WriteLine("look-ahead violations (a layer used a candle that was not closed yet): " + lookAhead);
        if (lookAhead > 0) fail++;
        return ind;
    }

    private static int CheckEngine(SwingPointsStructure ind, SwingEngine engine, Bars src)
    {
        int fail = 0, left = ind.LeftBars, right = ind.RightBars, lastClosed = src.Count - 2;
        var sw = engine.Swings;
        Console.WriteLine("swings: " + sw.Count + ", labels: " + string.Join(", ", sw.GroupBy(s => s.Label).OrderBy(g => g.Key).Select(g => g.Key + "=" + g.Count())) +
                          ", replaced later: " + engine.Replacements);
        Func<int, bool, double> px = (i, hi) => hi ? src.HighPrices[i] : src.LowPrices[i];
        Func<int, bool, bool> pivot = (p, hi) =>
        {
            double v = px(p, hi);
            if (p - left < 0 || p + right > lastClosed) return false;
            for (int j = p - left; j < p; j++) if (hi ? px(j, true) >= v : px(j, false) <= v) return false;
            for (int j = p + 1; j <= p + right; j++) if (hi ? px(j, true) > v : px(j, false) < v) return false;
            return true;
        };
        int notPivot = sw.Count(s => !pivot(s.Index, s.IsHigh));
        Console.WriteLine("swings that are not pivots: " + notPivot);
        if (notPivot > 0) fail++;
        if (!ind.Alternate && ind.MinSwingAtr == 0)
        {
            var bf = new HashSet<string>();
            for (int p = 0; p <= lastClosed; p++) foreach (bool hi in new[] { true, false }) if (pivot(p, hi)) bf.Add(p + (hi ? "H" : "L"));
            bool same = bf.SetEquals(sw.Select(s => s.Index + (s.IsHigh ? "H" : "L")));
            Console.WriteLine("brute-force pivots " + bf.Count + " vs engine " + sw.Count + ": " + (same ? "identical" : "DIFFERENT"));
            if (!same) fail++;
        }
        if (ind.Alternate)
        {
            int bad = 0;
            for (int k = 1; k < sw.Count; k++) if (sw[k].IsHigh == sw[k - 1].IsHigh) bad++;
            Console.WriteLine("alternation violations: " + bad);
            if (bad > 0) fail++;
        }
        int labelBad = 0;
        for (int k = 0; k < sw.Count; k++)
        {
            Swing prev = null;
            for (int j = k - 1; j >= 0; j--) if (sw[j].IsHigh == sw[k].IsHigh) { prev = sw[j]; break; }
            string l = sw[k].Label;
            if (prev == null || l == "EQH" || l == "EQL") continue;
            if (sw[k].IsHigh ? (l == "HH") != (sw[k].Price > prev.Price) : (l == "LL") != (sw[k].Price < prev.Price)) labelBad++;
        }
        Console.WriteLine("label rule violations: " + labelBad);
        if (labelBad > 0) fail++;
        int zoneBad = 0, zones = 0, merged = 0;
        var byId = sw.ToDictionary(s => s.Id);
        foreach (bool hi in new[] { true, false })
            foreach (Zone z in engine.ActiveZones(hi))
            {
                zones++;
                if (z.Count > 1) merged++;
                int newest = z.SwingIds.Where(byId.ContainsKey).Select(id => byId[id].Index).DefaultIfEmpty(z.Index).Max();
                double edge = hi ? z.High : z.Low;
                for (int j = newest + 1; j <= lastClosed; j++)
                    if (hi ? src.ClosePrices[j] > edge : src.ClosePrices[j] < edge) { zoneBad++; break; }
            }
        Console.WriteLine("active zones " + zones + " (" + merged + " merged from equal swings), closed through but active: " + zoneBad);
        if (zoneBad > 0) fail++;
        int cap = 5 * ind.MaxLabels * 3 + 40;
        Console.WriteLine("chart objects " + ind.Chart.Objects.Count + " (cap " + cap + "), draws " + ind.Chart.Draws + ", removes " + ind.Chart.Removes);
        if (ind.Chart.Objects.Count > cap) fail++;
        return fail;
    }

    private static List<object> Layers(SwingPointsStructure ind)
    {
        var list = (System.Collections.IEnumerable)typeof(SwingPointsStructure).GetField("_layers", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(ind);
        return list.Cast<object>().ToList();
    }

    private static object Layer(SwingPointsStructure ind, int k) { return Layers(ind)[k]; }

    private static object Field(object o, string name)
    {
        var t = o.GetType();
        var f = t.GetField(name, BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
        return f.GetValue(o);
    }

    private static DateTime Floor(DateTime t, int minutes) { long span = TimeSpan.TicksPerMinute * minutes; return new DateTime(t.Ticks - t.Ticks % span); }

    private static void Dump(SwingPointsStructure ind, int window, string path)
    {
        var b = ind.Bars;
        int start = b.Count - window;
        Func<DateTime, int> ix = t => b.OpenTimes.GetIndexByTime(t);
        using (var w = new StreamWriter(path))
        {
            for (int i = start; i < b.Count; i++)
                w.WriteLine(string.Join(",", "bar", i, b.OpenTimes[i].ToString("yyyy-MM-dd HH:mm"), F(b.OpenPrices[i]), F(b.HighPrices[i]), F(b.LowPrices[i]), F(b.ClosePrices[i])));
            foreach (var o in ind.Chart.Objects.Values)
            {
                if (o is ChartText t && t.BarIndex >= start) w.WriteLine(string.Join(",", "text", t.BarIndex, F(t.Y), t.Text, t.Color, t.VerticalAlignment, t.HorizontalAlignment));
                if (o is ChartTrendLine l && l.Index2 >= start) w.WriteLine(string.Join(",", "line", l.Index1, F(l.Y1), l.Index2, F(l.Y2), l.Color, l.LineStyle));
                if (o is ChartRectangle r && ix(r.T2) >= start) w.WriteLine(string.Join(",", "rect", ix(r.T1), F(r.Y1), ix(r.T2), F(r.Y2), r.Color));
                if (o is ChartStaticText s) w.WriteLine(string.Join(",", "static", s.Text.Replace("\n", "|"), s.Color));
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
        if (t == typeof(TimeFrame)) return TimeFrame.Parse((string)v);
        if (t.IsEnum) return v is string ? Enum.Parse(t, (string)v) : Enum.ToObject(t, v);
        return System.Convert.ChangeType(v, t, CultureInfo.InvariantCulture);
    }

    // ejtraderLabs M15: broker clock = NY + 7 h, prices x100
    private static List<Bar> LoadM15(string path, DateTime from, DateTime to)
    {
        var r = new List<Bar>();
        foreach (var line in File.ReadLines(path).Skip(1))
        {
            var f = line.Split(',');
            DateTime t = DateTime.ParseExact(f[0], "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
            DateTime u = t.AddHours(-3);
            if (!UsDst(u)) u = t.AddHours(-2);
            if (u < from || u >= to) continue;
            var b = new Bar { T = u, O = P(f[1]) / 100, H = P(f[2]) / 100, L = P(f[3]) / 100, C = P(f[4]) / 100 };
            if (b.H >= Math.Max(b.O, b.C) && b.L <= Math.Min(b.O, b.C)) r.Add(b);
        }
        return r;
    }

    // harness M1 file: time,open,high,low,close (UTC)
    private static List<Bar> LoadM1(string path, DateTime from, DateTime to)
    {
        var r = new List<Bar>();
        foreach (var line in File.ReadLines(path).Skip(1))
        {
            var f = line.Split(',');
            DateTime t = DateTime.ParseExact(f[0], "yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
            if (t < from || t >= to) continue;
            r.Add(new Bar { T = t, O = P(f[1]), H = P(f[2]), L = P(f[3]), C = P(f[4]) });
        }
        return r;
    }

    private static double P(string s) { return double.Parse(s, CultureInfo.InvariantCulture); }

    private static bool UsDst(DateTime t)
    {
        Func<int, int, int, DateTime> nth = (y, m, n) => { var d = new DateTime(y, m, 1); d = d.AddDays((7 - (int)d.DayOfWeek) % 7); return d.AddDays(7 * (n - 1)); };
        return t >= nth(t.Year, 3, 2).AddHours(7) && t < nth(t.Year, 11, 1).AddHours(6);
    }
}
