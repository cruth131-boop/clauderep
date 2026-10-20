# Was dem ICT Gold cBot fehlt – Frequenz, Diversifikation, Korrelation

Stand v2.60-dev. Die Frage lautet nicht „was ist schlecht umgesetzt“, sondern „was hat der Bot noch gar nicht“.
Die Messungen stammen aus zwei Quellen:

- **Harness-Läufe des echten Bots:** Alle Partial-Dateien sind jetzt die Originale, nur die Funnel-Telemetrie ist noch ein Stub.
  Echte M15-Kerzen, synthetische M1-Feinstruktur.
- **Strategie-Proxies ausschließlich auf echten M15-Kerzen,** 2016-01 bis 2022-02, XAUUSD und vier FX-Majors (1.595 Handelstage).

## Kurzfazit

1. **Der größte fehlende Hebel ist Portfolio-Fähigkeit: dieselbe Logik auf mehreren Instrumenten.**
   - Auf den echten Daten korrelieren die Tagesergebnisse der ICT-Logik zwischen Gold und FX praktisch nicht (−0,05 bis +0,12),
     obwohl die Kurse selbst deutlich korrelieren (Gold–EURUSD +0,37, Gold–AUDUSD +0,41, Gold–USDJPY −0,34).
   - Die empfohlene Konfiguration K2 erzielt im Harness auf allen vier FX-Paaren je **~1,0–1,15 Signale/Tag** mit PF 1,23–1,88.
   - **2–3 Signale/Tag** sind damit über 2–3 Instrumente erreichbar, ohne eine einzige Regel zu lockern.
2. **Genau das blockiert der heutige Code.** Die Fail-Safe-Schicht nimmt an, dass nur dieser eine Bot auf dem Konto handelt.
   Eine zweite Instanz auf einem anderen Symbol würde im Live-Betrieb beide Instanzen sperren (Details unten).
   Das ist die Voraussetzung Nr. 1.
3. **Andere Strategie-Familien sind kaum korreliert** (ORB +0,08–0,10, H1-Trendfolge ~0). Sie diversifizieren aber nur, wenn sie
   einen eigenen, belegten Edge haben. Die getesteten Proxies hatten nach Kosten keinen
   (ORB PF 0,88–0,98, Trendfolge 0,87–1,19).
   Die beliebte Hedge-These „Breakout gewinnt, wenn Sweep-Reversal verliert“ ist **widerlegt**:
   Ein ORB ist an ICT-Verlusttagen sogar schlechter (−0,32 R gegenüber −0,10 R).
4. **SMT-Divergenz fehlt komplett.** Gegen FX-Partner ergibt sie keinen stabilen Qualitätsunterschied.
   Das klassische Gold-SMT (gegen Silber oder den Dollar-Index) ließ sich hier mangels Daten nicht testen.
   Es ist ein Kandidat, aber kein gesicherter Gewinn.

## Die nachgelieferten Dateien

| Datei | Inhalt | Befund |
|---|---|---|
| `CandidateTelemetry.cs` | Kandidaten-Register (`CAND_END`), Terminal-Stufen, `ShadowEvaluator` (virtuelles Ergebnis bei 1,0/1,2/1,5/1,6/2,0/3,0 R, Stop-zuerst bei Mehrdeutigkeit, 24-h-Horizont) | Sauber und konservativ. Die Daten für ein Lernmodell (Meta-Labeling) entstehen damit bereits, aber **nichts wertet sie im Bot aus** |
| `CandidateTelemetryBot.cs` | Verdrahtung, rein beobachtend; OTE/ATM-Schattendetektoren | Im Harness bestätigt **handelsneutral** (identische Trades mit und ohne Shadow). `CandAdvanceShadows` durchläuft für jeden Kandidaten alle M1-Bars (O(n)): in langen Backtests langsam, sonst unkritisch |
| `EntryGeometry.cs` | OTE-Clip 0,618–0,786, Tick-Rundung nach innen, Fill-Ratio, Stop-Tick | Korrekt; `decimal`-Rechnung vermeidet Rundungsfehler |
| `Patterns.cs` | K03 Breaker / K04 Mitigation (M15, A-B-C-Pivots), K05 ATM (H1) | Detektion nur exakt auf der Bruch-Kerze, Displacement-Schwellen fest verdrahtet. Im Harness erzeugen **alle vier NS-Module zusammen 2 Trades in 2 Jahren**, für die Frequenz also irrelevant |
| `LiveNews.cs` | Live-Kalender (MQL5-Generation, Hash, Coverage, Stale) | Live sperrt ein HIGH-Event mit `TENTATIVE`/`ALL_DAY` den **ganzen UTC-Tag**. Der Backtest-Kalender (`ParseNewsCalendarCsv`) ignoriert solche Events. **Live handelt also seltener als jeder Backtest zeigt**, und das ist nirgends gemessen |

