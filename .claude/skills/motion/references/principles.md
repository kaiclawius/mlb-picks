# Motion principles

The shared foundation for video and UI. Numbers are starting points that work; adjust them deliberately, never randomly.

## Contents
1. What motion is for
2. Timing and durations
3. Easing (with exact curves)
4. Springs
5. Choreography: staging, stagger, hierarchy, continuity
6. Space and physics
7. Typography in motion
8. Tone presets
9. Platforms and formats (video)
10. Sound
11. Accessibility
12. Anti-patterns
13. Taste checklist

## 1. What motion is for

Every animation should do at least one of these jobs:
- **Orient**: show where something came from and where it went (a panel slides from the button that opened it).
- **Focus**: direct the eye to the one thing that matters now.
- **Explain**: show a process or a change of state (a task gets checked, a number grows, data flows).
- **Feedback**: confirm an action was received (press, success, error).
- **Character**: express the brand, in small doses, on top of the other jobs, not instead of them.

If you cannot name the job, cut the animation. Restraint is what makes the remaining motion feel expensive.

## 2. Timing and durations

### Video (at 30 fps; frames in brackets)
| Thing | Duration |
|---|---|
| Small accent, tick, highlight flash | 0.15–0.25 s (5–8) |
| Element / text entrance | 0.5–0.8 s (15–24) |
| Hero headline, product shot entrance | 0.8–1.2 s (24–36) |
| Exit | ⅔ of the entrance, 0.3–0.5 s (9–15) |
| Camera move or position change | 0.7–1.2 s (21–36) |
| Transition between scenes | 0.3–0.6 s (9–18) |
| Stagger between siblings | 2–6 frames (words 2–4, cards 4–8) |
| Hold after a reveal before the next thing | ≥ 0.5 s; key messages 1–2 s |
| Scene length | 2–6 s; nothing important shorter than 1.5 s |
| Reading time for on-screen text | words ÷ 3.3 + 0.8 s, minimum 1.5 s (`readFrames()` in the starter) |

60 fps only for fast UI recordings or sports-like energy; 30 fps is the norm for motion graphics; 24 fps for cinematic.

### UI (milliseconds)
| Interaction | Duration | Easing |
|---|---|---|
| Hover color/shadow | 100–150 | ease-out |
| Press / active | 60–100 down, 150 up | ease-out |
| Toggle, checkbox, small state | 150–200 | standard |
| Tooltip, dropdown, popover in | 150–200 | enter |
| …and out | 100–150 | exit |
| Toast, snackbar in / out | 250 / 180 | enter / exit |
| Modal, sheet, drawer in | 250–350 | enter (sheets on mobile: 300–400) |
| Page / route transition | 300–500 | move |
| Hero / landing entrance on load | 500–900, staggered | enter |
| Scroll reveal | 500–700, triggered at ~15–25 % in view | enter |
| Skeleton shimmer, spinner loop | 1200–1600 per cycle | linear |

Above 500 ms UI feels sluggish unless the element is large or the moment is ceremonial (first load, success). Under 100 ms is perceived as instant (fine for press states). Mobile durations can be ~20 % longer for big surfaces, shorter for small ones.

## 3. Easing

Name curves by intent. These are the defaults used in the starter (`EASE`) and suggested as CSS tokens:

| Intent | Curve | CSS |
|---|---|---|
| **Enter** (arrive, settle) | expo-out | `cubic-bezier(0.16, 1, 0.3, 1)` |
| **Exit** (leave the stage) | expo-in-ish | `cubic-bezier(0.7, 0, 0.84, 0)` |
| **Move** (A to B, both visible) | in-out | `cubic-bezier(0.65, 0, 0.35, 1)` |
| **Standard UI** (small state changes) | Material-like | `cubic-bezier(0.2, 0, 0, 1)` |
| **Pop** (playful arrival, slight overshoot) | back-out | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| **Linear** | — | only loops, progress bars, scrolling tickers, timecode |

Why: objects that start fast and settle slowly read as light and responsive (enter); objects that accelerate away read as leaving (exit); in-out reads as deliberate movement. CSS `ease` and `ease-in-out` are too symmetrical and timid for premium motion.

