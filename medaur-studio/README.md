# Medaur Studio: agency site, studio version

A second direction for Medaur, next to `../medaur/` (the Japanese ink version). Static page with no build step. Deploy the folder as is.

**Idea:** the name is the monument. A giant MEDAUR whose letters stretch toward the cursor (Archivo's variable width axis). Then **the machine**: a slot machine with three reels (business × problem × style) that pulls out what we would build. The style reel restyles the result card. "Ask about this combo" opens a mail with the combination filled in.

## Before going live
- `window.MEDAUR` in `index.html`: `EMAIL` (placeholder `hallo@medaur.de`), `IMPRESSUM` and `PRIVACY`. The legal pages are required in Germany and are not written yet.
- The work list shows our own studio projects. Swap any you don't want next to the agency.
- Machine results are suggestions from a fixed set of solutions (6 problems × 8 trades × 4 styles), labelled as such on the page.
- `og:image` is relative. Make it absolute once the domain is known.

## Motion
Loader (once per session), the cursor-reactive wordmark (a slow wave on touch, still with reduced motion), a spinning badge, marquees, highlight manifesto, giant service rows that widen on hover, the slot reels, a cursor-follow preview on the work list, a horizontal pinned process track (desktop only; phones get a list), and a magnetic mail button.

Fonts: Archivo and JetBrains Mono (SIL OFL). Motion kit: GSAP (Standard licence), Lenis (MIT).
