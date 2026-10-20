#!/usr/bin/env python3
"""Monte-Carlo analysis of harness / backtest trade lists (R multiples per signal).

  monte_carlo.py --trades runs/K2__R2021.trades.csv [more.csv ...] [--paths 10000] [--horizon-days 252]
                 [--block-days 10] [--risk-grid 0.25,0.5,0.75,1.0] [--daily-limit 2.0] [--dd-limit 10]
                 [--haircut-grid 0,0.05,0.1,0.2] [--seed 1]

Questions it answers (MC does not create an edge; it shows how wide the outcome band of a given edge is):
  A  Is the edge statistically there?      day-block bootstrap of the sample -> CI of expectancy / PF, P(E <= 0)
  B  How much of the drawdown was luck?    permutation of the trade order -> max-DD / losing-streak distribution
  C  What can one year look like?          forward block bootstrap of trading days (keeps same-day clusters and,
                                           via blocks of consecutive days, part of the regime structure)
  D  Which risk % fits my DD tolerance?    fixed-fractional compounding with the bot's daily realized loss limit
  E  How much edge erosion is tolerable?   per-trade haircut in R (spread/slippage/latency/live-vs-backtest gap)

Input: one or more trades.csv (columns entry_time, r; the harness format). Every weekday between the first and the
last entry date of a file is a trading day; days without a signal stay in the pool as 0-R days.
Assumptions to keep in mind: constant risk per trade (the bot sizes FixedLotsWithRiskCap, i.e. risk varies), trades
of one day are ordered by entry time, the daily limit acts on realized R in that order, no regime that is absent
from the sample can appear in the simulation.
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


def load_days(path):
    """Returns (list of per-day R arrays incl. empty days, flat R array in entry order)."""
    rows = []
    with open(path) as f:
        for r in csv.DictReader(f):
            rows.append((dt.datetime.fromisoformat(r["entry_time"]), float(r["r"])))
    rows.sort()
    if not rows:
        raise SystemExit(f"{path}: no trades")
    by_day = {}
    for t, r in rows:
        by_day.setdefault(ny_date(t), []).append(r)
    first, last = ny_date(rows[0][0]), ny_date(rows[-1][0])
    days = []
    d = first
    while d <= last:
        if d.weekday() < 5:
            days.append(np.array(by_day.get(d, []), dtype=float))
        d += dt.timedelta(days=1)
    return days, np.array([r for _, r in rows])


def pad(days):
    k = max(1, max(len(d) for d in days))
    m = np.full((len(days), k), np.nan)
    for i, d in enumerate(days):
        m[i, :len(d)] = d
    return m


def block_indices(rng, n_days, paths, horizon, block):
    """Moving-block bootstrap of day indices (paths x horizon)."""
    starts = rng.integers(0, max(1, n_days - block + 1), size=(paths, -(-horizon // block)))
    idx = (starts[:, :, None] + np.arange(block)[None, None, :]).reshape(paths, -1)[:, :horizon]
    return np.minimum(idx, n_days - 1)


def max_dd(curve, axis=-1):
    """curve: cumulative values (R or log equity) along axis; returns max peak-to-trough with a 0 start."""
    zero = np.zeros(curve.shape[:-1] + (1,))
    c = np.concatenate([zero, curve], axis=axis)
    return np.max(np.maximum.accumulate(c, axis=axis) - c, axis=axis)


def longest_run(mask):
    """Longest run of True along the last axis (2-D input)."""
    best = np.zeros(mask.shape[0], dtype=int)
    cur = np.zeros(mask.shape[0], dtype=int)
    for j in range(mask.shape[1]):
        cur = np.where(mask[:, j], cur + 1, 0)
        best = np.maximum(best, cur)
    return best


def q(a, ps=(5, 50, 95)):
    return " / ".join(f"{np.percentile(a, p):.2f}" for p in ps)


def pf_of(r):
    pos, neg = np.nansum(np.where(r > 0, r, 0), axis=-1), -np.nansum(np.where(r < 0, r, 0), axis=-1)
    return np.where(neg > 0, pos / np.maximum(neg, 1e-12), np.nan)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trades", nargs="+", required=True)
    ap.add_argument("--paths", type=int, default=10000)
    ap.add_argument("--horizon-days", type=int, default=252)
    ap.add_argument("--block-days", type=int, default=10)
    ap.add_argument("--risk-grid", default="0.25,0.5,0.75,1.0")
    ap.add_argument("--daily-limit", type=float, default=2.0, help="daily realized loss limit in %% of day-start equity")
    ap.add_argument("--dd-limit", type=float, default=10.0, help="drawdown tolerance in %% for P(DD >= limit)")
    ap.add_argument("--haircut-grid", default="0,0.05,0.1,0.2")
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    rng = np.random.default_rng(a.seed)

    days, flat = [], []
    for p in a.trades:
        d, f = load_days(p)
        days += d
        flat.append(f)
    flat = np.concatenate(flat)
    D = pad(days)
    n_days, n_tr = len(days), len(flat)
    print(f"sample: {n_tr} signals on {n_days} trading days ({n_tr / n_days:.2f}/day), "
          f"E={flat.mean():.3f} R, PF={pf_of(flat):.2f}, win {np.mean(flat > 0) * 100:.1f}%, "
          f"max DD {max_dd(np.cumsum(flat)):.1f} R, longest losing streak {longest_run((flat < 0)[None])[0]}")
    print(f"paths={a.paths}, block={a.block_days} days, horizon={a.horizon_days} days; quantiles shown as 5% / 50% / 95%")

    # A: edge confidence (resample the whole sample length in day blocks)
    idx = block_indices(rng, n_days, a.paths, n_days, a.block_days)
    R = D[idx].reshape(a.paths, -1)
    n = np.sum(~np.isnan(R), axis=1)
    e = np.nansum(R, axis=1) / np.maximum(n, 1)
    print("\nA  edge confidence (block bootstrap of the sample)")
    print(f"   expectancy R/signal {q(e)}   P(E <= 0) = {np.mean(e <= 0) * 100:.2f}%")
    print(f"   profit factor       {q(pf_of(R))}")

    # B: order luck (same trades, shuffled order)
    perm = np.array([rng.permutation(flat) for _ in range(min(a.paths, 5000))])
    dd = max_dd(np.cumsum(perm, axis=1))
    streak = longest_run(perm < 0)
    hist_dd = max_dd(np.cumsum(flat))
    print("\nB  trade-order permutation (same result, different sequence)")
    print(f"   max DD R            {q(dd)}   historical {hist_dd:.1f} R = {np.mean(dd <= hist_dd) * 100:.0f}th percentile")
    print(f"   losing streak       {q(streak)}   (99%: {np.percentile(streak, 99):.0f})")

    # C: one forward horizon
    idx = block_indices(rng, n_days, a.paths, a.horizon_days, a.block_days)
    Rd = np.nansum(D[idx], axis=2)  # paths x days
    curve = np.cumsum(Rd, axis=1)
    peak = np.maximum.accumulate(np.concatenate([np.zeros((a.paths, 1)), curve], axis=1), axis=1)[:, 1:]
    under = longest_run(curve < peak - 1e-9)
    print(f"\nC  forward {a.horizon_days} trading days (R units)")
    print(f"   result R            {q(curve[:, -1])}   P(result < 0) = {np.mean(curve[:, -1] < 0) * 100:.1f}%")
    print(f"   max DD R            {q(max_dd(curve))}   (99%: {np.percentile(max_dd(curve), 99):.1f})")
    print(f"   longest underwater  {q(under)} days")
    print(f"   worst day R         {q(Rd.min(axis=1))}")

    # D: risk sizing with daily realized loss limit
    print(f"\nD  fixed-fractional sizing, daily loss limit {a.daily_limit:.2f}%, DD tolerance {a.dd_limit:.1f}%")
    print("   risk%  | return% 5/50/95         | max DD% 5/50/95        | P(DD>=tol) | P(DD>=25%) | limit days")
    Rt = D[idx]  # paths x days x k
    for risk in [float(x) for x in a.risk_grid.split(",")]:
        f = risk / 100.0
        mult = np.where(np.isnan(Rt), 1.0, 1.0 + f * np.nan_to_num(Rt))
        cum = np.cumprod(mult, axis=2)
        prior = np.concatenate([np.ones(cum.shape[:2] + (1,)), cum[:, :, :-1]], axis=2)
        blocked = np.maximum.accumulate(prior <= 1.0 - a.daily_limit / 100.0, axis=2)
        day_mult = np.prod(np.where(blocked, 1.0, mult), axis=2)
        logeq = np.cumsum(np.log(np.maximum(day_mult, 1e-9)), axis=1)
        ret = (np.exp(logeq[:, -1]) - 1.0) * 100.0
        ddp = (1.0 - np.exp(-max_dd(logeq))) * 100.0
        lim = np.mean(np.any(blocked & ~np.isnan(Rt), axis=2)) * a.horizon_days
        print(f"   {risk:5.2f}  | {q(ret):23s} | {q(ddp):22s} | {np.mean(ddp >= a.dd_limit) * 100:8.1f}% "
              f"| {np.mean(ddp >= 25) * 100:8.2f}% | {lim:6.1f}/yr")

    # E: edge erosion
    print("\nE  edge erosion: haircut in R per signal (costs/slippage/live gap)")
    for h in [float(x) for x in a.haircut_grid.split(",")]:
        Rh = Rt - h
        tot = np.nansum(Rh, axis=(1, 2))
        print(f"   -{h:.2f} R  E={flat.mean() - h:+.3f}  result R {q(tot):24s} P(year < 0) = {np.mean(tot < 0) * 100:5.1f}%")


if __name__ == "__main__":
    main()
