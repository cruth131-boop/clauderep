// Offline backtest runner for the ICT Gold cBot (test harness, not the cTrader backtester).
//   IctGoldHarness --data m1.csv --from 2020-01-01 --to 2022-01-01 [--set Name=Value ...] [--out dir] [--tag name] [--log]
// Ticks per M1 candle: open, first extreme, second extreme, close (bullish: low first). Spread fixed 0.20 USD,
// commission 0, swap 0, EUR 5,000, account currency EUR (USD->EUR 0.92 fixed), no news calendar.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using cAlgo.API;

namespace IctGoldHarness
{
    public static class Program
    {
        public static int Main(string[] args)
        {
            string data = null, outDir = ".", tag = "run";
            DateTime from = DateTime.MinValue, to = DateTime.MaxValue;
            bool log = false;
            int substeps = 1;
            var sets = new List<KeyValuePair<string, string>>();
            for (int a = 0; a < args.Length; a++)
            {
                switch (args[a])
                {
                    case "--data": data = args[++a]; break;
                    case "--from": from = DateTime.Parse(args[++a], CultureInfo.InvariantCulture); break;
                    case "--to": to = DateTime.Parse(args[++a], CultureInfo.InvariantCulture); break;
                    case "--out": outDir = args[++a]; break;
                    case "--tag": tag = args[++a]; break;
                    case "--log": log = true; break;
                    case "--substeps": substeps = int.Parse(args[++a], CultureInfo.InvariantCulture); break;
                    case "--set":
                        string kv = args[++a]; int e = kv.IndexOf('=');
                        sets.Add(new KeyValuePair<string, string>(kv.Substring(0, e), kv.Substring(e + 1))); break;
                    default: throw new ArgumentException("unknown argument " + args[a]);
                }
            }
            Directory.CreateDirectory(outDir);
            StreamWriter logWriter = log ? new StreamWriter(Path.Combine(outDir, tag + ".log"), false, new UTF8Encoding(false)) : null;

            var engine = new Engine(5000.0);
            engine.Logger = s => { if (logWriter != null) logWriter.WriteLine(engine.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) + " " + s); };
            var bot = new cAlgo.Robots.IctGoldV259Dev();
            bot.HarnessEngine = engine;
            ApplyParameters(bot, sets);

            bool started = false;
            var tradingDays = new HashSet<DateTime>();
            foreach (var bar in ReadM1(data))
            {
                if (bar.Time >= to) break;
                foreach (var tick in Ticks(bar, substeps))
                {
                    engine.PushTick(tick.Key, tick.Value);
                    if (!started)
                    {
                        if (tick.Key < from) continue;
                        bot.HarnessStart();
                        started = true;
                        continue;
                    }
                    bot.HarnessTick();
                    engine.AfterTick();
                    if (engine.LastOpenLog != null)
                    {
                        var rec = engine.Records.Values.Where(r => r.OpenLog == null).OrderByDescending(r => r.PositionId).FirstOrDefault();
                        if (rec != null) rec.OpenLog = engine.LastOpenLog;
                        engine.LastOpenLog = null;
                    }
                }
                if (started && bar.Time >= from)
                {
                    DateTime nyDay = NyDate(bar.Time);   // trading days = NY weekdays (the Sunday evening open is not a day of its own)
                    if (nyDay.DayOfWeek != DayOfWeek.Saturday && nyDay.DayOfWeek != DayOfWeek.Sunday) tradingDays.Add(nyDay);
                }
            }
            bot.HarnessStop();
            engine.ForceCloseAll();
            if (logWriter != null) logWriter.Dispose();
            WriteReport(engine, bot, tradingDays.Count, outDir, tag, sets);
            return 0;
        }

