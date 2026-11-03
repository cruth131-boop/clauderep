# Birthday Run 🎂

Ein kleines Endless-Runner-Spiel als Web-App (PWA) fürs iPhone, ein Geburtstagsgeschenk.
Es gibt drei Modi: Geburtstag (Ziel: 100 Punkte, dann Finale mit Geschenk), Endlos und Horror (wird nach dem Geburtstags-Modus freigeschaltet).

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
