#!/usr/bin/env python3
"""Strategy-family correlation study on REAL M15 candles only (no synthetic micro structure).

Three deliberately simple, fully specified families (proxies, not the cBot itself):
  ICT  liquidity raid -> reclaim -> M15 market-structure shift -> limit at the leg's equilibrium (50 %),
       stop beyond the raid extreme, target 2R. Raided pools: previous NY-day H/L, Asia H/L, London H/L.
       Raids only inside the London / NY-AM killzones (02:00-11:00 NY). One trade per direction and day.
  ORB  opening-range breakout: range = first 30 min after 03:00 NY (London) and 09:30 NY (New York);
       entry on the first M15 close outside the range, stop at the opposite side, target 2R,
       time exit 08:00 NY (London) / 15:30 NY (NY).
  TRD  H1 trend following: close beyond the 20-bar Donchian channel in the direction of the 100-bar SMA,
       initial stop 2 ATR, chandelier trail 3 ATR, no target.
Costs: 1.2 % of the 20-day median NY-day range per round trip (gold ~0.25 USD, EURUSD ~0.7 pip).
Intrabar order is unknown on M15: when stop and target lie inside the same candle the stop counts first.
All results are R multiples per trade; daily R is attributed to the exit's NY date.

  strategy_family_study.py --root ejtraderLabs/historical-data --start 2016-01-01 --end 2022-03-01
"""
import argparse
import csv
import datetime as dt
import math

import numpy as np

SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD"]


def nth_sunday(y, m, n):
    d = dt.datetime(y, m, 1)
    d += dt.timedelta(days=(6 - d.weekday()) % 7)
    return d + dt.timedelta(days=7 * (n - 1))


def us_dst(t):
    return nth_sunday(t.year, 3, 2) + dt.timedelta(hours=7) <= t < nth_sunday(t.year, 11, 1) + dt.timedelta(hours=6)


def server_to_utc(t):
    u = t - dt.timedelta(hours=3)
    return u if us_dst(u) else t - dt.timedelta(hours=2)


def to_ny(u):
    return u - dt.timedelta(hours=4 if us_dst(u) else 5)


