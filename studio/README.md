# Studio · Produktvideos als Code

Ruhige, saubere Produktvideos im Stil großer Tech-Launches: große Typografie, viel Weißraum, weiche Überblendungen und eine echte Bildschirmaufnahme des Produkts mit langsamer Kamerafahrt. Gebaut mit [Remotion](https://www.remotion.dev) (React → MP4).

**Ein Produkt = eine Datei.** Payroll.exe ist das erste Beispiel. Für jedes andere Geschäft kopierst du `products/payroll.ts` und schreibst Marke und Szenen neu.

Jedes Produkt bekommt automatisch:

| Datei | Format | Wofür |
|---|---|---|
| `out/<id>/<id>-landscape.mp4` | 1920×1080 | Website, YouTube, X |
| `out/<id>/<id>-portrait.mp4` | 1080×1920 | TikTok, Reels, Shorts |
| `out/<id>/<id>-square.mp4` | 1080×1080 | Feeds, LinkedIn |
| `out/<id>/og.png` | 1200×630 | Link-Vorschau |
| `out/<id>/web/*` | wie oben, kleiner | zum Einbinden auf der eigenen Seite, plus `poster.jpg` |

## Schnellstart

```sh
cd studio
npm install
npm run capture -- payroll      # nimmt die echte Seite im Browser auf -> public/payroll/*.mp4
npm run studio                  # Vorschau im Browser, Szenen live bearbeiten
npm run render -- payroll       # alle Formate + og.png nach out/payroll/
npm run render -- payroll portrait   # nur ein Format
npm run render -- payroll web        # leichte Web-Kopien + poster.jpg nach out/payroll/web/
```

In einem Container ohne eigenes Chrome (z. B. Claude Code in der Cloud) vorher:

```sh
export REMOTION_BROWSER=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
```

## Ein neues Produkt in 4 Schritten

1. **Aufnahme festlegen:** `products/<id>.capture.mjs`. Hier stehen die Adresse der Seite (`url`) oder ein lokaler Ordner (`serve`) und die Clips. Jeder Clip ist eine Liste von Schritten:
   `goto`, `wait` (ms), `click`, `type: [selector, text]`, `scroll: selector | y`, `waitFor: "<js-ausdruck>"`, `hover`, `css` und `mark: "start"`. Mit `mark: "start"` beginnt der Clip erst an dieser Stelle, das Laden der Seite ist dann nicht zu sehen.
2. **Fonts holen** (einmalig, damit das Rendern ohne Netz läuft):
   `node capture/fonts.mjs <id> "Inter:wght@400;600;800&family=JetBrains+Mono"`
3. **Musik** (optional): `sh capture/music.sh public/<id>/music.m4a 60` erzeugt einen leisen, lizenzfreien Klangteppich. Für einen echten Launch ersetzt du ihn durch einen lizenzierten Track mit demselben Dateinamen.
4. **Video schreiben:** `products/<id>.ts`, danach in `products/index.ts` eintragen.

```ts
export const meinProdukt: Product = {
  id: "mein-produkt",
  brand: {
    wordmark: ["MEIN", "PRODUKT"],                 // zweiter Teil in Akzentfarbe
    colors: { bg, surface, ink, muted, accent, line },
    fonts: { display: "'Inter'", body: "'Inter'", mono: "'JetBrains Mono'" },
    fontCss: "mein-produkt/fonts/fonts.css",
  },
  music: { file: "mein-produkt/music.m4a", volume: 0.35 },
  scenes: [
    { type: "title", seconds: 4, kicker: "Neu", title: "Ein Satz, der *alles* sagt." },
    { type: "statement", seconds: 4.5, lines: ["Das Problem.", "Die *Lösung*."] },
    { type: "screen", seconds: 5, clip: "mein-produkt/flow.mp4", from: 2, url: "meinprodukt.de",
      title: "Was man gerade sieht.", camera: [{ t: 0, x: 0.5, y: 0.4, zoom: 1.4 }, { t: 5, x: 0.6, y: 0.5, zoom: 1.6 }] },
    { type: "steps", seconds: 6, title: "So funktioniert’s", steps: [{ title, body }, …] },
    { type: "features", seconds: 6, title: "Warum", items: [{ title, body }, …] },
    { type: "cta", seconds: 5, title: "Jetzt *ausprobieren*.", url: "meinprodukt.de", footnote: "Kleingedrucktes" },
  ],
};
```

### Die Szenen

- **title:** Kicker, großer Titel, Untertitel, mit langsamem Push-in.
- **statement:** 1 bis 3 große Sätze nacheinander, für Problem, Wendung und Versprechen.
- **screen:** Die echte Aufnahme in einem schwebenden Browserfenster mit Bildunterschrift.
  - `from`: Sekunde im Clip, ab der die Szene startet.
  - `camera`: Keyframes. `x`/`y` (0 bis 1) ist der Punkt im Clip, auf den die Kamera zentriert, `zoom` 1 heißt, das Fenster ist gefüllt.
  - `cameraPortrait`: eigener Kamerapfad für 9:16.
- **steps:** ein Ablauf in 3 bis 5 Schritten.
- **features:** 2 bis 3 Gründe als Karten.
- **cta:** Wortmarke, Aufforderung, URL und Kleingedrucktes.

Text in `*Sternchen*` erscheint in der Akzentfarbe.

### Timing finden

Schritte zum richtigen Zeitpunkt finden:

```sh
ffmpeg -i public/<id>/<clip>.mp4 -vf "fps=1,scale=480:-1,tile=4x6" -frames:v 1 sheet.png
```

Das ergibt ein Kontaktbild mit einem Bild pro Sekunde. Dann liest du die Sekunden ab und trägst sie als `from` und Kamera-`t` ein. Für einen schnellen Blick auf einzelne Frames:

```sh
npx remotion still <id>-landscape out/x.png --frame=300
```

## Loom oder Remotion?

- **Loom** passt für schnelle, persönliche Walkthroughs mit Gesicht und Stimme, zum Beispiel für Investoren oder Support.
- **Dieses Studio** passt für das offizielle Launch-Video. Es ist jedes Mal identisch reproduzierbar, in 3 Formaten und im eigenen Design. Wenn sich das Produkt ändert, reicht `npm run capture` und `npm run render`.

Eine Loom- oder andere Aufnahme (MP4) kannst du auch einfach nach `public/<id>/` legen und als `clip` in einer `screen`-Szene verwenden.

## Kinetischer Film (Erklärfilm im Takt)

Ein zweiter Stil neben dem ruhigen Launch-Video. Jeder Screen zeigt einen kurzen Satz, der Wort für Wort entsteht. Das Timing folgt dem Beat, es gibt eine Akzentfarbe, und echte Bilder vom Produkt dienen als Beweis. Der Stil funktioniert auf X auch ohne Ton. Gelernt ist er von Launch-Filmen wie dem von TasteSkill v2; übernommen wurden nur Aufbau, Timing und Übergänge.

**Warum der Film flüssig wirkt:**
- **60 fps und keine harten Schnitte.** Szenen überlappen sich: Die alte wird unscharf, verblasst und gleitet nach oben weg, während sich die neue aufbaut.
- **Wechsel der Tonfarbe** (hell, dunkel, Akzent) kommt als runder Wipe.
- **Ein Satz zentriert sich weich neu**, wenn ein Wort dazukommt, weil der Platz jedes Worts von null aufgeht (gemessen mit der echten Schrift).
- **Chips wachsen** mit ihrem getippten Text, **Zahlen rollen** wie ein Tacho, **Punkte verwandeln sich** von einem Raster in eine Reihe.
- **Keine Bildschirmaufnahmen als Video**, denn die laufen nur mit etwa 25 fps und ruckeln neben 60-fps-Typo. Stattdessen nutzt der Film scharfe 2×-Standbilder, über die eine durchgehende Kamera fährt (`story`).

```sh
node capture/stills-payroll.mjs     # 2x-Standbilder der Seite (Seite auf Port 4840 starten)
node capture/beat.mjs /tmp/beat.wav --bpm 120 --beats 76 --break 16 --rise 20 --drop 24 --hits 50 --end 66
# optional: Sound-Effekte per Cue-Liste (Motion-Skill: scripts/sfx.mjs --cues), mischen, auf -14 LUFS:
#   node ../.claude/skills/motion/scripts/loudnorm.mjs mix.m4a public/<id>/film-music.m4a
npm run render -- <id> film         # out/<id>/<id>-film-landscape|portrait|square.mp4
```

Im Produkt steht `film: { bpm, music, shots: [...] }`. Jede Szene dauert eine bestimmte Zahl von **Beats**. Wird das Tempo geändert, verschiebt sich der ganze Film mit.

**Markup im Text:**
- `*Wort*` erscheint in der Akzentfarbe.
- `[Label]` wird als UI-Chip dargestellt.
- `|` bedeutet: der Rest kommt auf dem nächsten Beat.

**Tonfarbe:** `tone: "light" | "dark" | "accent"`.

**Szenentypen:**
| Typ | Was er zeigt |
|---|---|
| `line` | ein Satz, Wort für Wort, der sich weich neu zentriert |
| `slam` | Vollbild in Farbe mit großen Worten pro Beat und laufendem Muster dahinter (gut für den Drop) |
| `type` | ein Befehl wird getippt, die Kamera fährt dabei vom Cursor zurück |
| `field` | ein Raster aus Punkten wird zu einer Reihe, die Beschriftung wechselt (`"9 agents. \| 9 wallets."`) |
| `story` | Standbilder im Browserfenster mit einer durchgehenden Kamerafahrt über `keys` (Bild, Fokus, Zoom, Untertitel, optional ein Stempel; `pfocus` für 9:16) |
| `score` | Zähler, die wie ein Tacho hochrollen |
| `mask` | ein riesiges Wort, gefüllt mit einem Bild |
| `montage` | ein Bild pro Beat, kurz überblendet |
| `end` | das Wordmark erscheint Buchstabe für Buchstabe, dazu Tagline, Chip, URL und Fußnote |

**Payroll-Beispiel** (`products/payroll.ts` → `film`): 76 Beats bei 120 BPM, also 38 s.
- **Bilder:** Der Arbeitsauftrag ist eine einzige Kamerafahrt über die fünf Schritte. Der APPROVED-Stempel landet auf Beat 50, zusammen mit dem Akzent in der Musik.
- **Abnahme:** `qa-video.mjs` meldet bei allen drei Formaten mit 60 fps keine Befunde, −14,5 LUFS.

## Walkthrough (Produktfilm im Stil der Claude-Launches)

Der dritte Stil, gelernt aus den Produktfilmen von Claude (Claude Design, Managed Agents, Claude Science). Übernommen ist nur die Machart, nicht die Marke. Echte UI-Panels schweben auf einer ruhigen, gemusterten Fläche, und eine einzige Kamera gleitet zwischen ihnen. Ein Cursor klickt, ein Prompt wird ins echte Eingabefeld getippt, eine Status-Pille schimmert, solange die Arbeit läuft, und eine Checkliste hakt sich ab. Kurze Serifentitel tragen das Argument zwischen den UI-Szenen. Länge 45–60 s, 60 fps, kaum Schnitte: Szenen blenden über, und innerhalb einer Szene ist alles eine durchgehende Bewegung.

**Warum es scharf und flüssig ist:** Die UI wird nicht als Video aufgenommen. Jedes Panel wird einzeln und pro Zustand als 3×-Standbild aufgenommen, zusammen mit **Marks**, also der Position jedes wichtigen Elements (`panels.json`). Kamera, Cursor und getippter Text landen dadurch exakt auf den echten Elementen. Der Text wird in der echten Schrift des Eingabefelds getippt.

```sh
node capture/walk-payroll.mjs        # Panels + Marks (Seite auf Port 4840 starten): public/payroll/walk/
node capture/beat.mjs /tmp/walk.wav --bpm 90 --beats 81 --drop 999 --end 74 --key 50   # ruhiges Bett ohne Drop
node ../.claude/skills/motion/scripts/loudnorm.mjs /tmp/walk.wav public/payroll/walk-music.m4a --target -16
npm run render -- <id> walk          # out/<id>/<id>-walk-landscape|portrait|square.mp4
```

Im Produkt steht `walk: { dir, panels, serif, serifCss, band, music, shots }` (Beispiel: `products/payroll.walk.ts`). Die Zeiten sind in **Sekunden innerhalb der Szene** angegeben. Die Fläche hat 1080p-Einheiten, wobei (0, 0) die Bildmitte ist.

| Szene | Was sie zeigt |
|---|---|
| `title` | Serifenzeile, Wort für Wort aus der Unschärfe. `*Wort*` erscheint kursiv in der Akzentfarbe. `then` ersetzt die Zeile ab Sekunde `at` (Problem → Lösung). |
| `ui` | `windows` (Panel, Position, Breite, `states` als [Sekunde, Zustand], `in` zum Einblenden, `p` als eigenes Layout für 9:16), `camera` (Keys auf Punkt, Fenster oder Mark; `zoom`, `pz` für 9:16/1:1, `px/py` als anderer Blickpunkt in 9:16), `cursor` (Ziel-Marks, `click`), `typing` (Text ins Mark, danach Zustand `then`), `pills` (Status mit Schimmer), `checklist` (Punkte haken sich zu ihrer Sekunde ab) |
| `end` | Wordmark Buchstabe für Buchstabe, Tagline in der Serifenschrift, URL, Fußnote |

**Ein neues Produkt:** Kopiere `capture/walk-payroll.mjs` und passe `PANELS` (CSS-Selektoren der Panels), `MARKS` (Elemente, auf die Kamera und Cursor zielen) und den Ablauf an. Wichtig ist ein Zustand `blank`, also ein leeres Eingabefeld ohne Placeholder, über das getippt wird.

**Payroll-Beispiel:** 53,5 s. Ablauf:
1. Problem in zwei Titeln.
2. „Introducing Payroll.exe“.
3. Das Büro: Mission tippen, Run klicken, die Runde läuft mit Pillen, die Kamera fährt über Printout und Wallets.
4. Wallet- und Signatur-Titel.
5. Arbeitsauftrag mit Checkliste und APPROVED-Stempel.
6. Kamerafahrt über die gelieferten Arbeiten.
7. „Less time … / More time …“.
8. Ende.
