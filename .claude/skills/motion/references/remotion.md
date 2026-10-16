# Remotion for motion design

Remotion renders React components frame by frame into video. Everything visible must be a pure function of the current frame. Version used here: 4.0.535 (checked against its type definitions).

**Licence:** Remotion is free for individuals, non-profits and companies with up to 3 employees; larger for-profit companies need a Company License (remotion.pro). Check this before using it for a client or inside an agency that grows past 3 people. Alternatives without that condition: HyperFrames (HTML + GSAP → MP4, Apache-2.0, young; set `HYPERFRAMES_NO_TELEMETRY=1`) or the HTML + Playwright + ffmpeg route.

**Official API skills:** the Remotion team publishes agent skills (`remotion-dev/skills`, covering every package in depth) and GreenSock publishes `greensock/gsap-skills`. For exact API details they are the best source; copy them at a pinned commit instead of running an installer. This skill stays in charge of design, timing and verification: where theirs say "don't render, open the Studio", ours still requires looking at frames.

## Contents
1. Project setup and structure
2. The mental model
3. Core APIs
4. Sequencing and transitions
5. Media: images, video, audio
6. Fonts
7. Formats and responsive layout
8. Data-driven videos (props, calculateMetadata)
9. Rendering and checking
10. Useful packages
11. Pitfalls

## 1. Setup

Copy the starter: `cp -r <skill>/assets/remotion-starter ./video && cd video && npm install`.
- Add Remotion packages with `npx remotion add <package>` (keeps every `@remotion/*` on the same version; mixed versions break at runtime). Upgrade with `npx remotion upgrade`.
- `npm run studio`: live preview with a timeline (scrubbing is exact because everything derives from the frame).
- `npx remotion render <id> out/<id>.mp4`: final render. `npx remotion still <id> out/f.png --frame=120` for one frame.
- In containers/CI with an installed Chrome: `export REMOTION_BROWSER=/path/to/chrome-headless-shell` (read by `remotion.config.ts`). Otherwise Remotion downloads its own headless browser once.

Structure: `src/index.ts` (registerRoot) → `src/Root.tsx` (Compositions) → `src/compositions/*` (films) → `src/motion/*` (tokens + primitives) → `src/brand.ts` (colors, fonts). Assets in `public/`, referenced with `staticFile("name.png")`.

## 2. Mental model

- `useCurrentFrame()` is the clock. Inside a `<Sequence from={60}>`, the frame starts at 0 again: every scene can be written as if it started at frame 0.
- Values come from `interpolate()` / `spring()` of the frame. No state that changes over time, no effects that animate, no CSS transitions/animations, no timers, no `Math.random()` (use `random("seed")`), no `Date.now()`.
- Think in frames, write in seconds: `s(0.6)` from the starter tokens converts seconds to frames at the project fps.
- Each frame is rendered in a separate tab possibly out of order (`concurrency`). Anything that depends on the previous frame will break.

## 3. Core APIs

```tsx
import { AbsoluteFill, interpolate, spring, Easing, useCurrentFrame, useVideoConfig, Sequence, Series, random } from "remotion";

const frame = useCurrentFrame();
const { fps, width, height, durationInFrames } = useVideoConfig();

// interpolate: ALWAYS clamp unless you want it to keep going
const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
// multi-point: in, hold, out
const o = interpolate(frame, [0, 15, 75, 90], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// scale that feels even: perceptual-scale interpolates in log space (linear scale looks fast at first, slow at the end)
const z = interpolate(frame, [0, 40], [1, 1.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp", output: "perceptual-scale" });
// easing per segment: pass an array, one easing for each pair of keys; posterize: N steps (stop-motion, "on twos" look)
const y = interpolate(frame, [0, 20, 60], [40, 0, -10], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: [Easing.out(Easing.exp), Easing.inOut(Easing.cubic)] });

// spring: returns 0 -> 1 (can overshoot); delay with frame - delay. Easing.spring({ damping: 200 }) gives a spring as an easing for interpolate.
const k = spring({ frame: frame - 10, fps, config: { damping: 200 } });           // smooth
const k2 = spring({ frame, fps, config: { damping: 13, stiffness: 160, mass: 0.6 }, durationInFrames: 20 }); // stretched to 20 frames
const scale = interpolate(k, [0, 1], [0.92, 1]);

// deterministic randomness
const jitter = random(`star-${i}`) * 10;
```

`AbsoluteFill` is a full-frame absolutely positioned flex container (column). Use it for scenes and layers.

## 4. Sequencing and transitions

