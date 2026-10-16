# Web motion kit (assets/web-motion-kit)

Award-level website motion from HTML attributes. It needs no build step and works on any static site, Webflow-style page or framework template. The kit implements the techniques measured on award sites (`award-sites.md`) with our motion tokens.

Every module is progressive:
- **No JavaScript:** the content is complete and still.
- **Reduced motion:** no smooth scroll, no pinning, no movement. Counters show their final value and WebGL draws one still frame.
- **Weak device:** WebGL lowers its resolution, then falls back to the poster.

## Contents
1. Setup
2. Modules
3. WebGL layer
4. Rules that make it look expensive
5. Verify
6. Licences

## 1. Setup

Copy `assets/web-motion-kit/` next to the page (or just `motion.css`, `motion.js`, `vendor/`, and `webgl/dist/` if you need WebGL).

```html
<html lang="en" class="no-js" data-m-smooth data-m-cursor>
<head>
  <!-- before first paint: start states only when JS runs and motion is welcome; undone after 3 s if motion.js never arrives -->
  <script>(function(d){d.classList.remove("no-js");if(!matchMedia("(prefers-reduced-motion: reduce)").matches)d.classList.add("m-ready");
    setTimeout(function(){if(!(window.Motion&&window.Motion.ready))d.classList.remove("m-ready")},3000)})(document.documentElement);</script>
  <link rel="stylesheet" href="kit/motion.css">
  <script src="kit/vendor/gsap.min.js" defer></script>
  <script src="kit/vendor/ScrollTrigger.min.js" defer></script>
  <script src="kit/vendor/SplitText.min.js" defer></script>
  <script src="kit/vendor/lenis.min.js" defer></script>          <!-- only with data-m-smooth -->
  <script type="module" src="kit/motion.js"></script>
  <script type="module" src="kit/webgl/dist/motion-webgl.js"></script>  <!-- only with [data-gl] -->
</head>
```
- `data-m-smooth` turns on Lenis smooth scrolling (about 1.2 s of inertia, as on the award sites). It only runs on desktop pointers and never with reduced motion. Anchor links scroll smoothly too.
- `data-m-cursor` adds a follower dot that grows over links, buttons and `[data-cursor]`. It only appears on fine pointers, and the native cursor stays.
- `window.Motion` exposes `{ ready, reduced, lenis, refresh(), destroy() }`. Call `Motion.refresh()` after you change the layout from your own code.
- `motion:intro-done` fires on `document` when the loader has finished (or right away if there is none). Start your own hero code there.
- Weight (minified): GSAP + ScrollTrigger + SplitText ≈ 124 KB, plus Lenis 20 KB, plus `motion.js` (≈ 12 KB unminified). WebGL: the gradient ≈ 7 KB, the gallery ≈ 8 KB, the product 609 KB (three.js, loaded only when used).

## 2. Modules

Shared options: `data-m-delay` (s), `data-m-dur` (s), `data-m-start` (ScrollTrigger start, default `"top 85%"`). Entrances play **once**.

| `data-m=` | What it does | Options (defaults) | Use for |
|---|---|---|---|
| `reveal` | fade + rise 24 px, 0.9 s, ease-out quart | `m-y` (24) | any block |
| `reveal-children` | children one after another | `m-stagger` (0.08), `m-y` | cards, buttons, lists |
| `lines` / `words` / `chars` | split text, pieces rise out of a mask | `m-stagger` (0.08 / 0.04 / 0.025) | headings (lines/words), display words (chars) |
| `wordmark` | huge word, letter by letter from below (or `data-m-from="top"`) | `m-stagger` (0.045), `m-dur` (1.1) | hero names, section titles |
| `blur-in` | fade + 10 px blur → sharp (Linear style) | | kicker, hero subline (few lines only) |
| `type` | typed text with a caret | `m-speed` (0.035 s per char), `data-m-keep-caret` | terminals, boot screens, chat |
| `highlight` | words go from dim to full as the paragraph crosses the viewport (scrubbed) | `m-dim` (0.16), `m-start`/`m-end` | one statement per page |
| `image` | clip opens upward (or `data-m-from="left"`), image zooms 1.18 → 1 and settles | `m-scale`, `m-dur` (1.2) | photos, video, canvas |
| `parallax` | moves against the scroll by ±speed × 100 % | `m-speed` (0.15; keep ≤ 0.3) | decorative layers, images inside a mask |
| `pin` | section stays while `[data-m-step]` children take turns; `--m-progress` 0..1 for CSS; `[data-m-stage]` = what gets pinned | `m-step-length` (80 % of a viewport per step) | "how it works", product stories |
| (inside pin) `data-m-on-step="3"` | element appears when that step (0-based) is reached; reverses when scrolling back | with `data-m="stamp"` it pops | the payoff of a story |
| `counter` | counts to `data-m-to` when seen, tabular figures | `m-from`, `m-decimals`, `m-prefix`, `m-suffix`, `m-locale` | stats; put the final value in the HTML |
| `marquee` | endless row (CSS), duplicated track, pauses on hover | `--m-speed` (30 s), `--m-gap`, `data-m-reverse` | logos, keywords; needs `.m-track` |
| `stamp` | pops in big and rotated, settles (the one bouncy element) | `m-scale` (1.8), `m-rotate` (−14), `m-rotate-to` (−6) | "PAID", "NEW", badges |
| `draw` | SVG strokes draw themselves (once, or scrubbed with `data-m-scrub`) | `m-stagger`, `m-dur` | diagrams, signatures, line art |
| `magnetic` | element follows the pointer a little | `m-strength` (0.3) | primary buttons (one or two per page) |
| `scrub-video` | pins and scrubs a `<video>` with the scroll (Apple style) | `m-length` (2 = 200 % of the viewport) | product reveals |
| `loader` | full-screen intro: `[data-m-count]` counts 000 → 100, `[data-m="type"]` types, then a curtain wipes up; once per session | `m-dur` (1.3), `data-m-skip` | studios, launches; never on app pages |

