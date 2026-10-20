# ICT Gold cBot – v2.61-dev

Weiterentwicklung von `SMC Precision Scalper XAUUSD v2.59-dev` (Klasse `IctGoldV259Dev`).
Grundlage war die kritische Gate- und Logikanalyse. Ziel: mehr Signale, ohne dass die Qualität sinkt.

> **v2.61-dev** (Punkte 3–5 der Gap-Analyse, Live-News-Regel, Monte Carlo): siehe **[`V261_UMSETZUNG.md`](V261_UMSETZUNG.md)**.
> Neue Bausteine: ADR-normierter Strategie-Pip und Instrument-Parametersätze, echte Limit-Orders am CE, mehrere Setups je Richtung,
> zusätzliche Liquiditätspools, Meta-Labeling auf der Telemetrie, eine gemeinsame Tentative-News-Regel für Live und Backtest,
> `tools/monte_carlo.py`. Neue Empfehlung **K3** (`paramsets/v261-recommended.json`). Mit Defaults handelt v2.61 identisch zu v2.59.
>
> **Korrektur zu den v2.60-Zahlen unten:** Die CE-Arme (C7, K2) wurden mit einem zu groben Tick-Raster gemessen. Der Tick-Trigger bekam dadurch
> im Schnitt 0,16 R bessere Einstiege als jeder echte Fill. Realistisch (Limit am CE) liegt K2 2020/21 bei PF ≈ 1,2 statt 1,52;
> über 2014–2021 bei +0,06 R je Signal. Details: `results/v261_tick_density.txt`, `V261_UMSETZUNG.md` Abschnitt 1.
> Die Tabellen unten bleiben als Dokumentation des v2.60-Stands stehen.

> **Status: Entwicklungsstand, kein Live-Release.** Alle Zahlen unten stammen aus einem Offline-Harness
> mit echten XAUUSD-M15-Kerzen und synthetischer M1-Feinstruktur (siehe „Testaufbau & Grenzen“).
> Vor jedem Echtgeld-Einsatz ist ein Backtest im cTrader-Backtester mit echten Ticks nötig.

## Kurzfassung

- Jede Änderung ist ein eigener Parameter (Gruppe **„15 v2.60 Logic“**). **Mit den Default-Werten handelt v2.60 byte-identisch zu v2.59.**
  Geprüft auf mehreren Datensätzen; die Trade-Listen sind identisch. Ausnahme sind die zwei Bugfixes, die nur in den Fehlerfällen greifen.
- **Zwei Bugfixes im Original** (beide im Harness reproduziert): Ein Trade, der knapp am Risiko-Cap dimensioniert ist, wurde direkt nach dem Fill als
  „post-fill protection invalid“ zwangsgeschlossen. Live hätte das jeweils den Protection-Kill-Switch ausgelöst.
  - B1: Die Post-Fill-Prüfung verglich mit der Equity *nach* der Order, also schon um den Spread reduziert.
  - B2: Die Rundung des Stops auf die Tickgröße kann bis zu einen Tick Risiko hinzufügen; die Prüfung danach hatte keine Toleranz.
- **Empfohlene Konfiguration „K2“** (6 Schalter, siehe unten): über 7 Datensätze **1,11–1,34 Signale/Handelstag** (Original: 0,19–0,31), **PF (R) 1,25–1,82** (Original: 0,73–1,53), Max-Drawdown 3,4–7,7 %. In jedem Datensatz positiv, auch in den zwei unberührten Zeiträumen.
- **Ziel 2–3 Signale pro Tag: nicht erreicht.** Mit hoher Qualität sind es realistisch **~1,1–1,3 Signale pro Handelstag**.
  Der Funnel zeigt, warum (Abschnitt „Frequenz-Realismus“).

## Dateien

