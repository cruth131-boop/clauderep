# v2.61-dev – Punkte 3–5, Live-News-Regel, Monte Carlo

Umsetzung der Punkte 3–5 aus `ANALYSE_FEHLENDE_BAUSTEINE.md` („Empfohlene Reihenfolge“) plus die beiden Detailpunkte
Telemetrie-Modell und Live-News. Alle neuen Funktionen sind Parameter mit Default = v2.60-Verhalten.

> **Status: Entwicklungsstand, kein Live-Release.** Alle Zahlen stammen aus dem Offline-Harness (echte M15-Kerzen 2014–2021,
> synthetische M1-Feinstruktur). Live bleibt wegen der Fail-Safe-Annahmen (Punkte 1/2) auf XAUUSD und eine Instanz beschränkt.

## Kurzfassung

| Thema | Umgesetzt | Ergebnis im Harness |
|---|---|---|
| **Korrektur v2.60** | Tick-Dichte-Test, Limit-Order als tickraster-unabhängiges CE-Modell | Die v2.60-CE-Zahlen (K2: PF 1,52) waren durch das grobe Tick-Raster geschönt. Realistisch: **PF ≈ 1,2, +0,13 R** (2020/21) |
| **3 – Zweites Instrument** | ADR-normierter Strategie-Pip, Kommission im Kosten-Gate, Kontrakt-Specs im Harness, Parametersätze EURUSD/GBPUSD/USDJPY/XAGUSD/NAS100/US30/GER40 | Skalierungstest bestanden (580/583 Trades identisch). FX: **mit Raw-Spread-Kosten PF 1,17–1,30**, mit Retail-Kosten **kein Edge** (0,85–1,00) |
| **4 – Mehr Kandidaten** | echte Limit-Orders am CE, 2–3 Setups je Richtung, Vorwochen-H/L, NY-AM-Range, unberührte H4-Swings, Rundzahl- und NWOG-Ziele | **K3** (Limit + 2 Slots + PW + NY AM): **1,83 Signale/Tag** (v2.59: 0,23), +0,069 R je Signal, Σ +263 R über 8 Jahre |
| **5 – Meta-Labeling** | Telemetrie `META_CAND`/`META_OUT`, logistisches Modell, Walk-Forward-Training, Override nur für Soft-Gates | Out-of-Sample in beiden Folds besser: **+62 R (2018/19), +20 R (2020/21)**, ~+0,3 Signale/Tag → **2,0–2,2/Tag**. Stabilität noch unklar |
| **Live-News** | eine Regel für TENTATIVE/ALL_DAY live **und** im Backtest, drei Policies, Paritäts-Selbsttest, Statistik-Tool | Live- und Backtest-Parser identisch; Wirkung je nach Kalender messbar |
| **Monte Carlo** | `tools/monte_carlo.py` | K3: P(Jahr < 0) ≈ 27 %; bei 0,5 % Risiko je Trade P(DD ≥ 10 %) ≈ 90 % → **Risiko höchstens 0,25 %** |

**Ehrliche Einordnung:** Mit realistischer Ausführung ist der Edge der CE-Variante dünn (+0,06–0,07 R je Signal nach Spread).
Die neuen Bausteine erhöhen die Frequenz deutlich (Ziel 2–3/Tag mit Meta-Override erreicht), verbessern die Qualität je Trade aber nicht.
Ob die Strategie auf echten Ticks trägt, kann nur der cTrader-Backtester zeigen; der Harness kann die M1-Mikrostruktur nicht abbilden.

## 1. Korrektur: Das Tick-Raster hat die CE-Ergebnisse von v2.60 geschönt

Der Harness spielt jede M1-Kerze als Open → Extrem → Extrem → Close ab und interpoliert mit `--substeps` Zwischenticks.
Bei 4 Zwischenschritten ist ein Tick-Schritt oft 0,3–0,5 USD. Der v2.60-Tick-Trigger füllt am ersten Tick **auf/jenseits** des CE –
also bis zu einen Schritt *besser* als der CE (kein echter Fill wäre so gut). Außerdem überspringt er Bewegungen, die in einem Schritt durch
die halbe Zone laufen; das sind oft die schnellen Verlierer. Eine ruhende Limit-Order füllt dagegen exakt am CE.