        private static void ApplyParameters(object bot, List<KeyValuePair<string, string>> sets)
        {
            var props = bot.GetType().GetProperties(BindingFlags.Instance | BindingFlags.Public)
                .Where(p => p.GetCustomAttribute<ParameterAttribute>() != null).ToDictionary(p => p.Name);
            foreach (var p in props.Values)
            {
                object def = p.GetCustomAttribute<ParameterAttribute>().DefaultValue;
                p.SetValue(bot, Convert(def, p.PropertyType));
            }
            // Harness defaults: no dashboard (performance); verbose log keeps the OPEN line for setup attribution.
            props["ShowDashboard"].SetValue(bot, false);
            foreach (var kv in sets)
            {
                PropertyInfo p;
                if (!props.TryGetValue(kv.Key, out p)) throw new ArgumentException("unknown parameter " + kv.Key);
                p.SetValue(bot, Convert(kv.Value, p.PropertyType));
            }
        }

        private static object Convert(object v, Type t)
        {
            if (t.IsEnum) return v is string ? Enum.Parse(t, (string)v) : Enum.ToObject(t, v);
            if (v is string && t != typeof(string)) return System.Convert.ChangeType((string)v, t, CultureInfo.InvariantCulture);
            return v == null ? null : System.Convert.ChangeType(v, t, CultureInfo.InvariantCulture);
        }

        private struct M1 { public DateTime Time; public double O, H, L, C; }

