"""HistData-M1 (EST ohne Sommerzeit = UTC-5) -> UTC-CSV für M1/M2/M3/M5 im cTrader-Bar-Raster.

Aufruf: python3 prepare_data.py DAT_ASCII_XAUUSD_M1_2025.csv data/
Quelle der für die Tests verwendeten Datei: https://github.com/tanjiroweb3/forex-data
"""
import sys
import pandas as pd

src, outdir = sys.argv[1], sys.argv[2]
df = pd.read_csv(src, sep=';', header=None, names=['t', 'o', 'h', 'l', 'c', 'v'])
df['t'] = pd.to_datetime(df['t'], format='%Y%m%d %H%M%S') + pd.Timedelta(hours=5)
df = df.set_index('t').sort_index()
df = df[~df.index.duplicated()]
df[['o', 'h', 'l', 'c']].to_csv(f'{outdir}/m1.csv', date_format='%Y-%m-%d %H:%M:%S', header=False)
for tf in (2, 3, 5):
    r = df.resample(f'{tf}min', label='left', closed='left').agg({'o': 'first', 'h': 'max', 'l': 'min', 'c': 'last'}).dropna()
    r.to_csv(f'{outdir}/m{tf}.csv', date_format='%Y-%m-%d %H:%M:%S', header=False)
print('M1-Kerzen:', len(df), df.index[0], '->', df.index[-1])