## 4. Springs

Springs feel physical and handle interruption well (UI) and give natural settle (video).

| Preset | Remotion `config` | Motion for React | Use |
|---|---|---|---|
| smooth (no overshoot) | `{ damping: 200 }` | `{ type: "spring", bounce: 0, duration: 0.5 }` | text, panels, anything serious |
| gentle | `{ damping: 18, stiffness: 120, mass: 1 }` | `{ type: "spring", bounce: 0.15, duration: 0.6 }` | cards, images |
| snappy | `{ damping: 13, stiffness: 160, mass: 0.6 }` | `{ type: "spring", bounce: 0.25, duration: 0.45 }` | icons, badges, buttons |
| bouncy | `{ damping: 9, stiffness: 140, mass: 0.7 }` | `{ type: "spring", bounce: 0.45 }` | playful brands, emoji, success |

Overshoot is seasoning. One bouncy element per scene, at most.

## 5. Choreography

- **Staging**: decide the single focal point of each moment. Everything else is still, dimmed or not yet there. Dim earlier items (opacity 0.35) when the point arrives (see the Problem scene in the starter).
- **Order**: lead with the most important element, then supporting ones, in reading order (top-left to bottom-right for LTR languages). Titles before body, image before caption, number before label.
- **Stagger**: overlap siblings so they read as a group: each starts after 10–20 % of the previous one's duration. Keep total stagger under ~0.5 s or it turns into a slow parade.
- **Overlap**: start the next action before the previous fully settles (30–50 % overlap) so motion flows instead of stepping.
- **Direction language**: things enter from where they logically come from (next = from right, detail = from below, back = to left). Keep it consistent across the piece.
- **Continuity**: when an element persists across states, move it rather than cutting (shared element / layout animation / View Transitions). The viewer keeps their place.
- **Exit before enter** for text: let the old content leave (0.3 s) before the new arrives; use crossfades for images, color fields and backgrounds.
- **Rhythm**: vary pacing. Quick, quick, hold. A steady drumbeat of identical reveals is boring; edit to beats of music if there is any.
- **Camera**: slow push-ins (scale +2–5 % over a scene) add life to static frames. Pan to the region you are talking about, hold while it matters, move on. Never move the camera and the content in different directions at the same time.

## 6. Space and physics

- Travel distances: UI 8–24 px (small), up to 40 px (sections); video 2–4 % of frame height for text, more only for big set pieces.
- Scale: enter from 0.92–0.96, not from 0 (popping from nothing looks cheap except for icons/dots).
- Rotation: 1–3° is plenty for organic feel; big rotations for playful pieces only.
- Depth: parallax layers move at different speeds (background 0.3–0.5×). Shadows grow as things lift (y-offset and blur up, opacity down slightly).
- Blur: a 4–8 px blur fading out on entrance can feel cinematic; don't stack it on many elements (render cost, mush).
- Mass: larger elements move slower and overshoot less than small ones.

## 7. Typography in motion

- Animate by **word or line**, not by letter, for anything people must read. Per-letter only for single display words or logos.
- The **mask reveal** (words rising out of a clip mask, `KineticText`) is the premium default for headlines. Typewriter effects only when the subject is typing.
- Keep text **still while it is read**. Never move or scale text that the viewer is reading; drift the background or camera instead.
- Sizes for video (1080 px wide frames): headline 90–140 px, body 36–48 px, labels 22–28 px; 9:16 body text ≥ 44 px. Minimum 2.5 % of frame height for anything that must be read on a phone.
- Line length: max ~30 characters per line in 9:16, ~45 in 16:9 headlines. Balance the lines (`text-wrap: balance`) and never leave one word alone on the last line; check the wrap in every format, it differs.
- Highlight one key word per line with the accent color or a drawn underline, not three.
- Numbers: count up with ease-out and tabular figures (no jitter). Round to what people remember (2.5 h, not 2.47 h).

## 8. Tone presets