| K2, Gold 2020/21 | substeps 4 | substeps 16 | substeps 32 |
|---|---|---|---|
| Tick-Trigger (v2.60) | 598 Signale, PF 1,52, +0,338 R | 674, PF 1,31, +0,204 R | 693, PF 1,23, +0,156 R |
| Ruhende Limit-Order (v2.61) | 722, PF 1,21, +0,138 R | 715, PF 1,21, +0,138 R | 710, PF 1,20, +0,134 R |

Auf denselben 582 Setups lag der Tick-Trigger im Schnitt **0,16 R besser** als der CE. C7 fällt von PF 1,81 auf 1,36 (2020/21) bzw. 1,27 auf 1,09 (2018/19).
A0 (Close-Bestätigung, v2.59) ändert sich kaum (1,53 → 1,48; 1,26 → 1,22). Details: `results/v261_tick_density.txt`.

**Folge:** Alle CE-Arme in v2.61 werden mit ruhender Limit-Order gemessen. Für den Live-Betrieb ist die Limit-Order ohnehin die bessere Ausführung:
Ein Market-Order nach dem Touch hätte Slippage, die Limit-Order nicht.

## 2. Punkt 3 – Zweites Instrument

**ADR-normierter Strategie-Pip** (`bot/InstrumentPip.cs`). Alle Pip-Parameter der Strategie (Stops, Puffer, Ziele, Zonenbreiten, Spread-Gate …)
sind „Strategie-Pips“. Mit `StrategyPipMode = AdrNormalized` ist ein Strategie-Pip = Median der NY-Tagesrange der letzten 20 Tage / 550.
Bei Gold mit 55 USD Tagesrange ergibt das genau die heutigen 0,10 USD; auf EURUSD beschreibt derselbe Parametersatz denselben Anteil der Tagesrange.
Der Wert wird je NY-Tag fixiert, offene Trades behalten ihren Entry-Pip. `Fixed` (Default) ist unverändert.

- **Skalierungstest:** Goldkurse ×0,001 mit EURUSD-Kontrakt (Pip 0,0001, Tick 0,00001, Lot 100 000) handeln 580 von 583 Trades identisch.
  Die 3 Abweichungen sind CE-Touch-Grenzfälle auf dem Tick-Raster. Es gibt also keine versteckten Gold-Annahmen mehr in der Logik.
- **Kosten:** `CommissionSymbolPips` addiert die Round-Turn-Kommission zum Spread (Spread-Gate, Break-even-Puffer). Auf Raw-Spread-Konten sieht
  der Bot sonst nur einen Teil der Kosten.
- **Harness:** `--symbol-spec eurusd|gbpusd|usdjpy|audusd|xagusd|nas100|us30|ger40` (Pip, Tick, Lot, Volumenschritte, Hebel, Spread),
  `make_m1_from_m15.py --price-divisor/--decimals` für unskalierte FX-Kurse.

| K3 + ADR-Pip, 2020/21, echte FX-Kurse | Kosten Raw-Spread | Kosten Retail |
|---|---|---|
| EURUSD | 0,3 Pip: **PF 1,30**, 1,89/Tag | 0,8 Pip: PF 1,00 |
| GBPUSD | 0,4 Pip: **PF 1,27**, 1,80/Tag | 1,2 Pip: PF 0,95 |
| USDJPY | 0,3 Pip: **PF 1,17**, 1,73/Tag | 0,9 Pip: PF 0,85 |

Entscheidend ist das Verhältnis Kosten/Tagesrange. Gold (heute): 0,20 USD / ~55 USD ≈ 0,4 %. FX-Majors mit Retail-Kosten: 1,3–2 % → der Edge ist weg.
Das Spread-Gate im ADR-Modus (5 Strategie-Pips ≈ 0,9 % der Tagesrange) sperrt solche Konten automatisch.
Indizes (NAS100/US30/GER40: ~0,5 %) wären vom Kostenverhältnis her die besten Kandidaten, Silber (3–5 %) der schlechteste; dafür gab es keine Daten.
Unskaliertes Gold 2020/21 (Tagesrange ~20 USD, gleicher Spread 0,20) zeigt dasselbe Muster: PF 1,01.

Parametersätze: `paramsets/instruments/*.json`. **Live ist weiter nur XAUUSD möglich** (G3-Live-Vertrag, Single-Instance-Fail-Safes = Punkte 1/2).
Abnahme je Instrument im cTrader-Backtester mit echten Ticks: PF ≥ 1,20 über 2 Jahre und in jeder Hälfte.

