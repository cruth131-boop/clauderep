"""Bewertet Signal-CSV des Harness auf M1-Daten (realistische Ausführung).

Annahmen (bewusst konservativ):
  * Signal auf Schluss der Kerze -> Einstieg zum Open der nächsten M1-Kerze.
  * Daten sind Bid-Kurse. Long kauft zum Ask (Bid + Spread), Short schließt zum Ask.
  * Slippage auf Market-Fills (Einstieg und Stop), Kommission pro Round-Turn.
  * Liegen SL und TP in derselben M1-Kerze, zählt der SL (Worst Case).
  * Kurslücken (Wochenende) werden zum Open der Lückenkerze gefüllt.
  * TP1 schließt TP1Share der Position, danach Stop auf Einstieg (Break-even).

Aufruf: python3 evaluate.py signals.csv m1.csv [--tf 2] [--spread 0.20] [--slip 0.05]
        [--comm 0.07] [--max-bars 0] [--split 2025-07-01] [--json out.json]
"""
import argparse, json, sys
import numpy as np, pandas as pd

try:
    from numba import njit
except ImportError:  # läuft auch ohne numba, nur langsamer
    def njit(*a, **k):
        return (lambda f: f) if not (len(a) == 1 and callable(a[0])) else a[0]


@njit(cache=True)
def simulate(entry_idx, direction, sl, tp1, tp2, share1, o, h, l, c, spread, slip, comm, max_bars):
    n = len(entry_idx)
    res_r = np.full(n, np.nan)
    exit_idx = np.full(n, -1)
    for k in range(n):
        i0 = entry_idx[k]
        d = direction[k]
        if i0 < 0:
            continue
        if d > 0:
            e = o[i0] + spread + slip
        else:
            e = o[i0] - slip
        risk = (e - sl[k]) if d > 0 else (sl[k] - e)
        if risk <= 0:
            continue
        stop = sl[k]
        rem = 1.0
        pnl = 0.0
        hit1 = share1[k] <= 0.0 or np.isnan(tp1[k])
        last = len(o) - 1 if max_bars <= 0 else min(len(o) - 1, i0 + max_bars - 1)
        j = i0
        done = False
        while j <= last:
            if d > 0:
                lo, hi, op = l[j], h[j], o[j]
                if lo <= stop:  # Stop zuerst (Worst Case)
                    px = min(stop, op) - slip
                    pnl += rem * (px - e); rem = 0.0; done = True
                else:
                    if (not hit1) and hi >= tp1[k]:
                        px = max(tp1[k], op) if j > i0 else tp1[k]
                        pnl += share1[k] * (px - e); rem -= share1[k]; hit1 = True; stop = max(stop, e)
                    if hi >= tp2[k]:
                        px = max(tp2[k], op) if j > i0 else tp2[k]
                        pnl += rem * (px - e); rem = 0.0; done = True
            else:
                lo, hi, op = l[j] + spread, h[j] + spread, o[j] + spread  # Ask
                if hi >= stop:
                    px = max(stop, op) + slip
                    pnl += rem * (e - px); rem = 0.0; done = True
                else:
                    if (not hit1) and lo <= tp1[k]:
                        px = min(tp1[k], op) if j > i0 else tp1[k]
                        pnl += share1[k] * (e - px); rem -= share1[k]; hit1 = True; stop = min(stop, e)
                    if lo <= tp2[k]:
                        px = min(tp2[k], op) if j > i0 else tp2[k]
                        pnl += rem * (e - px); rem = 0.0; done = True
            if done:
                break
            j += 1
        if not done:  # Zeitstopp / Datenende: Schluss der letzten Kerze
            j = last
            px = c[j] - slip if d > 0 else c[j] + spread + slip
            pnl += rem * ((px - e) if d > 0 else (e - px))
        res_r[k] = (pnl - comm) / risk
        exit_idx[k] = j
    return res_r, exit_idx


def load_m1(path):
    m1 = pd.read_csv(path, header=None, names=['t', 'o', 'h', 'l', 'c'], parse_dates=['t'])
    return m1