| Tone | Durations | Easing | Overshoot | Stagger | Notes |
|---|---|---|---|---|---|
| Calm / premium (Apple, Anthropic, Stripe) | long holds, entrances 0.7–1.0 s | expo-out, in-out | none | 3–4 f | lots of space, few elements, slow push-ins |
| Corporate / trust | 0.5–0.7 s | standard, expo-out | none | 4 f | clear hierarchy, no gimmicks |
| Energetic / social | 0.3–0.5 s, cuts on beat | expo-out, pop | small | 2 f | big type, hard contrasts, faster cuts (1–2 s) |
| Playful / consumer | 0.4–0.6 s | pop, springs | yes | 3 f | rotation, squash, emoji, color |
| Technical / developer | 0.4–0.6 s | standard | none | 2–3 f | mono type, grids, code, precise lines |
| Luxury / editorial | 1.0–1.6 s | slow in-out | none | 6–8 f | serif display, fades, letterspacing, darkness |

## 9. Platforms and formats (video)

| Platform | Format | Length | Notes |
|---|---|---|---|
| Website hero / landing | 16:9 (or 4:5 mobile) | 15–45 s, loopable | autoplay muted: must work without sound; first frame is the poster |
| YouTube / presentation | 16:9 1920×1080 | 30–120 s | chapters, end card |
| LinkedIn / X feed | 1:1 or 4:5 (1080×1350) | 15–45 s | captions burnt in; hook in 2 s |
| TikTok / Reels / Shorts | 9:16 1080×1920 | 7–30 s | hook in the first 1–2 s; keep text inside the safe area: top ~12 %, bottom ~20 %, sides ~8 % (platform UI covers the rest); captions mid-height |
| Story ads | 9:16 | 6–15 s | brand in first 3 s |

Thumbnails: pick a settled frame with the key message readable at 300 px wide.

## 10. Sound

- Music sets pace: cut or start key reveals on beats (beat frame = 60 / BPM × fps × n).
- Subtle sound design sells motion: soft whooshes on transitions, clicks on UI clicks, a low hit on the key reveal. Mix SFX below music; −14 LUFS integrated for social/web, −16 for podcasts/voice-led.
- Voice-over leads; motion follows the words (show the thing when it is said, not before).
- Always design for sound off too: the story must work silently, with captions.

## 11. Accessibility

- `prefers-reduced-motion: reduce` → no parallax, no large moves, no autoplaying loops; keep fades and essential state changes (≤ 200 ms). Never remove information, only movement.
- No content that flashes more than 3 times per second (WCAG 2.3.1); avoid large high-contrast strobing.
- Auto-playing motion longer than 5 s on web needs a pause control (WCAG 2.2.2).
- Captions for every video with speech; enough contrast for text over moving backgrounds (add a scrim).
- Don't rely on motion alone to convey meaning (pair with text/icon change).

## 12. Anti-patterns

- Everything animating at once on load.
- Bouncing serious UI (banking, health, B2B tables).
- Linear easing on movement.
- Long UI transitions (> 500 ms) that block the user; animations that cannot be interrupted.
- Text crossfading over other text; moving text that is being read.
- Fade-in everything the same way, same duration, same direction (no hierarchy).
- Spinning/zooming 3D transitions from 2010 slideshow software; random wipes.
- Scroll-jacking (taking over the scroll speed).
- Animating `width`, `height`, `top`, `left`, `margin` in UI (jank); `box-shadow` animation on many elements.
- Stock "particles everywhere" backgrounds that fight the content.
- Motion that is never seen (too fast to notice) or seen too much (loops on every card).

## 13. Taste checklist (before delivery)

- [ ] Can I say in one sentence what each animation is for?
- [ ] At any frame/moment, is there exactly one focal point?
- [ ] Do entrances ease out and exits ease in, from the same curve family?
- [ ] Is every text on screen long enough to read twice?
- [ ] Are holds long enough that it feels confident, not rushed?
- [ ] Do transitions avoid text-on-text overlap?
- [ ] Does it work without sound? With reduced motion?
- [ ] Do 9:16 versions keep text inside the safe area?
- [ ] First frame and last frame look intentional?
- [ ] Would a senior motion designer remove anything? Then remove it.
