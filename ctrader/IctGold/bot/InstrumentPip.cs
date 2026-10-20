// v2.61-dev (item 3): instrument-neutral strategy pip.
// Every pip parameter of the strategy (stops, buffers, targets, zone widths, spread cap, ...) is expressed in "strategy pips".
// Fixed (default, = v2.59/v2.60): one strategy pip = Price per Strategy Pip (0.10 USD on XAUUSD).
// AdrNormalized: one strategy pip = median NY-day range of the last ADR Lookback Days / ADR Reference Strategy Pips.
// With the reference 550 a gold day of 55 USD keeps 0.10 USD per strategy pip, and the same parameter set describes the same
// fraction of the daily range on EURUSD, GBPUSD, XAGUSD or an index. The value is fixed for a whole NY day (recomputed at the
// day roll); an open trade keeps the pip it was opened with.
using System;
using System.Collections.Generic;
using System.Linq;
using cAlgo.API;

namespace cAlgo.Robots
{
    public enum SmcStrategyPipMode
    {
        Fixed,
        AdrNormalized
    }

    public partial class IctGoldV259Dev
    {
        [Parameter("Strategy Pip Mode", DefaultValue = SmcStrategyPipMode.Fixed, Group = "16 v2.61 Instrument")]
        public SmcStrategyPipMode StrategyPipMode { get; set; }

        // Strategy pips that correspond to one median NY-day range (550 = gold at 55 USD/day with 0.10 per pip).
        [Parameter("ADR Reference Strategy Pips", DefaultValue = 550.0, MinValue = 50.0, MaxValue = 5000.0, Step = 10.0, Group = "16 v2.61 Instrument")]
        public double AdrReferenceStrategyPips { get; set; }

        [Parameter("ADR Lookback Days", DefaultValue = 20, MinValue = 5, MaxValue = 120, Group = "16 v2.61 Instrument")]
        public int AdrLookbackDays { get; set; }

        // Commission accounts (ECN/raw spread): the round-turn commission expressed in symbol pips is added to the spread
        // wherever the strategy prices its trading cost (spread gate, break-even cost buffer). 0 = spread only (v2.60).
        [Parameter("Round-Turn Commission Symbol Pips", DefaultValue = 0.0, MinValue = 0.0, MaxValue = 100.0, Step = 0.1, Group = "16 v2.61 Instrument")]
        public double CommissionSymbolPips { get; set; }

        private double _strategyPip;
        private double _adrPrice;
        private DateTime _strategyPipDay = DateTime.MinValue;

        private double StrategyPip { get { return _strategyPip; } }

        private double TradingCostPrice() { return (Symbol.Ask - Symbol.Bid) + CommissionSymbolPips * Symbol.PipSize; }

        private static double TradePip(ManagedTrade t, double fallback) { return t != null && t.PipPrice > 0 ? t.PipPrice : fallback; }

        // Called once at start (after the bars are loaded) and at every NY day roll.
        private void UpdateStrategyPip(DateTime utc, bool start)
        {
            if (StrategyPipMode == SmcStrategyPipMode.Fixed)
            {
                _strategyPip = PricePerStrategyPip;
                return;
            }
            DateTime day = ToNewYork(utc).Date;
            if (!start && day == _strategyPipDay)
                return;
            double adr = MedianNyDayRange(utc, AdrLookbackDays);
            if (adr > 0)
            {
                _adrPrice = adr;
                _strategyPip = adr / AdrReferenceStrategyPips;
                _strategyPipDay = day;
                Log("Strategy pip {0}: median NY-day range {1} over {2} days -> {3} per strategy pip ({4:F2} symbol pips).",
                    day.ToString("yyyy-MM-dd"), Fmt(adr), AdrLookbackDays, Fmt(_strategyPip), _strategyPip / Symbol.PipSize);
                return;
            }
            if (_strategyPip > 0)
                return;   // keep the last valid value
            throw new InvalidOperationException("ADR-normalised strategy pip: not enough H1 history for " + AdrLookbackDays + " complete NY days.");
        }

        // Median high-low range of the last completed NY calendar days, built from H1 bars (independent of the broker's D1
        // session boundaries). Days with fewer than 12 H1 bars (Sunday stub, holidays) are skipped.
        private double MedianNyDayRange(DateTime utc, int days)
        {
            if (_h1 == null || _h1.Count < 2)
                return 0;
            DateTime today = ToNewYork(utc).Date;
            var ranges = new List<double>();
            DateTime cur = DateTime.MinValue;
            double hi = double.MinValue, lo = double.MaxValue;
            int bars = 0;
            for (int i = _h1.Count - 1; i >= 0 && ranges.Count < days; i--)
            {
                DateTime d = ToNewYork(_h1.OpenTimes[i]).Date;
                if (d >= today)
                    continue;
                if (d != cur)
                {
                    if (bars >= 12)
                        ranges.Add(hi - lo);
                    cur = d; hi = double.MinValue; lo = double.MaxValue; bars = 0;
                }
                hi = Math.Max(hi, _h1.HighPrices[i]);
                lo = Math.Min(lo, _h1.LowPrices[i]);
                bars++;
            }
            if (ranges.Count < days && bars >= 12)
                ranges.Add(hi - lo);
            if (ranges.Count < Math.Min(days, 5))
                return 0;
            ranges.Sort();
            int n = ranges.Count;
            return n % 2 == 1 ? ranges[n / 2] : 0.5 * (ranges[n / 2 - 1] + ranges[n / 2]);
        }

        // Price text with the symbol's precision (F2 for XAUUSD as before, F5 for EURUSD, ...).
        private string Px(double price)
        {
            int digits = Math.Max(0, Math.Min(8, (int)Math.Round(-Math.Log10(Symbol.TickSize))));
            return price.ToString("F" + digits, System.Globalization.CultureInfo.InvariantCulture);
        }

        private static string Fmt(double v) { return v.ToString("0.#######", System.Globalization.CultureInfo.InvariantCulture); }
    }
}
