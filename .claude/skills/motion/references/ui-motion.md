# Interface motion (web and apps)

Motion in products should feel instant, explain changes and never get in the way. Most of it is 150–400 ms, invisible until it's missing.

## Contents
1. Tokens first
2. Micro-interactions table
3. Entrances on load
4. Scroll-triggered reveals
5. Layout changes and shared elements (FLIP, View Transitions)
6. Motion for React
7. GSAP
8. Reduced motion
9. Performance
10. Verify

## 1. Tokens first

```css
:root {
  --dur-1: 120ms;  /* hover, press, color */
  --dur-2: 200ms;  /* toggles, tooltips, small state */
  --dur-3: 300ms;  /* modals, drawers, toasts */
  --dur-4: 500ms;  /* page transitions, hero */
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-move: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --rise: 12px;    /* entrance travel */
}
@media (prefers-reduced-motion: reduce) {
  :root { --rise: 0px; --dur-4: 200ms; }
}
```
Use only these. Exits use roughly ⅔ of the entrance duration and `--ease-exit`.

## 2. Micro-interactions

| Element | Behaviour |
|---|---|
| Button hover | background/shadow change, `--dur-1`; optional lift `translateY(-1px)` |
| Button press | `scale(0.97)` 80 ms in, back 150 ms (`:active`); never remove the focus ring |
| Link hover | underline grows from left (`background-size` or `scaleX` on a pseudo-element), `--dur-2` |
| Toggle | knob moves with `--ease-move` `--dur-2`, track color crossfades |
| Checkbox | check path draws (`stroke-dashoffset`) 160 ms, box scales 0.9 → 1 |
| Input focus | ring fades in 120 ms; label floats with `--ease-standard` |
| Tooltip / popover | fade + 4 px from the anchor side, 150 ms in / 100 ms out, origin at the anchor |
| Dropdown / menu | scale 0.96 → 1 + fade from the trigger corner (`transform-origin`), 160 ms |
| Modal | backdrop fade 200 ms; dialog scale 0.96 → 1 + fade, `--dur-3`, `--ease-enter`; exit 180 ms |
| Drawer / sheet | translate from its edge, `--dur-3`; mobile sheet follows the finger (gesture) and settles with a spring |
| Toast | in from the edge it lives on, 250 ms; auto-dismiss ≥ 4 s; exit 180 ms; stack shifts with layout animation |
| Tabs | indicator slides between tabs (shared layout), content crossfades 150 ms |
| Accordion | content `grid-template-rows: 0fr → 1fr` (animatable) + fade; chevron rotates 180° |
| Skeleton | shimmer 1.4 s linear loop; replace with content by crossfade 200 ms |
| Success | check draws + small scale pop (one spring), then holds; no confetti in serious apps |
| Error | input shakes horizontally 3× 4 px in 300 ms only for submit errors; always pair with text |
| Number change | tabular figures; old value slides up/out, new in (150 ms) or counts for dashboards |

## 3. Entrances on load

Stagger the hero in reading order: kicker → headline → subline → CTA → visual, 60–80 ms apart, each 500–700 ms with `--ease-enter`, travel `--rise`. Everything should be in place within ~1 s. Never hide content until JavaScript runs (SEO, slow devices): start visible by default, animate with CSS that applies immediately.

```css
.hero > * { animation: rise var(--dur-4) var(--ease-enter) both; }
.hero > *:nth-child(2) { animation-delay: 70ms; } .hero > *:nth-child(3) { animation-delay: 140ms; } .hero > *:nth-child(4) { animation-delay: 210ms; }
@keyframes rise { from { opacity: 0; transform: translateY(var(--rise)); } }
```
Three things that go wrong with entrances in real apps:
- **Fill mode**: use `animation-fill-mode: backwards` (or `animation: … backwards`). `both`/`forwards` keeps the last keyframe applied after the animation, and an animation beats normal rules: the card's `:hover { transform }` silently stops working.
- **Re-renders replay everything**: when a list is re-rendered (live updates, `innerHTML`, React keys that change), entrance classes fire again. Remember which items were already shown (a `Set` of ids) and animate only new ones; for a new result set (search, filter) clear it and use a faster variant (300 ms, 25 ms stagger) so results feel instant.
- **Stagger cap**: delay = `min(index, 7) × 50 ms`; item 40 must not wait 2 s.
```css
.card.enter { animation: rise var(--dur-4) var(--ease-enter) backwards; animation-delay: calc(min(var(--i, 0), 7) * 50ms); }
.card.enter.quick { animation-duration: var(--dur-3); animation-delay: calc(min(var(--i, 0), 7) * 25ms); }
```
Hover effects belong in `@media (hover: hover) { … }` so they don't stick after a tap on touch screens. A hover shadow as a pre-rendered `::after` layer (fade its opacity) is cheaper than animating `box-shadow`; it is clipped if the card has `overflow: hidden`, so clip the image container instead.

For elements appearing in the DOM later (popovers, list items), `@starting-style` animates the first frame in modern browsers:
```css
.toast { transition: opacity var(--dur-3) var(--ease-enter), transform var(--dur-3) var(--ease-enter); }
@starting-style { .toast { opacity: 0; transform: translateY(8px); } }
```

## 4. Scroll reveals

Reveal sections once as they enter (not every time they leave and re-enter), triggered when ~20 % is visible, 500–700 ms, small travel. Stagger items in a grid by row. Don't animate long body text paragraph by paragraph.

