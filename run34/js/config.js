// Öffentliche Standardwerte. Alles Persönliche (Namen, Sprüche, Geschenk, Fotos)
// kommt aus private/config.json und wird verschlüsselt in assets/bundle.enc ausgeliefert.
export const DEFAULT_CONFIG = {
  title: 'Birthday Run',
  name: 'Geburtstagskind',
  age: 34,
  birthdayTarget: 34,
  menuSubtitle: 'Lauf, Geburtstagskind, lauf!',
  // Sprüche beim Verlieren (allgemein)
  loseLines: [
    'Das hab ich mir so nicht vorgestellt!',
    'Ab 34 lässt die Reaktion halt nach…',
    'Die Katze hätte das geschafft.',
    'Knapp daneben ist auch vorbei.',
  ],
  // Sprüche je nach Hindernis
  obstacleLines: {
    candles: ['Von Geburtstagskerzen besiegt. Peinlich.', 'Zu viele Kerzen, zu wenig Sprungkraft.'],
    shirt: ['Ausgerechnet ein grünes T-Shirt…', 'Grün. Warum immer grün?!'],
    flyshirt: ['Angriff des fliegenden grünen T-Shirts!', 'Ducken wäre eine Option gewesen.'],
    height: ['1,65 m sind halt nicht groß genug.', 'Mindestgröße: nicht erreicht.'],
    alarm: ['Der Wecker gewinnt. Wie jeden Morgen.'],
    tax: ['Die Steuererklärung holt dich immer ein.'],
    ghost: ['Buh!'],
    stink: ['Puh! Es stinkt!', 'Der Gestank war stärker.'],
    rille: ['RILLE. Mehr muss man nicht sagen.', 'Ausgerechnet dieses Wort…'],
    fish: ['Fischgeruch. Game over.', 'Erledigt von einem toten Fisch.'],
    merz: ['Von Friedrich Merz gestoppt.', 'Das Wahlplakat hat gewonnen.'],
    chair: ['Vom Bürostuhl überrollt.', 'Montagmorgen-Gefühl.'],
    boss: ['Der Chef will dich kurz sprechen.', 'Deadline verpasst!'],
    folders: ['Unter Akten begraben.'],
    paper: ['Papierflieger-Volltreffer!'],
    tomato: ['Ketchup-Unfall!', 'Die Tomaten waren schneller.'],
    grill: ['Angegrillt!', 'Würstchen 1 – Kimi 0.'],
    gnome: ['Vom Gartenzwerg gestoppt. Respekt.'],
    watering: ['Gießkannen-Stolperfalle!'],
    wasp: ['Bsss… autsch!'],
    speaker: ['Zu laut, zu nah.'],
    crate: ['Über den Bierkasten gestolpert. Klassiker.'],
    hourglass: ['Die Zeit ist abgelaufen!'],
    discoball: ['Von der Discokugel geblendet.'],
    banana: ['Auf der Bananenschale ausgerutscht!'],
    fence: ['Fast im Affengehege gelandet.'],
    sign: ['Dem Wegweiser gefolgt. Direkt rein.'],
    parrot: ['Der Papagei lacht dich aus.'],
    fruitcrate: ['Obstkisten-Crash!'],
    flowers: ['Blumen für dich – mitten ins Gesicht.'],
    basket: ['Über den Einkaufskorb gestolpert.'],
    cheese: ['Vom Käserad überrollt!'],
    pigeon: ['Tauben-Attacke!'],
    mop: ['Der Wischsauger hat gewonnen.', 'Piep piep – erwischt!'],
    pot: ['Heiß, heiß, heiß!'],
    flour: ['Mehlstaub-Explosion!'],
    pancake: ['Pfannkuchen im Gesicht.'],
    fig: ['Von einer Feige erwischt. Allergie-Schock!'],
    shrimp: ['Garnelen-Attacke! Notarzt!'],
  },
  titleLines: ['Autsch!', 'Neeein!', 'Oh nein!', 'Uff!', 'Mist!'],
  mercyLines: [
    'Okay, okay… ab jetzt hilft dir die Katze! 🐱 (alles etwas langsamer)',
    'Na gut: Du bekommst zusätzlich 2 Extra-Leben. ❤️❤️',
    'Schummel-Modus aktiviert: Du startest bei 80 Punkten. Psst! 🤫',
  ],
  catName: 'Fips',
  catLines: ['Miau!', 'Fips regelt!', 'Weg da!', 'Mrrrau!'],
  cameos: [
    // { face: 'mama', line: 'Lauf, Kimi!' } — kommt aus der privaten Config
    { face: 'cameo1', line: 'Lauf!!', hair: '#6b4a2b' },
    { face: 'cameo2', line: 'Du schaffst das!', hair: '#3a3a3a', beard: true },
    { face: 'oma', line: 'Kind, iss was!', hair: '#cfcfcf', oma: true, throws: true },
  ],
  items: {
    wine: { label: 'Wein', points: 5 },
    pizza: { label: 'Pizza', points: 5 },
    burger: { label: 'Burger', points: 5 },
    nachos: { label: 'Nachos', points: 5 },
    fig: { label: 'Feige', points: -10, bad: true, line: 'Igitt, eine Feige!' },
    shrimp: { label: 'Garnele', points: -10, bad: true, line: 'Garnele?! Allergie!' },
    egg: { label: 'Eierkopf', points: 15 },
    monkey: { label: 'Affe', points: 10 },
    poffertjes: { label: 'Poffertjes', points: 5 },
    fries: { label: 'Pommes', points: 5 },
    waffle: { label: 'Waffel', points: 5 },
    stroop: { label: 'Stroopwafel', points: 5 },
    treat: { label: 'Leckerli', points: 3 },
  },
  allergyLines: ['ALLERGIE-ALARM!', 'Igitt, eine Feige!', 'Garnele?! Bloß nicht!'],
  hammerLines: ['ABRISS!', 'Bauleiterin am Werk!', 'Weg mit den Fliesen!'],
  memories: [
    // { img: 'memory1', caption: 'Urlaub 2019' }
  ],
  finale: {
    headline: 'HAPPY BIRTHDAY!',
    giftPrompt: 'Moment… da ist noch was! 🎁',
  },
  gift: {
    title: 'Überraschung!',
    date: '',
    stops: ['Zuhause', 'Ziel'],
    text: 'Hier steht später dein Geschenk.',
  },
  horror: {
    intro: 'Willkommen im Horror-Modus. Dresscode: grünes T-Shirt.',
  },
};

