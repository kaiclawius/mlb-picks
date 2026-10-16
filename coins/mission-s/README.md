# MISSION S · $MISSION

A parody memecoin site: white vs. black. The Mission S stands in a white studio and the flying Roadster in a black one; both were unveiled on October 15, 2026. The page turns that into a looksmaxxing face-off, monochrome only.

Built with the motion skill's web kit (`kit/` is a copy of `.claude/skills/motion/assets/web-motion-kit`):
- **Loader** with a "facial analysis" count.
- **Split hero:** white studio and black studio side by side; the name runs across both in difference blend; image reveals with a zoom settle; a VS stamp.
- **Thesis** that is highlighted word by word while you scroll.
- **Face-off:** analysis lines placed on the photos (brow ridge, symmetry, eyes, jaw, frame), counters, metric bars, a MOGGED stamp.
- **Pinned "ascension protocol":** each step adds its annotation to the Mission S photo, and the last step stamps ASCENDED.
- **Split final score** and a marquee.
- **Mog-card generator** (canvas with the Mission S photo, PNG download, copy, post on X).
- **Buy steps** and a curtain footer with the disclaimer.

**Images:** the user's front views of both cars, upscaled ×4 with Real-ESRGAN x4plus. The small badge on the Mission S hood was retouched out. `img/*-1600.webp` / `*-900.webp` are used, and `*.jpg` are kept as fallbacks. The photos belong to their owners. The disclaimer says so and states that the site is parody, not affiliated, and not financial advice. The MOG crest is our own.

## Live

- **Site:** <https://mission-s.vercel.app/> (Vercel, Root Directory `coins/mission-s`, Framework "Other", no build step).
- **Contract address:** `kCrcJw9oumg1M4wEgyWQRyJX3uZD6PMh25YkHd1pump`. It is set in `index.html` in `const CA` and in the `#ca` box, together with the pump.fun and DexScreener links.
- `og:url`, `og:image` and `twitter:image` use absolute URLs on that domain. Change them together if the domain changes.

## Local preview

```sh
cd coins/mission-s && npx http-server -p 4830 .
```
Then open <http://127.0.0.1:4830/>.
