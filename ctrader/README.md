# XAUUSD M2 Signalgeber für cTrader

`XauM2SignalGenerator.cs` ist ein cTrader-Indikator. Er zeigt Kauf- und Verkaufssignale für **XAUUSD auf dem 2-Minuten-Chart** an und schlägt dazu Stop-Loss und Take-Profit vor. Er platziert **keine** Orders.

## Recherche: beliebte TradingView-Strategien

Die TradingView-Seite selbst war aus der Arbeitsumgebung nicht direkt erreichbar. Die Auswahl beruht daher auf Websuche-Ergebnissen und Drittquellen. Like- und Boost-Zahlen stammen aus Blogs und sind nicht live verifiziert.

| Skript | Typ | Logik | Stärke | Schwäche auf M2-Gold |
|---|---|---|---|---|
| **SuperTrend** (KivancOzbilgic), laut Drittquelle ca. 25.000 Boosts | Strategie | ATR-Bänder um hl2, Trendwechsel bei Durchbruch | Klarer Trendfilter, kaum Parameter | Viele Fehlsignale in Seitwärtsphasen |
| **UT Bot** (QuantNomad / Yo_adriiiiaan) | Indikator / Strategie | ATR-Trailing-Stop, Signal beim Kreuzen | Frühe, eindeutige Trigger | Allein sehr "whipsaw"-anfällig |
| **Squeeze Momentum** (LazyBear), laut Drittquelle ca. 97.000 Likes | Indikator | Lineare Regression des Preises gegen Donchian/SMA-Mitte | Gute Momentum-Bestätigung | Kein eigener Einstieg |
| **Smart Money Concepts** (LuxAlgo) | Indikator | BOS/CHoCH, Order Blocks | Struktur-Kontext | Schwer objektiv zu automatisieren |
| **XAUUSD 1-Min Scalping** (uzair2join) | Strategie | RSI(14)-Mean-Reversion + EMA-200-Filter, feste kleine TP/SL | Speziell für Gold-Scalping | Feste Pip-Ziele passen nicht zur schwankenden Volatilität |
| **Gold Scalping mit RSI-Divergenz** (atakhadivi) | Strategie | RSI-Divergenzen auf M1 | Erkennt Umkehrpunkte | Divergenzen sind auf M1/M2 häufig unzuverlässig |

**Fazit:** Keine Strategie ist allein robust genug. Am besten funktioniert die Kombination aus einem Trigger (UT Bot), einem Trendfilter (SuperTrend + EMA 200) und einer Momentum-Bestätigung (RSI + Squeeze). SL und TP werden an der ATR ausgerichtet statt an festen Pips.

## Signal-Logik

**KAUF** auf einer geschlossenen Kerze, wenn alle Bedingungen erfüllt sind:
1. Der Schlusskurs kreuzt den UT-Bot-Trailing-Stop nach oben.
2. Der SuperTrend steht auf Aufwärtstrend.
3. Der Schlusskurs liegt über der EMA 200.
4. Der RSI liegt zwischen 50 und 70.
5. Der Squeeze Momentum ist größer als 0 und steigt (abschaltbar).
6. Die Kerze liegt innerhalb der Session (Standard 07–20 Uhr UTC, also London + New York).
7. Seit dem letzten Signal sind mindestens 5 Bars vergangen, und der Spread liegt unter dem Maximum (nur live geprüft).

**VERKAUF** gilt spiegelbildlich.

**SL** = 1,5 × ATR(14), **TP** = SL × 1,5. Beide Werte lassen sich einstellen.

Signale werden nur auf **geschlossenen Kerzen** berechnet, es gibt also kein Repainting. Der Alarm erscheint als Popup in cTrader, optional zusätzlich per E-Mail. Für E-Mails muss SMTP in den cTrader-Einstellungen eingerichtet sein.

## Installation

1. Öffne cTrader → **Algo** → **Indikatoren** → **Neu**.
2. Ersetze den Code durch den Inhalt von `XauM2SignalGenerator.cs`.
3. Klicke auf **Build** (Strg+B).
4. Öffne einen XAUUSD-Chart, stelle den Zeitrahmen **m2** ein und füge den Indikator hinzu.

## Wichtige Hinweise

- Der Code wurde hier **nicht kompiliert**, weil in der Arbeitsumgebung kein cTrader/.NET verfügbar war. Falls beim Build ein Fehler auftritt, z. B. weil `Notifications.ShowPopup` in einer älteren cTrader-Version fehlt, kann die betreffende Zeile entfernt werden.
- Die Standardparameter sind sinnvolle Ausgangswerte, aber **nicht optimiert oder backgetestet**. Teste sie vor echtem Einsatz auf einem Demokonto. Für einen Backtest kann die Logik in einen cBot übernommen werden.
- Gold auf M2 reagiert stark auf Spread, Slippage und News, etwa NFP, CPI oder FOMC. Das ist keine Anlageberatung.

## Quellen

- https://www.tradingview.com/script/0DLK91nb-XAUUSD-1-Minute-Scalping-Strategy-Advanced-Strategy-for-Exits/
- https://www.tradingview.com/script/hdiQlcK8-Advanced-Gold-Scalping-Strategy-with-RSI-Divergence/
- https://hackernoon.com/the-truth-about-tradingviews-supertrend-strategy-after-67-years-of-backtesting
- https://blog.pickmytrade.io/top-free-indicators-and-strategies-on-tradingview/
- https://pineify.app/resources/blog/best-scripts-on-tradingview-ultimate-guide-to-top-indicators-and-trading-tools
- https://medium.com/@FMZQuant/short-term-trading-strategy-for-gold-xauusd-scalper-1m-3096f1addfc4
