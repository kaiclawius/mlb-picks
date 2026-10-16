# Video recipes

Proven scene patterns built from the starter primitives (`src/motion/primitives.tsx`) and tokens (`src/motion/tokens.ts`). Each recipe says when to use it, the timing, and the code core. The two example films in the starter (`ProductLaunch.tsx`, `SocialStat.tsx`) use most of them; read them before writing a new film.

## Contents
1. Story structures
2. Title reveal (kinetic headline)
3. Problem → turn (dim the past, light the point)
4. Product demo (browser window, camera, cursor)
5. Feature grid
6. Proof number / stat
7. Logo reveal and end card
8. Chart / data
9. Lower third and labels
10. Captions for social
11. Transitions between scenes
12. Backgrounds that stay quiet
13. Audio and beats
14. Making 9:16 from a 16:9 idea

## 1. Story structures

- **Launch (15–30 s)**: Hook (claim, 2–3 s) → Problem (2–3 s) → Product in action (4–8 s) → 2–3 features (3–5 s) → Proof (number/quote, 2–3 s) → End card (logo, CTA, URL, 2–4 s).
- **Launch, longer (45–90 s)**, by share of the running time: problem 8–10 % → why it hurts 8–10 % → the thesis, held still 5 % → product in action, at most 4 beats, 30–35 % → proof 20–25 % → before/after contrast ~10 % → CTA 8–10 %. The claim lands before second 10. Test it: say it in 7 words without "and". A cold open (straight into the product) works when the product is visual and instantly understood.
- **Explainer (45–90 s)**: Question → why it matters → how it works in 3 steps (one scene each, same layout) → result → CTA.
- **Social clip (6–15 s, 9:16)**: Hook in the first second (a number, a bold claim, motion) → one message → brand + CTA. No slow intros.
- **Feature drop (8–12 s)**: Name of feature → it working (UI) → one-line benefit → logo.
- **Testimonial**: quote in kinetic text (word reveal), name/role lower third, logo row.

Write the beats as a table first (beat, seconds, on screen, motion, purpose). Sum the seconds. Then build.

## 2. Title reveal

Use for: hooks, chapter titles, end lines. Words rise out of a mask, 3–4 frames apart; one accent word.
```tsx
<KineticText text={"Deine To-dos.\n*Endlich* im Griff."} at={6} gap={4} accent={C.accent} style={display(132 * u)} />
<Reveal at={30}><p style={sub}>Taskly: die To-do-App, die mitdenkt.</p></Reveal>
```
Timing: headline in 0.6–1.0 s, subline starts as the headline settles (~frame 30), hold ≥ 1.5 s after the last word. Add `fitText` from `@remotion/layout-utils` when the text length varies (data-driven videos).

## 3. Problem → turn

Lines appear one by one; when the decisive line arrives, the earlier ones dim to ~35 %. The eye follows the brightest thing.
```tsx
const dim = last ? 1 : 1 - 0.65 * progress(f, 34, 14);
<Reveal at={4 + i * 11} style={{ opacity: dim }}>…</Reveal>
```

## 4. Product demo

The heart of most videos. Show the real product; make it legible:
- Put UI in `<BrowserFrame>` (or a phone frame) on the brand background; shadow lifts it off the page.
- **Real screenshots**: use `<ScreenShot src size={{ w, h }} width height keys cursor>`. Camera keys and cursor points are in the screenshot's own pixels (open the image, read off where the thing is: "summary at x 540, y 820"), so they stay correct in every format. Take screenshots at 1.5–2× if you zoom past 1.5.
- **UI built in JSX** (like `MockApp`): `<Camera width height contentWidth contentHeight keys>`, with the app laid out at its natural desktop size; x/y are fractions of the content. JSX stays sharp at any zoom.
- Camera: zoom 1 = the content just covers the window. Start wide so viewers recognise the product, push to the area that matters (zoom 1.3–1.7), hold, move on. Moves 0.8–1.2 s with `EASE.move`.
- **Plan the camera timeline backwards from the scene end**: the last camera arrival needs ≥ 1 s of hold before the scene's exit starts. A camera that arrives and is immediately cut away reads as a mistake.
- Show interaction with `<Cursor>` (glide 0.6–0.9 s, click ring) and make the UI react 2–6 frames after the click; the cursor's last click should also land inside a hold.
- Screen recordings go in via `<Video>` from `@remotion/media` (`trimBefore`, `durationInFrames`, `muted`) inside the same `Camera`.
- Caption above the window: kicker (what step) + one short line. Never more than ~8 words while the UI moves.
- **9:16**: a desktop UI in a tall window shows a narrow slice plus empty space. Frame the one region that matters (zoom 1.4–1.8 on a 1440 px wide screenshot) and keep the window above `safe.bottom`.
```tsx
const { u, pad, width, height, portrait, safe } = useLayout();
const winW = width - pad * 2, winH = height - pad - capH - (portrait ? safe.bottom : pad);
<ScreenShot src={staticFile("watch.png")} size={{ w: 1440, h: 1100 }} width={winW} height={winH} url="app.example" theme={C} ring={C.accent}
  keys={[{ t: 0, x: 720, y: 340, zoom: 1 }, { t: 30, x: 720, y: 340, zoom: 1 }, { t: 58, x: 540, y: 820, zoom: 1.5 }, { t: 88, x: 540, y: 820, zoom: 1.5 }, { t: 116, x: 1150, y: 260, zoom: 1.7 }]}
  cursor={[{ t: 0, x: 860, y: 520 }, { t: 96, x: 1200, y: 340 }, { t: 122, x: 1268, y: 366, click: true }]} cursorScale={1.4} />
// scene length ≥ 116 + 30 (hold) + 10 (exit) frames
```