| Pfad | Inhalt |
|---|---|
| `bot/IctGoldV259Dev.cs` | Haupt-Robot (v2.61-dev). Der Klassenname bleibt, damit deine übrigen Partial-Dateien weiter passen |
| `bot/Ns.cs` | `NsPreflight` nutzt dieselben Veto- und RR-Helfer wie das Parent-Gate |
| `bot/FailSafeBot.cs` | `BotVersion = "v2.61-dev"` (Owner-Marker im Order-Kommentar ändert sich damit); v2.61: `FsGuardedLimitOrder` (einziger Pfad zu `PlaceLimitOrder`) |
| `bot/LiveNews.cs`, `bot/FailSafe.cs`, `bot/CandidateTelemetryBot.cs` | v2.61: `TentativeNews` (eine Regel für Live und Backtest), `NyTime.FromNy`, Telemetrie über alle Setup-Slots |
| `bot/NsRules.cs`, `bot/CandidateTelemetry.cs`, `bot/EntryGeometry.cs`, `bot/Patterns.cs` | unverändert |
| `paramsets/v260-recommended.json` | die Parameter von K2, die von den Defaults abweichen |
| `harness/` | Offline-Testumgebung: cAlgo-API-Nachbildung mit Tick-Engine und Runner |
| `tools/make_m1_from_m15.py` | Testdaten: echte M15 → M1 (Brownian Bridge, optional Mikro-Rauschen und Volatilitätsnormierung) |
| `tools/run_arms.py` | A/B-Matrix: Arme × Datensätze, parallel, mit Invarianten-Checks |
| `tools/build_harness.sh` | baut `out/new` (aktueller Code) und `out/base` (v2.59 aus der Git-Historie) |
| `tools/portfolio_corr.py`, `tools/strategy_family_study.py`, `tools/smt_study.py` | Portfolio-, Strategie-Familien- und SMT-Studien (siehe `ANALYSE_FEHLENDE_BAUSTEINE.md`) |
| `ANALYSE_FEHLENDE_BAUSTEINE.md` | Was dem Bot fehlt (Frequenz, Diversifikation, Korrelation), mit Messwerten |
| `V261_UMSETZUNG.md` | v2.61-dev: Umsetzung, Messwerte, Parameter, Sicherheitslogik, nächste Schritte |
| `bot/InstrumentPip.cs`, `bot/LiquidityPools.cs`, `bot/PendingLimit.cs`, `bot/MetaModel.cs`, `bot/MetaModelBot.cs` | v2.61-dev: ADR-Pip, Liquiditätspools, Limit-Orders und Slots, Meta-Labeling (neue Partial-Dateien, im cBot-Projekt mit hinzufügen) |
| `paramsets/v261-recommended.json`, `paramsets/instruments/*.json` | K3 für XAUUSD; Startsätze für EURUSD, GBPUSD, USDJPY, XAGUSD, NAS100, US30, GER40 (nur Backtest) |
| `tools/monte_carlo.py`, `tools/meta_train.py`, `tools/make_test_calendar.py`, `tools/news_tentative_stats.py` | Monte Carlo, Meta-Modell-Training (Walk-Forward), Testkalender, Tentative-News-Statistik |
| `results/` | Ergebnistabellen und Aufschlüsselung je Setup-Typ und Quartal |

Alle Partial-Dateien sind die Originale, mit einer Ausnahme: die Funnel-Telemetrie (`NsF`, `NsFE`, `NsRej` …) fehlt im Upload.
Sie ist im Harness durch einen Zähler ersetzt (`harness/src/MissingPartsStubs.cs`).
Mit den echten Dateien geprüft (2020–21):
- OFF ist identisch zu v2.59.
- K2 ist identisch zum Stand mit Stubs.
- Mit eingeschalteten NS-Modulen sind v2.59 und v2.60 identisch.
- Die Shadow-Telemetrie ist handelsneutral.

## Änderungen