Integration geprüft: v2.60 kompiliert mit allen echten Dateien. Ergebnisse auf 2020–21:

| Prüfung | Ergebnis |
|---|---|
| OFF gegen v2.59 | identisch, 103 Positionen |
| K2 mit echten Dateien gegen K2 mit Stubs | identisch, 598 Positionen |
| NS-Module an, v2.59 gegen v2.60 | identisch, 105 Positionen |
| Shadow-Telemetrie | handelsneutral |

## Fehlende Bausteine – priorisiert

| # | Baustein (fehlt heute) | Frequenz | Qualität / Risiko | Evidenz |
|---|---|---|---|---|
| 1 | **Multi-Instrument-Betrieb** (gleiche Logik auf Gold + FX/Indizes) | **×N Instrumente**, ~1/Tag je Instrument mit K2 | Diversifikation: Ergebnis-Korrelation ~0 auf echten Daten | **gemessen** (Harness + echte M15) |
| 2 | **Multi-Instanz-sichere Fail-Safes** (Lock, Ownership, Kill-Switch pro Bot statt pro Konto) | Voraussetzung für 1 | ohne das sperren sich Instanzen gegenseitig | Code-Befund |
| 3 | **Portfolio-Risikomanager** (Gesamtrisiko, USD-Klumpen, Tageslimit über alle Instrumente) | ermöglicht 1 sicher | an 52–57 % der gemeinsamen Handelstage haben Gold und FX-Trade dieselbe USD-Richtung | **gemessen** |
| 4 | **Instrument-neutrale Parameter** (Pips → ATR/ADR-Vielfache, `PricePerStrategyPip` je Symbol) | Voraussetzung für 1 | auch für Gold robuster gegen Volatilitätsregime | Harness nutzt genau diese Normierung (Tagesrange 55) |
| 5 | **Echte Pending-Limit-Orders + mehrere Kandidaten gleichzeitig** | Zonen 4,6/Tag → CE erreicht 2,2/Tag → Order 1,15/Tag; 462 Zonen laufen ohne CE-Touch ab | Fill exakt am CE statt Tick-Trigger | Funnel gemessen, Effekt nicht |
| 6 | **Meta-Labeling auf der vorhandenen Telemetrie** (`CAND_END` + `SHADOW_END` → Modell entscheidet über abgelehnte Kandidaten) | zusätzliche Signale aus heute abgelehnten Kandidaten (Extended-Session 133, RR 133, kein Ziel 103 in 2 J.) | nur mit striktem Out-of-Sample | Daten liegen vor, Modell fehlt |
| 7 | **Weitere Liquiditätspools & Referenzlevels**: Vorwochen-H/L, NY-Session-H/L, H4-Swings, NWOG/NDOG, Midnight-/8:30-Open, Rundzahlen | mehr Raid-Auslöser und mehr gültige Ziele (103 × „kein Ziel“, TP-Deckel) | ICT-konform | Funnel gemessen, Effekt nicht |
| 8 | **News-Reaktions-Lane** (FVG nach dem Displacement eines HIGH-Release, z. B. 8:30) | +Signale an News-Tagen (heute nur Sperre/Schließen) | erhöhte Slippage → enge Ausführungsregeln | nicht getestet |
| 9 | **Zweite Strategie-Familie** (z. B. eure ORB-VWAP-Forschung, Trendfolge) | ORB-Proxy 1,8–1,9/Tag, Trend 0,7/Tag je Symbol | Korrelation zu ICT 0–0,10 → nur mit eigenem Edge sinnvoll | **gemessen**: Korrelation niedrig, Proxies ohne Edge |
| 10 | **SMT-Divergenz** (Gold vs. Silber/DXY) | indirekt: als starke Bestätigung könnte sie schwächere Filter ersetzen | gegen FX nicht trennscharf | **gemessen** (FX): kein stabiler Effekt |

