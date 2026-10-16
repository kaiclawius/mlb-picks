# MISSION S · $MISSION

A parody memecoin site: the Mission S vs. the flying Roadster as a looksmaxxing face-off. Both cars were unveiled on October 15, 2026.

The page is built with the motion skill's web kit (`kit/` is a copy of `.claude/skills/motion/assets/web-motion-kit`):
- loader with a "facial analysis" count
- line-art cars that draw themselves, with analysis overlays (canthal tilt, jaw, FWHR)
- a scroll-highlighted thesis
- the face-off with counters, metric bars and a MOGGED stamp
- the pinned "ascension protocol" with an ASCENDED stamp on the last step
- the final PSL score, a marquee, and the mog-card generator (canvas → PNG, copy, post on X)
- buy steps and a curtain footer with the disclaimer

Smooth scroll runs on desktop only. Reduced motion and no-JS both get a complete, still page.

All drawings and the MOG crest are our own. There are no Porsche or Tesla logos or press photos. The disclaimer in the footer says it is parody and not affiliated with either company.

## After the launch

1. Put the contract address in `index.html`: `const CA = "…";` (search for `$MISSION contract address`).
2. Set `og:image` to the full URL, for example `https://your-domain/img/og.jpg`. Some platforms only read absolute URLs.
3. Deploy with Vercel: New Project → this repo → Root Directory `coins/mission-s` → Framework "Other". It is a static site; no environment variables are needed.

## Local preview

```sh
cd coins/mission-s && npx http-server -p 4830 .
```
Then open <http://127.0.0.1:4830/>.
