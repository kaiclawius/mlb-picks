# Motion-Starter (Remotion)

Kopieren, `npm install`, `npm run studio`. Marke in `src/brand.ts`, Bewegungs-System in `src/motion/tokens.ts`, Bausteine in `src/motion/primitives.tsx`. Beispiele: `src/compositions/ProductLaunch.tsx` (Launch-Film 16:9/9:16/1:1) und `SocialStat.tsx` (Hochformat-Clip).

Bausteine: `Reveal`, `Stagger`, `KineticText`, `Counter`, `Underline`, `Pop`, `Scene` (Ausgang vor Eingang), `DriftBackground`, `Camera` (Fenster + Inhalt, Zoom/Schwenk), `BrowserFrame`, `ScreenShot` (echter Screenshot mit Kamera und Cursor in Bild-Pixeln), `Cursor`, `Captions` (TikTok-Untertitel aus Wort-Zeiten), `VoiceBars` (Balken nach der Lautstärke einer Audiodatei).

```sh
npm run studio                                    # Vorschau mit Zeitleiste
npx remotion render launch-landscape out/launch-landscape.mp4
node ../../scripts/frames.mjs --remotion . launch-portrait --every 15   # Kontaktbogen ohne vollen Render
node ../../scripts/captions.mjs public/voice.wav --out src/captions.json --lang de --script "…"   # Wort-Zeiten
node ../../scripts/loudnorm.mjs out/clip.mp4 out/clip-final.mp4 --target -14                     # Lautheit
```
