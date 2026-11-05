// Level-Musik: Arcade-Arrangements gemeinfreier Melodien (Volkslieder, Klassik, Traditionals)
// und einige eigene Stücke. Notation: "C5" = 1 Schritt, "C5:3" = 3 Schritte, "." = Pause.
// bar = Schritte pro Takt, div = Schritte pro Viertel (2 = Achtel, 4 = Sechzehntel).
// ch = Akkorde je Takt ("|"-getrennt, bis zu 2 Akkorde pro Takt), style = Begleitung.

const HB44 = `. . . . . . G4 G4  A4:2 G4:2 C5:4  B4:6 G4 G4  A4:2 G4:2 D5:4  C5:6 G4 G4  G5:2 E5:2 C5:4  B4:2 A4:4 F5 F5  E5:2 C5:2 D5:4  C5:8`;
const HB44_CH = 'N | C | G | G | C | C | F | C G | C';

export const SONGS = {
  // L1 Oh du lieber Augustin (Wiener Volkslied)
  augustin: { bpm: 150, bar: 6, style: 'waltz', lead: 'square', drums: 'k.h.h.',
    mel: `G5:3 A5 G5 F5  E5:2 C5:2 C5:2  D5:2 G4:2 G4:2  E5:2 C5:2 C5:2  G5:3 A5 G5 F5  E5:2 C5:2 C5:2  D5:2 G4:2 G4:2  C5:6
          D5:2 G4:2 G4:2  E5:2 C5:2 C5:2  D5:2 G4:2 G4:2  E5:2 C5:2 C5:2  G5:3 A5 G5 F5  E5:2 C5:2 C5:2  D5:2 G4:2 G4:2  C5:6`,
    ch: 'C | C | G | C | C | C | G | C | G | C | G | C | C | C | G | C' },
  // L2 Alle meine Entchen
  entchen: { bpm: 150, bar: 8, style: 'oompah', lead: 'triangle', drums: 'k.h.s.h.',
    mel: `C5:2 D5:2 E5:2 F5:2  G5:4 G5:4  A5:2 A5:2 A5:2 A5:2  G5:8  A5:2 A5:2 A5:2 A5:2  G5:8  F5:2 F5:2 F5:2 F5:2  E5:4 E5:4  D5:2 D5:2 D5:2 D5:2  C5:8`,
    ch: 'C | C | F | C | F | C | F | C | G | C' },
  // L3 Hänschen klein
  haenschen: { bpm: 156, bar: 8, style: 'oompah', lead: 'square', drums: 'k.h.s.h.',
    mel: `G5:2 E5:2 E5:4  F5:2 D5:2 D5:4  C5:2 D5:2 E5:2 F5:2  G5:2 G5:2 G5:4  G5:2 E5:2 E5:4  F5:2 D5:2 D5:4  C5:2 E5:2 G5:2 G5:2  C5:8
          D5:2 D5:2 D5:2 D5:2  D5:2 E5:2 F5:4  E5:2 E5:2 E5:2 E5:2  E5:2 F5:2 G5:4  G5:2 E5:2 E5:4  F5:2 D5:2 D5:4  C5:2 E5:2 G5:2 G5:2  C5:8`,
    ch: 'C | G7 | C | C | C | G7 | C | C | G7 | G7 | C | C | C | G7 | C | C' },
  // L4 Für Elise (Beethoven)
  elise: { bpm: 120, div: 4, bar: 6, style: 'arp', lead: 'square', drums: 'k..h..',
    mel: `. . . . E5 D#5  E5 D#5 E5 B4 D5 C5  A4:3 C4 E4 A4  B4:3 E4 G#4 B4  C5:3 E4 E5 D#5  E5 D#5 E5 B4 D5 C5  A4:3 C4 E4 A4  B4:3 E4 C5 B4
          A4:3 B4 C5 D5  E5:3 G4 F5 E5  D5:3 F4 E5 D5  C5:3 E4 D5 C5  B4:3 E4 E5 .`,
    ch: 'N | N | Am | E | Am | N | Am | E | Am | C | G | Am | E', oct: 12 },
  // L5 Happy Birthday (Kinder-Version)
  birthday: { bpm: 138, bar: 8, style: 'oompah', lead: 'triangle', drums: 'k.h.s.h.', mel: HB44, ch: HB44_CH, oct: 12 },
  // L6 The Entertainer (Scott Joplin)
  entertainer: { bpm: 112, bar: 8, style: 'oompah', lead: 'square', drums: 'k.h.s.hh',
    mel: `. . . . . . D5 D#5  E5 C6:2 E5 C6:2 E5 C6  C6:4 . C6 D6 D#6  E6 C6 D6 E6:2 B5 D6:2  C6:6 D5 D#5
          E5 C6:2 E5 C6:2 E5 C6  C6:6 A5 G5  F#5 A5 C6 E6:2 D6 C6 A5  D6:6 D5 D#5
          E5 C6:2 E5 C6:2 E5 C6  C6:4 . C6 D6 D#6  E6 C6 D6 E6:2 B5 D6:2  C6:8`,
    ch: 'N | C | C | C G | C | C | C A7 | D7 | G7 | C | C | C G | C' },
  // L7 Wilhelm Tell – Ouvertüre (Rossini)
  tell: { bpm: 152, div: 4, bar: 8, style: 'eighths', lead: 'square', drums: 'k.h.s.h.',
    mel: `G5 G5 G5:2 G5 G5 G5:2  G5 G5 C6:2 D6:2 E6:2  G5 G5 G5:2 G5 G5 G5:2  G5 G5 E6:2 D6:2 C6:2
          G5 G5 G5:2 G5 G5 G5:2  G5 G5 C6:2 D6:2 E6:2  E6 E6 E6:2 D6 D6 D6:2  C6:8`,
    ch: 'C | C | C | G C | C | C | C G | C' },
  // L8 Habanera (Bizet, Carmen)
  habanera: { bpm: 104, div: 4, bar: 8, style: 'habanera', lead: 'sawtooth', drums: 'k..hk.h.',
    mel: `D5:3 C#5 C5:2 C5:2  B4:2 A#4:2 A4:4  G#4:3 G4 F4:2 F4:2  E4:2 F4:2 G4:2 F4 E4
          D5:3 C#5 C5:2 C5:2  B4:2 A#4:2 A4:4  G#4:3 G4 F4:2 E4:2  D4:8`,
    ch: 'Dm | Dm | Dm | A7 | Dm | Dm | A7 | Dm', oct: 12 },
  // L9 Rondo alla Turca (Mozart)
  turca: { bpm: 132, div: 4, bar: 8, style: 'oompah', lead: 'square', drums: 'k.h.s.h.',
    mel: `B4 A4 G#4 A4 C5:4  D5 C5 B4 C5 E5:4  F5 E5 D#5 E5 B5 A5 G#5 A5  B5 A5 G#5 A5 C6:4
          A5:2 C6:2 B5:2 A5:2  G5:2 A5:2 B5:2 A5:2  G5:2 A5:2 B5:2 A5:2  G5:2 F#5:2 E5:4`,
    ch: 'Am | Am | Am | Am | Am | E | Am E | E' },
  // L10 In der Halle des Bergkönigs (Grieg)
  mountain: { bpm: 168, bar: 8, style: 'eighths', lead: 'square', drums: 'k.h.k.s.',
    mel: `A4 B4 C5 D5 E5 C5 E5:2  D#5 B4 D#5:2 D5 A#4 D5:2  A4 B4 C5 D5 E5 C5 E5 A5  G5 E5 C5 E5 G5:4
          E5 F#5 G5 A5 B5 G5 B5:2  A#5 F#5 A#5:2 A5 F5 A5:2  E5 F#5 G5 A5 B5 G5 B5 E6  D6 B5 G5 B5 D6:4`,
    ch: 'Am | B7 | Am | C | Em | F#7 | Em | G' },
  // L11 Ode an die Freude (Beethoven)
  ode: { bpm: 144, bar: 8, style: 'oompah', lead: 'square', drums: 'k.h.s.h.',
    mel: `E5:2 E5:2 F5:2 G5:2  G5:2 F5:2 E5:2 D5:2  C5:2 C5:2 D5:2 E5:2  E5:3 D5 D5:4  E5:2 E5:2 F5:2 G5:2  G5:2 F5:2 E5:2 D5:2  C5:2 C5:2 D5:2 E5:2  D5:3 C5 C5:4
          D5:2 D5:2 E5:2 C5:2  D5:2 E5 F5 E5:2 C5:2  D5:2 E5 F5 E5:2 D5:2  C5:2 D5:2 G4:4  E5:2 E5:2 F5:2 G5:2  G5:2 F5:2 E5:2 D5:2  C5:2 C5:2 D5:2 E5:2  D5:3 C5 C5:4`,
    ch: 'C | G | C | G | C | G | C | G C | G C | G C | G C | C G | C | G | C | G C' },
  // L12 Toccata d-Moll (Bach)
  toccata: { bpm: 96, div: 4, bar: 8, style: 'organ', lead: 'sawtooth', drums: '........',
    mel: `A5 G5 A5:6  . . G5 F5 E5 D5 C#5:2  D5:8  A4 G4 A4:6  . . E4 F4 C#4:2 D4:2  D4:8
          A4 D5 F5 A5 D6 A5 F5 D5  C#5 E5 G5 A5 C#6 A5 G5 E5  D5 F5 A5 D6 A5 F5 D5 A4  D5:8`,
    ch: 'Dm | A7 | Dm | Dm | A7 | Dm | Dm | A7 | Dm | Dm' },
  // L15 Deck the Halls (Traditional)
  deckhalls: { bpm: 140, bar: 8, style: 'oompah', lead: 'triangle', drums: 'k.h.s.h.',
    mel: `G5:3 F5 E5:2 D5:2  C5:2 D5:2 E5:2 C5:2  D5 E5 F5 D5 E5:3 D5  C5:2 B4:2 C5:4  G5:3 F5 E5:2 D5:2  C5:2 D5:2 E5:2 C5:2  D5 E5 F5 D5 E5:3 D5  C5:2 B4:2 C5:4
          D5:3 E5 F5:2 D5:2  E5:3 F5 G5:2 D5:2  E5 F#5 G5:2 A5 B5 C6:2  B5:2 A5:2 G5:4  G5:3 F5 E5:2 D5:2  C5:2 D5:2 E5:2 C5:2  A5 A5 A5 A5 G5:3 F5  E5:2 D5:2 C5:4`,
    ch: 'C | F C | G C | G C | C | F C | G C | G C | G | C G | C D | D G | C | F C | F C | G C' },
  // L16 Volksfest-Walzer (eigene Melodie)
  volksfest: { bpm: 168, bar: 6, style: 'waltz', lead: 'square', drums: 'k.h.h.',
    mel: `E5:2 G5:2 C6:2  B5:4 G5:2  A5:2 F5:2 A5:2  G5:6  F5:2 A5:2 D6:2  C6:4 A5:2  G5:2 B5:2 D6:2  C6:6
          C6:2 B5:2 A5:2  G5:2 E5:2 C5:2  D5:2 E5:2 F5:2  G5:6  A5:2 G5:2 F5:2  E5:2 D5:2 C5:2  D5:2 G5:2 B4:2  C5:6`,
    ch: 'C | G | F | C | F | F | G | C | C | C | G | C | F | C | G | C' },
  // L17 La donna è mobile (Verdi)
  mobile: { bpm: 140, bar: 8, style: 'oompah', lead: 'square', drums: 'k.h.s.h.',
    mel: `E5 E5 E5 G5 F5:2 D5:2  D5 D5 D5 F5 E5:2 C5:2  C5 C5 C5 E5 D5:2 B4:2  C5:2 E5:2 G5:4
          A5 G5 F5 E5 D5:2 B4:2  C5:2 G5:2 C6:4  A5 G5 F5 E5 D5:2 G5:2  C5:8`,
    ch: 'C G | G C | Am G | C | F G | C | F G | C' },
  // L18 Can-Can (Offenbach)
  cancan: { bpm: 152, bar: 8, style: 'oompah', lead: 'square', drums: 'k.h.s.h.',
    mel: `C5:4 D5 F5 E5 D5  G5:2 G5:2 G5 A5 E5 F5  D5:2 D5:2 D5 F5 E5 D5  C5 C6 B5 A5 G5 F5 E5 D5
          C5:4 D5 F5 E5 D5  G5:2 G5:2 G5 A5 E5 F5  D5:2 D5:2 D5 F5 E5 D5  C5 G5 D5 E5 C5:4`,
    ch: 'C | G | G | C G | C | G | G | G C' },
  // L19 Korobeiniki (russisches Volkslied, bekannt als Tetris-Melodie)
  tetris: { bpm: 150, bar: 8, style: 'eighths', lead: 'square', drums: 'k.h.s.h.',
    mel: `E5:2 B4 C5 D5:2 C5 B4  A4:2 A4 C5 E5:2 D5 C5  B4:3 C5 D5:2 E5:2  C5:2 A4:2 A4:4
          . D5:2 F5 A5:2 G5 F5  E5:3 C5 E5:2 D5 C5  B4:2 B4 C5 D5:2 E5:2  C5:2 A4:2 A4:4`,
    ch: 'E | Am | E | Am | Dm | C | E | Am' },
  // L20 Retro-Synthpop (eigene Melodie)
  retro: { bpm: 122, bar: 8, style: 'disco', lead: 'sawtooth', drums: 'k.hsk.hs',
    mel: `A5:2 G5 E5:2 G5 A5:2  C6:2 A5 G5:2 E5:3  G5:2 E5 C5:2 E5 G5:2  D5:6 . .  A5:2 G5 E5:2 G5 A5:2  C6:2 D6 C6:2 A5:3  G5:2 A5 G5:2 E5 D5:2  C5:8`,
    ch: 'Am | F | C | G | Am | F | C | G' },
  // L21 Safari (eigene Melodie, Marimba)
  safari: { bpm: 138, bar: 8, style: 'eighths', lead: 'triangle', drums: 'k.hhs.hk',
    mel: `C5 E5 G5 E5 A5:2 G5:2  E5 G5 C6 G5 E5:4  F5 A5 C6 A5 G5:2 E5:2  D5 E5 G5 E5 D5:4  C5 E5 G5 E5 A5:2 C6:2  D6 C6 A5 G5 E5:4  F5 E5 D5 E5 G5:2 A5:2  G5:8`,
    ch: 'C | C | F | G | C | Am | F G | C' },
  // L22 Jingle Bells (James Lord Pierpont, 1857)
  jinglebells: { bpm: 150, bar: 8, style: 'oompah', lead: 'square', drums: 'k.h.s.h.',
    mel: `E5:2 E5:2 E5:4  E5:2 E5:2 E5:4  E5:2 G5:2 C5:3 D5  E5:8  F5:2 F5:2 F5:3 F5  F5:2 E5:2 E5:2 E5 E5  E5:2 D5:2 D5:2 E5:2  D5:4 G5:4
          E5:2 E5:2 E5:4  E5:2 E5:2 E5:4  E5:2 G5:2 C5:3 D5  E5:8  F5:2 F5:2 F5:3 F5  F5:2 E5:2 E5:2 E5 E5  G5:2 G5:2 F5:2 D5:2  C5:8`,
    ch: 'C | C | C | C | F | C | D7 | G | C | C | C | C | F | C | G | C' },
  // L23 Eine kleine Nachtmusik (Mozart)
  nachtmusik: { bpm: 132, bar: 8, style: 'eighths', lead: 'square', drums: 'k.h.s.h.',
    mel: `G5:2 . D5 G5:2 . D5  G5 D5 G5 B5 D6:4  C6:2 . A5 C6:2 . A5  C6 A5 F#5 A5 D5:4
          G5:2 G5:2 B5 A5 G5 G5  G5 F#5 F#5:2 A5 C6 F#5 A5  G5:2 G5:2 B5 A5 G5 G5  G5 F#5 A5 F#5 G5:4`,
    ch: 'G | G | D | D | G | D | G | D G' },
  // L24 Ungarischer Tanz Nr. 5 (Brahms)
  hungarian: { bpm: 132, bar: 8, style: 'oompah', lead: 'sawtooth', drums: 'k.h.s.h.',
    mel: `A4:2 D5:6  F5 E5 D5:2 C#5:4  D5:2 E5:2 F5:2 G5:2  A5:3 G5 F5:2 E5:2  A4:2 D5:6  F5 E5 D5:2 C#5:4  E5 F5 G5 F5 E5:2 C#5:2  D5:8
          A5 A5 A#5 A5 G5 G5 A5 G5  F5 F5 G5 F5 E5:4  G5 G5 A5 G5 F5 F5 G5 F5  E5 D5 C#5 E5 D5:4`,
    ch: 'Dm | A7 | Dm | A7 | Dm | A7 | A7 | Dm | Dm | A7 | A7 | Dm', oct: 12 },
  // L25 Happy Birthday – Disco
  bday30: { bpm: 120, bar: 8, style: 'disco', lead: 'sawtooth', drums: 'khshkhsh', mel: HB44, ch: HB44_CH, oct: 12 },
  // L26 Hummelflug (Rimski-Korsakow)
  bumblebee: { bpm: 150, div: 4, bar: 8, style: 'eighths', lead: 'square', drums: 'k.h.s.h.',
    mel: `E6 D#6 D6 C#6 D6 C#6 C6 B5  C6 B5 A#5 A5 G#5 G5 F#5 F5  E5 D#5 D5 C#5 D5 C#5 C5 B4  C5 B4 A#4 A4 G#4 G4 F#4 F4
          E4 F4 E4 D#4 E4 F4 E4 D#4  E4 F4 F#4 G4 G#4 A4 A#4 B4  C5 C#5 D5 D#5 E5 F5 E5 D#5  E5 F5 F#5 G5 G#5 A5 A#5 B5`,
    ch: 'E | E | E | E | Am | Am | E | E' },
  // L27 Hochzeits-Pop-Punk (eigene Melodie)
  punk: { bpm: 176, bar: 8, style: 'eighths', lead: 'square', drums: 'k.s.kks.',
    mel: `E5 E5 E5 D5 C5:2 D5:2  E5:2 G5:2 D5:4  E5 E5 E5 D5 C5:2 A4:2  C5:2 D5:2 C5:4  G5 G5 G5 E5 G5:2 A5:2  G5:2 E5:2 D5:4  E5 E5 G5 A5 G5:2 E5:2  D5:2 C5:2 C5:4`,
    ch: 'C | G | Am | F | C | G | Am | F' },
  // L28 Schnatter-Polka (eigene Melodie)
  polka: { bpm: 160, bar: 8, style: 'oompah', lead: 'square', drums: 'k.s.k.s.',
    mel: `G5 E5 G5 E5 G5:2 A5:2  G5 F5 E5 D5 C5:4  D5 E5 F5 D5 E5 F5 G5:2  A5 G5 F5 E5 D5:4  G5 E5 G5 E5 G5:2 A5:2  G5 F5 E5 D5 C5 E5 G5:2  A5 A5 G5 G5 F5 F5 E5 D5  C5:4 C6:4`,
    ch: 'C | G C | G | G | C | C | F G | C' },
  // L29 Kerb-Marsch (eigene Melodie)
  kerbmarsch: { bpm: 120, bar: 8, style: 'oompah', lead: 'square', drums: 'k.h.s.h.',
    mel: `C5:2 E5:2 G5:3 E5  F5:2 A5:2 C6:4  B5:2 G5:2 D5:2 F5:2  E5:6 G5:2  C6:2 B5:2 A5:2 G5:2  F5:2 E5:2 D5:4  G5:2 F5:2 E5:2 D5:2  C5:8`,
    ch: 'C | F | G | C | C | F G | G | C' },
  // L30 When the Saints Go Marching In (Traditional)
  saints: { bpm: 144, bar: 8, style: 'walk', lead: 'square', drums: 'k.h.s.h.',
    mel: `.:2 C5:2 E5:2 F5:2  G5:8  .:2 C5:2 E5:2 F5:2  G5:8  .:2 C5:2 E5:2 F5:2  G5:4 E5:4  C5:4 E5:4  D5:8
          .:2 E5:2 E5:2 D5:2  C5:6 C5:2  E5:4 G5:4  G5:2 F5:6  .:2 E5:2 F5:2 G5:2  E5:4 C5:4  D5:8  C5:8`,
    ch: 'C | C | C | C | C | C | C | G | G | C | C | F | C | C | G | C' },
  // L31 What Shall We Do with the Drunken Sailor (Seemannslied)
  sailor: { bpm: 150, bar: 8, style: 'oompah', lead: 'square', drums: 'k.h.s.h.',
    mel: `A5:2 A5 A5 A5:2 A5 A5  A5:2 D5:2 F5:2 A5:2  G5:2 G5 G5 G5:2 G5 G5  G5:2 C5:2 E5:2 G5:2  A5:2 A5 A5 A5:2 A5 A5  A5:2 B5:2 C6:2 D6:2  C6:2 A5:2 G5:2 E5:2  D5:4 D5:4`,
    ch: 'Dm | Dm | C | C | Dm | Dm | C | Dm' },
  // L32 Menuett G-Dur (Petzold/Bach)
  minuet: { bpm: 132, bar: 6, style: 'waltz', lead: 'triangle', drums: 'k.h.h.',
    mel: `G5:2 C5 D5 E5 F5  G5:2 C5:2 C5:2  A5:2 F5 G5 A5 B5  C6:2 C5:2 C5:2  F5:2 G5 F5 E5 D5  E5:2 F5 E5 D5 C5  D5:2 E5 D5 C5 B4  C5:6`,
    ch: 'C | C | F | C | F | C | G | C' },
  // L33 Der Frühling (Vivaldi)
  spring: { bpm: 132, bar: 8, style: 'eighths', lead: 'square', drums: 'k.h.s.h.',
    mel: `E5:2 G#5:2 G#5:2 G#5:2  F#5 E5 B5:6  B5 A5 G#5:2 G#5:2 G#5:2  F#5 E5 B5:6  B5 A5 G#5:2 A5:2 B5:2  A5:2 G#5:2 F#5:4  E5:2 G#5:2 F#5 E5 D#5:2  E5:8`,
    ch: 'E | E | E | E | E | B | E B | E' },
  // L34 We Wish You a Merry Christmas (Traditional)
  wewish: { bpm: 156, bar: 6, style: 'waltz', lead: 'triangle', drums: 'k.h.s.',
    mel: `. . . . . D5  G5:2 G5 A5 G5 F#5  E5:2 C5:2 E5:2  A5:2 A5 B5 A5 G5  F#5:2 D5:2 D5:2  B5:2 B5 C6 B5 A5  G5:2 E5:2 D5 D5  E5:2 A5:2 F#5:2  G5:6`,
    ch: 'N | G | C | A7 | D | B7 | Em | C D | G' },
  // L35 Oh! Susanna (Stephen Foster, 1848)
  susanna: { bpm: 152, bar: 8, style: 'walk', lead: 'square', drums: 'k.h.s.h.',
    mel: `. . . . . . C5 D5  E5:2 G5:2 G5:3 A5  G5:2 E5:2 C5:3 D5  E5:2 E5:2 D5:2 C5:2  D5:6 C5 D5  E5:2 G5:2 G5:3 A5  G5:2 E5:2 C5:3 D5  E5:2 E5:2 D5:2 D5:2  C5:8
          F5:4 F5:4  A5:2 A5:4 A5:2  G5:2 G5:2 E5:2 C5:2  D5:6 C5 D5  E5:2 G5:2 G5:3 A5  G5:2 E5:2 C5:3 D5  E5:2 E5:2 D5:2 D5:2  C5:8`,
    ch: 'N | C | C | C | G | C | C | G | C | F | F | C | G | C | C | G | C' },
  // L37 Auld Lang Syne (schottisches Volkslied) – mit Dudelsack-Bordun
  auldlang: { bpm: 112, bar: 8, style: 'drone', lead: 'sawtooth', drums: 'k...s...',
    mel: `. . . . . . G4:2  C5:3 C5 C5:2 E5:2  D5:3 C5 D5:2 E5:2  C5:3 C5 E5:2 G5:2  A5:6 A5:2  G5:3 E5 E5:2 C5:2  D5:3 C5 D5:2 E5:2  C5:3 A4 A4:2 G4:2  C5:6 .:2`,
    ch: 'N | C | G | C | F | C | G | F G | C', oct: 12 },
  // L38 Happy Birthday – großes Finale
  finaleBday: { bpm: 132, bar: 8, style: 'arp', lead: 'square', drums: 'k.hsk.hs', mel: HB44, ch: HB44_CH, oct: 12 },
  // Geheimes Level: La Cucaracha (mexikanisches Volkslied) als Reggae
  cucaracha: { bpm: 92, bar: 8, style: 'reggae', lead: 'triangle', drums: 'k...s...',
    mel: `G4 G4 G4 C5:3 E5:2  G4 G4 G4 C5:3 E5:2  C5:2 C5 B4 B4 A4 A4 G4  G4:8  G4 G4 G4 B4:3 D5:2  G4 G4 G4 B4:3 D5:2  G5:2 G5 F5 E5 D5 C5:2  C5:8`,
    ch: 'C | C | C G | G | G | G | G C | C', oct: 12 },
  // Ruhige Gitarren-Ballade (eigene Komposition) – Ersatz, falls kein eigener Song im Bundle liegt
  ballad: { bpm: 84, bar: 8, style: 'arp', lead: 'triangle', drums: 'k.......',
    mel: `E5:2 G5:2 C6:4  B5:2 G5:2 D5:4  C5:2 E5:2 A5:4  F5:4 A5:4  G5:3 E5 C5:4  D5:2 F5:2 B4:4  C5:4 E5:4  C5:8`,
    ch: 'C | G | Am | F | C | G | F G | C', oct: 0 },
  // L14 Techno (eigene Komposition)
  techno: { bpm: 132, div: 4, bar: 8, style: 'techno', lead: 'sawtooth', drums: 'k.h.k.h.',
    mel: `A4 C5 E5 A5 E5 C5 A4 E5  A4 C5 E5 A5 E5 C5 A4 E5  F4 A4 C5 F5 C5 A4 F4 C5  F4 A4 C5 F5 C5 A4 F4 C5
          C5 E5 G5 C6 G5 E5 C5 G5  C5 E5 G5 C6 G5 E5 C5 G5  G4 B4 D5 G5 D5 B4 G4 D5  G4 B4 D5 G5 D5 B4 G4 D5`,
    ch: 'Am | Am | F | F | C | C | G | G', oct: 12 },
};

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], dim: [0, 3, 6] };
function note(t) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(t);
  if (!m) return null;
  return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}
