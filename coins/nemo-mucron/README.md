# Nemo Mucron · $NEMO

Meme site for Nemo, the first dog of France, drawn next to Mucron in the Mucron style. One static page, no build.

## Before launch
1. In `index.html`, fill `window.NEMO`: `CA` (pump.fun) and `X` (handle without @).
2. After the first deploy, make `og:image` / `twitter:image` absolute (`https://<domain>/img/og.jpg`) so X shows the preview.

## Art
- `img/mucron-1000.png`: the original Mucron art, upscaled 8× with Real-ESRGAN (anime model, `tools/upscale` on the tools branch).
- `img/nemo-pose.png`: Nemo built from Mucron's own silhouette (same pose one to one), see `make-nemo.py`; `img/nemo-mucron-square.png` is the two together (profile picture, pump.fun image).
- `img/nemo-sticker.png`: Nemo's head, for the rain and the logo.

## On the page
- Click Nemo in the picture: he bounces and says something (wouf, en même temps, …).
- Ask Nemo: answers in character from a fixed list (no AI, no server).
- Pluie de Nemo: stickers fall, roll and pile up.

Parody, not affiliated with Emmanuel Macron, the Élysée or the French Republic (the footer says so).