def evaluate(sig, m1, tf=2, spread=0.20, slip=0.05, comm=0.07, max_bars=0, one_at_a_time=True):
    t = m1['t'].values
    sig = sig.copy()
    sig['Time'] = pd.to_datetime(sig['Time'])
    close_time = sig['Time'].values + np.timedelta64(tf, 'm')
    idx = np.searchsorted(t, close_time, side='left')
    idx[idx >= len(t)] = -1
    d = sig['Direction'].values.astype(np.int64)
    sl = sig['StopLoss'].values.astype(float)
    if 'TakeProfit2' in sig:
        tp1 = sig['TakeProfit1'].values.astype(float); tp2 = sig['TakeProfit2'].values.astype(float)
        share = sig['TP1Share'].values.astype(float) if 'TP1Share' in sig else np.full(len(sig), 0.5)
    else:
        tp2 = sig['TakeProfit'].values.astype(float); tp1 = tp2.copy(); share = np.zeros(len(sig))
    r, ex = simulate(idx.astype(np.int64), d, sl, tp1, tp2, share, m1['o'].values, m1['h'].values, m1['l'].values,
                     m1['c'].values, spread, slip, comm, max_bars)
    sig['R'] = r
    sig['EntryIdx'] = idx
    sig['ExitIdx'] = ex
    sig = sig[~np.isnan(sig['R'])]
    if one_at_a_time:  # Signale während eines offenen Trades ignorieren
        keep, busy_until = [], -1
        for ei, xi in zip(sig['EntryIdx'].values, sig['ExitIdx'].values):
            ok = ei > busy_until
            keep.append(ok)
            if ok:
                busy_until = xi
        sig = sig[np.array(keep, dtype=bool)]
    return sig


def stats(df, days):
    r = df['R'].values
    n = len(r)
    if n == 0:
        return dict(n=0)
    eq = np.cumsum(r)
    dd = float(np.max(np.maximum.accumulate(np.concatenate([[0], eq]))[1:] - eq)) if n else 0.0
    wins, losses = r[r > 0].sum(), -r[r < 0].sum()
    return dict(n=n, per_day=round(n / max(days, 1), 2), win=round(float((r > 0).mean()) * 100, 1),
                avgR=round(float(r.mean()), 3), sumR=round(float(r.sum()), 1),
                pf=round(float(wins / losses), 2) if losses > 0 else None,
                maxDD_R=round(dd, 1), t=round(float(r.mean() / (r.std(ddof=1) / np.sqrt(n))), 2) if n > 2 else None)


def trading_days(m1, start=None, end=None):
    t = m1['t']
    if start is not None:
        t = t[t >= start]
    if end is not None:
        t = t[t < end]
    return t.dt.normalize().nunique()


def report(sig, m1, split, **kw):
    ev = evaluate(sig, m1, **kw)
    sp = pd.Timestamp(split)
    out = {'gesamt': stats(ev, trading_days(m1)),
           'IS': stats(ev[ev['Time'] < sp], trading_days(m1, end=sp)),
           'OOS': stats(ev[ev['Time'] >= sp], trading_days(m1, start=sp)),
           'long': stats(ev[ev['Direction'] > 0], trading_days(m1)),
           'short': stats(ev[ev['Direction'] < 0], trading_days(m1))}
    q = ev['Time'].dt.to_period('Q')
    for p in sorted(q.unique()):
        out[str(p)] = stats(ev[q == p], trading_days(m1, p.start_time, p.end_time + pd.Timedelta(seconds=1)))
    if 'Setup' in ev:
        for s in sorted(ev['Setup'].unique()):
            out['setup_' + str(s)] = stats(ev[ev['Setup'] == s], trading_days(m1))
    return out, ev


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('signals'); ap.add_argument('m1')
    ap.add_argument('--tf', type=int, default=2)
    ap.add_argument('--spread', type=float, default=0.20)
    ap.add_argument('--slip', type=float, default=0.05)
    ap.add_argument('--comm', type=float, default=0.07)
    ap.add_argument('--max-bars', type=int, default=0, help='Zeitstopp in M1-Kerzen (0 = aus)')
    ap.add_argument('--split', default='2025-07-01')
    ap.add_argument('--until', default=None, help='nur Signale vor diesem Datum (In-Sample-Arbeit)')
    ap.add_argument('--all-signals', action='store_true', help='überlappende Signale nicht verwerfen')
    ap.add_argument('--json')
    a = ap.parse_args()
    m1 = load_m1(a.m1)
    sig = pd.read_csv(a.signals)
    if a.until:
        sig = sig[pd.to_datetime(sig['Time']) < pd.Timestamp(a.until)]
        m1 = m1[m1['t'] < pd.Timestamp(a.until)].reset_index(drop=True)
    out, ev = report(sig, m1, a.split, tf=a.tf, spread=a.spread, slip=a.slip, comm=a.comm,
                     max_bars=a.max_bars, one_at_a_time=not a.all_signals)
    for k, v in out.items():
        if a.until and k == 'OOS':
            continue
        print(f'{k:>10}: {v}')
    if a.json:
        json.dump(out, open(a.json, 'w'), indent=1)