def load(path, start, end):
    T, O, H, L, C = [], [], [], [], []
    with open(path) as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            u = server_to_utc(dt.datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S"))
            if u < start or u >= end:
                continue
            T.append(to_ny(u))
            O.append(float(row[1])); H.append(float(row[2])); L.append(float(row[3])); C.append(float(row[4]))
    return T, np.array(O), np.array(H), np.array(L), np.array(C)


class Market:
    def __init__(self, T, O, H, L, C):
        self.T, self.O, self.H, self.L, self.C = T, O, H, L, C
        self.n = len(T)
        self.date = [t.date() for t in T]
        self.hour = np.array([t.hour + t.minute / 60.0 for t in T])
        # NY calendar-day ranges and the 20-day median range known at the start of each day
        days = {}
        for i, d in enumerate(self.date):
            lo, hi = days.get(d, (math.inf, -math.inf))
            days[d] = (min(lo, L[i]), max(hi, H[i]))
        self.days = sorted(days)
        self.day_hl = days
        self.adr = {}
        hist = []
        for d in self.days:
            self.adr[d] = float(np.median(hist[-20:])) if len(hist) >= 5 else None
            hist.append(days[d][1] - days[d][0])

    def prev_day(self, d):
        k = self.days.index(d) if d in self.day_hl else -1
        return self.days[k - 1] if k > 0 else None


def resolve(m, i0, direction, entry, stop, target, t_exit_hour, cost):
    """Walk forward from bar i0 (first bar after fill). Returns (exit index, R)."""
    risk = abs(entry - stop)
    for k in range(i0, m.n):
        if m.date[k] != m.date[i0 - 1] and m.hour[k] >= 0 and k > i0 and m.date[k] != m.date[k - 1] and t_exit_hour is not None:
            return k - 1, (direction * (m.C[k - 1] - entry)) / risk - cost / risk
        hit_stop = m.L[k] <= stop if direction > 0 else m.H[k] >= stop
        hit_tgt = target is not None and (m.H[k] >= target if direction > 0 else m.L[k] <= target)
        if hit_stop:
            return k, -1.0 - cost / risk
        if hit_tgt:
            return k, (abs(target - entry)) / risk - cost / risk
        if t_exit_hour is not None and m.hour[k] >= t_exit_hour:
            return k, (direction * (m.C[k] - entry)) / risk - cost / risk
    return m.n - 1, (direction * (m.C[-1] - entry)) / risk - cost / risk


def ict(m, meta=None):
    """meta (optional list) receives (fill time, direction, raid bar time, raided level kind) per trade."""
    trades = []
    i = 0
    by_day = {}
    for idx, d in enumerate(m.date):
        by_day.setdefault(d, []).append(idx)
    for d in m.days:
        adr = m.adr[d]
        pd_ = m.prev_day(d)
        if adr is None or pd_ is None:
            continue
        idxs = by_day[d]
        pdh, pdl = m.day_hl[pd_][1], m.day_hl[pd_][0]
        prev_idxs = by_day.get(pd_, [])
        asia = [k for k in prev_idxs if m.hour[k] >= 20.0]
        a_hi = max(m.H[k] for k in asia) if asia else None
        a_lo = min(m.L[k] for k in asia) if asia else None
        cost = 0.012 * adr
        busy_until = -1
        for direction in (1, -1):
            done = False
            for j, k in enumerate(idxs):
                if done or k <= busy_until:
                    continue
                h = m.hour[k]
                if not (2.0 <= h < 11.0):
                    continue
                lon = [q for q in idxs if 2.0 <= m.hour[q] < 5.0 and q < k] if h >= 5.0 else []
                levels = [pdl, a_lo] if direction > 0 else [pdh, a_hi]
                if lon:
                    levels.append(min(m.L[q] for q in lon) if direction > 0 else max(m.H[q] for q in lon))
                levels = [x for x in levels if x is not None]
                prev_close = m.C[k - 1]
                swept = [x for x in levels if (m.L[k] < x - 0.02 * adr and prev_close > x) if direction > 0] if direction > 0 else \
                        [x for x in levels if (m.H[k] > x + 0.02 * adr and prev_close < x)]
                if not swept:
                    continue
                level = max(swept) if direction > 0 else min(swept)
                kind = "PD" if level == (pdl if direction > 0 else pdh) else "ASIA" if level == (a_lo if direction > 0 else a_hi) else "LONDON"
                # reclaim within 2 bars
                ext = m.L[k] if direction > 0 else m.H[k]
                rec = None
                for q in range(k, min(k + 2, m.n)):
                    ext = min(ext, m.L[q]) if direction > 0 else max(ext, m.H[q])
                    if (m.C[q] > level) if direction > 0 else (m.C[q] < level):
                        rec = q
                        break
                if rec is None:
                    continue
                swing = max(m.H[max(0, k - 6):k]) if direction > 0 else min(m.L[max(0, k - 6):k])
                mss = None
                for q in range(rec, min(rec + 12, m.n)):
                    ext = min(ext, m.L[q]) if direction > 0 else max(ext, m.H[q])
                    if (m.C[q] > swing) if direction > 0 else (m.C[q] < swing):
                        mss = q
                        break
                if mss is None:
                    continue
                imp = max(m.H[k:mss + 1]) if direction > 0 else min(m.L[k:mss + 1])
                entry = ext + 0.5 * (imp - ext)
                stop = ext - 0.05 * adr if direction > 0 else ext + 0.05 * adr
                risk = abs(entry - stop)
                if not (0.08 * adr <= risk <= 0.6 * adr):
                    continue
                fill = None
                for q in range(mss + 1, min(mss + 13, m.n)):
                    if (m.L[q] <= entry) if direction > 0 else (m.H[q] >= entry):
                        fill = q
                        break
                    if (m.H[q] >= entry + 2 * risk) if direction > 0 else (m.L[q] <= entry - 2 * risk):
                        break  # ran to target without retrace
                if fill is None:
                    continue
                # fill bar itself: stop counts first if touched
                if (m.L[fill] <= stop) if direction > 0 else (m.H[fill] >= stop):
                    trades.append((m.T[fill], m.T[fill], direction, -1.0 - cost / risk))
                    if meta is not None:
                        meta.append((m.T[fill], direction, m.T[k], kind))
                    done = True
                    continue
                ex, r = resolve(m, fill + 1, direction, entry, stop, entry + direction * 2 * risk, 15.0, cost)
                trades.append((m.T[fill], m.T[ex], direction, r))
                if meta is not None:
                    meta.append((m.T[fill], direction, m.T[k], kind))
                busy_until = ex
                done = True
    return trades


def orb(m):
    trades = []
    by_day = {}
    for idx, d in enumerate(m.date):
        by_day.setdefault(d, []).append(idx)
    for d in m.days:
        adr = m.adr[d]
        if adr is None:
            continue
        cost = 0.012 * adr
        idxs = by_day[d]
        for start, exit_h in ((3.0, 8.0), (9.5, 15.5)):
            rng = [k for k in idxs if start <= m.hour[k] < start + 0.5]
            if len(rng) < 2:
                continue
            hi, lo = max(m.H[k] for k in rng), min(m.L[k] for k in rng)
            if not (0.05 * adr <= hi - lo <= 0.5 * adr):
                continue
            after = [k for k in idxs if start + 0.5 <= m.hour[k] < exit_h]
            for k in after:
                direction = 1 if m.C[k] > hi else -1 if m.C[k] < lo else 0
                if direction == 0:
                    continue
                entry = m.C[k]
                stop = lo if direction > 0 else hi
                risk = abs(entry - stop)
                if risk <= 0:
                    break
                ex, r = resolve(m, k + 1, direction, entry, stop, entry + direction * 2 * risk, exit_h, cost)
                trades.append((m.T[k], m.T[ex], direction, r))
                break
    return trades


def trend(m):
    # aggregate to H1
    hT, hO, hH, hL, hC, hIdx = [], [], [], [], [], []
    for i, t in enumerate(m.T):
        key = t.replace(minute=0)
        if not hT or hT[-1] != key:
            hT.append(key); hO.append(m.O[i]); hH.append(m.H[i]); hL.append(m.L[i]); hC.append(m.C[i]); hIdx.append(i)
        else:
            hH[-1] = max(hH[-1], m.H[i]); hL[-1] = min(hL[-1], m.L[i]); hC[-1] = m.C[i]
    hH, hL, hC = np.array(hH), np.array(hL), np.array(hC)
    n = len(hT)
    tr = np.maximum(hH[1:] - hL[1:], np.maximum(abs(hH[1:] - hC[:-1]), abs(hL[1:] - hC[:-1])))
    atr = np.concatenate([[np.nan], np.convolve(tr, np.ones(14) / 14, mode="full")[:n - 1]])
    trades = []
    pos = 0
    for i in range(101, n):
        a = atr[i]
        if not a > 0:
            continue
        sma = hC[i - 100:i].mean()
        if pos == 0:
            up = hC[i] > hH[i - 20:i].max() and hC[i] > sma
            dn = hC[i] < hL[i - 20:i].min() and hC[i] < sma
            if up or dn:
                pos = 1 if up else -1
                entry, stop, ent_t, risk = hC[i], hC[i] - pos * 2 * a, hT[i], 2 * a
                best = hC[i]
                cost = 0.012 * (m.adr.get(hT[i].date()) or 0)
        else:
            hit = hL[i] <= stop if pos > 0 else hH[i] >= stop
            if hit:
                trades.append((ent_t, hT[i], pos, pos * (stop - entry) / risk - cost / risk))
                pos = 0
                continue
            best = max(best, hH[i]) if pos > 0 else min(best, hL[i])
            stop = max(stop, best - 3 * a) if pos > 0 else min(stop, best + 3 * a)
    return trades


def stats(tr, ndays):
    r = np.array([x[3] for x in tr]) if tr else np.zeros(0)
    pf = r[r > 0].sum() / -r[r < 0].sum() if (r < 0).any() else float("nan")
    return len(r), len(r) / ndays, (r > 0).mean() * 100 if len(r) else 0, r.sum(), pf


def daily(tr, days):
    idx = {d: i for i, d in enumerate(days)}
    v = np.zeros(len(days))
    for e, x, d, r in tr:
        k = idx.get(x.date())
        if k is not None:
            v[k] += r
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--start", default="2016-01-01")
    ap.add_argument("--end", default="2022-03-01")
    a = ap.parse_args()
    start, end = dt.datetime.fromisoformat(a.start), dt.datetime.fromisoformat(a.end)
    res = {}
    all_days = None
    for s in SYMBOLS:
        m = Market(*load(f"{a.root}/{s}/{s}m15.csv", start, end))
        days = [d for d in m.days if d.weekday() < 5]
        all_days = days if all_days is None else sorted(set(all_days) & set(days))
        res[s] = {"ICT": ict(m), "ORB": orb(m), "TRD": trend(m), "_days": days}
    nd = len(all_days)
    print(f"period {a.start}..{a.end}, common NY trading days {nd}\n")
    print(f"{'symbol':8s} {'family':4s} {'trades':>6s} {'/day':>5s} {'win%':>5s} {'sumR':>7s} {'PF':>5s}")
    for s in SYMBOLS:
        for f in ("ICT", "ORB", "TRD"):
            n, pd_, w, sr, pf = stats(res[s][f], nd)
            print(f"{s:8s} {f:4s} {n:6d} {pd_:5.2f} {w:5.1f} {sr:7.1f} {pf:5.2f}")
    vec = {(s, f): daily(res[s][f], all_days) for s in SYMBOLS for f in ("ICT", "ORB", "TRD")}

    def corr(a_, b_):
        return float(np.corrcoef(vec[a_], vec[b_])[0, 1])

    print("\nfamily correlation of daily R, per symbol (ICT/ORB, ICT/TRD, ORB/TRD):")
    for s in SYMBOLS:
        print(f"  {s:8s} {corr((s,'ICT'),(s,'ORB')):6.2f} {corr((s,'ICT'),(s,'TRD')):6.2f} {corr((s,'ORB'),(s,'TRD')):6.2f}")
    for f in ("ICT", "ORB"):
        print(f"\n{f}: cross-instrument correlation of daily R")
        print("          " + " ".join(f"{s:>8s}" for s in SYMBOLS))
        for s in SYMBOLS:
            print(f"  {s:8s}" + " ".join(f"{corr((s,f),(t,f)):8.2f}" for t in SYMBOLS))

    usd = {"XAUUSD": -1, "EURUSD": -1, "GBPUSD": -1, "AUDUSD": -1, "USDJPY": 1}
    print("\nICT pairs with gold, days on which both traded: n, corr(R), share same USD direction, share both lost")
    for t in SYMBOLS[1:]:
        da = {x.date(): (dirn, r) for e, x, dirn, r in res["XAUUSD"]["ICT"]}
        db = {x.date(): (dirn, r) for e, x, dirn, r in res[t]["ICT"]}
        both = sorted(set(da) & set(db))
        if len(both) < 10:
            continue
        ra = np.array([da[d][1] for d in both]); rb = np.array([db[d][1] for d in both])
        same = np.mean([da[d][0] * usd["XAUUSD"] == db[d][0] * usd[t] for d in both])
        print(f"  XAUUSD/{t}: n={len(both)} corr={np.corrcoef(ra, rb)[0, 1]:+.2f} same_usd={same:.2f} both_lost={np.mean((ra < 0) & (rb < 0)):.2f}"
              f" (independent would be {np.mean(ra < 0) * np.mean(rb < 0):.2f})")

    g_ict, g_orb, g_trd = vec[("XAUUSD", "ICT")], vec[("XAUUSD", "ORB")], vec[("XAUUSD", "TRD")]
    loss = g_ict < 0
    win = g_ict > 0
    print(f"\nXAUUSD: on ICT losing days (n={loss.sum()}) ORB averages {g_orb[loss].mean():+.2f} R and TRD {g_trd[loss].mean():+.2f} R;"
          f" on ICT winning days (n={win.sum()}) ORB {g_orb[win].mean():+.2f} R, TRD {g_trd[win].mean():+.2f} R")

    def port(keys):
        v = sum(vec[k] for k in keys)
        eq = np.cumsum(v); dd = float(np.max(np.maximum.accumulate(np.concatenate([[0], eq]))[1:] - eq))
        n = sum(len(res[s][f]) for s, f in keys)
        return n / nd, v.sum(), dd, v.mean() / v.std() * math.sqrt(252) if v.std() > 0 else float("nan")

    print("\nportfolios (equal risk per trade): trades/day, sum R, max DD R, daily Sharpe-like")
    for name, keys in [("ICT gold", [("XAUUSD", "ICT")]),
                       ("ICT+ORB gold", [("XAUUSD", "ICT"), ("XAUUSD", "ORB")]),
                       ("ICT+ORB+TRD gold", [("XAUUSD", f) for f in ("ICT", "ORB", "TRD")]),
                       ("ICT 5 symbols", [(s, "ICT") for s in SYMBOLS]),
                       ("ICT+ORB 5 symbols", [(s, f) for s in SYMBOLS for f in ("ICT", "ORB")]),
                       ("all", [(s, f) for s in SYMBOLS for f in ("ICT", "ORB", "TRD")])]:
        tpd, sr, dd, sh = port(keys)
        print(f"  {name:20s} {tpd:5.2f} {sr:8.1f} {dd:7.1f} {sh:6.2f}")


if __name__ == "__main__":
    main()