| ID | Parameter (Default = v2.59) | Was | Bewertung |
|---|---|---|---|
| P1 | `FvgSearchWholeLeg` (false) | FVG-Suche über das ganze Displacement-Bein (Sweep → MSS + 2). Breite, Discount, Qualität und „noch nicht angelaufen“ werden *pro Kandidat vor der Auswahl* geprüft. v2.59 suchte nur am Premium-Ende des Beins und wählte die breiteste Lücke vor dem Breitencheck | logisch korrekter, im Test aber **nicht robust** (je nach Datensatz besser oder schlechter) → optional |
| P2 | `DeliveryVetoAfterMssOnly` (false) | Delivery-Veto zählt nur, wenn der Gegen-MSS *nach* dem eigenen MSS schloss. Der Raid-Leg des Setups selbst ist kein Veto | neutral (greift sehr selten) → optional |
| P3 | `FailFastStaticGates` (false) | Gates, deren Ergebnis schon feststeht (M5-Internal ohne CRT-Range, M5-Zone besteht die statischen Kriterien nicht), setzen sofort zurück statt den Slot bis zum Order-Gate zu blockieren | leicht positiv → **empfohlen** |
| P4 | `UpgradeSlotOnStrongerSweep` (false) | Ein Sweep stärkerer externer Liquidität ersetzt einen wartenden schwächeren Kandidaten | mehr Signale, Qualität **instabil** → nicht empfohlen |
| P5 | `IgnoreConsumedLiquidity` (Off / Sweeps / Targets / Both) | Bereits durchgehandelte Liquidität wird weder erneut als Raid noch als TP-Ziel gezählt | Sweeps: Frequenz bricht ein (−80 %); Targets: schlechter → **nicht empfohlen** |
| P6 | `AllowDeepFillWithHold` (false) | Ein tiefer Erst-Touch (> `MaximumZoneFill`) mit Schluss zurück über/unter die Zonenmitte gilt als Rejection, nicht als Over-Mitigation | leicht positiv in allen Datensätzen → **empfohlen** |
| E1 | `RrBasis` (Tp1 / StructuralTarget), `StructuralMinimumRewardRisk` (2,0), `Tp1MinimumR` (1,0) | StructuralTarget: TP2 muss echte Liquidität sein, TP2/Risiko ≥ 2,0. TP1 bleibt der Teilgewinn, mindestens 1,0 R. Eine Regel für Pre-Order-Gate, Post-Fill-Prüfung und NS-Preflight | allein gemischt, zusammen mit E2 klar positiv → **empfohlen** |
| E2 | `EntryMode` (ConfirmationClose / FvgCeTouch), `CeStopAnchor` (SweepExtreme / ZoneEdge) | Entry auf dem Tick, der das PD-Array bei seinem CE (50 %) erreicht, wie eine Limit-Order am CE. Die Zone ist das echte PD-Array, nicht die 40-Pip-Trade-Zone. Stop am Sweep-Extrem | **größter Hebel**: ~3× Frequenz, höherer PF → **empfohlen** (mit SweepExtreme) |
| K | `EnableContinuationLane` (false) | Neue Lane: In London/NY-Killzones, mit M15-Anchor, M5-Delivery und H1-Struktur gleichgerichtet, bricht eine Displacement-Kerze das letzte Exec-Swing. Das FVG dieses Beins wird mit derselben Zonen-, Entry-, Score-, Stop-, Ziel- und RR-Logik gehandelt. Zählt als interne Liquidität: kein Extended-Session- oder A+-Sonderweg | Lane-PF 1,18–2,04, verdoppelt die Frequenz → **empfohlen** |
| H | `HtfBiasFilter` (Off / H4Structure) | Kein Trade gegen die H4-Struktur | halbiert die Frequenz, PF nicht stabil besser → optional |
| M | `M5InternalMinimumStrength` (1) | 2 = nur EQH/EQL als interne M5-Liquidität | schlechter → nicht empfohlen |
| — | `TradeNyPm` (bestehender Parameter) | NY-PM-Killzone 13:30–15:30 NY als Core-Session | leicht mehr Signale, PF ≈ gleich → **empfohlen** |
| B1 | immer aktiv | **Bugfix:** Post-Fill-Risiko-Cap gegen die Equity, mit der dimensioniert wurde (nicht die um den Spread reduzierte Equity nach dem Fill) | behebt einen live-relevanten Fehlalarm |
| B2 | immer aktiv | **Bugfix:** Die Cap-Prüfungen *nach* der Tick-Normalisierung des Stops und nach dem Broker-Readback erlauben genau einen Tick Quantisierung (wie die bestehende 1-Tick-Readback-Toleranz). Die Prüfung vor der Normalisierung bleibt strikt | behebt einen live-relevanten Fehlalarm |

Zusätzlich gibt es reine Telemetrie-Zähler (`NsF("PARENT", "reset:…")`) an jedem Parent-Reset.
Damit sieht man im Funnel, wo Kandidaten sterben.

## Empfohlener Parametersatz (K2)

```
FailFastStaticGates     = True
AllowDeepFillWithHold   = True
EntryMode               = FvgCeTouch
CeStopAnchor            = SweepExtreme
RrBasis                 = StructuralTarget   (StructuralMinimumRewardRisk 2.0, Tp1MinimumR 1.0)
EnableContinuationLane  = True
TradeNyPm               = True
```

