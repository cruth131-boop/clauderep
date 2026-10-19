# XAUUSD M2 Signalgeber für cTrader (Version 2, Fibonacci)

`XauM2SignalGenerator.cs` ist ein cTrader-Indikator für **XAUUSD auf dem 2-Minuten-Chart**. Er zeichnet Fibonacci-Level, meldet Kauf- und Verkaufssignale mit Stop-Loss, TP1 und TP2 und platziert **keine** Orders. Eine eingebaute Statistik zeigt auf dem Chart, wie die Signale in der geladenen Historie abgeschnitten hätten, inklusive Kosten.

> **Wichtigstes Ergebnis vorweg:** Der Code ist kompiliert und repaint-frei geprüft. Keines der getesteten Setups hat aber nach realistischen Kosten einen **robusten** Vorteil. Das gilt auch für die Fibonacci-Varianten. Ein Setup sah in der Entwicklungsphase profitabel aus und ist im unberührten Out-of-Sample-Test durchgefallen. Details siehe [Prüfung](#prüfung-auf-overfitting). **Bitte nicht mit echtem Geld handeln, höchstens Demo.**

## Setups

### Setup 1: Asia-Range-Ausbruch mit Fibonacci (Standard: an)
- Die Range ist Hoch/Tief von 00:00–07:00 UTC.
- Schließt eine M2-Kerze zwischen 07:00 und 12:00 UTC **erstmals** außerhalb der Range, kommt ein Signal in Ausbruchsrichtung. Pro Tag gibt es höchstens ein Signal.
- **SL** liegt auf dem 50-%-Retracement der Range, also der Range-Mitte.
- **TP1** liegt auf der 127,2-%-Extension. Dort werden 50 % geschlossen, danach wandert der SL auf Einstand.
- **TP2** liegt auf der 161,8-%-Extension.
- Die Range, die 50-%-Linie und die Extensionen beider Richtungen werden für den laufenden Tag gezeichnet.

### Setup 2: Fibonacci-Rücksetzer im Impuls (Standard: aus)
- Ein ATR-ZigZag erkennt Swings: eine Umkehr ab 3 × ATR(14). Ein Impuls ist das letzte Tief→Hoch (Long) bzw. Hoch→Tief (Short) mit mindestens 6 × ATR.
- Der Rücksetzer muss die Zone **38,2–78,6 %** erreichen. Bei mehr als 78,6 % gilt der Impuls als gescheitert.
- Der Trigger ist eine Wende des **UT Bot** (Originalparameter 1 / 10) in Impulsrichtung, solange der Kurs noch unter dem 0-%-Level liegt.
- Filter sind die EMA 200 (Trendrichtung), die Session 07–20 UTC und der Spread. Es gibt höchstens ein Signal pro Impuls.
- **SL** liegt 0,5 ATR hinter dem Rücksetzer-Extrem, mindestens aber 1 ATR entfernt. **TP1** ist das 0-%-Level, also das Impulsende. **TP2** ist die 127,2-%-Extension. Ein Signal kommt nur, wenn das CRV bis TP1 mindestens 1 beträgt.
- Gezeichnet werden der Impuls und die Level 0 / 38,2 / 50 / 61,8 / 78,6 / 100 % sowie die Extension.

Für beide Setups gilt:
- Signale entstehen nur auf **geschlossenen Kerzen**, und jede Kerze wird genau einmal ausgewertet. Live- und Historienmodus liefern nachweislich identische Signale.
- Alarme gibt es als Popup, Ton und optional per E-Mail.
- Standardmäßig ist nur ein Signal gleichzeitig aktiv. Die Statistik verfolgt dazu einen virtuellen Trade.
- Alle Fibonacci-Werte sind Standardwerte (38,2 / 50 / 61,8 / 78,6 / 127,2 / 161,8 %). Sie wurden nicht auf die Testdaten optimiert.

## Installation

1. Öffne cTrader → **Algo** → **Indikatoren** → **Neu**.
2. Ersetze den Code durch den Inhalt von `XauM2SignalGenerator.cs`.
3. Klicke auf **Build** (Strg+B).
4. Öffne einen XAUUSD-Chart, stelle **m2** ein und füge den Indikator hinzu.
5. Oben links steht die Statistik der geladenen Historie, gerechnet mit deinen Broker-Daten. Je mehr Historie geladen ist, desto aussagekräftiger ist sie.

Der Indikator kompiliert fehlerfrei gegen das offizielle NuGet-Paket `cTrader.Automate` 1.0.21 (siehe `backtest/CompileCheck`).

## Prüfung auf Overfitting

### Daten und Methode
- **Daten:** XAUUSD M1 für das ganze Jahr 2025 (353.951 Kerzen, HistData-Format, nach UTC umgerechnet). Daraus wurden M2/M3/M5 gebaut. Zum Gegencheck dienen XAUUSD M15 von 2012–2022 (230.400 Kerzen). Quellen stehen unten.
- **Der getestete Code ist der ausgelieferte Code.** `backtest/Harness` führt `XauM2SignalGenerator.cs` unverändert über einen Nachbau der cTrader-API aus. Ein Zugriff auf zukünftige Kerzen würde dabei eine Exception auslösen (Lookahead-Schutz).
- **Ausführung** (`backtest/evaluate.py`):
  - Der Einstieg erfolgt zum Open der nächsten M1-Kerze.
  - Gerechnet werden 0,20 Spread, 0,05 Slippage je Market-Fill und 0,07 Kommission, zusammen ≈ 0,37 USD je Trade.
  - SL/TP werden auf M1 aufgelöst. Liegen beide in derselben Kerze, zählt der SL.
  - Es läuft immer nur ein Trade gleichzeitig.
- **In-Sample (IS):** Jan–Jun 2025. Alle Entwurfsentscheidungen wurden nur hier getroffen.
- **Out-of-Sample (OOS):** Jul–Dec 2025. Dieser Zeitraum wurde erst nach dem Einfrieren der Standardwerte ausgewertet, und zwar genau einmal.

### Ergebnisse 2025 (Ø R je Trade nach Kosten, 1 R = Abstand Einstieg–SL)

| Version | Signale/Tag | IS Ø R | IS PF | OOS Ø R | OOS PF |
|---|---|---|---|---|---|
| Alte Version (UT Bot + SuperTrend + EMA + RSI + Squeeze) | 1,7 | −0,125 | 0,80 | −0,077 | 0,88 |
| Setup 2: Fib-Rücksetzer | 2,0 | −0,035 | 0,94 | **−0,188** | 0,72 |
| Setup 1: Range-Ausbruch + Fib (Standard) | 0,6 | +0,098 | 1,43 | **−0,102** | 0,72 |
| Beide Setups | 2,3 | −0,015 | 0,97 | −0,154 | 0,74 |

### Was die Tests zeigen
- **Klassisches Overfitting beim Range-Ausbruch.** In der Entwicklungsphase lagen alle 27 Parameter-Nachbarn im Plus (Range-Ende 6/7/8 Uhr, Einstieg bis 11/12/13 Uhr, SL 38,2/50/61,8 %). Out-of-Sample waren es nur noch 4 von 27, und das knapp. Die Korrelation zwischen IS- und OOS-Ergebnis beträgt 0,12.
- **Langfristig negativ.** Unverändert über 2012–2022 gerechnet, verliert der Range-Ausbruch in 9 von 11 Jahren. Über 1.613 Trades sind es −0,10 R (t = −6,8). Ohne Kosten liegt er bei −0,008 R: Das Signal selbst hat keinen Vorteil, und die Kosten machen es negativ.
- **Der Fib-Rücksetzer hat keinen Vorteil.** Über das ganze Jahr 2025 liegt er bei −0,11 R; das 95-%-Bootstrap-Intervall [−0,21; −0,01] liegt komplett im Minus. Auf M3/M5 ist er schon **vor** Kosten negativ. Ein Limit-Einstieg direkt am 50- oder 61,8-%-Level (Prototyp) war ebenfalls negativ.
- **Frequenz gegen Qualität.** Mehr Signale gab es in den Tests nur zulasten der Qualität. Beide Setups zusammen liefern 2,3 statt 0,6 Signale pro Tag, sind aber schlechter. Auch Varianten ohne Session-Filter, ohne EMA-Filter oder ein zweiter Range-Ausbruch zur NY-Eröffnung brachten mehr Trades, aber keine bessere Erwartung.
- Getestet wurden insgesamt rund 40 Konfigurationen auf den IS-Daten. Bei so vielen Versuchen ist ein zufällig gutes IS-Ergebnis zu erwarten. Genau dafür ist der OOS-Test da.
- **Technisch geprüft:**
  - Live- und Historienmodus liefern identische Signale (197 von 197). Im Live-Modus wird jede Kerze erst unfertig und dann fertig berechnet.
  - Der Code kompiliert gegen die echte cTrader-API.
  - Die eingebaute Chart-Statistik stimmt mit der externen M1-Auswertung überein (−0,001 R zu −0,001 R bzw. −0,113 R zu −0,111 R).

### Einschränkungen
- Ausgewertet sind nur ein Jahr M1-Daten und 10 Jahre M15-Daten. Die Spreads sind als Pauschale modelliert, echte Tickspreads (z. B. bei News) sind meist schlechter.
- Ein negativer Backtest beweist nicht, dass ein Setup nie funktioniert. Er zeigt nur, dass sich ein Vorteil in diesen Daten nicht nachweisen ließ.

### Empfehlung
- Nutze den Indikator als **Werkzeug**: automatische Fibonacci-Level, Range-Level, Alarme und eine ehrliche Statistik. Ein fertiges Handelssystem ist er nicht.
- Prüfe die Statistik oben links auf **deinem** Broker mit möglichst viel Historie. Steht dort dauerhaft ein negativer Ø R, gilt das Ergebnis oben auch für deine Daten.
- Verwende ihn höchstens auf einem Demokonto. Das ist keine Anlageberatung.

## Reproduzieren

```bash
# Daten (HistData M1 2025) vorbereiten
python3 backtest/prepare_data.py DAT_ASCII_XAUUSD_M1_2025.csv backtest/data
# Indikator unverändert über die Historie laufen lassen (Parameter als Name=Wert)
dotnet run -c Release --project backtest/Harness -- --bars backtest/data/m2.csv --out signals.csv
dotnet run -c Release --project backtest/Harness -- --bars backtest/data/m2.csv --out pull.csv UseRangeSetup=false UsePullbackSetup=true MaxBarsInTrade=180
# Live-Simulation (jede Kerze erst unfertig, dann fertig) – Ergebnis muss identisch sein
dotnet run -c Release --project backtest/Harness -- --bars backtest/data/m2.csv --ticks backtest/data/m1.csv --live --out live.csv
# Auswertung mit Kosten, IS/OOS-Split, Quartalen, Long/Short
python3 backtest/evaluate.py signals.csv backtest/data/m1.csv --max-bars 600
# Kompilierprüfung gegen die echte cTrader-API
dotnet build backtest/CompileCheck
```

## Quellen
- Strategie-Recherche: [TradingView-Strategieliste](https://de.tradingview.com/scripts/?script_access=all&script_type=strategies). Gelesen wurden u. a. [Gold Trail](https://de.tradingview.com/script/be5yqBM1-Gold-Trail-XAUUSD-Regime-Gated-Adaptive-ATR-Strategy/), [UT Bot Alerts](https://de.tradingview.com/script/n8ss8BID-UT-Bot-Alerts/), [SuperTrend STRATEGY](https://de.tradingview.com/script/P5Gu6F8k/) und [Squeeze Momentum](https://de.tradingview.com/script/nqQ1DT5a-Squeeze-Momentum-Indicator-LazyBear/).
- M1-Daten 2025: [tanjiroweb3/forex-data](https://github.com/tanjiroweb3/forex-data) (`DAT_ASCII_XAUUSD_M1_2025.csv`)
- M15-Daten 2012–2022: [ejtraderLabs/historical-data](https://github.com/ejtraderLabs/historical-data) (`XAUUSD/XAUUSDm15.csv`, Brokerzeit UTC+2/+3, nach UTC umgerechnet)