## 5. Feature grid

Three cards (never more than four) with icon, title (2–4 words), one line. `Stagger` 6 frames; on 9:16 stack them vertically. Hold 2–3 s after the last card. If each feature needs explaining, give each its own beat instead.

## 6. Proof number

`<Counter>` with ease-out over 1–1.5 s, tabular numbers, huge (200–300 u), then the label, then a drawn `<Underline>` under the number as the final accent. Round numbers. Mark example numbers as placeholders in the video until real data is in.

## 6b. Talking-head video with B-roll

For founder videos, tutorials and podcasts clips: the person is the film, motion graphics support them.
1. Transcribe (`captions.mjs`), then write a plan table **before any code** and get it approved: #, in–out time, the spoken line, what appears and on which word, treatment, why.
2. Treatment per line: **cutaway** (full-frame graphic, 3–10 s), **panel** (graphic in the empty part of the frame, the face stays visible) or **nothing**. Cut away only when the line describes something to see: a product, a process, a comparison, a number, a new chapter. Never in the first second of the hook, never on personal, emotional or opinion lines.
3. Density: light 2–4 graphics per minute, medium 4–7, heavy more; keep ≥ 2 s of face between cutaways and never more than ~3.5 s without the speaker in social clips.
4. Show the speaker's real things (their app, file, terminal, result) with a small vocabulary of interactions: click on a pill, progress, check, toggle, tabs, chart with tooltip, drag and drop, typing, side by side, chapter card. No invented numbers: use relative bars or skeleton lines and mark what is illustrative.
5. Sync: clip-local frame = word time − clip in-point; one change per spoken beat (0.4–1.2 s apart); anchor key changes on the first or last word of a caption (word times are most exact there).
6. Deliver panels as transparent ProRes 4444 (`--image-format=png`, see remotion.md) named by their timeline in-point (`0m32s40-stat.mov`), plus a list of in-points and a low-res preview with everything composited.

## 7. Logo reveal and end card

Logo mark `Pop` (snappy spring) → word mark `Reveal` 8–10 frames later → CTA → URL pill. Keep the end card static for the last 1–1.5 s so it works as a thumbnail and a loop point. For a logo-only reveal: draw the outline with `evolvePath` (0.8 s), fill fades in (0.3 s), slight scale settle 0.96 → 1.
Logo timing: draw-on 0.6–1.2 s, mask wipe 0.5–0.9 s, letters/parts built on with 0.06–0.10 s stagger, a settle of 1.04 → 1.00 over 0.12–0.2 s, then a hold ≥ 0.4 s (end cards ≥ 1.5 s). One technique per logo; never scale the final mark non-uniformly; land the settle on the sound accent.

## 8. Chart / data

- Bars grow from the baseline with `spring` (smooth), 3–4 frames stagger, value labels count with `Counter` and land when the bar lands.
- Lines draw with `evolvePath` along the data path (1–1.5 s, `EASE.move`), the end dot pops when the line arrives.
- Always show the axis/baseline before the data; highlight the one bar that matters in the accent color, the rest muted.

## 9. Lower third and labels

Name + role slide in from the left with a thin accent bar: bar scales X 0 → 1 (8 frames, `EASE.enter`), name reveals 4 frames later, role 4 frames after that; hold ≥ 3 s; exit faster than entry. Keep within the safe area (bottom 20 % on 9:16 is covered by platform UI: put lower thirds at ~65 % height there).

## 10. Captions for social

Workflow for speech (voice-over, talking head, screen recording with narration):
1. Get the audio: a recorded voice, a TTS voice (e.g. Stimme in this repo, ElevenLabs), or the video's own track.
2. Word timings: `node <skill>/scripts/captions.mjs voice.wav --out src/captions.json --lang de --script "exact spoken text"` (local Whisper; `--script` keeps your spelling and names and only takes the timings from Whisper). Import the JSON (`resolveJsonModule` is on in the starter).
3. `<Captions captions={captions} at={AT} combineMs={700} color="#fff" active="#fff" pill={C.accent} style={…} />`: pages of 2–4 words, the spoken word highlighted. Highlight with color or a pill, not by scaling the word (scaling eats the spaces next to it).
4. Put the audio in `<Audio src={…} from={AT} />` (`@remotion/media`) with the same `AT`, so captions and voice share one clock.
5. Time the visuals to the words: `frameOf(word) = AT + round(startMs / 1000 * fps)`; show the thing when it is said (pop the "DE" card on the word "Deutsch"), never before.
Style: big (76–90 u on 1080 wide), bold, high contrast with a soft shadow, centred at 55–65 % height, inside the 9:16 safe area, `textWrap: "balance"`.