Alle anderen Parameter bleiben auf Default. `CeStopAnchor = ZoneEdge` sah im Harness noch besser aus (enge Stops).
Das ist aber genau die Variante, die sich laut Projekthistorie auf echten Gold-Daten nicht bewährt hat;
synthetische M1-Pfade unterschätzen Stop-Hunts. Deshalb wird sie nicht empfohlen.

## Testaufbau & Grenzen

- **Harness statt cTrader:** Eine eigene Nachbildung der genutzten cAlgo-API (`harness/src/CAlgoApi.cs`) mit Tick-Engine.
  Market-Orders füllen zu Bid/Ask, SL/TP am exakten Level (nach Lücken > 5 min zum Tickpreis).
  Teilschließung, Positions-Events und Bars aller Zeitebenen werden aus den Ticks gebaut.
- **Daten:** Echte XAUUSD-M1- oder Tickdaten waren aus der Umgebung nicht erreichbar.
  Verwendet wurden echte **M15**-Kerzen 2014–2021 (öffentliches Repo `ejtraderLabs/historical-data`, Broker-Zeit → UTC).
  Jede M15-Kerze wird mit 15 synthetischen M1-Kerzen gefüllt, die exakt O/H/L/C treffen.
  - **Echt** ist damit alles, was der Bot aus M15/H1 ableitet: Swings, PDH/PDL, Asia/London, CRT, Trend.
  - **Synthetisch** ist die M2-Mikrostruktur: der exakte Sweep, die M2-FVG und die Bestätigungskerze.
- **Zwei Mikrostruktur-Varianten:** „glatt“ (reine Brownian Bridge, M1/M15-Range-Verhältnis 0,20) und
  „rau“ (Mikro-Rauschen, Verhältnis ~0,32, näher an echtem Gold). Die rauen Daten sind die Hauptreferenz.
- **Volatilitätsnormierung:** Die Preise sind so skaliert, dass die mediane NY-Tagesrange 55 USD beträgt (≈ Gold 2025/26).
  Sonst würden die festen Pip-Schwellen des Bots (TP1 80, Stop 15–75 …) ein anderes Regime testen.
- **Kosten:** Spread fix 0,20 USD, Kommission 0, Swap 0, keine Slippage, **kein News-Kalender** (Filter im Test inaktiv).
  EUR 5.000, FixedLots 0,1 mit 0,75-%-Risiko-Cap (Source-Defaults), USD→EUR 0,92 fix.
- **Kennzahlen pro Signal:** Eine Position einschließlich TP1-Teilschließung zählt als ein Signal.
  R = realisierter Gewinn / Anfangsrisiko. „/Tag“ = Signale pro NY-Handelstag (Mo–Fr).
- **Entwicklung vs. Kontrolle:** 2018–2021 (R/S) wurden während der Entwicklung betrachtet.
  **2014–2015 und 2016–2017 waren bis zur Endauswahl unberührt** (echtes Out-of-Sample).
  Dazu kommt 2020–2021 mit einem anderen Zufalls-Seed (R2021s2).

Was der Harness **nicht** beweisen kann: Edge auf echten M1/Tick-Daten, Slippage bei News, Broker-Verhalten.
Positiv ist: Die Rangfolge der Varianten ist über 7 Datensätze stabil, und das Original v2.59 verhält sich in der gleichen Größenordnung
wie in euren echten cTrader-Läufen (≈ 0,2 Signale/Werktag, Signal-PF 1,05–1,40).

## Ergebnisse

### Empfohlene Konfiguration gegen das Original (alle Datensätze)