```tsx
<Sequence from={30} durationInFrames={90} layout="none">…</Sequence>   // layout="none": no AbsoluteFill wrapper
<Series>
  <Series.Sequence durationInFrames={100}><Hook /></Series.Sequence>
  <Series.Sequence durationInFrames={80} offset={-10}><Next /></Series.Sequence> {/* negative offset overlaps */}
</Series>
```

Transitions (`@remotion/transitions`):
```tsx
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";   // direction: "from-left" | "from-right" | "from-top" | "from-bottom"
import { wipe } from "@remotion/transitions/wipe";
<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={90}><A /></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
  <TransitionSeries.Sequence durationInFrames={90}><B /></TransitionSeries.Sequence>
</TransitionSeries>
```
A transition overlaps the two scenes: total length = sum of scenes − sum of transitions. During the overlap both scenes render; with text-heavy scenes prefer `Series` + the starter's `<Scene>` (exit before enter) and keep transitions for image-to-image or full-bleed color changes.

## 5. Media

- Images: `<Img src={staticFile("shot.png")} />` (waits for load before the frame is captured). Not `<img>`.
- Video and audio come from **`@remotion/media`** (`npx remotion add @remotion/media`): `import { Video, Audio } from "@remotion/media"`. `Video`/`Audio` imported from `remotion` are deprecated (renamed `Html5Video`/`Html5Audio`); `<OffthreadVideo>` still works and is what `@remotion/media` falls back to.
  - `<Video src={staticFile("rec.mp4")} from={30} trimBefore={2 * fps} durationInFrames={90} muted />`: `from` places it on the timeline (no wrapping `<Sequence>` needed), `trimBefore` skips source frames, `durationInFrames` says how many play. `trimAfter` is deprecated, and so are `startFrom`/`endAt`.
  - `<Audio src={staticFile("music.mp3")} from={AT} volume={(f) => interpolate(f, [0, 30, d - 45, d], [0, 0.6, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />`; SFX the same way with `from={hitFrame}`.
  - Duration and size of media for `calculateMetadata`: `getAudioDurationInSeconds(src)` and `getVideoMetadata(src)` from `@remotion/media-utils`, so a film can be exactly as long as its voice-over (`durationInFrames: Math.ceil(sec * fps) + tail`).
