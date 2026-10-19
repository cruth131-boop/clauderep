"""Prüft vorab festgelegte Hypothesen aus der Literatur zu Tageszeit-Effekten in Gold.

H1 US-Session short (08:20-13:30 New York), H2 Overnight long (13:30-08:20, Mo-Do),
H3 Intraday-Momentum (erste -> letzte Halbstunde), H4 Session-Trades in Richtung SMA-200-Tagestrend,
H5 Slot-Persistenz (Heston/Korajczyk/Sadka): 2 Sessions bzw. 4h-Slots, Lookback 20 Tage.
Ergebnis in USD je Trade vor/nach 0,37 USD Kosten.

Aufruf: python3 session_hypotheses.py DATENORDNER   (erwartet m15_hist.csv und m1.csv, UTC, ohne Kopfzeile)
"""
import sys
import numpy as np, pandas as pd
W = sys.argv[1] if len(sys.argv) > 1 else 'data'
COST = 0.37  # USD je Round-Turn (Spread + Slippage + Kommission)

def load(path):
    d = pd.read_csv(path, header=None, names=['t', 'o', 'h', 'l', 'c'], parse_dates=['t'])
    d['et'] = d.t.dt.tz_localize('UTC').dt.tz_convert('America/New_York').dt.tz_localize(None)
    return d.set_index('et').sort_index()

def price_at(d, ts):
    # Open der ersten Kerze ab Zeitpunkt ts (max. 30 min später), sonst NaN
    i = d.index.searchsorted(ts)
    if i >= len(d) or (d.index[i] - ts) > pd.Timedelta(minutes=30):
        return np.nan
    return d.o.iloc[i]

def legs(d):
    rows = []
    days = pd.Series(d.index.normalize().unique())
    for day in days:
        if day.dayofweek > 4: continue
        p0820 = price_at(d, day + pd.Timedelta(hours=8, minutes=20))
        p0850 = price_at(d, day + pd.Timedelta(hours=8, minutes=50))
        p1300 = price_at(d, day + pd.Timedelta(hours=13))
        p1330 = price_at(d, day + pd.Timedelta(hours=13, minutes=30))
        nxt = day + pd.Timedelta(days=1)
        pn = price_at(d, nxt + pd.Timedelta(hours=8, minutes=20)) if day.dayofweek <= 3 else np.nan
        rows.append(dict(day=day, us=p1330 - p0820, night=pn - p1330, first=p0850 - p0820, last=p1330 - p1300, px=p0820))
    return pd.DataFrame(rows).set_index('day')

def summarize(x, sign, name):
    x = x.dropna() * sign
    net = x - COST
    t = net.mean() / (net.std(ddof=1) / np.sqrt(len(net))) if len(net) > 2 else np.nan
    return f'{name:<22} n={len(x):4d}  brutto Ø {x.mean():+6.2f} USD  netto Ø {net.mean():+6.2f} USD  Treffer {100*(net>0).mean():4.1f}%  t={t:+5.2f}'

for label, path in [('M15 2012-2022', f'{W}/m15_hist.csv'), ('M1 2025', f'{W}/m1.csv')]:
    d = load(path)
    L = legs(d)
    L['mom'] = np.sign(L['first']) * L['last']  # H3: Richtung der ersten Halbstunde in der letzten handeln
    print(f'===== {label} =====')
    print(summarize(L.us, -1, 'H1 US-Session short'))
    print(summarize(L.night, 1, 'H2 Overnight long'))
    print(summarize(L.mom, 1, 'H3 Intraday-Momentum'))
    if label.startswith('M15'):
        for y, g in L.groupby(L.index.year):
            print(f'  {y}: H1 {(-g.us - COST).mean():+6.2f}  H2 {(g.night - COST).mean():+6.2f}  H3 {(g.mom.dropna() - COST).mean():+6.2f}  (USD netto je Trade, Gold ~{g.px.mean():.0f})')
    else:
        for q, g in L.groupby(L.index.quarter):
            print(f'  Q{q}: H1 {(-g.us - COST).mean():+6.2f}  H2 {(g.night - COST).mean():+6.2f}  H3 {(g.mom.dropna() - COST).mean():+6.2f}')

# H4 (vorab festgelegt): Intraday-Trades nur in Richtung des Tagestrends (Schluss vs. SMA 200 Tage)
print('===== H4 Tagestrend-Filter (SMA 200), M15 2012-2022 =====')
d = load(f'{W}/m15_hist.csv')
L = legs(d)
daily = d.c.resample('D').last().dropna()
trend = np.sign(daily - daily.rolling(200).mean()).shift(1)  # nur Vortageswert, kein Lookahead
L['trend'] = trend.reindex(L.index)
L = L.dropna(subset=['trend'])
L = L[L.trend != 0]
print(summarize(L.us * L.trend, 1, 'US-Session in Trendrichtung'))
print(summarize(L.night * L.trend, 1, 'Overnight in Trendrichtung'))
both = (L.us.fillna(0) + L.night.fillna(0)) * L.trend
print(summarize(both, 1, 'ein Trade 08:20->08:20'))
for y, g in L.groupby(L.index.year):
    print(f'  {y}: US {(g.us * g.trend - COST).mean():+6.2f}  Overnight {((g.night * g.trend).dropna() - COST).mean():+6.2f}')

# H5 (vorab festgelegt): Slot-Persistenz nach Heston/Korajczyk/Sadka – Richtung = Vorzeichen des
# mittleren Slot-Ertrags der letzten 20 Handelstage (nur Vergangenheit).
def slot_returns(d, hours):
    # Ertrag je Slot: Open an Slot-Beginn bis Open an Slot-Ende (UTC-Stunden), nur Mo-Fr
    rows = []
    for day in pd.Series(d.index.normalize().unique()):
        if day.dayofweek > 4: continue
        for a, b in hours:
            pa, pb = price_at(d, day + pd.Timedelta(hours=a)), price_at(d, day + pd.Timedelta(hours=b))
            rows.append(dict(day=day, slot=a, r=pb - pa))
    return pd.DataFrame(rows)

def h5(R, lookback=20):
    R = R.dropna().sort_values(['slot', 'day']).copy()
    R['sig'] = R.groupby('slot').r.transform(lambda s: np.sign(s.rolling(lookback).mean().shift(1)))
    R = R.dropna(subset=['sig']); R = R[R.sig != 0]
    return R.set_index('day').sort_index(), (R.r * R.sig)

for label, path in [('M15 2012-2022', f'{W}/m15_hist.csv'), ('M1 2025', f'{W}/m1.csv')]:
    d = load(path)  # Index in NY-Zeit
    print(f'===== H5 {label} =====')
    a = slot_returns(d, [(8 + 1/3, 13.5), (13.5, 24 + 8 + 1/3)])
    R, x = h5(a)
    print(summarize(x, 1, 'H5a 2 Sessions/Tag'))
    b = slot_returns(d, [(h, h + 4) for h in (0, 4, 8, 12, 16)])
    R, x = h5(b)
    print(summarize(x, 1, 'H5b 4h-Slots'))
    if label.startswith('M15'):
        R['x'] = x.values
        print('   H5b je Jahr netto:', {y: round(g.x.mean() - COST, 2) for y, g in R.groupby(R.index.year)})
