# Reviewing motion

How to judge a piece honestly before showing it, and how to review someone else's. The author is the worst judge of their own film: they know what each moment means, so they see intent instead of what is on screen. Measure first, then look with fresh eyes.

## Contents
1. The review loop
2. Automatic fails
3. Scorecard (video and UI)
4. Symptom → fix
5. Anti-default check (does it look like every AI video?)

## 1. The review loop

1. **Measure.** `qa-video.mjs` (export, loudness, pops, dead stretches, strobing, beat offsets), `lint-motion.mjs`, for UI `audit-ui.mjs`. Fix every Fehler first.
2. **Contact sheets at the right moments.** Not only every N frames: one frame ~0.3 s after each beat/reveal (settled), the last frame of every scene (anything still moving there is a leftover), and 10-frame strips around each cut.
3. **Three single-focus passes.** Watch once only for sync (does each thing happen on its word or beat?), once muted only for motion (one focus at a time? anything twitching?), once only for the message (see 4.).
4. **Slow and small.** Step through transitions at 0.25–0.5× speed; look at a 360 px wide contact sheet: is the key text still readable on a phone?
5. **Fresh eyes.** When you can spawn a subagent, give a reviewer only the frames/contact sheets and the brief (not your code or intentions) and ask it to: restate the message from the frames alone, score the card below, list the 3 worst problems with timestamps. It rejects by default. Fix the scenes it scores lowest, then repeat until every category is ≥ 2 (video: ≥ 18 total for a launch).
6. **Distraction test.** After watching, write down the copy from memory. If you remember the animation but not the words, the motion is too loud.

## 2. Automatic fails (fix before anything else)

- Text on screen too short to read twice, or text clipped, overlapping, or under the 9:16 platform UI.
- A single-frame pop, flash or jump; strobing > 3 flashes per second.
- A camera that arrives and is cut away without a hold; a frame where nothing is in focus or everything moves.
- Wrong or invented facts and numbers (keep a `facts.md`: every on-screen number with its source; mark placeholders).
- Loudness far from target or clipping; voice not understandable.
- UI: no reduced-motion path; motion that hides controls or shifts layout (CLS); an entrance that blocks interaction; the page is weaker with motion off than with it on.
- No visual proof inspected (nobody looked at frames).

## 3. Scorecard

Score 0–3 each (0 broken, 1 weak, 2 good, 3 excellent). Pass: every category ≥ 2. Launch films: ≥ 18 of 21.

| Category | 3 means |
|---|---|
| Hook | something meaningful moves or is said in the first second; the promise is clear by 2–3 s |
| Clarity | one message per scene; a stranger can restate the film's point in one sentence |
| Readability | every text holds long enough (≥ max(0.7 s, 0.25 s + chars/17)), large enough, high contrast, inside safe areas |
| Motion quality | one focus at a time, eased, consistent curves, holds that breathe, no twitching or dead stretches |
| Rhythm and variety | pacing changes (quick, quick, hold); slowest scene ≥ 3× the fastest; no device used twice the same way |
| Sound and sync | hits land on their word/beat (± 1 frame), mix hierarchy voice > SFX > music, target loudness |
| Brand and finish | colors, type and tone match; first and last frame work as thumbnails; delivery specs met |

For UI score: purpose (every animation has a job), responsiveness (feedback < 100 ms, nothing blocks), consistency (tokens only), performance (transform/opacity, no jank on a 4× CPU throttle), accessibility (reduced motion, no flashing, focus visible), and restraint.

## 4. Symptom → fix

| It feels… | Usually because | Fix |
|---|---|---|
| robotic, mechanical | linear or identical easing everywhere, everything the same duration | expo-out entrances, in-out moves, vary durations with distance; add 1–3 frame offsets between children |
| cheap, "template" | everything fades up the same way, too many effects, scale from 0 | one entrance style per role, enter from 0.92–0.97 scale, cut effects to one per scene |
| slow, boring | long entrances, short holds in the wrong places, no rhythm | shorter moves (0.4–0.7 s), longer holds only on key messages, cut dead stretches |
| rushed, stressful | holds too short, several things moving at once | reading-time formula, exit before enter, one mover |
| floaty | very long ease-outs, no settle, everything drifting | shorter tails, a firm settle (or a tiny overshoot on small elements), stop ambient motion under text |
| jumpy, twitchy | missing clamps, springs that oscillate, crossfading text | clamp all interpolations, damp springs (`damping: 200` for text), exit before enter |
| distracting | ambient motion as strong as primary, loops everywhere | ambient ≤ 20 % of primary energy, one loop per screen, pause loops under reading |
| flat | no depth, no hierarchy | 3 depth layers (background drift, content, foreground accents), shadow lift, dim what is not the focus |
| out of sync | hardcoded times, sound placed by file start | one timeline for picture and sound; place sounds by their peak (`sfx.mjs` does) |

## 5. Anti-default check

AI-made motion converges on the same look. Before delivery check:
- Not more than two tweens with the same easing and duration in one scene; entry directions vary with meaning.
- The first move of each scene starts 0.1–0.3 s in, not on frame 0 of the scene.
- Scenes have a shape: build (≈ 30 %), breathe (≈ 40 %), resolve (≈ 30 %).
- Not every film ends with logo + tagline + URL in the same way; not every hook is a three-word kinetic headline. When making several films for one brand, vary at least four of: structure, opening device, palette weighting, camera energy, transition family, typography rhythm, ending.