function chord(name) {
  if (!name || name === 'N') return null;
  const m = /^([A-G])(#|b)?(m7|m|7|dim)?$/.exec(name);
  if (!m) return null;
  const root = PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { root, tones: QUAL[m[3] || ''] };
}

/** Wandelt ein Lied in Spuren pro Schritt um: lead/bass/stab = { n, d } bzw. Arrays. */
export function compileSong(song) {
  const bar = song.bar || 8, div = song.div || 2, oct = song.oct || 0;
  const lead = [];
  for (const tok of song.mel.trim().split(/\s+/)) {
    const [t, l] = tok.split(':'); const d = Number(l || 1);
    const n = t === '.' ? null : note(t);
    lead.push(n == null ? null : { n: n + oct, d });
    for (let i = 1; i < d; i++) lead.push(null);
  }
  const bars = Math.ceil(lead.length / bar);
  while (lead.length < bars * bar) lead.push(null);
  const chs = song.ch.split('|').map((b) => b.trim().split(/\s+/));
  const len = lead.length;
  const bass = new Array(len).fill(null), stab = new Array(len).fill(null);
  const st = song.style;
  for (let s = 0; s < len; s++) {
    const b = Math.floor(s / bar), sb = s % bar;
    const list = chs[b % chs.length];
    const c = chord(list[Math.min(list.length - 1, Math.floor(sb / (bar / list.length)))]);
    if (!c) continue;
    let r = 36 + c.root; if (r < 40) r += 12;
    const third = r + c.tones[1], fifth = r + c.tones[2];
    const tones = c.tones.map((x) => 60 + c.root + x).map((x) => (x > 71 ? x - 12 : x));
    const q = sb % div === 0, beat = Math.floor(sb / div), half = Math.max(1, (bar / list.length) | 0);
    const chordStart = sb % half === 0;
    if (st === 'oompah' || st === 'waltz') {
      if (q) { if (beat === 0) bass[s] = { n: r, d: div }; else if (st === 'oompah' && beat === 2 && bar / div >= 4) bass[s] = { n: fifth, d: div }; else stab[s] = { n: tones, d: div * 0.6 }; }
      if (chordStart && !q) bass[s] = { n: r, d: div };
    } else if (st === 'eighths') {
      if (sb % Math.max(1, div / 2) === 0) bass[s] = { n: r, d: Math.max(1, div / 2) * 0.9 };
      if (chordStart) stab[s] = { n: tones, d: div * 1.5 };
    } else if (st === 'disco') {
      if (sb % Math.max(1, div / 2) === 0) bass[s] = { n: (sb / Math.max(1, div / 2)) % 2 ? r + 12 : r, d: Math.max(1, div / 2) * 0.8 };
      if (q && beat % 2 === 1) stab[s] = { n: tones, d: div * 0.5 };
    } else if (st === 'walk') {
      if (q) bass[s] = { n: [r, third, fifth, r + 9][beat % 4], d: div };
      if (q && beat % 2 === 1) stab[s] = { n: tones, d: div * 0.5 };
    } else if (st === 'arp') {
      if (chordStart) bass[s] = { n: r, d: half };
      const k = sb % Math.max(1, div / 2) === 0 ? (sb / Math.max(1, div / 2)) : -1;
      if (k >= 0) { const arp = [tones[0], tones[1], tones[2], tones[0] + 12]; stab[s] = { n: [arp[k % 4] + 12], d: Math.max(1, div / 2) * 0.8, arp: 1 }; }
    } else if (st === 'drone') {
      if (sb === 0) bass[s] = { n: 45 + ((c.root + 3) % 12 === 3 ? 0 : 0), d: bar, drone: 1 };
      if (chordStart) stab[s] = { n: tones, d: half * 0.9, soft: 1 };
    } else if (st === 'reggae') {
      if (sb === 0 || sb === Math.round(bar * 0.6)) bass[s] = { n: r, d: div * 1.4 };
      if (q && beat % 2 === 1) stab[s] = { n: tones, d: div * 0.35 };
    } else if (st === 'habanera') {
      const pat = [0, 3, 4, 6].map((x) => Math.round(x * div / 4));
      if (pat.includes(sb % (div * 2))) bass[s] = { n: sb % (div * 2) === pat[2] ? fifth : r, d: div / 2 };
      if (chordStart) stab[s] = { n: tones, d: half * 0.8, soft: 1 };
    } else if (st === 'organ') {
      if (chordStart) { bass[s] = { n: r - 12, d: half, organ: 1 }; stab[s] = { n: tones, d: half * 0.95, soft: 1, organ: 1 }; }
    } else if (st === 'techno') {
      if (sb % div === div / 2) bass[s] = { n: r, d: div / 2 };
      if (chordStart) stab[s] = { n: tones, d: half * 0.5, soft: 1 };
    }
  }
  return { bpm: song.bpm, div, len, lead, bass, stab, drums: song.drums || 'k.h.s.h.', leadType: song.lead || 'square' };
}