## 3. Punkt 4 – Mehr Kandidaten: Limit-Orders, Slots, Liquiditätspools

**Ruhende Limit-Order am CE** (`CeExecution = RestingLimit`, `bot/PendingLimit.cs`): Sobald ein Setup sein PD-Array hat und die komplette
Gate-Folge für einen Entry *am CE* besteht, liegt eine Limit-Order mit SL/TP im Markt. Sicherheitslogik siehe Abschnitt 8.

**Mehrere Setups je Richtung** (`SetupSlotsPerDirection`): Ein neuer Raid in dieselbe Richtung wartet nicht mehr, bis das laufende Setup endet.
Pro Kerze und Richtung armiert höchstens ein freier Slot; Slots mit gleicher Liquidität, gleichem MSS oder gleichem PD-Array werden verworfen.

**Neue Liquiditätspools** (`bot/LiquidityPools.cs`): Vorwochen-H/L (PWH/PWL), NY-AM-Range (07:00–11:00 NY, ab 11:00 für den NY-PM-Raid),
unberührte H4-Swings (Raid und Ziel); Rundzahlen und NWOG nur als Ziele.

Testmatrix (realistische Limit-Fills, 4 × 2 Jahre, `results/v261_matrix.md`):

| Arm | 2014/15 PF · Signale/Tag | 2016/17 | 2018/19 | 2020/21 | Σ R | Ø R/Signal | Signale/Tag |
|---|---|---|---|---|---|---|---|
| A0 (v2.59) | 0,73 · 0,26 | 0,97 · 0,23 | 1,26 · 0,22 | 1,53 · 0,20 | +25 | +0,052 | 0,23 |
| K2 + Limit | 0,93 · 1,37 | 1,17 · 1,28 | 1,06 · 1,29 | 1,21 · 1,39 | +165 | +0,060 | 1,33 |
| + 2 Slots | 0,97 · 1,61 | 1,17 · 1,52 | 1,03 · 1,52 | 1,20 · 1,62 | +208 | +0,064 | 1,57 |
| + 3 Slots | 0,97 · 1,64 | 1,15 · 1,55 | 1,07 · 1,56 | 1,22 · 1,65 | +230 | +0,070 | 1,60 |
| + Vorwoche | 1,01 · 1,57 | 1,17 · 1,46 | 1,00 · 1,52 | 1,17 · 1,62 | +192 | +0,060 | 1,54 |
| + NY AM | 0,94 · 1,38 | 1,17 · 1,28 | 1,06 · 1,28 | 1,22 · 1,40 | +177 | +0,064 | 1,34 |
| + H4-Swings | 0,98 · 1,57 | 1,15 · 1,44 | 0,97 · 1,49 | 1,18 · 1,60 | +153 | +0,048 | 1,53 |
| + NWOG-Ziele | 0,93 · 1,41 | 1,15 · 1,32 | 1,04 · 1,32 | 1,20 · 1,44 | +156 | +0,055 | 1,37 |
| **K3** = Limit + 2 Slots + Vorwoche + NY AM | **1,05 · 1,85** | **1,19 · 1,77** | **0,98 · 1,79** | **1,18 · 1,90** | **+263** | **+0,069** | **1,83** |

Bewertung:
- **Slots und Vorwochen-/NY-AM-Liquidität** erhöhen die Frequenz bei gleicher Qualität je Trade → **empfohlen (K3)**.
- **H4-Swings und NWOG**: mehr Signale, aber schlechter je Trade → optional, nicht empfohlen.
- **Rundzahl-Ziele**: auf echten (unskalierten) Goldkursen schlechter (5 USD: −21 R, 10 USD: −12 R statt +4 R) → nicht empfohlen.
- Die Unterschiede zwischen den Armen liegen teilweise im Rauschen (Standardfehler ~0,03 R je Signal). Robust ist nur: mehr Frequenz, Qualität gleich.

## 4. Punkt 5 – Meta-Labeling: Welche Ablehnungen wären profitabel?