- Audio data: `useAudioData(src)` from `@remotion/media-utils` decodes the whole file once (fine for voice-overs and clips up to a few minutes; the starter's `VoiceBars` uses it). For long files use `useWindowedAudioData({ src, frame, fps, windowInSeconds })` with `visualizeAudio`/`visualizeAudioWaveform`.
- Remote URLs work but make renders depend on the network; download into `public/` for final renders.
- Screen recordings for product demos: record at the final aspect's needs (e.g. 1920×1080 for 16:9; for 9:16 plan a camera path), 30 fps, no cursor if you will add the `<Cursor>` primitive; trim page loads away.

## 6. Fonts

Text must never render in a fallback font. Options:
- Local files (best for final renders): `.woff2` in `public/fonts`, loaded with `loadFont({ family, url: staticFile(...), weight })` from **`@remotion/fonts`**, which holds the render until the file is ready (wired in the starter's `src/fonts.ts`).
- `@remotion/google-fonts/<Family>`: `const { fontFamily, waitUntilDone } = loadFont("normal", { weights: ["400", "800"], subsets: ["latin"] })`. The quickest way and the one Remotion recommends; it needs network at render time.
- Measuring text (`measureText`, `fitText` from `@remotion/layout-utils`) is only correct after the font has loaded: await `waitUntilDone()` (Google Fonts) or the `loadFont` promise first, or the sizes are computed for the fallback font.
- Variable fonts: set `fontVariationSettings` or `fontStretch`/`fontWeight` as numbers; animating weight is possible but costly; keep it to headlines.

## 7. Formats and responsive layout

Write one component and register several compositions (1920×1080, 1080×1920, 1080×1080, 1080×1350). Use `useLayout()` from the starter: `u` (scale unit), `portrait`/`square`, `pad`, and `safe` (platform safe areas for 9:16). Size everything in `u`. Re-check composition per format: portrait usually needs stacked layouts, bigger text, a different camera path and shorter lines.

## 8. Data-driven videos

```tsx
<Composition id="stat" component={Stat} defaultProps={{ value: 68, label: "…" }} durationInFrames={240} fps={30} width={1080} height={1920}
  calculateMetadata={({ props }) => ({ durationInFrames: 60 + props.items.length * 45 })} />
```
Render with props: `npx remotion render stat out/stat.mp4 --props='{"value":72}'` or `--props=./data.json`. For batches, use `@remotion/renderer` (`bundle` once, `selectComposition`, `renderMedia` per item).

## 9. Rendering and checking

- `npx remotion render <id> out.mp4 --codec h264 --crf 18` (starter config sets h264/crf 18/yuv420p).
- Transparent video (overlays, B-roll panels for an editor): `--image-format=png --codec prores --prores-profile 4444 --pixel-format yuva444p10le`, or VP9 WebM with `--image-format=png --pixel-format yuva420p`. Without `--image-format=png` the frames are captured as JPEG and the alpha channel is lost.
- Several stills in one go: `npx remotion render <id> out/frames --sequence --frames=0-90 --image-format=png`, or `frames.mjs --remotion` for a contact sheet.
- GIF: `--codec gif --every-nth-frame 2` (keep short).
- Speed: `--concurrency` (default half the cores). Heavy blur, large shadows, `backdrop-filter` and many SVG filters slow renders; prefer pre-blurred images.
- Check: `node <skill>/scripts/frames.mjs --remotion . <id> --every 15` (stills only, fast), then the full render with `frames.mjs out.mp4 --every 0.5`.

## 10. Useful packages (same version as `remotion`)

- `@remotion/transitions`: presentations importable from `@remotion/transitions/<name>`: fade, slide, wipe, flip, clock-wipe (`clockWipe`), iris, push-cut, blur-slide, linear-blur, zoom-blur, dissolve, zoom-in-out, cross-zoom, dreamy-zoom, book-flip, swap, none, plus custom presentations. Use the quiet ones (fade, slide, push-cut, blur-slide, linear-blur) for premium work; film-burn/ripple/crosswarp/dreamy-zoom are effects, use them only on purpose. `<TransitionSeries.Overlay>` plays something over a cut (a flash, a light leak, a logo sting) without overlapping the scenes, so it does not shorten the film.
- `@remotion/paths`: `evolvePath(progress, d)` for line drawing; `getLength`, `interpolatePath` for morphing.
- `@remotion/shapes`: Rect, Circle, Triangle, Star… as SVG with exact sizes.
- `@remotion/layout-utils`: `fitText({ text, withinWidth, fontFamily, fontWeight })` and `measureText` to size headlines to a box.
- `@remotion/captions`: `createTikTokStyleCaptions` to group word timestamps into caption pages, `parseSrt`/`serializeSrt` for sidecar files (starter: `Captions`; timings from `scripts/captions.mjs`).
- `@remotion/media-utils`: `useAudioData` + `visualizeAudio` for audio-reactive bars/waves.
- `@remotion/noise`: `noise2D/3D` for organic, deterministic drift.
- `@remotion/motion-blur`: `<CameraMotionBlur>` / `<Trail>` (render cost ×samples), and the newer experimental `<HtmlInCanvasMotionBlur width height shutterAngle samples>` (averages sub-frame snapshots; Studio preview needs a Chrome flag). Blur only fast moves (a 180° shutter look); text that is read must stay sharp.
- `@remotion/effects`: shader effects (light leaks, gradients, patterns, LUT-like colour work, corner pin…) applied with `effects={[…]}` on images, video and solids. WebGL effects render with `--gl=angle`. Prefer one subtle effect over a stack.
- `@remotion/lottie`, `@remotion/three` (`<ThreeCanvas width height>`; never use three's `useFrame()`, derive everything from `useCurrentFrame()`; `layout="none"` on Sequences inside), `@remotion/gif`, `@remotion/player` (embed in a web app).

## 11. Pitfalls

- Forgetting `extrapolateRight: "clamp"` → values keep growing after the animation (opacity > 1 is harmless, transforms are not).
- `spring()` without a delay subtracted → everything springs at frame 0.
- Hooks inside loops/conditions; components that read `useCurrentFrame()` outside a Sequence get the global frame.
- Text shifting during counting → use `fontVariantNumeric: "tabular-nums"`.
- Fonts loading late → fallback font frames; always `delayRender` until fonts are loaded.
- Using `<img>`/`<video>` → blank or wrong frames; use `<Img>` and `<Video>` from `@remotion/media`.
- Tailwind in Remotion: never use `animate-*` or `transition-*` classes; they run on the wall clock, not on frames.
- Huge PNG sequences or 4K screenshots → memory; downscale assets to 2× the displayed size.
- Duration math with `TransitionSeries`: remember transitions shorten the total.
- 9:16 built by cropping 16:9 → text off-screen; design the portrait layout explicitly.
- Headlines that wrap differently per format leave a single word on the last line. Set `textWrap: "balance"` (Chromium renders it) and use one block element per line group: balance does not work across a `<br>`.
- Piping a render command into `head` closes the pipe early and kills the render; redirect to a file or use `tail`.
- A camera whose content is bigger than its window needs the window size (`width`/`height`) and the content size; framing by percentages of the content alone shows the wrong region.