| Arm | Datensatz | Signale | /Tag | Trefferquote % | Summe R | Ø R | PF (R) | Max-DD % |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| A0 Original (Defaults) | rau 2020–21 | 103 | 0.20 | 36.9 | 33.6 | 0.33 | 1.53 | 5.6 |
| C7 P3+P6+CE+RR | rau 2020–21 | 332 | 0.64 | 39.5 | 161.4 | 0.49 | 1.81 | 3.8 |
| **K2 empfohlen** | rau 2020–21 | 598 | 1.15 | 35.3 | 202.1 | 0.34 | 1.52 | 6.0 |
| A0 Original (Defaults) | rau 2018–19 | 113 | 0.22 | 31.9 | 19.9 | 0.18 | 1.26 | 9.3 |
| C7 P3+P6+CE+RR | rau 2018–19 | 305 | 0.59 | 31.1 | 56.6 | 0.19 | 1.27 | 6.3 |
| **K2 empfohlen** | rau 2018–19 | 574 | 1.11 | 31.0 | 122.5 | 0.21 | 1.31 | 5.7 |
| A0 Original (Defaults) | glatt 2020–21 | 158 | 0.30 | 32.9 | 25.0 | 0.16 | 1.24 | 10.2 |
| C7 P3+P6+CE+RR | glatt 2020–21 | 389 | 0.75 | 37.3 | 167.5 | 0.43 | 1.69 | 4.1 |
| **K2 empfohlen** | glatt 2020–21 | 696 | 1.34 | 32.8 | 206.0 | 0.30 | 1.44 | 7.7 |
| A0 Original (Defaults) | glatt 2018–19 | 160 | 0.31 | 33.1 | 37.6 | 0.23 | 1.36 | 10.9 |
| C7 P3+P6+CE+RR | glatt 2018–19 | 330 | 0.64 | 36.4 | 155.8 | 0.47 | 1.75 | 4.9 |
| **K2 empfohlen** | glatt 2018–19 | 631 | 1.22 | 31.1 | 197.8 | 0.31 | 1.46 | 6.1 |
| A0 Original (Defaults) | rau 2014–15 (OOS) | 132 | 0.26 | 22.7 | -26.3 | -0.20 | 0.73 | 16.9 |
| C7 P3+P6+CE+RR | rau 2014–15 (OOS) | 299 | 0.58 | 29.4 | 39.5 | 0.13 | 1.19 | 10.2 |
| **K2 empfohlen** | rau 2014–15 (OOS) | 602 | 1.17 | 29.2 | 107.4 | 0.18 | 1.25 | 5.3 |
| A0 Original (Defaults) | rau 2016–17 (OOS) | 120 | 0.23 | 28.3 | -2.7 | -0.02 | 0.97 | 11.0 |
| C7 P3+P6+CE+RR | rau 2016–17 (OOS) | 307 | 0.59 | 34.5 | 108.3 | 0.35 | 1.54 | 5.1 |
| **K2 empfohlen** | rau 2016–17 (OOS) | 578 | 1.12 | 33.9 | 222.2 | 0.39 | 1.58 | 3.4 |
| A0 Original (Defaults) | rau 2020–21, Seed 2 | 100 | 0.19 | 33.0 | 7.5 | 0.07 | 1.11 | 7.3 |
| C7 P3+P6+CE+RR | rau 2020–21, Seed 2 | 318 | 0.61 | 36.8 | 120.0 | 0.38 | 1.60 | 4.5 |
| **K2 empfohlen** | rau 2020–21, Seed 2 | 609 | 1.18 | 38.3 | 306.1 | 0.50 | 1.82 | 4.9 |

### Einzeländerungen (raue Daten, Entwicklungszeiträume)

