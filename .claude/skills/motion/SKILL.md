---
name: motion
description: Motion design at a professional studio level, for videos and for interfaces. Use for any animated video made in code (product launch films, explainer videos, social clips for TikTok/Reels/Shorts, kinetic typography, logo reveals, animated stats and charts, UI demos with cursor and camera moves, lower thirds, end cards) with Remotion, and for animation in websites and apps (page and hero entrances, scroll-triggered reveals, hover/press micro-interactions, page transitions, View Transitions, CSS/Motion/GSAP animation, prefers-reduced-motion). Use it whenever someone wants something to move, animate, transition, "feel alive", "look premium like Apple/Stripe/Linear/Anthropic", or asks for a promo, teaser or demo video, even if they never say "motion" or "Remotion". Also use it to review or fix existing animations that feel janky, slow, cheap or distracting.
---

# Motion

Make things move the way the best studios do: with purpose, physical believability, clear choreography and restraint. Motion is not decoration; it explains what changed, where to look and what matters, and it carries brand feeling. Bad motion is the fastest way to make good design look cheap.

This skill covers two media that share one set of principles:
- **Video** (Remotion: React rendered frame by frame to MP4). Read `references/remotion.md` and `references/recipes.md`.
- **Interfaces** (CSS, View Transitions, Motion for React, GSAP). Read `references/ui-motion.md`.
- **Both**: the principles, numbers and taste rules in `references/principles.md`. Read it on every motion task; it is the difference between "animated" and "designed".

Answer in the user's language. Keep the user's brand, content and facts; invent nothing they would have to correct (numbers, quotes, customer names) without marking it as a placeholder.

## Workflow

### 1. Brief (two minutes, saves hours)
Write down, briefly and to the user if anything is unclear:
- **Purpose**: what must the viewer understand or do afterwards? One sentence.
- **Audience and platform**: website hero, YouTube, LinkedIn, TikTok/Reels (9:16, sound off, 3-second hook), presentation, app UI.
- **Format and length**: 16:9 / 9:16 / 1:1 / 4:5; video length; UI: which interactions.
- **Tone**: calm and premium, energetic, playful, technical, luxury. This sets the numbers (see the tone table in principles.md).
- **Brand**: colors, fonts, logo, existing assets (screenshots, recordings, product UI). If missing, use the neutral defaults in the starter and say so.

Ask only what you cannot reasonably assume. A sensible default, stated, beats a questionnaire.

### 2. Storyboard before code
Video: write the beats as a table: beat, seconds, what is on screen, what moves, what the viewer should feel or know. One idea per beat. Check the timing budget: reading time for text (≈ 3.3 words/s + 1 s), holds after every reveal, a hook in the first 2 seconds for social. A 20-second film usually has 5–7 beats.
UI: list the interactions and states (enter, hover, press, loading, success, exit) and give each a duration and easing from the token table.

### 3. Build on the system, not by hand
- **Video**: start from `assets/remotion-starter/` (copy it into the project, `npm install`). It has the motion tokens (`src/motion/tokens.ts`), primitives (Reveal, Stagger, KineticText, Counter, Underline, Pop, Camera, BrowserFrame, ScreenShot, Cursor, Captions, VoiceBars, DriftBackground, Scene) and two finished example films to learn from. Put brand values in `src/brand.ts`. Every duration, easing and spring comes from the tokens, so the film feels like one piece and can be retuned in one place. If the repo already has a Remotion project (e.g. `studio/` here), build there and reuse its patterns.
- **UI**: define motion tokens as CSS custom properties (durations, easings) first, then use them everywhere. Prefer CSS for simple state changes; use Motion for React or GSAP when you need sequencing, layout animation, gestures or scroll choreography.

### 4. Look at it (non-negotiable)
Motion cannot be judged from code. Before you call anything done, look at frames:
- Video: `node scripts/frames.mjs --remotion <project> <compositionId> --every 15 --cols 6 --out sheet.png` renders only the chosen frames and tiles them (seconds, not minutes). Then render the full video and make a contact sheet of the MP4 (`node scripts/frames.mjs out/video.mp4 --every 0.5`). Read the images. Check every format you deliver (9:16 crops differently).
- UI: `node scripts/audit-ui.mjs <url> [--steps steps.json] [--mobile]` records the page while it moves, lists every animation that ran (element, properties, duration, easing), measures layout shift and re-runs with reduced motion. Look at the screenshots.
- Run `node scripts/lint-motion.mjs <src>` for both: it catches non-deterministic renders, CSS animation inside Remotion, deprecated APIs, network fonts, layout-property transitions and missing reduced-motion support.

