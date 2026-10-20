#!/usr/bin/env python3
"""How much do HIGH events without an exact time (TENTATIVE / ALL_DAY) cost in trading days and trades?

  news_tentative_stats.py --calendar path/news-calendar.csv [--currencies USD] [--trades a.trades.csv ...]
                          [--lead 30 --lag 30]

Reads a calendar in the MQL5 export schema 1.0 (the file the bot uses live and in backtests) and reports per year:
the rows with time_status TENTATIVE/ALL_DAY and impact HIGH in the filtered currencies, the UTC days they block under
the WholeDay policy, and the share of weekdays affected. With --trades (harness/backtest trades.csv, ideally a run with
Tentative HIGH News Policy = Ignore) it also shows the signals on those days, i.e. what a backtest that ignores such
rows overstates compared with live trading (WholeDay), and how many of them the UsReleaseWindows policy would keep
(signals outside 08:30 / 10:00 / 14:00 New York +- the HIGH window).
lead/lag = the bot's look-ahead/past windows (max of the HIGH/MEDIUM/close-before minutes).
"""
import argparse
import csv
import datetime as dt
from collections import defaultdict


def us_dst(utc):
    def nth_sunday(y, m, n):
        d = dt.datetime(y, m, 1)
        d += dt.timedelta(days=(6 - d.weekday()) % 7)
        return d + dt.timedelta(days=7 * (n - 1))
    return nth_sunday(utc.year, 3, 2) + dt.timedelta(hours=7) <= utc < nth_sunday(utc.year, 11, 1) + dt.timedelta(hours=6)


def ny_to_utc(ny):
    edt = ny + dt.timedelta(hours=4)
    return edt if us_dst(edt) else ny + dt.timedelta(hours=5)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--calendar", required=True)
    ap.add_argument("--currencies", default="USD")
    ap.add_argument("--trades", nargs="*", default=[])
    ap.add_argument("--lead", type=int, default=20, help="look-ahead minutes (max HIGH/MEDIUM before, close-before)")
    ap.add_argument("--lag", type=int, default=15, help="past-event minutes (max HIGH/MEDIUM after)")
    ap.add_argument("--high-before", type=int, default=20)
    ap.add_argument("--high-after", type=int, default=15)
    a = ap.parse_args()
    cur = {c.strip().upper() for c in a.currencies.split(",") if c.strip()}
    rows = []
    with open(a.calendar, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["time_status"] in ("TENTATIVE", "ALL_DAY") and r["impact"] == "HIGH" and (not cur or r["currency"] in cur):
                rows.append((dt.datetime.strptime(r["event_time_utc"], "%Y-%m-%dT%H:%M:%SZ"), r["time_status"], r["currency"], r["title"]))
    days = sorted({t.date() for t, *_ in rows})
    by_year = defaultdict(list)
    for d in days:
        by_year[d.year].append(d)
    print(f"TENTATIVE/ALL_DAY HIGH rows in {sorted(cur) or 'all'}: {len(rows)}, distinct UTC days {len(days)}")
    titles = defaultdict(int)
    for _, st, c, title in rows:
        titles[(st, c, title)] += 1
    for (st, c, title), n in sorted(titles.items(), key=lambda kv: -kv[1])[:15]:
        print(f"  {n:4d}  {st:9s} {c} {title}")
    for y, ds in sorted(by_year.items()):
        wd = sum(1 for i in range(366) if (dt.date(y, 1, 1) + dt.timedelta(days=i)).year == y and (dt.date(y, 1, 1) + dt.timedelta(days=i)).weekday() < 5)
        print(f"  {y}: {len(ds)} blocked UTC days = {100.0 * len(ds) / wd:.1f}% of weekdays")
    if not a.trades:
        return

    def blocked(t):
        for k in (t - dt.timedelta(minutes=a.lag)).date(), (t + dt.timedelta(minutes=a.lead)).date():
            if k in days_set:
                return True
        return False

    def in_window(t):
        d = t.date()
        for m in (8 * 60 + 30, 10 * 60, 14 * 60):
            ev = ny_to_utc(dt.datetime(d.year, d.month, d.day) + dt.timedelta(minutes=m))
            if ev - dt.timedelta(minutes=a.high_before) <= t <= ev + dt.timedelta(minutes=a.high_after):
                return True
        return False

    days_set = set(days)
    for path in a.trades:
        tr = []
        with open(path) as f:
            for r in csv.DictReader(f):
                tr.append((dt.datetime.fromisoformat(r["entry_time"]), float(r["r"])))
        hit = [(t, r) for t, r in tr if blocked(t)]
        keep = [(t, r) for t, r in hit if not in_window(t)]

        def pf(x):
            w, l = sum(r for _, r in x if r > 0), -sum(r for _, r in x if r < 0)
            return w / l if l > 0 else float("nan")
        print(f"\n{path}\n  all signals {len(tr)}, on tentative days {len(hit)} ({100.0 * len(hit) / max(1, len(tr)):.1f}%), "
              f"sum R {sum(r for _, r in hit):.1f}, PF {pf(hit):.2f}")
        print(f"  WholeDay drops all {len(hit)}; UsReleaseWindows keeps {len(keep)} (sum R {sum(r for _, r in keep):.1f}, PF {pf(keep):.2f})")


if __name__ == "__main__":
    main()