| Arm | Datensatz | Signale | /Tag | Trefferquote % | Summe R | Ø R | PF (R) | Max-DD % |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| A0_control | rau 2020–21 | 103 | 0.20 | 36.9 | 33.6 | 0.33 | 1.53 | 5.6 |
| A0_control | rau 2018–19 | 113 | 0.22 | 31.9 | 19.9 | 0.18 | 1.26 | 9.3 |
| P1_fvg_leg | rau 2020–21 | 117 | 0.23 | 32.5 | 17.0 | 0.14 | 1.22 | 8.2 |
| P1_fvg_leg | rau 2018–19 | 133 | 0.26 | 33.1 | 21.8 | 0.16 | 1.25 | 4.4 |
| P2_veto_after_mss | rau 2020–21 | 103 | 0.20 | 36.9 | 33.6 | 0.33 | 1.53 | 5.6 |
| P2_veto_after_mss | rau 2018–19 | 113 | 0.22 | 31.9 | 19.9 | 0.18 | 1.26 | 9.3 |
| P3_failfast | rau 2020–21 | 105 | 0.20 | 37.1 | 37.1 | 0.35 | 1.58 | 5.5 |
| P3_failfast | rau 2018–19 | 113 | 0.22 | 31.9 | 19.9 | 0.18 | 1.26 | 9.4 |
| P4_slot_upgrade | rau 2020–21 | 115 | 0.22 | 38.3 | 41.0 | 0.36 | 1.60 | 5.5 |
| P4_slot_upgrade | rau 2018–19 | 123 | 0.24 | 27.6 | 1.6 | 0.01 | 1.02 | 13.2 |
| P5s_consumed_sweeps | rau 2020–21 | 18 | 0.04 | 22.2 | -7.1 | -0.40 | 0.49 | 4.5 |
| P5s_consumed_sweeps | rau 2018–19 | 23 | 0.04 | 30.4 | 2.1 | 0.09 | 1.13 | 4.9 |
| P5t_consumed_targets | rau 2020–21 | 112 | 0.22 | 33.9 | 18.9 | 0.17 | 1.26 | 7.7 |
| P5t_consumed_targets | rau 2018–19 | 125 | 0.24 | 28.0 | 9.3 | 0.07 | 1.11 | 14.3 |
| P6_deep_fill | rau 2020–21 | 106 | 0.20 | 36.8 | 34.4 | 0.32 | 1.53 | 5.6 |
| P6_deep_fill | rau 2018–19 | 121 | 0.23 | 32.2 | 26.2 | 0.22 | 1.32 | 9.3 |
| E1_rr_structural | rau 2020–21 | 174 | 0.34 | 33.9 | 1.9 | 0.01 | 1.02 | 12.6 |
| E1_rr_structural | rau 2018–19 | 179 | 0.34 | 38.5 | 29.4 | 0.16 | 1.28 | 9.1 |
| E2_ce_entry | rau 2020–21 | 297 | 0.57 | 35.4 | 149.4 | 0.50 | 1.78 | 4.4 |
| E2_ce_entry | rau 2018–19 | 256 | 0.49 | 25.0 | 30.8 | 0.12 | 1.16 | 6.9 |
| E2z_ce_zone_stop | rau 2020–21 | 390 | 0.75 | 31.8 | 245.4 | 0.63 | 1.92 | 3.5 |
| E2z_ce_zone_stop | rau 2018–19 | 348 | 0.67 | 24.7 | 115.7 | 0.33 | 1.44 | 4.6 |
| H4_bias | rau 2020–21 | 45 | 0.09 | 35.6 | 9.3 | 0.21 | 1.33 | 5.1 |
| H4_bias | rau 2018–19 | 53 | 0.10 | 32.1 | 6.0 | 0.11 | 1.18 | 5.9 |
| M5_eq_only | rau 2020–21 | 122 | 0.24 | 35.2 | 30.6 | 0.25 | 1.40 | 7.2 |
| M5_eq_only | rau 2018–19 | 126 | 0.24 | 30.2 | 12.5 | 0.10 | 1.15 | 11.8 |
| S_nypm | rau 2020–21 | 113 | 0.22 | 37.2 | 34.9 | 0.31 | 1.51 | 5.5 |
| S_nypm | rau 2018–19 | 125 | 0.24 | 32.8 | 22.6 | 0.18 | 1.28 | 10.6 |
| K0_cont_only | rau 2020–21 | 170 | 0.33 | 34.7 | 47.4 | 0.28 | 1.43 | 6.3 |
| K0_cont_only | rau 2018–19 | 199 | 0.38 | 32.2 | 21.1 | 0.11 | 1.16 | 11.3 |

### Kombinationen (Entwicklungszeiträume, raue und glatte Daten)