CSS-only helpers in `motion.css`:
- `.m-link` gives an underline that grows from the left.
- `.m-press` gives press feedback.
- `.m-curtain-cover` + `.m-curtain-footer` make the last section uncover a sticky footer.
- `@view-transition` gives cross-page transitions with in-out quart.
- The tokens: `--m-dur-*`, `--m-ease-*` (including the measured `--m-ease-out-quart`, `--m-ease-inout-quart`, `--m-ease-lux`).

## 3. WebGL layer

`[data-gl]` elements mount lazily when they come within 300 px of the viewport. Every scene has these behaviours:
- **Fallback until ready:** it keeps a fallback (`<img data-gl-fallback>` inside, or the element's own CSS background) until the first frame is drawn.
- **Pauses when off screen**, and when the tab is hidden.
- **Caps the pixel ratio** with `data-gl-dpr` (default 2).
- **Performance guard:** it checks itself every 1.5 s of visible running time. Below 24 fps it halves the resolution (down to `data-gl-min-dpr`: 0.5 for the gradient, 1 for the others). If that is still too slow, it switches to the fallback and records the reason in `data-gl-degraded`.
- **Reduced motion:** it draws one still frame, which updates on scroll (`data-gl-still` forces this).

| `data-gl=` | Look | Options | Weight |
|---|---|---|---|
| `gradient` | moving mesh gradient (Stripe style), reacts to pointer and scroll | `data-gl-colors` (4 hex, comma-separated), `data-gl-speed` (1), `data-gl-grain` (0.035) | ≈ 7 KB, raw WebGL |
| `gallery` | its `<img>` children bent onto a cylinder; they slide sideways while the section passes and bend more with scroll speed | `data-gl-curve` (0.35), `data-gl-travel` (1), `data-gl-gap` (0.12), `data-gl-aspect` (1.5) | ≈ 8 KB, raw WebGL; images must be same-origin or CORS-enabled |
| `product` | a 3D object with a camera move along the scroll, idle float, pointer parallax | `data-gl-src` (GLB) or `data-gl-shape` (`card`, `device`, `orb`), `data-gl-color`, `data-gl-keys` (JSON `[{p, zoom, orbit:[yaw,pitch], rot}]`; zoom 1 = the object fits the frame), `data-gl-exposure` | three.js chunk 609 KB, loaded only for this |

- **Make the poster from the scene itself.** Render one still frame with `data-gl-still` in Playwright and screenshot the element at DPR 2. Use the image as `<img data-gl-fallback>`. Then the fallback looks exactly like the live scene.
- **Rebuild `webgl/dist` after changing `webgl/src`:** `cd webgl && npm install && npm run build` (esbuild 0.28.2, three 0.186.1).

## 4. Rules that make it look expensive

- **Product restraint, award signature.** UI and reading text use the fast tokens (200–400 ms). Pick one or two award techniques as the page's signature, such as a wordmark, a highlight statement, a pinned story, or a WebGL hero. Using all of them at once looks like a template.
- **One loader at most,** only on a first visit and under 2.5 s, never on app pages.
- **Only one bouncy thing per page** (`stamp`). Everything else uses ease-out or in-out.
- **Split text needs the final font.** The kit waits for `document.fonts.ready` (at most 1.5 s), so lines never re-break after the reveal.
- **Put real values in the HTML** (counters, text). Motion only decorates what is already there.
- **On mobile**, smooth scroll, the cursor and magnetic effects switch off by themselves. Check that pinned sections still read well on a 390 px screen.

## 5. Verify

1. `node <skill>/scripts/study-site.mjs http://localhost:PORT/ --scrolls 14` and the same with `--mobile`. Compare with `award-sites.md`: editorial reveals 500–1000 ms, UI 200–400 ms, CLS < 0.05.
2. `node <skill>/scripts/audit-ui.mjs http://localhost:PORT/` runs the page with and without reduced motion. In the reduced run nothing may move.
3. Load the page with JavaScript disabled. All content must be visible.
4. Test with CPU throttled ×4 (CDP `Emulation.setCPUThrottlingRate`). The frame rate must hold, and WebGL must degrade, not stutter (`data-gl-degraded` says what happened).
5. `node <skill>/scripts/lint-motion.mjs <src>` for layout-property transitions and a missing reduced-motion path.
6. Look at the screenshots (contact sheets). Measuring is not seeing.

The demo (`demo/index.html`) uses every module. In testing it measured CLS 0 on desktop and 0.0009 on mobile, and Lenis inertia of 1.25 s. Under ×4 CPU throttling without a GPU, the WebGL scenes switched to their fallbacks within 1.5 s and the page held 40–60 fps.

## 6. Licences

- **GSAP 3.15.0** (with ScrollTrigger and SplitText): GreenSock Standard "no charge" licence. It is free, including for commercial work. The one exception is building a tool that competes with Webflow's visual builder. Keep the licence header in the files.
- **Lenis 1.3.26** and **three.js r186**: MIT.
- **The demo media** were generated with ffmpeg (gradients, a Mandelbrot zoom), and the product poster was rendered from the kit's own 3D card.