**Telemetrie** (`MetaMode = Log`, `bot/MetaModelBot.cs`): Jedes Setup, das das Order-Gate erreicht, schreibt `META_CAND` mit Entscheidung,
Ablehnungsgrund, ausgesetzten Soft-Gates, Geometrie und 39 Merkmalen (Setup-Typ, Session, Score und Abstand zum Mindestscore, Zonenqualität, FVG/OB, P/D,
OTE, Liquiditätsstärke, TP2-R, TP1-R, Stop/ATR, Spread/Risiko, Regime-Ausrichtung, Delivery-Veto, CRT-Flags, MSS-Alter …).
Für abgelehnte Setups wird der vollständige Plan per Trockenlauf mit ausgesetzten Soft-Gates berechnet, also genau die Order, die es gewesen wäre.
`META_OUT` liefert das Ergebnis als Bracket (Entry am CE, Plan-Stop, strukturelles TP2, Stop zuerst bei Doppeltreffer in einer Kerze, 4 h).
Log ändert den Handel nicht (Trade-Listen identisch geprüft).

**Modell** (`tools/meta_train.py`, `bot/MetaModel.cs`): L2-logistische Regression, p = P(TP2 vor Stop), erwartetes R = p · TP2-R − (1 − p).
Überstimmt werden dürfen nur **Soft-Gates**: Score, R/R-Mindestwert, Delivery-Veto, M5-Internal-Kontext, H4-Bias, Extended-Session-Qualität.
Harte Gates (Session, News, Caps, Cooldowns, Spread, Stopdistanz, Margin, G3/Kill-Switch) nie. Zusätzlich: echtes Liquiditätsziel und TP2 ≥ 1,5 R.

**Walk-Forward** (`results/v261_meta_walkforward.txt`, nur auf früheren Jahren trainiert, Schwelle 0,2 vorab festgelegt):

| | Fold 1: Training 2014–17, Test 2018/19 | Fold 2: Training 2014–19, Test 2020/21 |
|---|---|---|
| AUC / Kalibrierung (Test) | 0,675 / gut | 0,682 / gut |
| Soft-Abgelehnte gesamt (Test) | +0,43 R je Kandidat | +0,04 R |
| vom Modell gewählt (exp. R ≥ 0,2) | 121 Kand., +0,43 R, PF 1,66 | 142 Kand., +0,01 R, PF 1,01 |
| **Bot mit Override vs. ohne** | **−39 R → +23 R**, PF 0,94 → 1,03, 1,76 → 2,00/Tag | **+101 R → +121 R**, PF 1,15 → 1,16, 1,92 → 2,21/Tag |

- Das Modell trennt Treffer und Stopps ordentlich und ist gut kalibriert. Ein großer Teil davon ist mechanisch (weiteres Ziel = seltener getroffen).
- Im Bot verbessert der Override in **beiden** Test-Zeiträumen das Gesamtergebnis und bringt ~0,3 zusätzliche Signale pro Tag.
  Die Auswahl schlägt aber nicht stabil „alle Soft-Abgelehnten nehmen“: In 2018/19 waren die Abgelehnten insgesamt besser als die Akzeptierten,
  in 2020/21 kaum. Das ist ein Hinweis, dass einige Soft-Gates im Harness keinen Wert haben, nicht, dass das Modell zuverlässig selektiert.
- Ein Veto (akzeptierte Trades mit niedrigem erwarteten R streichen) half nur in Fold 1 → nicht eingebaut.
- **Beim Test gefundener Fehler, behoben:** Überstimmte Trades mit ausgesetztem R/R-Gate wurden direkt nach dem Fill von der Post-Fill-Prüfung
  wieder geschlossen (45–50 Fälle; live hätte das den Protection-Kill-Switch ausgelöst). Die Post-Fill-Prüfung wendet jetzt dieselbe Override-Regel an.

**Empfehlung:** In cTrader-Echttick-Backtests und auf Demo `MetaMode = Log` laufen lassen, dann auf diesen Daten neu trainieren.
`Override` erst, wenn ein vorab festgelegter Test auf echten Daten besteht: Override-Trades im Test-Zeitraum mit Ø R ≥ Ø R der akzeptierten Trades
und PF ≥ 1,2, in zwei aufeinanderfolgenden Zeiträumen. `results/meta_model_example_harness.json` ist nur ein Formatbeispiel (synthetische Daten).

## 5. Live-News: eine Regel für Live und Backtest