| Arm | Datensatz | Signale | /Tag | Trefferquote % | Summe R | Ø R | PF (R) | Max-DD % |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| A0_control | rau 2020–21 | 103 | 0.20 | 36.9 | 33.6 | 0.33 | 1.53 | 5.6 |
| A0_control | rau 2018–19 | 113 | 0.22 | 31.9 | 19.9 | 0.18 | 1.26 | 9.3 |
| A0_control | glatt 2020–21 | 158 | 0.30 | 32.9 | 25.0 | 0.16 | 1.24 | 10.2 |
| A0_control | glatt 2018–19 | 160 | 0.31 | 33.1 | 37.6 | 0.23 | 1.36 | 10.9 |
| C1_p3_p6 | rau 2020–21 | 108 | 0.21 | 37.0 | 37.9 | 0.35 | 1.57 | 5.6 |
| C1_p3_p6 | rau 2018–19 | 121 | 0.23 | 32.2 | 26.2 | 0.22 | 1.32 | 9.3 |
| C1_p3_p6 | glatt 2020–21 | 167 | 0.32 | 32.9 | 23.9 | 0.14 | 1.22 | 10.4 |
| C1_p3_p6 | glatt 2018–19 | 169 | 0.33 | 33.1 | 37.5 | 0.22 | 1.34 | 11.8 |
| C2_c1_ce | rau 2020–21 | 302 | 0.58 | 35.4 | 150.3 | 0.50 | 1.77 | 4.5 |
| C2_c1_ce | rau 2018–19 | 262 | 0.51 | 24.8 | 31.0 | 0.12 | 1.16 | 6.7 |
| C2_c1_ce | glatt 2020–21 | 324 | 0.62 | 34.9 | 161.3 | 0.50 | 1.77 | 3.4 |
| C2_c1_ce | glatt 2018–19 | 305 | 0.59 | 32.1 | 121.4 | 0.40 | 1.59 | 5.7 |
| C3_c1_ce_zone | rau 2020–21 | 394 | 0.76 | 31.5 | 242.6 | 0.62 | 1.90 | 3.5 |
| C3_c1_ce_zone | rau 2018–19 | 353 | 0.68 | 24.4 | 111.7 | 0.32 | 1.42 | 4.4 |
| C3_c1_ce_zone | glatt 2020–21 | 451 | 0.87 | 26.6 | 199.0 | 0.44 | 1.60 | 3.8 |
| C3_c1_ce_zone | glatt 2018–19 | 390 | 0.75 | 28.5 | 218.8 | 0.56 | 1.78 | 4.2 |
| C6_c2_fvgleg | rau 2020–21 | 319 | 0.62 | 34.5 | 147.5 | 0.46 | 1.71 | 4.6 |
| C6_c2_fvgleg | rau 2018–19 | 287 | 0.55 | 23.7 | 11.3 | 0.04 | 1.05 | 8.8 |
| C6_c2_fvgleg | glatt 2020–21 | 402 | 0.78 | 35.1 | 222.3 | 0.55 | 1.85 | 4.4 |
| C6_c2_fvgleg | glatt 2018–19 | 366 | 0.70 | 29.0 | 100.0 | 0.27 | 1.37 | 9.8 |
| C7_best | rau 2020–21 | 332 | 0.64 | 39.5 | 161.4 | 0.49 | 1.81 | 3.8 |
| C7_best | rau 2018–19 | 305 | 0.59 | 31.1 | 56.6 | 0.19 | 1.27 | 6.3 |
| C7_best | glatt 2020–21 | 389 | 0.75 | 37.3 | 167.5 | 0.43 | 1.69 | 4.1 |
| C7_best | glatt 2018–19 | 330 | 0.64 | 36.4 | 155.8 | 0.47 | 1.75 | 4.9 |
| C8_best_nypm | rau 2020–21 | 348 | 0.67 | 39.1 | 164.3 | 0.47 | 1.78 | 3.9 |
| C8_best_nypm | rau 2018–19 | 333 | 0.64 | 32.4 | 71.9 | 0.22 | 1.32 | 6.1 |
| C8_best_nypm | glatt 2020–21 | 415 | 0.80 | 36.1 | 162.5 | 0.39 | 1.61 | 4.4 |
| C8_best_nypm | glatt 2018–19 | 364 | 0.70 | 35.7 | 159.9 | 0.44 | 1.69 | 5.6 |
| K1_best_cont | rau 2020–21 | 545 | 1.05 | 35.8 | 185.2 | 0.34 | 1.53 | 7.9 |
| K1_best_cont | rau 2018–19 | 507 | 0.98 | 30.0 | 99.9 | 0.20 | 1.28 | 6.5 |
| K1_best_cont | glatt 2020–21 | 629 | 1.21 | 34.3 | 220.0 | 0.35 | 1.53 | 4.2 |
| K1_best_cont | glatt 2018–19 | 545 | 1.05 | 31.9 | 183.8 | 0.34 | 1.50 | 5.1 |
| K2_best_cont_nypm | rau 2020–21 | 598 | 1.15 | 35.3 | 202.1 | 0.34 | 1.52 | 6.0 |
| K2_best_cont_nypm | rau 2018–19 | 574 | 1.11 | 31.0 | 122.5 | 0.21 | 1.31 | 5.7 |
| K2_best_cont_nypm | glatt 2020–21 | 696 | 1.34 | 32.8 | 206.0 | 0.30 | 1.44 | 7.7 |
| K2_best_cont_nypm | glatt 2018–19 | 631 | 1.22 | 31.1 | 197.8 | 0.31 | 1.46 | 6.1 |