CSS scroll-driven (no JS), with a fallback:
```css
@supports (animation-timeline: view()) {
  .reveal { animation: rise linear both; animation-timeline: view(); animation-range: entry 10% cover 30%; }
}
```
(Scroll-driven animations map progress to scroll position; keep them subtle, they run as fast as the user scrolls.) JS fallback / one-shot reveal:
```js
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.2 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
```
```css
.reveal { opacity: 0; transform: translateY(var(--rise)); transition: opacity 600ms var(--ease-enter), transform 600ms var(--ease-enter); }
.reveal.in { opacity: 1; transform: none; }
.no-js .reveal { opacity: 1; transform: none; } /* never hide content without JS */
```
Parallax: at most 0.1–0.3× speed difference, only decorative layers, off for reduced motion. Never hijack scroll speed.

## 5. Layout changes and shared elements

- **FLIP** for list reorder/insert: measure first, apply the new layout, invert with transform, play to identity. Motion for React's `layout` prop does this for you.
- **View Transitions API** for page/state changes with shared elements:
```js
if (!document.startViewTransition) update(); else document.startViewTransition(() => update());
```
```css
.card-image { view-transition-name: hero-image; }          /* same name on both states */
::view-transition-old(root), ::view-transition-new(root) { animation-duration: 250ms; }
@media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation: none; } }
```
Cross-document (multi-page sites): `@view-transition { navigation: auto; }` in both pages' CSS (Chromium-based browsers; others simply navigate).

## 6. Motion for React (`motion`, MIT)

```tsx
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
const enter = { duration: 0.5, ease: [0.16, 1, 0.3, 1] };

<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={enter} />
<AnimatePresence>{open && <motion.div key="m" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .98, transition: { duration: .18 } }} />}</AnimatePresence>
<motion.li layout transition={{ type: "spring", bounce: 0, duration: 0.4 }} />              // reorder/resize smoothly
<motion.span layoutId="tab-indicator" />                                                   // shared element between tabs
<motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
  <motion.li variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: enter } }} />
</motion.ul>
<motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} />
```
`useReducedMotion()` returns true when the user prefers less motion: drop `y`/`scale`, keep opacity. `MotionConfig reducedMotion="user"` applies it globally.

## 7. GSAP

Best for long timelines, SVG choreography, scroll storytelling (ScrollTrigger), text splitting (SplitText). Since 2025 GSAP and all its plugins are free, including for commercial projects (Webflow licence; the restriction is building a competing no-code animation tool). Check the current licence before shipping in a product you sell.
```js
gsap.registerPlugin(ScrollTrigger);
const mm = gsap.matchMedia();
mm.add("(prefers-reduced-motion: no-preference)", () => {
  gsap.timeline({ scrollTrigger: { trigger: ".story", start: "top 70%" } })
    .from(".story h2", { y: 24, opacity: 0, duration: 0.7, ease: "expo.out" })
    .from(".story .card", { y: 16, opacity: 0, stagger: 0.07, duration: 0.6, ease: "expo.out" }, "-=0.4");
});
```
Use `gsap.matchMedia()` so animations only exist when motion is welcome, and kill timelines on unmount in SPAs.

## 8. Reduced motion

For every animated thing decide the calm alternative:
- Movement (translate/scale/rotate/parallax/scroll-linked) → none or a 150–200 ms fade.
- Autoplay loops and background video → paused, with a play control.
- Essential feedback (focus, state change, progress) → keep, just shorter and without travel.
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```
The blanket rule above is a safety net; designing explicit calm states is better (e.g. entrances become a 200 ms fade: `@media (prefers-reduced-motion: reduce) { .list .item.enter { animation: fade 200ms ease-out backwards !important } }`, specific enough to beat the blanket rule). Include `::before`/`::after` in a blanket rule; `*` alone does not match pseudo-elements.

## 9. Performance

- Animate `transform` and `opacity` (compositor). Avoid animating `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size`; use `scale`/`translate` or the `grid-template-rows` trick.
- `will-change: transform` only on elements that are about to animate, removed afterwards; never on hundreds of elements.
- `box-shadow` and `filter: blur()` animations are expensive: animate the opacity of a pre-rendered shadow layer instead.
- Keep main-thread work out of animation frames; batch DOM reads/writes. Test with CPU throttling ×4 and on a real phone.
- Prefer CSS for simple transitions (works without JS, cheaper), libraries for orchestration.
- Interruptible: hover-out mid-animation must reverse smoothly (CSS transitions do; springs do).

## 10. Verify

1. `node <skill>/scripts/lint-motion.mjs src/` (layout-property transitions, long durations, missing reduced motion).
2. `node <skill>/scripts/audit-ui.mjs http://localhost:3000 --steps steps.json` and the same with `--mobile`: read the list of animations (durations, easings, properties), the findings (linear or timid `ease` curves, layout properties, expensive shadow/filter animations, fill modes that lock transforms, motion that ignores reduced motion), the reduced-motion run and the screenshots. Steps: `[{ "wait": 1200 }, { "hover": ".card" }, { "type": ["#q", "Export"] }, { "click": "text=Mehr" }, { "scroll": 800 }]`. Run it before and after a change and compare.
3. Keyboard: Tab through: focus rings visible, nothing moves unexpectedly.
4. Ask: does the page feel faster or slower with motion? If slower, cut durations or animations.
