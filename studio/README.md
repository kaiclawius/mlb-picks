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
