"""ejtraderLabs XAUUSDm15.csv (Brokerzeit = New York + 7 h, Preise x100) -> UTC-CSV ohne Kopfzeile.

Aufruf: python3 m15_from_mt5.py XAUUSDm15.csv data/m15_hist.csv
Quelle: https://github.com/ejtraderLabs/historical-data
"""
import sys
import pandas as pd

d = pd.read_csv(sys.argv[1], parse_dates=['Date'])
for c in ['open', 'high', 'low', 'close']:
    d[c] = d[c] / 100
ny = (d.Date - pd.Timedelta(hours=7)).dt.tz_localize('America/New_York', ambiguous='NaT', nonexistent='NaT')
d['t'] = ny.dt.tz_convert('UTC').dt.tz_localize(None)
d = d.dropna(subset=['t']).sort_values('t').drop_duplicates('t')
d[['t', 'open', 'high', 'low', 'close']].to_csv(sys.argv[2], index=False, header=False, date_format='%Y-%m-%d %H:%M:%S')
print(len(d), d.t.min(), '->', d.t.max())