export const OUTFIT_PARTS = {
  top: {
    label: 'Oberteil', icon: '👕',
    options: {
      matrose: { label: 'Matrose' },
      ripp: { label: 'Ripp-Shirt' },
      tank: { label: 'Enges Top' },
      princess: { label: 'Prinzessin', unlock: 'birthday' },
      blazer: { label: 'Blazer', unlock: 'world:office' },
      glitter: { label: 'Glitzer-Top', unlock: 'world:party' },
      green: { label: 'Grünes T-Shirt', refuse: true },
      pyjama: { label: 'Schlafanzug-Shirt', shop: 80 },
      vans: { label: 'Vans Checkerboard-Shirt', shop: 90 },
      carhartt: { label: 'Carhartt Detroit-Jacke', shop: 160 },
    },
  },
  topColor: {
    label: 'Farbe', icon: '🎨',
    options: {
      a: { label: 'Navy', color: '#2c3157' },
      b: { label: 'Senf', color: '#d79a2b' },
      c: { label: 'Rost', color: '#b54f2c' },
      d: { label: 'Schwarz', color: '#222228' },
      e: { label: 'Weiß', color: '#f1eee6' },
      f: { label: 'Rosa', color: '#f28fb8' },
    },
  },
  bottom: {
    label: 'Hose', icon: '👖',
    options: {
      jeans: { label: 'Jeans' },
      culotte: { label: 'Culotte' },
      latz: { label: 'Latzhose' },
      matrose: { label: 'Matrosenhose' },
      tutu: { label: 'Tüll-Rock', unlock: 'birthday' },
      pyshorts: { label: 'Schlafanzug-Shorts', shop: 60 },
      doubleknee: { label: 'Carhartt Double Knee', shop: 120 },
    },
  },
  socks: {
    label: 'Socken', icon: '🧦',
    options: {
      ringel: { label: 'Ringelsocken' },
      plain: { label: 'Weiß' },
      none: { label: 'Keine' },
    },
  },
  shoes: {
    label: 'Schuhe', icon: '👟',
    options: {
      sneaker: { label: 'Sneaker' },
      docs: { label: 'Docs' },
      sailor: { label: 'Halbschuhe' },
      checker: { label: 'Vans Slip-On kariert', shop: 110 },
      oldskool: { label: 'Vans Old Skool', shop: 100 },
      cowboy: { label: 'Cowboy-Boots', shop: 140 },
    },
  },
  extra: {
    label: 'Extras', icon: '🎩',
    multi: true,
    options: {
      scarf: { label: 'Schal' },
      crown: { label: 'Krone', unlock: 'birthday' },
      shades: { label: 'Sonnenbrille' },
      party: { label: 'Partybrille' },
      sash: { label: 'Schärpe', unlock: 'birthday' },
      apron: { label: 'Gartenschürze', unlock: 'world:garden' },
      safari: { label: 'Safari-Hut', unlock: 'world:zoo' },
      tote: { label: 'Jutebeutel', unlock: 'world:market' },
      chef: { label: 'Kochmütze', unlock: 'world:kitchen' },
      beanie: { label: 'Carhartt Beanie', shop: 50 },
      cowboyhat: { label: 'Cowboyhut', shop: 70 },
    },
  },
};

