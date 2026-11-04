# Birthday Run 🎂

Ein kleines Endless-Runner-Spiel als Web-App (PWA) fürs iPhone, ein Geburtstagsgeschenk.
Modi: Geburtstag (Kerzen sammeln, dann Finale mit Geschenk) → danach **Level-Modus** (38 Level + 1 geheimes,
nach Lebensphasen sortiert, einmal erreichte Level sind frei wählbar). Level 13 schaltet den Horror-Modus frei,
Level 38 den Endlos-Modus (alle Level-Welten in zufälliger Reihenfolge). Roadtrip ab 4.12.

- Fortschritt (Sterne, Rekorde, Outfits) wird automatisch im Browser gespeichert (`localStorage`, Schlüssel `br.save.v1`).
  `?reset=1` löscht ihn, `?dev=1` schaltet zum Testen alles frei.
- Cheat in jedem Level: 10× springen, 3× ducken, 3× springen (innerhalb von 12 s) → Godmode mit ◀ ▶ und Raketenwerfer.
- Kurzvideos im Kinoformat vor dem Level (`introVideo`) und nach dem Ziel (`outroVideo`), beim Wiederholen sofort überspringbar.
- Nach dem Zieleinlauf folgt das Finale: Einspieler oder Minispiel (Tanzen im Takt, Rolltreppe, Sonde,
  Schultüte, Schokokuss-Werfen, Spielautomat, Fips mit den Hunden). Minispiele kennen kein Scheitern, nur Bonuspunkte.
  Daten: `events` in der privaten Config, Engine: `js/story.js`.
- Level-Texte, Gäste und Sprüche stehen verschlüsselt in der privaten Config (`levels`), Mechanik/Hintergründe in `js/levels.js`,
  Musik in `js/songs.js` (gemeinfreie Melodien + eigene Stücke). Eigene MP3s als `music_<name>.mp3` im Bundle ersetzen einen Track.

## Privatsphäre

Das Repository ist **öffentlich**. Fotos, Namen, Sprüche und das Geschenk liegen deshalb
**nur verschlüsselt** in `assets/bundle.enc` (AES-256-GCM, Schlüssel per PBKDF2 aus dem Passwort).
Der Ordner `private/` mit den Originalen ist per `.gitignore` ausgeschlossen und wird nie committet.

## Inhalte ändern

```
private/config.json        # Texte, Namen, Geschenk, Cameos, Erinnerungen
private/assets/*.png|jpg   # Fotos (Dateiname ohne Endung = Schlüssel)
private/assets/*.mp3       # optionale Sounds/Musik
```

Bundle neu bauen:

```bash
PASSWORT="…" node tools/build.mjs
```

Bundle wieder entpacken (z. B. in einer neuen Session):

```bash
PASSWORT="…" node tools/build.mjs --decrypt
```

### Bild-Schlüssel

| Datei | Verwendung |
|---|---|
| `her`, `her_happy`, `her_shock`, `her_sad` | Kopf der Spielfigur (freigestellt, PNG mit Transparenz) |
| `him_sad`, `him_happy` | Partner-Kopf (Einspieler beim Verlieren, Finale, Eierkopf-Bonus) |
| `mama`, `papa`, `oma` | Cameos am Wegesrand |
| `fips` | Kopf des Katers (optional, sonst gezeichnet) |
| `memory_*` | Polaroids bei 25/50/75 Punkten (siehe `memories` in config.json) |
| `injury_op`, `injury_wheelchair` | „Notaufnahme“-Einspieler |

### Sound-Schlüssel (optional, ersetzen die eingebauten Chiptunes/Effekte)

`no` (Verlier-Sound), `music_menu`, `music_run`, `music_horror`, `music_finale`, und jeder Effektname aus `js/audio.js`.

## Testen

```bash
python3 -m http.server 8000
```

Dann `http://localhost:8000/run34/?dev=1` öffnen. `?dev=1` schaltet alles frei und mit der Taste **F** springt man direkt ins Finale.

## Veröffentlichen (kostenlos)

Über GitHub Pages: Repository → Settings → Pages → „Deploy from a branch“ → Branch wählen, Ordner `/ (root)`.
Die Adresse ist dann `https://<user>.github.io/clauderep/run34/`.
Auf dem iPhone öffnet man sie in Safari und wählt dann Teilen → „Zum Home-Bildschirm“.

Nach Änderungen sollte man in `sw.js` die `VERSION` erhöhen, damit das iPhone die neue Fassung lädt.