**Problem:** USD-HIGH-Events mit `time_status` TENTATIVE oder ALL_DAY sperrten live den ganzen UTC-Tag. Der Backtest-Kalender ignorierte
genau diese Zeilen. Jeder Backtest zeigte deshalb mehr Handelstage, als live möglich waren.

**Lösung** (`FailSafe.TentativeNews` in `bot/LiveNews.cs`): eine Funktion, die der Live-Feed **und** der Backtest-Kalender aufrufen.
Parameter `TentativeHighNewsPolicy`:
- `WholeDay` (Default, = bisheriges Live-Verhalten): der UTC-Tag ist gesperrt, jetzt auch im Backtest.
- `UsReleaseWindows`: USD-Events sperren nur die üblichen US-Veröffentlichungszeiten 08:30, 10:00, 14:00 New York, mit den normalen HIGH-Fenstern.
  Offene Positionen werden davor wie bei exakten Events behandelt. Andere Währungen sperren weiter den ganzen Tag.
- `Ignore`: altes Backtest-Verhalten, nur zum Vergleich; live wird der Start verweigert.

Prüfung: `IctGoldHarness --selftest-news <kalender>` parst denselben Kalender mit dem Live-Parser und dem Backtest-Parser.
Für alle drei Policies sind blockierte Tage und Events identisch. Im Bot-Lauf mit Testkalender (8 synthetische Tentative-Tage pro Jahr):
WholeDay 0 Trades an gesperrten Tagen, UsReleaseWindows nur Trades außerhalb der Fenster, Ignore = altes Verhalten (`results/v261_news_policy.txt`).

**Was du mit deinem echten MQL5-Export machen solltest:**
`python3 tools/news_tentative_stats.py --calendar news-calendar.csv --trades <backtest>.trades.csv` zeigt, wie viele Tage pro Jahr betroffen sind
und welche Trades ein Backtest mit `Ignore` zu viel zeigt. Sind es nur wenige Tage, bleib bei `WholeDay`.
Sind es viele und liegen die Trades überwiegend außerhalb der US-Zeitfenster, ist `UsReleaseWindows` der sinnvolle Kompromiss.
Hinweis: Die Regel verwendet das UTC-Datum des Events wie der bisherige Live-Code. Der Exporter muss ganztägige Events auf 00:00 UTC des Event-Tages schreiben.

## 6. Monte-Carlo-Simulation – wofür sie im Algo-Trading taugt

Monte Carlo erzeugt **keinen Edge**. Es zeigt, wie breit das Ergebnisband eines vorhandenen Edges ist, also wie viel vom Backtest-Ergebnis Glück
in der Reihenfolge war. `tools/monte_carlo.py` beantwortet fünf Fragen:

| Frage | Methode | Wofür |
|---|---|---|
| A – Ist der Edge statistisch da? | Block-Bootstrap der Handelstage (Tage ohne Trade bleiben drin, 10-Tage-Blöcke erhalten Cluster und Regime) | Konfidenzband für Erwartungswert und PF, P(E ≤ 0) |
| B – Wie viel vom Drawdown war Glück? | Permutation der Trade-Reihenfolge (gleiches Endergebnis) | Verteilung von Max-DD und Verlustserien; wo liegt der historische DD? |
| C – Wie kann ein Jahr aussehen? | Vorwärts-Bootstrap über 252 Handelstage | Ergebnisband, P(Jahr < 0), längste Unterwasserphase |
| D – Welches Risiko je Trade passt? | Fixed-Fractional mit dem Tagesverlust-Limit des Bots | P(DD ≥ Toleranz) je Risiko-% → Kill-Switch- und Prop-Firm-Grenzen kalibrieren |
| E – Wie viel Edge-Erosion verträgt die Strategie? | Abschlag in R je Trade (Slippage, Latenz, Live-Backtest-Lücke) | ab welchen Mehrkosten das Jahr negativ wird |

K3 (`results/monte_carlo_K3.txt`, 3 784 Signale über 8 Jahre):
- **A:** Erwartungswert +0,06 R (90 %-Band +0,01 … +0,12), P(E ≤ 0) = 2,6 %. PF 1,02 … 1,17.
- **B:** historischer Max-DD 91,5 R liegt beim 87. Perzentil → die Reihenfolge war eher ungünstig. Verlustserien von 20 sind normal, 28 kommen vor.
- **C:** Ein Jahr: Median +26 R, 5 %: −41 R, **P(Jahr < 0) = 27 %**, längste Unterwasserphase median 120 Handelstage.
- **D:** 0,25 % Risiko: P(DD ≥ 10 %) = 32 %. **0,5 % Risiko (dein Default): P(DD ≥ 10 %) = 90 %, P(DD ≥ 25 %) = 12 %.**
- **E:** schon **0,05 R Mehrkosten je Trade** machen das Jahr zum Münzwurf (P(Jahr < 0) = 47 %).