export const PRESETS = {
  matrose: { top: 'matrose', topColor: 'a', bottom: 'matrose', socks: 'none', shoes: 'sailor', extra: [] },
  casual: { top: 'ripp', topColor: 'b', bottom: 'jeans', socks: 'ringel', shoes: 'docs', extra: ['scarf'] },
  princess: { top: 'princess', topColor: 'f', bottom: 'tutu', socks: 'plain', shoes: 'sneaker', extra: ['crown', 'sash'] },
  vans: { top: 'vans', topColor: 'd', bottom: 'jeans', socks: 'plain', shoes: 'checker', extra: [] },
  carhartt: { top: 'carhartt', topColor: 'c', bottom: 'doubleknee', socks: 'none', shoes: 'docs', extra: ['beanie'] },
  pyjama: { top: 'pyjama', topColor: 'a', bottom: 'pyshorts', socks: 'plain', shoes: 'checker', extra: [] },
  cowgirl: { top: 'ripp', topColor: 'e', bottom: 'jeans', socks: 'none', shoes: 'cowboy', extra: ['cowboyhat'] },
};

// Komplett-Looks im Kleiderschrank/Shop (Bundle-Preis = Rabatt auf fehlende Teile)
export const LOOKS = {
  matrose: { label: 'Klassiker', icon: '⚓' },
  casual: { label: 'Casual', icon: '👖' },
  princess: { label: 'Birthday Princess', icon: '👑', unlock: 'birthday' },
  vans: { label: 'Vans-Skater', icon: '🛹', discount: 0.8 },
  carhartt: { label: 'Carhartt-Workwear', icon: '🧱', discount: 0.8 },
  pyjama: { label: 'Kurzer Schlafanzug', icon: '😴', discount: 0.8 },
  cowgirl: { label: 'Cowgirl', icon: '🤠', discount: 0.8 },
};

// Booster für den nächsten Lauf
export const BOOSTS = {
  heart: { label: 'Extra-Herz', icon: '❤️', price: 40, text: 'Startet mit einem Herz mehr' },
  fips: { label: 'Fips-Start', icon: '🐱', price: 30, text: 'Fips räumt die ersten Sekunden ab' },
  double: { label: 'Doppel-Taler', icon: '✖️2', price: 50, text: 'Doppelte Taler im nächsten Lauf' },
};

