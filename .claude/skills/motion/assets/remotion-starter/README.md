# Motion-Starter (Remotion)

Kopieren, `npm install`, `npm run studio`. Marke in `src/brand.ts`, Bewegungs-System in `src/motion/tokens.ts`, Bausteine in `src/motion/primitives.tsx`. Beispiele: `src/compositions/ProductLaunch.tsx` (Launch-Film 16:9/9:16/1:1) und `SocialStat.tsx` (Hochformat-Clip).

Bausteine: `Reveal`, `Stagger`, `KineticText`, `Counter`, `Underline`, `Pop`, `Scene` (Ausgang vor Eingang), `DriftBackground`, `Camera` (Fenster + Inhalt, Zoom/Schwenk), `BrowserFrame`, `ScreenShot` (echter Screenshot mit Kamera und Cursor in Bild-Pixeln), `Cursor`, `Captions` (TikTok-Untertitel aus Wort-Zeiten), `VoiceBars` (Balken nach der Lautstärke einer Audiodatei), `Grade` (Filmkorn, Vignette, Lichtschimmer als letzte Ebene).

```sh
npm run studio                                    # Vorschau mit Zeitleiste
npx remotion render launch-landscape out/launch-landscape.mp4
node ../../scripts/frames.mjs --remotion . launch-portrait --every 15   # Kontaktbogen ohne vollen Render
node ../../scripts/captions.mjs public/voice.wav --out src/captions.json --lang de --script "…"   # Wort-Zeiten
node ../../scripts/sfx.mjs --cues cues.json --length 20 public/sfx.wav                          # Soundeffekte aus Cue-Liste
node ../../scripts/beats.mjs public/music.mp3 --fps 30                                           # Beat-Raster der Musik
node ../../scripts/loudnorm.mjs out/clip.mp4 out/clip-final.mp4 --target -14                     # Lautheit + True Peak
node ../../scripts/qa-video.mjs out/clip-final.mp4                                               # Abnahme-Check
```
