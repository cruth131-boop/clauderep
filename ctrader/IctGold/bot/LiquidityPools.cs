// v2.61-dev (item 4, part 1): additional ICT liquidity pools and draws on liquidity. All switches default OFF (= v2.60).
//  * Previous week high/low (PWH/PWL): external buy-/sell-side liquidity of the previous NY trading week (raid + target)
//  * NY AM session high/low (07:00-11:00 NY), published after 11:00: the classic NY PM raid of the AM range (raid + target)
//  * Untaken H4 swings: H4 pivots whose price was not traded through afterwards = resting liquidity (raid + target)
//  * Round numbers (step in price units, e.g. 10.00 on XAUUSD, 0.0050 on EURUSD): draw on liquidity only (target only)
//  * NWOG: Friday close / week open of the current New Week Opening Gap: draw on liquidity only (target only)
// Target-only levels never start a setup; they only give TP1/TP2 a structural objective.
using System;
using System.Collections.Generic;
using System.Linq;
using cAlgo.API;

namespace cAlgo.Robots
{
    public partial class IctGoldV259Dev
    {
        [Parameter("Use Previous Week Liquidity", DefaultValue = false, Group = "17 v2.61 Liquidity Pools")]
        public bool UsePreviousWeekLiquidity { get; set; }

        [Parameter("Use NY AM Session Liquidity", DefaultValue = false, Group = "17 v2.61 Liquidity Pools")]
        public bool UseNyAmSessionLiquidity { get; set; }

        [Parameter("Use Untaken H4 Swing Liquidity", DefaultValue = false, Group = "17 v2.61 Liquidity Pools")]
        public bool UseH4SwingLiquidity { get; set; }

        [Parameter("H4 Swing Lookback Bars", DefaultValue = 30, MinValue = 10, MaxValue = 120, Group = "17 v2.61 Liquidity Pools")]
        public int H4SwingLookbackBars { get; set; }

        // 0 = off. Price units (not pips): round numbers are absolute prices.
        [Parameter("Round Number Target Step (price)", DefaultValue = 0.0, MinValue = 0.0, Group = "17 v2.61 Liquidity Pools")]
        public double RoundNumberStepPrice { get; set; }

        [Parameter("Use NWOG Targets", DefaultValue = false, Group = "17 v2.61 Liquidity Pools")]
        public bool UseNwogTargets { get; set; }

        private bool AnyExtraLiquidityPool()
        {
            return UsePreviousWeekLiquidity || UseNyAmSessionLiquidity || UseH4SwingLiquidity || RoundNumberStepPrice > 0 || UseNwogTargets;
        }

        private void AddExtraLiquidityPools(List<LiquidityLevel> levels, DateTime timeUtc)
        {
            if (UsePreviousWeekLiquidity)
                AddPreviousWeekLevels(levels, timeUtc);
            if (UseNyAmSessionLiquidity)
                AddSessionLevels(levels, timeUtc, "NY AM", 7, 11, false);
            if (UseH4SwingLiquidity && _h4 != null)
                AddUntakenH4Swings(levels, timeUtc);
            double mid = (Symbol.Bid + Symbol.Ask) / 2.0;
            if (RoundNumberStepPrice > 0 && mid > 0)
                AddRoundNumberTargets(levels, mid);
            if (UseNwogTargets && mid > 0)
                AddNwogTargets(levels, timeUtc, mid);
        }

        // NY trading week = Sunday 17:00 NY .. Friday 17:00 NY (the date of NY time + 7 h, Monday-based).
        private static DateTime TradingWeekStart(DateTime ny)
        {
            DateTime d = ny.AddHours(7).Date;
            return d.AddDays(-(((int)d.DayOfWeek + 6) % 7));
        }

