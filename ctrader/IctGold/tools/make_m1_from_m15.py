#!/usr/bin/env python3
"""Build a reproducible XAUUSD M1 test series from real M15 candles.

Real M1/tick data for XAUUSD was not reachable from the test environment, so this
script keeps the REAL M15 OHLC (sessions, swings, PDH/PDL, Asia/London ranges,
H1/M15 structure) and fills each M15 candle with a seeded Brownian-bridge path of
15 one-minute candles that hits exactly the real open, high, low and close.

Consequence for interpretation: everything the bot derives from M15/H1 is real,
the M2 micro structure (exact sweep candle, M2 FVG, confirmation candle) is
synthetic. Frequencies and gate behaviour are meaningful, absolute profit numbers
are not a substitute for a cTrader tick backtest.

Source timestamps (ejtraderLabs/historical-data, XAUUSDm15.csv) use the usual
"NY close" broker clock (NY + 7 h); they are converted to UTC here.

Optional volatility normalisation: all prices are multiplied by a factor so that
the median NY-day range of the period matches --target-day-range (USD). The bot
uses fixed pip thresholds that were tuned on 2025/26 gold (~4000 USD), so older
data at ~1800 USD would otherwise test a different regime.

Usage:
  make_m1_from_m15.py --m15 XAUUSDm15.csv --start 2020-01-01 --end 2022-01-01 \
      --out xau_m1.csv [--target-day-range 55] [--seed 20261019]
"""
import argparse
import csv
import datetime as dt

import numpy as np


def us_dst_utc(t):
    """True when the UTC instant t lies inside US daylight saving time."""
    def nth_sunday(year, month, n):
        d = dt.datetime(year, month, 1)
        d += dt.timedelta(days=(6 - d.weekday()) % 7)
        return d + dt.timedelta(days=7 * (n - 1))
    return nth_sunday(t.year, 3, 2) + dt.timedelta(hours=7) <= t < nth_sunday(t.year, 11, 1) + dt.timedelta(hours=6)


def server_to_utc(t):
    # The source uses the common "NY close" broker clock: daily break at 00:00-01:00,
    # i.e. NY time + 7 h (UTC+3 during US DST, UTC+2 otherwise).
    u = t - dt.timedelta(hours=3)
    return u if us_dst_utc(u) else t - dt.timedelta(hours=2)


def load_m15(path, start, end):
    rows = []
    with open(path, newline="") as f:
        r = csv.reader(f)
        next(r)
        for line in r:
            t = server_to_utc(dt.datetime.strptime(line[0], "%Y-%m-%d %H:%M:%S"))
            if t < start or t >= end:
                continue
            o, h, l, c = (float(x) / 100.0 for x in line[1:5])
            if not (h >= max(o, c) and l <= min(o, c) and h >= l):
                continue
            rows.append((t, o, h, l, c))
    return rows


def ny_day(t):
    return (t - dt.timedelta(hours=4 if us_dst_utc(t) else 5)).date()


def median_day_range(rows):
    days = {}
    for t, o, h, l, c in rows:
        d = ny_day(t)
        lo, hi = days.get(d, (1e18, -1e18))
        days[d] = (min(lo, l), max(hi, h))
    rng = [hi - lo for lo, hi in days.values() if hi > lo]
    return float(np.median(rng)), len(rng)


def bridge(rng, a, b, n, sigma):
    """Brownian bridge from a to b in n steps (returns n+1 points)."""
    if n <= 0:
        return np.array([a])
    steps = rng.normal(0.0, sigma, n)
    walk = np.concatenate([[0.0], np.cumsum(steps)])
    k = np.arange(n + 1) / n
    return a + walk - k * walk[-1] + k * (b - a)


def build_minutes(rng, o, h, l, c, micro=0.0):
    sub = 4                      # sub points per minute -> intra-minute high/low
    n = 15 * sub
    # time of high / low inside the candle; bullish candles tend to print the low first
    i1, i2 = sorted(rng.choice(np.arange(1, n), size=2, replace=False))
    low_first = rng.random() < (0.62 if c >= o else 0.38)
    a, b = (l, h) if low_first else (h, l)
    rngp = max(h - l, 0.01)
    sigma = rngp * 0.18 / np.sqrt(sub)
    p = np.concatenate([
        bridge(rng, o, a, i1, sigma)[:-1],
        bridge(rng, a, b, i2 - i1, sigma)[:-1],
        bridge(rng, b, c, n - i2, sigma),
    ])
    if micro > 0:
        # i.i.d. micro-structure noise (spikes that mean-revert), the part of real gold M1 that hits tight stops
        p = p + rng.normal(0.0, micro * rngp, p.shape)
    p = np.clip(p, l, h)
    p[i1], p[i2] = a, b
    p[0], p[-1] = o, c
    out = []
    for m in range(15):
        seg = p[m * sub:(m + 1) * sub + 1]
        out.append((seg[0], seg.max(), seg.min(), seg[-1]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--m15", required=True)
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--target-day-range", type=float, default=0.0)
    ap.add_argument("--seed", type=int, default=20261019)
    ap.add_argument("--micro-noise", type=float, default=0.0,
                    help="i.i.d. noise per sub point as a fraction of the M15 range (0 = smooth bridge)")
    args = ap.parse_args()

    start = dt.datetime.fromisoformat(args.start)
    end = dt.datetime.fromisoformat(args.end)
    rows = load_m15(args.m15, start, end)
    med, ndays = median_day_range(rows)
    k = args.target_day_range / med if args.target_day_range > 0 else 1.0
    rng = np.random.default_rng(args.seed)
    n = 0
    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["time", "open", "high", "low", "close"])
        for t, o, h, l, c in rows:
            for m, (mo, mh, ml, mc) in enumerate(build_minutes(rng, o * k, h * k, l * k, c * k, args.micro_noise)):
                w.writerow([(t + dt.timedelta(minutes=m)).strftime("%Y-%m-%d %H:%M"),
                            f"{mo:.2f}", f"{mh:.2f}", f"{ml:.2f}", f"{mc:.2f}"])
                n += 1
    print(f"m15 rows={len(rows)} ny_days={ndays} median_day_range={med:.2f} scale={k:.4f} m1_rows={n}")


def m1_m15_range_ratio(path, limit=200000):
    """Average M1 range / average M15 range of a generated file (real XAUUSD is roughly 0.30-0.35)."""
    m1, agg = [], {}
    with open(path) as f:
        r = csv.reader(f)
        next(r)
        for i, row in enumerate(r):
            if i >= limit:
                break
            t = dt.datetime.strptime(row[0], "%Y-%m-%d %H:%M")
            hi, lo = float(row[2]), float(row[3])
            m1.append(hi - lo)
            key = t.replace(minute=t.minute // 15 * 15)
            a = agg.get(key)
            agg[key] = (max(a[0], hi), min(a[1], lo)) if a else (hi, lo)
    return (sum(m1) / len(m1)) / (sum(h - l for h, l in agg.values()) / len(agg))


if __name__ == "__main__":
    main()
