# What award-winning sites do (measured)

Measured in October 2026 with `scripts/study-site.mjs` and REA network captures. The sample: 12 Awwwards Sites of the Day (Sep–Oct 2026) and 4 product sites as a contrast (Linear, Stripe, Vercel, Apple AirPods Pro).
Learn the craft from it: the timing, the curves and the techniques. Never copy a site's code, assets, layout or copy. Build your own design with your own content, and treat these numbers as calibration.

**Measurement limits.** The browser was headless with software WebGL. Heavy 3D sites (Landberg, LISA, Overworld, Moto, Vercel) ran at 1–15 fps, so their timing numbers are unreliable; only their engines and screenshots are used here. Santioni (Active Theory) refuses unsupported browsers entirely. Long-task counts are inflated by the software rendering.

## Contents
1. The stack
2. Timing and curves
3. Signature techniques and how to build them
4. Product sites vs award sites
5. Costs and risks

## 1. The stack

| Site | Engines found | Notes |
|---|---|---|
| Iventions (SOTD, CSSDA WOTM) | GSAP 3.13, ScrollTrigger, SplitText, Lenis, three r176 | giant wordmark, editorial type, project videos |
| Mat Voyce (GSAP SOTY nominee) | GSAP 3.12, Lenis, three r167 | kinetic type, rolling characters, custom cursor, 10 videos |
| Butter (ToyFight) | GSAP 3.15, ScrollTrigger, SplitText, Lenis, three r183 | SaaS product site, 7 GLB models, scroll-highlighted words |
| Heron AI (Bearplus) | GSAP 3.12, ScrollTrigger, SplitText, Barba, Webflow | line drawings, path reveals, page transitions |
| twks | GSAP 3.14, ScrollTrigger, Lenis, Lottie | Swiss grid, 13 videos, footer curtain reveal |
| Moto Finance | GSAP 3.15, ScrollTrigger, Lenis, three r181, Webflow | dark luxury fintech, 3D card, pinned story |
| By-Kin | GSAP 3.12, SplitText | loader → wordmark, zoom-settle intro, mouse-reactive hero |
| OFFF Forum | GSAP 3.15, Lenis | short page; video hero, huge wordmark |
| Jesper Landberg | GSAP 3.15, three r185, 21 KTX2 textures | WebGL curved gallery (images bent on a cylinder) |
| Overworld Audio | GSAP 3.15, three r184, 1 GLB model | dark 3D scene |
| LISA (Locomotive) | GSAP 3.14, three r165 | one-screen interactive character with typed dialogue |
| Linear | CSS + own code | blur-in hero text, CSS `steps()` pixel-grid animation |
| Stripe | own code, WebGL gradient, CSS scroll-driven | animated gradient hero, marquee, lazy reveals |
| Vercel | own code, three r185 | 3D hanging sign, marquee |
| Apple AirPods Pro | own code, WebGL, video | sticky scroll sections, scrubbed media, 30 px reveals |

Counts:
- **GSAP:** 11 of 12 award sites, versions 3.12–3.15. It has been free for commercial use since 2025.
- **Lenis smooth scroll:** 7 of 12. Its measured inertia after one wheel notch is 0.84–1.18 s.
- **three.js / WebGL:** 8 of 12.
- **ScrollTrigger:** 5. **SplitText-style splitting:** 5. **Page transitions (Barba):** 1. **Lottie:** 1.
- **None of the four product sites uses GSAP.**

## 2. Timing and curves

| | Median reveal | p25–p75 | Y travel (median) | Curves |
|---|---|---|---|---|
| Linear | 268 ms | 200–332 | 8 px | power4/expo out; 200 ms for small UI |
| Apple | 388 ms | 289–530 | 28–30 px | in-out; `cubic-bezier(0.4,0,0.6,1)` nav at 320 ms |
| Heron | 384 ms | 304–776 | 5 px | ease-out family; path reveals 0.9–1.1 s |
| By-Kin | 525 ms | 491–843 | 28 px | quad/cubic out; intro zoom 1.2 → 1.04 over 1.2 s |
| twks | 531 ms | 470–631 | 16 px | power2 out; image scale 1.15 → 1.05 |
| Mat Voyce | 718 ms | 575–874 | large (character rolls) | `0.165,0.84,0.44,1` / `0.76,0,0.24,1` |
| Iventions | 913 ms | 543–1033 | 68 px | power2/3 out (50 + 19 of 102) |
| Butter | 959 ms | 449–1113 | 12 px | `0,0,0,1` at 800 ms; words reveal over 1.3–1.4 s |

The CSS of these sites shows the same few curves:
- **Ease-out quart** `cubic-bezier(0.165, 0.84, 0.44, 1)` (Iventions, Mat Voyce, Stripe at 800 ms) and its sibling `cubic-bezier(0.25, 1, 0.5, 1)` (Stripe hovers at 300 ms). These are for entrances and reveals.
- **Ease-in-out quart** `cubic-bezier(0.76, 0, 0.24, 1)` (Iventions, By-Kin, Mat Voyce at 1200 ms). This is for big moves: menus, page and panel transitions, curtains.
- **Extreme ease-out** `cubic-bezier(0, 0, 0, 1)` (Butter, 800 ms). The element is almost there at once, then settles for a long time; it reads as luxurious.

Our tokens `--ease-enter: cubic-bezier(0.16,1,0.3,1)` and `--ease-move: (0.65,0,0.35,1)` sit in the same families.