What to look for on the frames: overlapping text during transitions, text that is on screen too briefly to read, elements colliding or touching edges, unbalanced empty space, safe-area violations on 9:16, a frame where nothing is in focus, a frame where everything moves at once, jumps between consecutive frames, the first and last frame (they become thumbnails and loop points). Pick extra frames (`--frames a,b,c`) where the camera arrives and where each scene is about to exit. Fix, then look again. Expect at least one round; first renders almost always have a transition or timing problem.

The problems first renders actually had in testing, so look for them on purpose:
- The camera shows the wrong region of a screenshot, or arrives and is cut away at once (no hold).
- A headline wraps fine in 16:9 and leaves one word alone in 9:16.
- A product window runs into the bottom 20 % of a 9:16 frame (platform UI covers it).
- Captions lose the space next to the highlighted word.
- The voice-over is far quieter than −14 LUFS.
- In UI: an entrance with `fill-mode: both` blocks the hover transform; a re-rendered list replays its entrance.

### 5. Deliver
- Video: H.264 MP4 (`crf 18`, yuv420p), one file per format, named `<name>-<format>.mp4`; a poster frame/thumbnail from a settled moment; captions burnt in or as a sidecar for social; with audio, normalise to −14 LUFS with `scripts/loudnorm.mjs`; note placeholder content.
- Speech: generate or record the voice first, get word timings with `scripts/captions.mjs` (pass `--script` when the text is known), then time captions and visuals to the words (recipes.md §10).
- UI: the code, the tokens, the reduced-motion behavior, and what you verified (audit output).
- Tell the user what you checked and what you could not check (e.g. "sound not reviewed", "not tested on Safari").

## Core rules (the short version of principles.md)

1. **Every motion has a job.** It shows a cause (this button opened that panel), guides attention, shows hierarchy, or gives feedback. If it has no job, remove it.
2. **One focus at a time.** Animate the important thing; let the rest wait or stay still. Stagger in reading order (≈ 40–80 ms in UI, 3–6 frames in video).
3. **Enter slow-out, exit fast.** Arrivals ease out (fast start, long settle); departures ease in and are about ⅔ as long. Moves between two on-screen positions ease in-out. Linear only for continuous loops and progress.
4. **Small distances, real physics.** Elements travel 8–40 px (UI) or 2–4 % of the frame (video), not across the screen. Things have weight: overshoot only where the brand is playful, and then subtly.
5. **Hold.** After something arrives, let it sit. Text needs reading time; a viewer needs a beat to feel a reveal. Most amateur motion is too fast in the holds and too slow in the moves.
6. **Exit before you enter** when two text-heavy scenes replace each other; crossfading two blocks of text in the same place reads as mush. Crossfade images, not paragraphs.
7. **Consistency.** One easing family, one duration scale, one direction language per piece. The starter's tokens exist for this.
8. **Respect people.** `prefers-reduced-motion`: replace movement with fades or nothing. No flashing more than 3 times per second. Captions for video that may play muted.
9. **Performance is part of the design.** UI: animate `transform` and `opacity`, not layout properties. Video: everything is a pure function of the frame; no timers, no `Math.random()`, no CSS transitions.

## When the user asks to review or fix motion

Audit first (frames, `audit-ui.mjs`, `lint-motion.mjs`), then report findings in plain language with the frame or element, why it hurts, and the fix, before changing code. Typical findings: everything moves at once, durations too long in UI (> 500 ms) or too short for text in video, linear easing, animating `height`/`top`, bounce on serious brands, no reduced motion, motion that fights reading.

## Files

- `references/principles.md`: timing, easing curves with exact values, springs, choreography, typography in motion, tone presets, platform specs (safe areas, hooks, lengths), sound, accessibility, anti-patterns. Read first.
- `references/remotion.md`: Remotion APIs that matter, project setup, fonts, assets, audio, captions, rendering, formats, pitfalls.
- `references/recipes.md`: proven scene recipes (title reveal, product demo with camera and cursor, stat, feature grid, logo reveal, chart, captions, end card, transitions) with code using the starter primitives.
- `references/ui-motion.md`: interface motion: tokens, micro-interaction table, entrances, scroll, page and View Transitions, Motion for React, GSAP, reduced motion, performance.
- `scripts/frames.mjs`: contact sheets from a Remotion composition (fast stills) or a rendered video.
- `scripts/captions.mjs`: word-timed captions (local Whisper) in the `@remotion/captions` format; `--script` aligns your exact text to the heard timings.
- `scripts/loudnorm.mjs`: two-pass loudness normalisation of a rendered video (−14 LUFS social, −16 voice-led), video copied untouched.
- `scripts/lint-motion.mjs`: static checks for Remotion and UI motion code.
- `scripts/audit-ui.mjs`: records and measures real UI motion in a browser, with and without reduced motion.
- `assets/remotion-starter/`: Remotion project with the motion system, primitives (incl. `ScreenShot` for real screenshots, `Captions`, `VoiceBars`) and two example films (launch film in 16:9/9:16/1:1, vertical social stat clip).
