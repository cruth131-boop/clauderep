#!/usr/bin/env python3
"""Daily-R correlation and portfolio statistics of harness runs (one trades.csv per instrument or strategy).

  portfolio_corr.py --runs NAME=path/to/x.trades.csv [...] [--start 2020-01-01 --end 2022-01-01]
                    [--underlying NAME=path/to/m15.csv ...]

Daily R = sum of R of all signals entered on that NY trading day (0 on days without a signal).
Also reports: same-day co-occurrence, simultaneous open positions with the same USD exposure,
and the combined portfolio (equal risk per signal).
"""
import argparse
import csv
import datetime as dt

import numpy as np


def us_dst(t):
    def nth_sunday(y, m, n):
        d = dt.datetime(y, m, 1)
        d += dt.timedelta(days=(6 - d.weekday()) % 7)
        return d + dt.timedelta(days=7 * (n - 1))
    return nth_sunday(t.year, 3, 2) + dt.timedelta(hours=7) <= t < nth_sunday(t.year, 11, 1) + dt.timedelta(hours=6)


def ny_date(t):
    return (t - dt.timedelta(hours=4 if us_dst(t) else 5)).date()


def load_trades(path):
    out = []
    with open(path) as f:
        for r in csv.DictReader(f):
            e = dt.datetime.fromisoformat(r["entry_time"])
            x = dt.datetime.fromisoformat(r["exit_time"])
            out.append((e, x, 1 if r["side"] == "Buy" else -1, float(r["r"])))
    return out


# USD exposure sign of a long position: +1 = long USD, -1 = short USD (gold and xxxUSD are quoted in USD)
USD_SIGN = {"xauusd": -1, "eurusd": -1, "gbpusd": -1, "audusd": -1, "usdjpy": 1, "usdchf": 1, "usdcad": 1}


def max_dd(series):
    eq = np.cumsum(series)
    peak = np.maximum.accumulate(np.concatenate([[0.0], eq]))[1:]
    return float(np.max(peak - eq)) if len(eq) else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", nargs="+", required=True)
    ap.add_argument("--start", default="2020-01-01")
    ap.add_argument("--end", default="2022-01-01")
    args = ap.parse_args()
    start, end = dt.date.fromisoformat(args.start), dt.date.fromisoformat(args.end)
    days = [start + dt.timedelta(days=i) for i in range((end - start).days)]
    days = [d for d in days if d.weekday() < 5]
    idx = {d: i for i, d in enumerate(days)}
    names, trades, mat = [], {}, []
    for spec in args.runs:
        name, path = spec.split("=", 1)
        t = load_trades(path)
        trades[name] = t
        v = np.zeros(len(days))
        for e, x, side, r in t:
            d = ny_date(e)
            if d in idx:
                v[idx[d]] += r
        names.append(name)
        mat.append(v)
    m = np.array(mat)
    print(f"trading days: {len(days)}")
    print("\nper run: signals, signals/day, sum R, PF(R), max DD (R), share of days with a signal")
    for n, v in zip(names, m):
        rs = np.array([r for *_, r in trades[n]])
        pf = rs[rs > 0].sum() / -rs[rs < 0].sum() if (rs < 0).any() else float("nan")
        print(f"  {n:22s} {len(rs):5d} {len(rs)/len(days):5.2f} {rs.sum():8.1f} {pf:5.2f} {max_dd(v):7.1f} {np.mean(v != 0):5.2f}")
    print("\ndaily-R correlation (Pearson)")
    c = np.corrcoef(m)
    print("  " + " ".join(f"{n[:10]:>10s}" for n in names))
    for i, n in enumerate(names):
        print(f"  {n[:10]:10s}" + " ".join(f"{c[i, j]:10.2f}" for j in range(len(names))))
    off = c[np.triu_indices(len(names), 1)]
    print(f"  mean off-diagonal {off.mean():.3f}, max {off.max():.3f}")

    port = m.sum(axis=0)
    rs = np.concatenate([[r for *_, r in trades[n]] for n in names])
    pf = rs[rs > 0].sum() / -rs[rs < 0].sum()
    sum_dd = sum(max_dd(v) for v in m)
    print(f"\nportfolio (equal risk per signal): signals/day {len(rs)/len(days):.2f}, sum R {port.sum():.1f}, PF(R) {pf:.2f}, "
          f"max DD {max_dd(port):.1f} R (sum of single max DDs {sum_dd:.1f} R), worst day {port.min():.1f} R, "
          f"losing days {np.mean(port < 0):.2f}, daily Sharpe-like {port.mean()/port.std()*np.sqrt(252):.2f}")
    single = [v.mean() / v.std() * np.sqrt(252) for v in m]
    print("  single daily Sharpe-like: " + ", ".join(f"{n} {s:.2f}" for n, s in zip(names, single)))

    # simultaneous open positions with the same USD exposure
    events = []
    for n in names:
        sign = USD_SIGN.get(n.split("_")[-1].lower(), 0)
        for e, x, side, r in trades[n]:
            events.append((e, x, n, side * sign))
    events.sort()
    clash = 0
    for i, (e, x, n, usd) in enumerate(events):
        for e2, x2, n2, usd2 in events[i + 1:]:
            if e2 >= x:
                break
            if n2 != n and usd != 0 and usd == usd2:
                clash += 1
    print(f"\noverlapping open positions with the same USD direction: {clash} pairs ({clash/max(1,len(events)):.2f} per signal)")


if __name__ == "__main__":
    main()