        private void AddPreviousWeekLevels(List<LiquidityLevel> levels, DateTime timeUtc)
        {
            int end = GetLastFullyClosedBarIndex(_h1, timeUtc, 60);
            if (end < 0)
                return;
            DateTime thisWeek = TradingWeekStart(ToNewYork(timeUtc));
            DateTime prevWeek = thisWeek.AddDays(-7);
            double hi = double.MinValue, lo = double.MaxValue;
            DateTime formed = DateTime.MinValue;
            for (int i = end; i >= Math.Max(0, end - 400); i--)
            {
                DateTime w = TradingWeekStart(ToNewYork(_h1.OpenTimes[i]));
                if (w >= thisWeek)
                    continue;
                if (w < prevWeek)
                    break;
                if (formed == DateTime.MinValue)
                    formed = _h1.OpenTimes[i].AddMinutes(60);
                hi = Math.Max(hi, _h1.HighPrices[i]);
                lo = Math.Min(lo, _h1.LowPrices[i]);
            }
            if (hi > lo && lo > 0)
            {
                levels.Add(new LiquidityLevel("PWH", hi, 1, 3, true) { FormedUtc = formed });
                levels.Add(new LiquidityLevel("PWL", lo, -1, 3, true) { FormedUtc = formed });
            }
        }

        // H4 pivots (2/2) of the lookback whose price was not exceeded by any later closed H4 bar.
        private void AddUntakenH4Swings(List<LiquidityLevel> levels, DateTime timeUtc)
        {
            int end = GetLastFullyClosedBarIndex(_h4, timeUtc, 240);
            if (end < 10)
                return;
            int start = Math.Max(2, end - H4SwingLookbackBars);
            double laterHigh = double.MinValue, laterLow = double.MaxValue;
            int added = 0;
            for (int i = end; i >= start && added < 8; i--)
            {
                // later extremes cover bars i+1..end
                if (i + 2 <= end)
                {
                    if (IsPivot(_h4, i, true, 2, 2, end) && _h4.HighPrices[i] > laterHigh)
                    {
                        levels.Add(new LiquidityLevel("H4 BSL", _h4.HighPrices[i], 1, 2, true) { FormedUtc = _h4.OpenTimes[i + 2].AddMinutes(240) });
                        added++;
                    }
                    if (IsPivot(_h4, i, false, 2, 2, end) && _h4.LowPrices[i] < laterLow)
                    {
                        levels.Add(new LiquidityLevel("H4 SSL", _h4.LowPrices[i], -1, 2, true) { FormedUtc = _h4.OpenTimes[i + 2].AddMinutes(240) });
                        added++;
                    }
                }
                laterHigh = Math.Max(laterHigh, _h4.HighPrices[i]);
                laterLow = Math.Min(laterLow, _h4.LowPrices[i]);
            }
        }

        private void AddRoundNumberTargets(List<LiquidityLevel> levels, double mid)
        {
            double step = RoundNumberStepPrice;
            double below = Math.Floor(mid / step) * step, above = below + step;
            for (int k = 0; k < 2; k++)
            {
                double up = above + k * step, down = below - k * step;
                levels.Add(new LiquidityLevel("RN " + Px(up), up, 1, 1, false) { TargetOnly = true });
                if (down > 0)
                    levels.Add(new LiquidityLevel("RN " + Px(down), down, -1, 1, false) { TargetOnly = true });
            }
        }

        // The current week's opening gap: last H1 close of the previous trading week vs first H1 open of this week.
        private void AddNwogTargets(List<LiquidityLevel> levels, DateTime timeUtc, double mid)
        {
            int end = GetLastFullyClosedBarIndex(_h1, timeUtc, 60);
            if (end < 2)
                return;
            DateTime thisWeek = TradingWeekStart(ToNewYork(timeUtc));
            int first = -1;
            for (int i = end; i >= Math.Max(1, end - 200); i--)
            {
                if (TradingWeekStart(ToNewYork(_h1.OpenTimes[i])) < thisWeek)
                    break;
                first = i;
            }
            if (first < 1)
                return;
            double fridayClose = _h1.ClosePrices[first - 1], weekOpen = _h1.OpenPrices[first];
            if (Math.Abs(weekOpen - fridayClose) < Symbol.TickSize * 2)
                return;
            foreach (double p in new[] { fridayClose, weekOpen, (fridayClose + weekOpen) / 2.0 })
                levels.Add(new LiquidityLevel(p == fridayClose ? "NWOG close" : p == weekOpen ? "NWOG open" : "NWOG CE", p, p > mid ? 1 : -1, 2, false) { TargetOnly = true });
        }
    }
}