## Korrelation – Messwerte (echte M15-Daten 2016–2022)

Proxies (bewusst einfach, keine Bot-Kopien):
- **ICT:** Raid auf Vortags-, Asia- oder London-Hoch/-Tief in den Killzones, Reclaim, M15-MSS, Limit am 50-%-Level des Beins,
  Stop hinter dem Extrem, Ziel 2 R.
- **ORB:** London 03:00 und NY 09:30, 30-Minuten-Range, Ziel 2 R.
- **TRD:** H1-Donchian-20 mit SMA-100-Filter, Chandelier-Trail 3 ATR.

Kosten jeweils 1,2 % der medianen Tagesrange.

**Tages-Korrelation der Basiswerte** (Renditen 2020–21):

| | XAUUSD | EURUSD | GBPUSD | USDJPY | AUDUSD |
|---|---:|---:|---:|---:|---:|
| XAUUSD | 1 | 0,37 | 0,33 | −0,34 | 0,41 |
| EURUSD | | 1 | 0,59 | −0,53 | 0,58 |

**Ergebnis-Korrelation der ICT-Logik** (Tages-R) zwischen den Instrumenten: −0,02 bis +0,06.
Betrachtet man nur die Tage, an denen Gold **und** das FX-Paar einen ICT-Trade hatten:

| Paar | gemeinsame Tage | Korrelation R | gleiche USD-Richtung | beide verloren (unabhängig erwartet) |
|---|---:|---:|---:|---:|
| XAUUSD / EURUSD | 400 | −0,03 | 56 % | 40 % (40 %) |
| XAUUSD / GBPUSD | 369 | −0,03 | 52 % | 40 % (41 %) |
| XAUUSD / USDJPY | 293 | +0,12 | 57 % | 41 % (37 %) |
| XAUUSD / AUDUSD | 322 | −0,05 | 56 % | 43 % (44 %) |