Rule of thumb from the data:
- **Product and app UI:** 200–400 ms with 8–30 px of travel.
- **Editorial and award sites:** 500–1000 ms reveals, 1.2 s for big transforms, and an intro choreography of 2.8–7 s.

Stagger between items is ~30 ms for letters or words in a line (By-Kin). Between blocks it is 200–500 ms, which reads as one reveal after another.

## 3. Signature techniques and how to build them

| Technique | Seen on | Build with (our stack) | Notes |
|---|---|---|---|
| Preloader → intro choreography | Mat Voyce (000→100 counter), By-Kin, Iventions, twks | GSAP timeline, or CSS with `animation-delay`; counter with tabular figures | keep ≤ 2.5 s on repeat visits (sessionStorage), content must exist without JS |
| Giant wordmark / type reveal | Iventions, By-Kin, OFFF | split into letters, mask each (`overflow: clip`), y 100 % → 0, 30 ms stagger, ease-out quart 800–1000 ms | fit with `clamp()` font sizes; letters are aria-hidden, keep the word for screen readers |
| Line / word / char reveals | Butter, Heron, Mat Voyce, Iventions | GSAP SplitText (`mask: "lines"`, `autoSplit`) or our CSS split | lines for paragraphs, chars only for display words |
| Scroll-highlighted reading text | Butter | words at 0.15 opacity → 1 as the paragraph crosses the viewport (ScrollTrigger scrub, or CSS `animation-timeline: view()`) | a strong storytelling device for one statement per page, not for body text |
| Image reveal with zoom settle | twks (1.15 → 1.05), By-Kin (1.2 → 1.04) | clip-path inset or wrapper mask + inner image scale, ease-out 600–1200 ms | the image moves less than its frame: depth |
| Smooth scroll | 7 of 12 award sites | Lenis (MIT), `lerp` ≈ 0.1, inertia ≈ 1 s | off for reduced motion and on touch devices by default; never hijack keyboard scrolling |
| Pinned scroll storytelling | Moto, Apple | ScrollTrigger `pin` + scrubbed timeline, or `position: sticky` + scroll-driven CSS | each pinned step needs a readable resting state |
| Scrubbed product media | Apple | video `currentTime` or an image sequence tied to scroll, sticky section | use preloaded, small, keyframe-dense video (all-intra or a GOP of a few frames) |
| WebGL hero | Stripe (gradient mesh), Vercel (3D sign), Moto (3D card), Landberg (curved gallery), Butter (GLB) | three.js or OGL; for gradients a single fragment shader is enough | static fallback image, pause when offscreen, lazy-load, cap DPR at 2 |
| Marquee | Stripe, Vercel, Mat Voyce | CSS keyframes translating a duplicated track, linear, 20–40 s per loop | pause on hover and for reduced motion |
| Footer curtain | twks | footer `position: sticky; bottom: 0` under the last section, or ScrollTrigger scrub of y | cheap, memorable ending |
| Path / line drawing | Heron | SVG `stroke-dashoffset`, or opacity per path in sequence | technical, architectural brands |
| Custom cursor / mouse-reactive hero | Mat Voyce (`cursor: none`), By-Kin | `gsap.quickTo` for the follower, lerp 0.15–0.2 | keep the native cursor for links and inputs; none on touch |
| Page transitions | Heron (Barba) | View Transitions API (`@view-transition`), Barba/Taxi only where needed | 400–800 ms with in-out quart; keep focus management |
| Blur-in hero text | Linear | opacity 0 → 1 and `filter: blur(8px)` → 0 over ~0.5 s, staggered by line | only for a few big lines (blur is expensive) |
| Pixel-grid / steps animation | Linear | CSS `steps(1)` keyframes per dot with offsets | a technical texture without any JS |

## 4. Product sites vs award sites

- **Product sites** (Linear, Stripe, Apple, Vercel) use fast, small and consistent motion: 200–400 ms, 8–30 px. They spend their "wow" on one hero element: a gradient, a 3D object, or scrubbed product media. Everything stays readable when motion and WebGL are off. This is the right default for SaaS products such as Klipp and Stimme.
- **Award sites** use slow, big, choreographed motion: 500–1200 ms, smooth scroll, a preloader, split type and WebGL. They suit studios, events, portfolios, luxury goods and launches where the site *is* the experience. They cost performance and accessibility unless they are built carefully.
- **Best of both:** product-site restraint for UI and reading, plus one or two award techniques as the signature (a wordmark reveal, a scroll-highlight statement, an image zoom settle, a WebGL hero with a fallback).

## 5. Costs and risks

- **Weak devices.** WebGL-heavy sites fell to 1–15 fps without a GPU, and one refuses unsupported browsers. Always ship a static fallback and test with CPU throttling ×4.
- **Layout shift.** One award site measured CLS 0.104, which is over the 0.1 limit. Reserve space for split text and media before the animation runs.
- **Page weight.**
  - Requests ranged from 7 to 403. Linear loads 303 script chunks, but each is small.
  - 3D assets: Butter loads 7 GLB models and Landberg 21 KTX2 textures. Videos: twks 13, Mat Voyce 10.
  - Lazy-load media and decode it before revealing.
- **Third parties.** 0–14 per site. Heron loads 14 (Webflow and analytics).
- **Reduced motion.** Smooth scroll, pinning and scrubbing are exactly what reduced-motion users must not get. Turn them off and keep the content in its resting state.