        private static IEnumerable<M1> ReadM1(string path)
        {
            using (var r = new StreamReader(path))
            {
                r.ReadLine();
                string line;
                while ((line = r.ReadLine()) != null)
                {
                    var f = line.Split(',');
                    yield return new M1
                    {
                        Time = DateTime.ParseExact(f[0], "yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
                        O = double.Parse(f[1], CultureInfo.InvariantCulture), H = double.Parse(f[2], CultureInfo.InvariantCulture),
                        L = double.Parse(f[3], CultureInfo.InvariantCulture), C = double.Parse(f[4], CultureInfo.InvariantCulture)
                    };
                }
            }
        }

        // Anchor ticks O, first extreme, second extreme, C at 0/15/30/59 s; with substeps > 1 every leg between two anchors
        // is filled with linearly interpolated ticks, so a level inside the candle is crossed close to its price.
        private static IEnumerable<KeyValuePair<DateTime, double>> Ticks(M1 b, int substeps)
        {
            bool lowFirst = b.C >= b.O;
            double[] px = { b.O, lowFirst ? b.L : b.H, lowFirst ? b.H : b.L, b.C };
            double[] sec = { 0, 15, 30, 59 };
            yield return new KeyValuePair<DateTime, double>(b.Time, px[0]);
            for (int leg = 1; leg < 4; leg++)
                for (int k = 1; k <= substeps; k++)
                {
                    double f = k / (double)substeps;
                    yield return new KeyValuePair<DateTime, double>(b.Time.AddSeconds(sec[leg - 1] + f * (sec[leg] - sec[leg - 1])),
                        Math.Round(px[leg - 1] + f * (px[leg] - px[leg - 1]), 2));
                }
        }

        private static DateTime NyDate(DateTime utc) { return FailSafe.NyTime.ToNy(utc).Date; }

        private static void WriteReport(Engine engine, cAlgo.Robots.IctGoldV259Dev bot, int days, string outDir, string tag, List<KeyValuePair<string, string>> sets)
        {
            var recs = engine.Records.Values.OrderBy(r => r.PositionId).ToList();
            var rs = recs.Select(r => r.InitialRiskEur > 0 ? r.Realized / r.InitialRiskEur : 0).ToList();
            double grossWin = recs.Where(r => r.Realized > 0).Sum(r => r.Realized), grossLoss = -recs.Where(r => r.Realized < 0).Sum(r => r.Realized);
            double rWin = rs.Where(x => x > 0).Sum(), rLoss = -rs.Where(x => x < 0).Sum();
            int wins = recs.Count(r => r.Realized > 0);
            var sb = new StringBuilder();
            sb.AppendLine("tag=" + tag);
            sb.AppendLine("params=" + string.Join(" ", sets.Select(s => s.Key + "=" + s.Value)));
            sb.AppendLine(string.Format(CultureInfo.InvariantCulture,
                "signals={0} ny_days={1} signals_per_day={2:F3} win_rate={3:F1}% net_eur={4:F2} pf_eur={5:F2} sum_r={6:F2} avg_r={7:F3} pf_r={8:F2} max_dd_eur={9:F2} max_dd_pct={10:F2}",
                recs.Count, days, days > 0 ? recs.Count / (double)days : 0, recs.Count > 0 ? 100.0 * wins / recs.Count : 0,
                recs.Sum(r => r.Realized), grossLoss > 0 ? grossWin / grossLoss : double.NaN, rs.Sum(), rs.Count > 0 ? rs.Average() : 0,
                rLoss > 0 ? rWin / rLoss : double.NaN, engine.MaxDrawdown, engine.MaxDrawdownPct));
            foreach (var g in recs.GroupBy(r => SetupOf(r.OpenLog)).OrderBy(g => g.Key))
            {
                var gr = g.Select(r => r.InitialRiskEur > 0 ? r.Realized / r.InitialRiskEur : 0).ToList();
                double w = gr.Where(x => x > 0).Sum(), l = -gr.Where(x => x < 0).Sum();
                sb.AppendLine(string.Format(CultureInfo.InvariantCulture, "  setup {0,-18} n={1,4} win={2,5:F1}% sum_r={3,7:F2} pf_r={4:F2}",
                    g.Key, g.Count(), 100.0 * g.Count(r => r.Realized > 0) / g.Count(), gr.Sum(), l > 0 ? w / l : double.NaN));
            }
            foreach (var y in recs.GroupBy(r => r.EntryTime.ToString("yyyy-'Q'", CultureInfo.InvariantCulture) + ((r.EntryTime.Month - 1) / 3 + 1)).OrderBy(g => g.Key))
                sb.AppendLine(string.Format(CultureInfo.InvariantCulture, "  quarter {0} n={1,4} sum_r={2,7:F2} net_eur={3,8:F2}", y.Key, y.Count(),
                    y.Sum(r => r.InitialRiskEur > 0 ? r.Realized / r.InitialRiskEur : 0), y.Sum(r => r.Realized)));
            sb.AppendLine("funnel:");
            foreach (var kv in bot.HarnessFunnel.OrderBy(k => k.Key, StringComparer.Ordinal))
                sb.AppendLine("  " + kv.Key + "=" + kv.Value);
            File.WriteAllText(Path.Combine(outDir, tag + ".summary.txt"), sb.ToString());
            Console.Write(sb.ToString().Split(new[] { "funnel:" }, StringSplitOptions.None)[0]);

            var csv = new StringBuilder("position_id,side,entry_time,entry,initial_stop,units,risk_eur,realized_eur,r,mfe_r,exit_time,setup\n");
            foreach (var r in recs)
                csv.AppendLine(string.Join(",", r.PositionId, r.Side, r.EntryTime.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                    r.EntryPrice.ToString("F2", CultureInfo.InvariantCulture), r.InitialStop.ToString("F2", CultureInfo.InvariantCulture), r.Units,
                    r.InitialRiskEur.ToString("F2", CultureInfo.InvariantCulture), r.Realized.ToString("F2", CultureInfo.InvariantCulture),
                    (r.InitialRiskEur > 0 ? r.Realized / r.InitialRiskEur : 0).ToString("F3", CultureInfo.InvariantCulture),
                    r.Mfe.ToString("F2", CultureInfo.InvariantCulture), r.ExitTime.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                    "\"" + (r.OpenLog ?? "").Replace("\"", "'") + "\""));
            File.WriteAllText(Path.Combine(outDir, tag + ".trades.csv"), csv.ToString());
        }

        private static string SetupOf(string openLog)
        {
            if (string.IsNullOrEmpty(openLog)) return "?";
            int a = openLog.IndexOf("type=", StringComparison.Ordinal);
            if (a < 0) return "?";
            int b = openLog.IndexOf(',', a);
            return openLog.Substring(a + 5, (b < 0 ? openLog.Length : b) - a - 5);
        }
    }
}