// Titel nach Anzahl der Fehlversuche ("Das hab ich mir so nicht vorgestellt!"-Zähler)
export const FAIL_TITLES = [
  [0, 'Frischling'], [5, 'Anfängerin'], [10, 'Stolperkönigin'], [25, 'Profi-Pechvogel'],
  [50, 'Bish of Pain'], [100, 'Legende des Scheiterns'], [200, 'Unkaputtbar'],
];

// Erfolge: id -> [Titel, Beschreibung, Emoji]
export const ACHIEVEMENTS = {
  birthday: ['Geburtstagskind', 'Den Geburtstags-Modus geschafft', '🎂'],
  allergy: ['Allergikerin', '45 Sekunden ohne Feige oder Garnele', '🦐'],
  monkeys: ['Affenliebe', '10 Affen gesammelt', '🐒'],
  worlds: ['Weltenbummlerin', 'Alle 7 Welten in einem Lauf', '🌍'],
  payback: ['Payback-Profi', '3× vor Hagen geflüchtet', '💳'],
  mop: ['Wischsauger-Bezwingerin', '10 Wischsaugern ausgewichen', '🧹'],
  hearts: ['Volles Herz', 'Mit 3 Herzen gleichzeitig unterwegs', '❤️'],
  score500: ['Marathon-Bish', '500 Punkte im Endlos-Modus', '🏃‍♀️'],
  egghead: ['Eierkopf', 'Den geheimen Eierkopf-Modus gefunden', '🥚'],
  green: ['Grün ist das neue Schwarz', 'Das grüne T-Shirt angezogen', '👕'],
  nightowl: ['Nachteule', 'Nach 23 Uhr gespielt', '🦉'],
  shake: ['Erdbeben', 'Fips per Schütteln gerufen', '📳'],
  fipsbox: ['Katzen-Klappe', 'Fips’ Geheimgang gefunden', '📦'],
  challenge: ['Challenge accepted', 'Eine Tages-Challenge geschafft', '🎯'],
  stumble: ['Stolperkönigin', '10× gescheitert', '🤕'],
  roadtrip: ['Auf Achse', 'Den Roadtrip-Modus gespielt', '🚗'],
  hero: ['Gerettet!', 'Der Superheld ist erschienen', '🦸'],
  soup: ['Graupensuppe!', 'Omas Suppe von der Rollator-Rakete gegessen', '🍲'],
  horrorlv: ['Freitag der 13.', 'Level 13 überlebt', '👻'],
  levels: ['Lebenswerk', 'Alle 38 Level geschafft', '🗺️'],
  allstars: ['Sternenhimmel', 'Alle Level mit 3 Sternen', '🌟'],
  secret: ['Psst…', 'Das geheime Level gefunden', '🌿'],
  god: ['Cheaterin!', 'Den Godmode entdeckt', '⚡'],
};

// Tages-Challenges (je Tag eine, abhängig vom Datum)
export const CHALLENGES = [
  { id: 'pizza5', text: 'Sammle 5× Pizza in einer Runde', item: 'pizza', n: 5 },
  { id: 'wine3', text: 'Sammle 3× Wein in einer Runde', item: 'wine', n: 3 },
  { id: 'hearts2', text: 'Sammle 2 Herzen in einer Runde', item: 'heart', n: 2 },
  { id: 'score150', text: 'Schaffe 150 Punkte im Endlos-Modus', score: 150, mode: 'endless' },
  { id: 'chairs5', text: 'Spring über 5 Bürostühle', pass: 'chair', n: 5 },
  { id: 'monkeys5', text: 'Sammle 5 Affen im Zoo', item: 'monkey', n: 5 },
  { id: 'mops3', text: 'Weiche 3 Wischsaugern aus', pass: 'mop', n: 3 },
  { id: 'nofig80', text: '80 Punkte ohne Feige oder Garnele', score: 80, noBad: true },
  { id: 'burger3', text: 'Sammle 3 Burger in einer Runde', item: 'burger', n: 3 },
  { id: 'tomato4', text: 'Spring über 4 Tomatenpflanzen', pass: 'tomato', n: 4 },
];
