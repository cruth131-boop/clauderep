#!/usr/bin/env python3
"""SMT divergence study on real M15 data: does a non-confirming correlated market separate good gold raids from bad?

For every gold ICT-proxy trade (strategy_family_study.ict) the raided pool (previous NY-day / Asia / London low or
high) is looked up on the correlated market for the same NY day. SMT is present when the correlated market has NOT
taken its own equivalent pool by the time of the gold raid. Gold is short-USD like EURUSD/GBPUSD/AUDUSD and long-USD
opposite to USDJPY, so for USDJPY the opposite pool is checked.

  smt_study.py --root ejtraderLabs/historical-data --start 2016-01-01 --end 2022-03-01
"""
import argparse
import datetime as dt
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import strategy_family_study as sfs  # noqa: E402

PARTNERS = {"EURUSD": 1, "GBPUSD": 1, "AUDUSD": 1, "USDJPY": -1}


def pools(m, d, upto_time, kind, side):
    """Level of the given pool on market m for NY day d (side -1 = low, +1 = high) and whether it was taken before upto_time."""
    pd_ = m.prev_day(d)
    if pd_ is None:
        return None
    idx = [i for i, x in enumerate(m.date) if x == d]
    if kind == "PD":
        level = m.day_hl[pd_][0] if side < 0 else m.day_hl[pd_][1]
    elif kind == "ASIA":
        a = [i for i, x in enumerate(m.date) if x == pd_ and m.hour[i] >= 20.0]
        if not a:
            return None
        level = min(m.L[i] for i in a) if side < 0 else max(m.H[i] for i in a)
    else:
        lon = [i for i in idx if 2.0 <= m.hour[i] < 5.0]
        if not lon:
            return None
        level = min(m.L[i] for i in lon) if side < 0 else max(m.H[i] for i in lon)
    start_h = 5.0 if kind == "LONDON" else 0.0
    window = [i for i in idx if start_h <= m.hour[i] and m.T[i] <= upto_time]
    if not window:
        return None
    taken = min(m.L[i] for i in window) < level if side < 0 else max(m.H[i] for i in window) > level
    return taken


def pf(r):
    r = np.array(r)
    return (r[r > 0].sum() / -r[r < 0].sum()) if (r < 0).any() else float("nan")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--start", default="2016-01-01")
    ap.add_argument("--end", default="2022-03-01")
    a = ap.parse_args()
    start, end = dt.datetime.fromisoformat(a.start), dt.datetime.fromisoformat(a.end)
    gold = sfs.Market(*sfs.load(f"{a.root}/XAUUSD/XAUUSDm15.csv", start, end))
    meta = []
    trades = sfs.ict(gold, meta)
    r_by_fill = {(e, d): r for e, x, d, r in trades}
    print(f"gold ICT-proxy trades: {len(trades)}, PF {pf([t[3] for t in trades]):.2f}, mean R {np.mean([t[3] for t in trades]):+.3f}\n")
    partners = {s: sfs.Market(*sfs.load(f"{a.root}/{s}/{s}m15.csv", start, end)) for s in PARTNERS}
    print(f"{'partner':8s} {'SMT n':>6s} {'PF':>5s} {'meanR':>7s} {'win%':>5s} | {'no-SMT n':>8s} {'PF':>5s} {'meanR':>7s} {'win%':>5s}")
    any_smt = {}
    for s, sign in PARTNERS.items():
        pm = partners[s]
        yes, no = [], []
        for fill, direction, raid_t, kind in meta:
            side = -direction * sign  # gold long raids a low; same-sign partner low, opposite-sign partner high
            taken = pools(pm, raid_t.date(), raid_t, kind, side)
            if taken is None:
                continue
            r = r_by_fill[(fill, direction)]
            (no if taken else yes).append(r)
            if not taken:
                any_smt.setdefault((fill, direction), 0)
                any_smt[(fill, direction)] += 1
        print(f"{s:8s} {len(yes):6d} {pf(yes):5.2f} {np.mean(yes):+7.3f} {100*np.mean(np.array(yes) > 0):5.1f} | "
              f"{len(no):8d} {pf(no):5.2f} {np.mean(no):+7.3f} {100*np.mean(np.array(no) > 0):5.1f}")
    for need in (1, 2, 3):
        sel = [r_by_fill[k] for k, c in any_smt.items() if c >= need]
        rest = [r for k, r in r_by_fill.items() if any_smt.get(k, 0) < need]
        print(f"SMT with >= {need} partner(s): n={len(sel)} PF {pf(sel):.2f} mean R {np.mean(sel):+.3f} | rest n={len(rest)} PF {pf(rest):.2f} mean R {np.mean(rest):+.3f}")
    # stability: split by year
    years = sorted({k[0].year for k in r_by_fill})
    print("\nper year, SMT (>=2 partners) vs rest: mean R")
    for y in years:
        sel = [r for k, r in r_by_fill.items() if k[0].year == y and any_smt.get(k, 0) >= 2]
        rest = [r for k, r in r_by_fill.items() if k[0].year == y and any_smt.get(k, 0) < 2]
        if sel and rest:
            print(f"  {y}: SMT n={len(sel):3d} {np.mean(sel):+.3f} | rest n={len(rest):3d} {np.mean(rest):+.3f}")


if __name__ == "__main__":
    main()
