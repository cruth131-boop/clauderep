# v2.61-dev Testmatrix (Harness, synthetische M1 "rough", Spread 0,20, substeps 4)

CE-Arme mit **ruhender Limit-Order** (`CeExecution=RestingLimit`): Ihr Fill liegt exakt am CE und hängt nicht vom Tick-Raster ab.
Der v2.60-Tick-Trigger wird vom groben Raster geschönt (siehe v261_tick_density.txt). A0 (Close-Bestätigung) ist davon kaum betroffen.

| Arm | Inhalt | O2015 PF / Signale pro Tag | O2017 | R2019 | R2021 | Σ R (8 J.) | Ø R/Signal | Signale/Tag |
|---|---|---|---|---|---|---|---|---|
| A0_control | v2.59-Verhalten (Defaults) | 0.73 / 0.26 | 0.97 / 0.23 | 1.26 / 0.22 | 1.53 / 0.20 | +25 | +0.052 | 0.23 |
| K2L_limit | K2 + CE als ruhende Limit-Order | 0.93 / 1.37 | 1.17 / 1.28 | 1.06 / 1.29 | 1.21 / 1.39 | +165 | +0.060 | 1.33 |
| K2L_S2 | + 2 Slots je Richtung | 0.97 / 1.61 | 1.17 / 1.52 | 1.03 / 1.52 | 1.20 / 1.62 | +208 | +0.064 | 1.57 |
| K2L_S3 | + 3 Slots je Richtung | 0.97 / 1.64 | 1.15 / 1.55 | 1.07 / 1.56 | 1.22 / 1.65 | +230 | +0.070 | 1.60 |
| K2L_PW | + Vorwochen-H/L | 1.01 / 1.57 | 1.17 / 1.46 | 1.00 / 1.52 | 1.17 / 1.62 | +192 | +0.060 | 1.54 |
| K2L_NYAM | + NY-AM-Range | 0.94 / 1.38 | 1.17 / 1.28 | 1.06 / 1.28 | 1.22 / 1.40 | +177 | +0.064 | 1.34 |
| K2L_H4 | + unberührte H4-Swings | 0.98 / 1.57 | 1.15 / 1.44 | 0.97 / 1.49 | 1.18 / 1.60 | +153 | +0.048 | 1.53 |
| K2L_NWOG | + NWOG-Ziele | 0.93 / 1.41 | 1.15 / 1.32 | 1.04 / 1.32 | 1.20 / 1.44 | +156 | +0.055 | 1.37 |
| K2L_POOLS | + PW, NY AM, H4, NWOG | 1.00 / 1.60 | 1.17 / 1.48 | 1.00 / 1.52 | 1.16 / 1.64 | +186 | +0.058 | 1.56 |
| K2L_S2_POOLS | + 2 Slots + alle vier Pools | 1.04 / 1.88 | 1.19 / 1.78 | 0.98 / 1.79 | 1.14 / 1.93 | +232 | +0.061 | 1.85 |
| K3 | **K3 = K2L + 2 Slots + PW + NY AM (Empfehlung)** | 1.05 / 1.85 | 1.19 / 1.77 | 0.98 / 1.79 | 1.18 / 1.90 | +263 | +0.069 | 1.83 |
