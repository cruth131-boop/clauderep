#!/usr/bin/env python3
"""APPROXIMATE USD news calendar for offline tests, written in the MQL5 export schema 1.0 (+ manifest).

It is NOT a real calendar export. It exists to exercise the bot's news paths in the harness:
  * NFP     first Friday of the month 08:30 New York        (approximate: BLS sometimes uses the second Friday)
  * CPI     business day closest to the 12th, 08:30 New York  (approximate)
  * FOMC    statement 14:00 New York, published meeting dates 2018-2021
  * optional synthetic TENTATIVE / ALL_DAY HIGH rows (--tentative-per-year) to test the tentative-news policy;
    their titles say "synthetic".

  make_test_calendar.py --out-dir dir [--start 2018-01-01 --end 2022-02-01] [--tentative-per-year 8] [--seed 7]
Writes dir/news-calendar.csv and dir/news-calendar.manifest.json (validation_status VALID, sha256, coverage).
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import random

COLUMNS = ["schema_version", "event_id", "event_time_local", "timezone_id", "utc_offset", "event_time_utc", "time_status",
           "currency", "impact", "title", "enabled", "source_provider", "source_event_id", "source_url", "source_retrieved_utc",
           "revision", "notes"]

FOMC = ["2018-01-31", "2018-03-21", "2018-05-02", "2018-06-13", "2018-08-01", "2018-09-26", "2018-11-08", "2018-12-19",
        "2019-01-30", "2019-03-20", "2019-05-01", "2019-06-19", "2019-07-31", "2019-09-18", "2019-10-30", "2019-12-11",
        "2020-01-29", "2020-04-29", "2020-06-10", "2020-07-29", "2020-09-16", "2020-11-05", "2020-12-16",
        "2021-01-27", "2021-03-17", "2021-04-28", "2021-06-16", "2021-07-28", "2021-09-22", "2021-11-03", "2021-12-15"]


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
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--start", default="2018-01-01")
    ap.add_argument("--end", default="2022-02-01")
    ap.add_argument("--tentative-per-year", type=int, default=0)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    start, end = dt.date.fromisoformat(a.start), dt.date.fromisoformat(a.end)
    events = []   # (utc datetime, status, title)
    y, m = start.year, start.month
    while dt.date(y, m, 1) < end:
        d = dt.date(y, m, 1)
        while d.weekday() != 4:
            d += dt.timedelta(days=1)
        events.append((ny_to_utc(dt.datetime(d.year, d.month, d.day, 8, 30)), "EXACT", "Nonfarm Payrolls (approx. date)"))
        c = dt.date(y, m, 12)
        for k in range(4):
            for cand in (c - dt.timedelta(days=k), c + dt.timedelta(days=k)):
                if cand.weekday() < 5:
                    c = cand
                    break
            else:
                continue
            break
        events.append((ny_to_utc(dt.datetime(c.year, c.month, c.day, 8, 30)), "EXACT", "CPI m/m (approx. date)"))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    for s in FOMC:
        d = dt.date.fromisoformat(s)
        events.append((ny_to_utc(dt.datetime(d.year, d.month, d.day, 14, 0)), "EXACT", "FOMC Statement"))
    rnd = random.Random(a.seed)
    if a.tentative_per_year > 0:
        for year in range(start.year, end.year + 1):
            days = [dt.date(year, 1, 1) + dt.timedelta(days=i) for i in range(366)]
            days = [d for d in days if d.year == year and d.weekday() < 5 and start <= d < end]
            taken = {e[0].date() for e in events}
            pool = [d for d in days if d not in taken]
            for i, d in enumerate(sorted(rnd.sample(pool, min(a.tentative_per_year, len(pool))))):
                status = "TENTATIVE" if i % 2 == 0 else "ALL_DAY"
                events.append((dt.datetime(d.year, d.month, d.day), status, f"Fed testimony (synthetic {status.lower()} test event)"))
    events = [e for e in events if start <= e[0].date() < end]
    events.sort()
    now = dt.datetime(end.year, end.month, end.day) - dt.timedelta(days=1)
    fmt = "%Y-%m-%dT%H:%M:%S"
    rows = [",".join(COLUMNS)]
    for i, (t, status, title) in enumerate(events):
        rid = str(900000 + i)
        rows.append(",".join(["1.0", "mql5:" + rid, t.strftime(fmt), "Etc/UTC", "+00:00", t.strftime(fmt) + "Z", status, "USD", "HIGH",
                              '"' + title + '"', "true", "mql5", rid, "", now.strftime(fmt) + "Z", "0", "approximate test calendar"]))
    csv_bytes = ("\n".join(rows) + "\n").encode("utf-8")
    os.makedirs(a.out_dir, exist_ok=True)
    with open(os.path.join(a.out_dir, "news-calendar.csv"), "wb") as f:
        f.write(csv_bytes)
    manifest = {"schema_version": "1.0", "validation_status": "VALID", "source_provider": "mql5",
                "calendar_sha256": hashlib.sha256(csv_bytes).hexdigest(), "calendar_bytes": len(csv_bytes), "row_count": len(events),
                "source_as_of_utc": now.strftime(fmt) + "Z",
                "coverage_start_utc": dt.datetime(start.year, start.month, start.day).strftime(fmt) + "Z",
                "coverage_end_utc": dt.datetime(end.year, end.month, end.day).strftime(fmt) + "Z",
                "note": "APPROXIMATE TEST CALENDAR (tools/make_test_calendar.py), not a real export"}
    with open(os.path.join(a.out_dir, "news-calendar.manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    n_t = sum(1 for e in events if e[1] != "EXACT")
    print(f"{len(events)} rows ({n_t} tentative/all-day) -> {a.out_dir}")


if __name__ == "__main__":
    main()