Vollständige Tabellen inklusive glatter Daten und Funnel liegen unter `results/`.

## Frequenz-Realismus

Funnel K2, rau 2020–21 (518 Handelstage):

| Stufe | Anzahl | pro Tag |
|---|---:|---:|
| Raid-Kandidaten armiert (Parent) | 16938 | 32.7 |
| Continuation-BOS armiert | 2614 | 5.0 |
| gültige Zone (FVG/PD-Array) gefunden | 2394 | 4.6 |
| CE erreicht (Entry-Versuch) | 1149 | 2.2 |
| Order ausgeführt | 598 | 1.15 |

Zum Vergleich das Original: 3.1 Zonen/Tag → 0.20 Orders/Tag. Größte Verluste nach der Zone sind bei K2: Zone läuft ab, ohne das CE zu erreichen (462), Zone wird vor dem CE invalidiert (254), Extended-Session-Qualität (133), RR-Gate (133) und kein Ziel mit echter Liquidität (103).

Setup-Typen K2, rau 2020–21: CRT Sweep n=52 PF 1.55, Continuation n=263 PF 1.35, LiquiditySweep n=136 PF 1.71, M5 Internal n=9 PF 1.43, SessionSweep n=43 PF 1.08, TurtleSoup n=95 PF 2.09.

Für **2–3 Signale/Tag bei gleicher Qualität** reicht Gate-Tuning nicht aus. Die Extended-Session- und M5-Internal-Gates
filtern laut den Shadow-Auswertungen der Projekthistorie überwiegend Verlierer heraus; sie zu lockern wurde hier bewusst nicht getestet.
Weitere Frequenz bräuchte ein **zusätzliches, eigenständig validiertes Entry-Modell**, z. B. Silver-Bullet-Fenster
(03–04, 10–11, 14–15 NY) auf M1 oder einen zweiten Entry aus derselben HTF-Formation.
Jedes davon muss eine eigene Lane mit eigener PF-Auswertung bekommen.

## Nächste Schritte

1. Im **cTrader-Backtester mit echten Ticks** die Arme A0 (Default), C7 und K2 auf 2025 Q1 – 2026 Q3 fahren
   (euer Vertrag: Spread 2, Kommission 0, EUR 5.000), dazu den bestehenden News-Kalender.
2. Erst wenn K2 dort Signal-PF ≥ 1,20 je Lane und Gesamt-PF ≥ 1,35 hält: Kostenstress (+0,5 Pip, Kommission) und 2024 als Validierung.
3. Live erst nach eigener Freigabe. Die CE-Entries sind Market-Orders auf Tick-Trigger, keine Pending-Orders.
   Das Fail-safe-Gate (`FsGuardedMarketOrder`) bleibt der einzige Order-Pfad.

## Reproduktion

```bash
cd ctrader/IctGold
./tools/build_harness.sh                                   # braucht .NET 8 SDK
python3 tools/make_m1_from_m15.py --m15 XAUUSDm15.csv --start 2019-11-01 --end 2022-01-01 \
    --out data/xau_m1_2020_2021_rough.csv --target-day-range 55 --micro-noise 0.15
python3 tools/run_arms.py --exe harness/out/new/IctGoldHarness \
    --data R2021=data/xau_m1_2020_2021_rough.csv:2020-01-01:2022-01-01 --out runs/x --arms final
# OFF-Äquivalenz: harness/out/base/IctGoldHarness und harness/out/new/IctGoldHarness mit gleichen Argumenten,
# dann die *.trades.csv mit cmp vergleichen.
```

`XAUUSDm15.csv` stammt aus `https://github.com/ejtraderLabs/historical-data` (Ordner `XAUUSD/`).