Zum Vergleich: Die K2-Simulation (`results/monte_carlo_K2.txt`) beruhte auf den geschönten Tick-Trigger-Zahlen.

Grenzen: Bootstrap unterstellt, dass die Zukunft aus denselben Tagen „gemischt“ ist wie der Test. Ein Regime, das im Test fehlt, kann nicht auftauchen.
Parameter-Robustheit ist eine andere Frage: dafür Daten oder Schwellen stören und die Stabilität prüfen (`run_arms.py` mit mehreren Datensätzen).

Aufruf: `python3 tools/monte_carlo.py --trades a.trades.csv b.trades.csv --risk-grid 0.25,0.5,0.75,1.0 --daily-limit 2 --dd-limit 10`
(cTrader-Backtests: Trades als CSV mit `entry_time` und `r` exportieren).

## 7. Neue Parameter (alle Defaults = v2.60-Verhalten)

| Gruppe | Parameter | Default | Wirkung |
|---|---|---|---|
| 09 Live News | `TentativeHighNewsPolicy` | `WholeDay` | siehe Abschnitt 5 |
| 16 v2.61 Instrument | `StrategyPipMode` | `Fixed` | `AdrNormalized`: 1 Strategie-Pip = Median-NY-Tagesrange / `AdrReferenceStrategyPips` |
| 16 | `AdrReferenceStrategyPips`, `AdrLookbackDays` | 550, 20 | 550 = Gold mit 55 USD Tagesrange bei 0,10 je Pip (heutige Kalibrierung) |
| 16 | `CommissionSymbolPips` | 0 | Round-Turn-Kommission in Symbol-Pips, wird zum Spread addiert |
| 17 v2.61 Liquidity Pools | `UsePreviousWeekLiquidity` | false | PWH/PWL, Raid und Ziel |
| 17 | `UseNyAmSessionLiquidity` | false | NY-AM-Range 07–11 NY, Raid und Ziel ab 11:00 |
| 17 | `UseH4SwingLiquidity`, `H4SwingLookbackBars` | false, 30 | unberührte H4-Pivots, Raid und Ziel |
| 17 | `RoundNumberStepPrice` | 0 | Rundzahlen als reine Ziele (Preis-Einheiten) |
| 17 | `UseNwogTargets` | false | NWOG-Kanten und -CE als reine Ziele |
| 18 v2.61 Execution | `CeExecution` | `TickTrigger` | `RestingLimit` = Limit-Order am CE (nur mit `EntryMode = FvgCeTouch`) |
| 18 | `SetupSlotsPerDirection` | 1 | 2–3 parallele Setups je Richtung |
| 19 v2.61 Meta-Labeling | `MetaMode` | `Off` | `Log` / `Shadow` (Handel unverändert), `Override` |
| 19 | `MetaModelPath`, `MetaMinExpectedR`, `MetaMinRewardRisk`, `MetaShadowHorizonMinutes` | "", 0 (= Modellwert), 1,5, 240 | Modelldatei (fail-closed geprüft), Schwelle, Mindest-TP2-R, Bracket-Horizont |

Empfohlener Entwicklungssatz: `paramsets/v261-recommended.json` (K3, `MetaMode = Log`). Je Instrument: `paramsets/instruments/*.json`.

## 8. Sicherheitslogik der Limit-Orders

- **Ein Order-Pfad:** `FsGuardedLimitOrder` (FailSafeBot.cs) prüft `FsEntryBlock()` unmittelbar vor `PlaceLimitOrder`, genau wie
  `FsGuardedMarketOrder` vor `ExecuteMarketOrder`. Geprüft werden Safety-only, Startup-Fault, Recovery-Lock, Ownership, Protection-Recovery,
  Controlled Close, Stop-Guard, Kill-Switch, Ledger und Sizing-Fault.