Die Ergebnisse verhalten sich wie unabhängig. Das Instrument ist eine echte Diversifikationsquelle.
Gleichgerichtetes USD-Exposure tritt trotzdem an gut der Hälfte der gemeinsamen Tage auf. Deshalb braucht es den Portfolio-Risikomanager (#3).

**Strategie-Familien untereinander** (gleiches Instrument, Tages-R): ICT/ORB +0,08 bis +0,10, ICT/Trend −0,06 bis +0,08, ORB/Trend ~0.
An ICT-Verlusttagen (Gold) liefert ORB im Schnitt −0,32 R und Trend −0,02 R. **Keine Absicherungswirkung**, nur geringe Korrelation.

**Bot im Harness (K2, 2020–21):**

| Instrument | Signale/Tag | PF (R) | Summe R |
|---|---:|---:|---:|
| XAUUSD | 1,14 | 1,52 | 202 |
| EURUSD | 1,15 | 1,64 | 246 |
| GBPUSD | 1,14 | 1,88 | 320 |
| USDJPY | 1,03 | 1,23 | 88 |
| AUDUSD | 1,11 | 1,52 | 200 |
| Portfolio (gleiches Risiko je Signal) | 5,58 | 1,56 | 1.057 |

Bei diesem Instrumenten-Test korrelieren die Tagesergebnisse im Harness ebenfalls ~0. Das ist aber **kein Beleg**:
Dieselbe Gold-Serie mit anderem Zufalls-Seed korreliert dort mit sich selbst auch nur ~0,0, weil die Tagesergebnisse von der synthetischen M1-Struktur dominiert werden.
Belastbar für die Korrelation sind deshalb nur die Proxy-Werte auf echten Daten oben.
Die Harness-Läufe belegen etwas anderes: Die Logik funktioniert normiert auch auf FX, und die Frequenz skaliert mit der Zahl der Instrumente.

## Blocker im heutigen Code (für #1–#3)

| Stelle | Verhalten | Folge bei zweiter Instanz / zweitem Symbol |
|---|---|---|
| `FsInitialize` (`FailSafeBot.cs`) | Recovery-Lock `RecoveryOwner/account-<Konto>.lock` mit `FileShare.None`, pro Bot-Klasse und Konto | zweite Instanz bekommt den Lock nicht → `_startupFault` → keine Entries |
| `FsOwnershipCheck` / `OwnershipGuard` | jede Position, die nicht Label + **gleiches Symbol** + Owner-Marker trägt, gilt als fremd und latcht dauerhaft | eine Position auf EURUSD sperrt die Gold-Instanz (und umgekehrt) bis zum manuellen Reset |
| Kill-Switch `StrictBalance` (live) | jede Balance-Änderung, die nicht aus eigenen Trades stammt, ist ein Fehler | jeder geschlossene Trade einer anderen Instanz sperrt die Entries |
| `FsKsReconciliation` | fremde Positionen verhindern die automatische Freigabe des Protection-Latch | Latches lösen sich nie automatisch |
| `FsValidateLiveStart` | Live-Start nur für Konto 2077191, EUR, **XAUUSD**, Hebel 1:30 | andere Symbole können live nicht starten |
| `BotLabel` const, `RequiredSymbolPrefix = XAUUSD`, feste Pip-Werte | Gold-spezifisch | Parameter müssen pro Instrument neu gesetzt werden |

**Benötigt wird:**

1. Lock und State pro (Bot, Konto, Symbol).
2. Eine Ownership-Registry, die eigene Geschwister-Instanzen kennt (gemeinsames Label-Präfix plus Instanz-ID).
3. Kill-Switch-Bilanzierung nur über die eigenen Positions-IDs.
4. Optional ein gemeinsamer Portfolio-Kill-Switch, also eine Datei mit Lock, die alle Instanzen lesen.

Die Sicherheitslogik bleibt dabei erhalten; nur ihr Geltungsbereich wird vom Konto auf die Instanz verschoben.

## Empfohlene Reihenfolge

1. **Portfolio-Grundlage (#2, #4):** Fail-Safes instanzfähig machen und Parameter ATR/ADR-normieren.
   Danach mit Gold allein prüfen, dass Gold identisch handelt wie vorher.
2. **Portfolio-Risiko (#3):** Gesamtrisiko-Deckel, USD-Netto-Exposure-Deckel, Tages-/Wochenlimit über alle Instrumente.
3. **Zweites Instrument im cTrader-Backtest mit echten Ticks:** EURUSD oder GBPUSD, möglichst auch ein Index (NAS100/US30/GER40) und XAGUSD.
   Indizes und Silber waren hier nicht verfügbar. Abnahme je Instrument wie bei Gold (Lane-PF ≥ 1,20).
4. **Pending-Limit-Engine (#5)** und **zusätzliche Liquiditätspools (#7):** mehr Signale je Instrument.
5. **Meta-Labeling (#6)** erst, wenn genug Telemetrie aus 1–4 vorliegt; strikt vorregistriert und Out-of-Sample.
6. **SMT mit XAGUSD/DXY (#10)** als Studie im echten cTrader-Backtest.
   Eine zweite Strategie-Familie (#9) nur mit separat nachgewiesenem Edge.

## Methodik & Grenzen

- Die Proxies sind vereinfachte Regelwerke. Sie sollen die **Korrelationsstruktur** zeigen, nicht die Profitabilität.
  Dass sie nach Kosten keinen Edge haben, sagt nichts über den Bot.
- M15-Daten (kein Intrabar-Verlauf); bei Stop und Ziel in derselben Kerze zählt der Stop.
  Quelle `ejtraderLabs/historical-data`, Broker-Zeit (NY+7 h) → UTC.
- Harness-Läufe: wie im README beschrieben (echte M15, synthetische M1, normierte Tagesrange 55, Spread 0,20, kein News-Kalender).
- Reproduktion: `tools/strategy_family_study.py`, `tools/smt_study.py`, `tools/portfolio_corr.py`.
