using System;
using System.Globalization;
namespace NewSetups
{
    public static class EntryGeometry
    {
        private static bool Finite(double x) => !double.IsNaN(x) && !double.IsInfinity(x);
        private static decimal ExactDecimal(double x) => decimal.Parse(x.ToString("R", CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture);
        public static bool Clip(int d, double low, double high, double impulseLow, double impulseHigh,
            double blockLow, double blockHigh, bool ote, double tick, out double l, out double h)
        {
            l = h = 0;
            if ((d != 1 && d != -1) || !Finite(low) || !Finite(high) || !Finite(impulseLow) ||
                !Finite(impulseHigh) || !Finite(blockLow) || !Finite(blockHigh) || !Finite(tick) ||
                tick <= 0 || high <= low || impulseHigh <= impulseLow) return false;
            try
            {
                decimal step = ExactDecimal(tick);
                if (step <= 0) return false;
                decimal dl = ExactDecimal(low), dh = ExactDecimal(high);
                if (blockHigh > blockLow) { dl = Math.Max(dl, ExactDecimal(blockLow)); dh = Math.Min(dh, ExactDecimal(blockHigh)); }
                if (ote)
                {
                    decimal il = ExactDecimal(impulseLow), ih = ExactDecimal(impulseHigh), r = ih - il;
                    if (r <= 0) return false;
                    dl = Math.Max(dl, d > 0 ? ih - .786m * r : il + .618m * r);
                    dh = Math.Min(dh, d > 0 ? ih - .618m * r : il + .786m * r);
                }
                dl = Math.Ceiling(dl / step) * step;
                dh = Math.Floor(dh / step) * step;
                if (dh - dl < step) return false;
                l = (double)dl; h = (double)dh;
                return Finite(l) && Finite(h);
            }
            catch (OverflowException) { return false; }
        }
        public static bool Contains(double p, double l, double h) => Finite(p) && p >= l && p <= h;
        public static double FillRatio(int direction, double low, double high, double barLow, double barHigh)
        {
            if ((direction != 1 && direction != -1) || !Finite(low) || !Finite(high) || !Finite(barLow) ||
                !Finite(barHigh) || high <= low || barHigh < barLow) return double.NaN;
            try
            {
                decimal l = ExactDecimal(low), h = ExactDecimal(high), width = h - l;
                if (width <= 0) return double.NaN;
                return (double)((direction > 0 ? h - ExactDecimal(barLow) : ExactDecimal(barHigh) - l) / width);
            }
            catch (OverflowException) { return double.NaN; }
        }
        public static double StopTick(double p, int direction, double tick)
        {
            if (!Finite(p) || !Finite(tick) || tick <= 0 || (direction != 1 && direction != -1)) return double.NaN;
            try
            {
                decimal step = ExactDecimal(tick);
                if (step <= 0) return double.NaN;
                decimal index = ExactDecimal(p) / step;
                return (double)((direction > 0 ? Math.Floor(index) : Math.Ceiling(index)) * step);
            }
            catch (OverflowException) { return double.NaN; }
        }
    }
}