## 11. Transitions

- Default: **exit before enter** with `<Scene>` in a `<Series>` (content lifts and fades over 10 frames, next scene builds itself). The shared background makes it feel continuous.
- Image to image, colour field to colour field: `TransitionSeries` with `fade()` or `slide()` (12–18 frames, `EASE.move`).
- Match cuts: end one scene on a shape (circle, card) that the next scene starts from; scale the shared element to bridge the cut.
- Choose by energy: calm 0.5–0.8 s with in-out easing and little or no blur; medium 0.3–0.5 s; high 0.15–0.3 s with expo curves and motion blur. One primary transition for 60–70 % of the cuts plus one or two accents for chapter changes and the climax.
- Velocity-matched cuts: the outgoing element accelerates out (ease-in), the incoming one decelerates in (ease-out) in the same direction, both at similar speed at the cut; with a little blur the cut disappears.
- Speed ramp (energetic pieces): slow to ~25 % into the beat, snap back to full speed after it.
- "A becomes B" morphs: one element transforms into the next state (button → player, card → page, dot → chart); the leading edge moves first and the trailing edge follows on its own, slightly slower timing, so the shape stretches and settles instead of sliding rigidly.
- Avoid: crossfading text over text, spinning 3D cubes, random wipes, more than two transition types in one piece.

## 11b. Finish: grade, grain, vignette

A last layer over everything gives code-made video a filmic finish. Keep it subtle and check contrast with the grade switched off (it must already be readable without it).
- Grain: an SVG `feTurbulence` noise at ~0.06–0.10 opacity, reseeded every 2nd frame (`seed={Math.floor(frame / 2)}`), so it lives without flickering. Grain makes the H.264 file larger and blockier: raise the bitrate or lower `crf` by 2 when you add it.
- Vignette: radial gradient to ~10–15 % black at the corners.
- Light sweep: a soft diagonal highlight at ~0.1 opacity crossing once or twice per film, on a hero moment only.
- Colour: one look for the whole film; adjust in the order exposure → contrast → saturation → split-tone (≤ 0.15) → unify. Interpolate colours in OKLCH (`interpolateColors` steps through RGB and gets muddy between complementary colours).
- Starter: `<Grade grain={0.08} vignette={0.12} />` as the last child of the film.

## 12. Backgrounds

`DriftBackground` (two soft radial gradients drifting over 8–10 s) or a static brand colour with a vignette. Grids and noise at 2–4 % opacity for technical brands. Backgrounds move slower than anything in the foreground and never carry information.

## 12b. Delivery formats

| Need | Deliver | Notes |
|---|---|---|
| Narrative video, social, presentation | MP4 (H.264, yuv420p, BT.709) | `qa-video.mjs` checks the specs |
| Video on a website hero | MP4 + WebM (VP9), muted, `playsinline`, poster image, ≤ 3–5 MB | the poster is the first meaningful frame |
| Overlay for an editor (lower thirds, panels) | ProRes 4444 with alpha | `--image-format=png` |
| Small vector loop in an app (icon, loader, empty state, brand accent) | Lottie / dotLottie | crisp at any size, tiny files, recolourable; render inside Remotion with `@remotion/lottie` |
| Interactive animation driven by app state (toggle, onboarding character) | Rive | a state machine the app sets inputs on |
| Preview in a README, chat or email | GIF from the MP4 | `ffmpeg -i in.mp4 -vf "fps=15,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif`; keep it under ~8 s |

Every animated asset gets a static poster/fallback, and the composition has to work as a still frame before it moves.

## 13. Audio and beats

Full guide: `sound.md` (voice-over timing, SFX made in code with `scripts/sfx.mjs`, beat grids with `scripts/beats.mjs`, mixing). In short: music at 0.5–0.7 volume under voice, fade in 1 s and out 1.5 s. Find the BPM; put key reveals on beats: `beatFrame(n) = Math.round(n * 60 / bpm * fps)`. One soft SFX per transition (whoosh) and per UI click (tick) at low volume. If there is no licensed music, deliver silent and say so; never ship unlicensed tracks.
`<VoiceBars src at bars width height color>` draws bars that follow the loudness of the voice: an instant, honest hook for audio products and talking clips.
After rendering, normalise loudness: `node <skill>/scripts/loudnorm.mjs out/x.mp4 out/x-final.mp4 --target -14` (social/web; −16 voice-led). TTS and raw recordings are usually around −25 LUFS: far too quiet next to other clips in a feed.

## 14. 9:16 from a 16:9 idea

Do not crop. Re-compose: stack side-by-side layouts vertically, enlarge text ~20 %, shorten lines (≤ 30 chars), move the camera path to the part of the UI that matters (portrait shows a narrower slice: plan `x` so the action stays in view), respect the safe area (`useLayout().safe`), and open with motion in the first second. Check the portrait contact sheet separately.