- **Dieselben Gates wie beim Market-Entry:** `TryExecuteSetup` ist zerlegt in `PlanEntry` (komplette Gate-Folge, auch als Trockenlauf) und
  `AdoptFill` (alles nach dem Fill). Die Trade-Listen und der Funnel sind dabei identisch geblieben.
- **Jeder Tick:** Ist ein Gate rot (Session-Ende, News-Fenster, Positions- oder Tageslimit, Cooldown, Kill-Switch, G3), wird storniert. Das Setup lebt weiter.
- **Jede geschlossene Exec-Kerze:** neue Planung; ändern sich Stop, TP2 oder Volumen → Storno und neue Order.
- **Reset des Setups** (Invalidierung, Ablauf, Tageswechsel) storniert über einen Sink in `SetupState.Reset`. `OnStop` storniert alles.
  Beim Start werden eigene, verwaiste Orders storniert, nie übernommen. Server-Ablauf = Setup-Ablauf + 1 Kerze (Absturzschutz).
- **Nie mehr ruhende Orders als freie Positions-Slots.**
- **Fill:** durch `AdoptFill` wie ein Market-Fill (Ledger, Neuberechnung am echten Fill, Risiko-Cap, R/R, Schutz setzen und zurücklesen).
  Fill ohne Setup (Storno-Rennen), bei gesperrten Entries oder über den Caps: Journal, sofortiger verifizierter Close, Alarm.
- **Fallback:** Hat ein Setup keine Order (Gate beim Planen rot, kein freier Slot), bleibt der Tick-Trigger aktiv.
- Harness-Prüfung (alle Läufe ab Einbau der Zähler: Meta-, K3- und FX-Läufe): keine Orders nach `OnStop` übrig,
  nie mehr als 2 offene Positionen (`MaxConcurrentPositions`).
- Bekannter Randfall: Läuft der Kurs im selben Tick durch CE **und** Stop (in der Matrix etwa 1 je 1 700 Limit-Fills), greift die Post-Fill-Prüfung
  bzw. das Setzen des Schutzes schlägt fehl. Der Trade wird geschlossen; live würde dabei wie bei v2.60-Market-Orders in Spikes der
  Protection-Kill-Switch auslösen (`KsStopOnProtectionFailure`). Das ist gewollt konservativ, kostet aber im Extremfall den Rest des Tages.

## 9. Tests

| Test | Ergebnis |
|---|---|
| Defaults vs. v2.59 (2018/19 und 2020/21) | Trade-Listen identisch |
| K2 vs. v2.60 nach allen Umbauten (PlanEntry/AdoptFill, Slots, Pools, Meta-Hooks) | identisch, inkl. Funnel |
| `MetaMode = Log` vs. `Off` | Trade-Listen identisch |
| Skalierungs-Invarianz ADR-Pip (Gold ×0,001 mit FX-Kontrakt) | 580 von 583 Trades identisch |
| Live- vs. Backtest-News-Parser (3 Policies) | identisch |
| Limit-Lebenszyklus (alle Läufe) | 0 Orders nach Stop, max. 2 offene Positionen |
| Meta-Override Post-Fill | Fehler gefunden und behoben (siehe Abschnitt 4), danach 0 Zwangsschließungen |

## 10. Nächste Schritte im cTrader-Backtester (echte Ticks)

1. v2.61 mit Defaults gegen v2.60 laufen lassen: identische Trades erwartet.
2. `v261-recommended.json` (K3, `MetaMode = Log`) auf 2–3 Jahren XAUUSD mit echten Ticks. Abnahme: PF ≥ 1,15 in jeder Jahreshälfte, Max-DD im Monte-Carlo-Band.
   Ein Vergleichslauf mit `CeExecution = TickTrigger` zeigt die Slippage-Differenz auf echten Ticks.
3. Echten MQL5-Kalender mit `news_tentative_stats.py` auswerten und die Tentative-Policy wählen.
4. Aus den `META_CAND`/`META_OUT`-Zeilen des Echttick-Laufs ein Modell trainieren (`meta_train.py`, Walk-Forward), Override nur nach bestandenem Vorab-Test.
5. Risiko je Trade an der Monte-Carlo-Auswertung des Echttick-Laufs ausrichten (Harness-Wert: höchstens 0,25 %).
6. Zweites Instrument (bevorzugt ein Index) erst im Backtest; live erst nach den Fail-Safe-Punkten 1/2.
