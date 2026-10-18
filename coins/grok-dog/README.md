# Grok Dog · $GROKDOG

Meme site for Grok Dog: a golden retriever in a homemade black-ball costume with two white tape stripes.
One static page (`index.html`), no build, no server. Hosts on Vercel, Netlify or any static host.

## Before launch
1. In `index.html`, fill `window.GROK`: `CA` (from pump.fun) and `X` (handle without @). The buy, chart and copy buttons follow it.
2. After the first deploy, make the preview image absolute for X: replace `img/og.jpg` in the `og:image` and `twitter:image` tags with `https://<your-domain>/img/og.jpg`, then deploy again.

## What's on the page
- The costume eyes on the photo are alive: they follow the cursor and blink. Clicking the photo makes him bork.
- **Ask Grok Dog**: a question box. He answers in character, from a fixed list of lines (no AI, no server).
- **Roll more Grok Dogs**: stickers of him fall, roll and pile up at the bottom of the screen (make it rain, shake, send them home).
- Sound is off until someone turns it on (a small synth: boops and a bark).
- Fonts: Bagel Fat One, Permanent Marker, Courier Prime (Google Fonts).

## Notes
- Not affiliated with xAI, X or Grok; the footer says so. Do not add the Grok or xAI logo.
- The photo comes from the internet. If the owner shows up, credit them in the footer (and ask if the dog wants to be in the community).
