# Sound for motion design

Sound sells motion: the same animation feels twice as expensive with a soft whoosh and a click in the right frame. This file covers voice-over timing, sound effects made in code, music and beats, mixing and the checks before delivery. Sound always gets designed in, never sprinkled on at the end.

## Contents
1. One timeline for picture and sound
2. Voice-over first
3. Sound effects in code (`scripts/sfx.mjs`)
4. Music and beats (`scripts/beats.mjs`)
5. Mix and master
6. Checks and honesty

## 1. One timeline

Keep every moment that matters in one place (a `BEATS`/`CUES` object in the composition or a `timeline.json`): scene starts, reveals, clicks, the hero hit. Components read their frames from it and the cue sheet for sound is generated from it. Then a retime moves picture and sound together, and nothing is a hardcoded number in two places.

```ts
// src/timeline.ts
export const T = { hook: 0, click: 2.4, reveal: 4.1, hero: 8.0, end: 13.5 }; // seconds
export const f = (sec: number) => Math.round(sec * FPS);
// cues.json for sfx.mjs is written from T: [{ t: T.click, type: "click" }, { t: T.hero, type: "impact" }, ...]
```

## 2. Voice-over first

When there is narration, the voice sets the clock and the picture follows it:
- Make or record the voice first (Stimme in this repo, a recording, or a scratch system voice for timing until the real one exists). Film length = voice + 0.2–0.5 s tail + the end card.
- Get word times with `scripts/captions.mjs --script "…"`.
- Cue each visual on the **meaning word** (usually the verb or the number), not the first word of the sentence. A visual may lead its word by up to ~0.5 s (the eye is faster than the ear), never trail it by more than ~0.2 s.
- Text that must be read appears 1–2 frames before it is spoken; a sound hit lands exactly on the word.
- Put the payoff (the reveal, the hit) in a short pause of the voice, not under a word: speech masks it. Leave 0.5–1 s of breath before the key line.
- Music under voice: −18 to −24 dB below the voice, or ducked 8–12 dB while someone speaks.

## 3. Sound effects in code

`scripts/sfx.mjs` makes licence-free, deterministic sounds (no samples, no network): `click`, `tick`, `key`, `pop`, `blip`, `whoosh`, `riser`, `impact`, `chime`, `success`, `pad`.
```sh
node <skill>/scripts/sfx.mjs --kit public/sfx/                 # every sound once, to pick from
node <skill>/scripts/sfx.mjs --cues cues.json --length 16.8 public/sfx.wav   # a whole track from a cue sheet
```
In the cue sheet `t` is the moment the viewer should feel it. The script puts each sound's own peak there: a whoosh peaks on `t` (so it starts early), a riser **ends** on `t`, clicks and pops start on `t`. Use the track as one `<Audio src={staticFile("sfx.wav")} />`.

Rules that keep it tasteful:
- **Hierarchy by gain**: one hero hit per film (impact/success, −4 to −8 dB), supporting sounds −12 to −18 dB (whoosh, pop, chime), texture −18 to −24 dB (ticks, keys, pad). The defaults in the script follow this.
- **One riser and one big impact per film.** Repeated, they lose all meaning.
- **Pan follows position**: an element on the left sounds slightly left (−0.3 to −0.5); whooshes travel with the motion.
- **Typing**: one `key` per visible character, with small timing jitter (±15 ms) and varied seeds so it does not machine-gun.
- **Pitch tells progress**: successive pops/chimes can step up a scale (e.g. 880 → 988 → 1109 Hz) as a list builds.
- **No sound for things that do not move** and nothing on every element: sound the 3–6 moments that matter.
- A quiet `pad` bed (−24 dB, a few seconds of fade in/out) makes silent product films feel finished when no licensed music exists.

## 4. Music and beats

- Use licensed music only; if there is none, use the pad bed or deliver without music and say so.
- `node <skill>/scripts/beats.mjs music.mp3 --fps 30` writes `beats.json`: BPM, beats, bar downbeats (`beatFrames` too), energy per bar and the drop. Phase is taken from the kick band, because the full band locks onto hi-hats and puts cuts half a beat late.
- `mode: "beat_cut"` → cut on downbeats/strong beats, animate on the off-beats. `mode: "phrase_flow"` (ambient, rubato, low confidence) → do not invent a grid; pace by phrases and energy changes.
- Snap reveals to a beat only within ±0.15 s; never stretch the story to fit the grid.
- Shorter shots toward the drop, a half-beat of stillness before it, the hero moment on it. Place the drop ~40 % into a short clip so there is build-up and payoff.
- After rendering, `qa-video.mjs --beats beats.json` reports each cut's offset to the nearest beat (target: within one frame).

## 5. Mix and master

- Order of importance: **voice > SFX > music**. If the voice is hard to understand, everything else is too loud.
- Fade music in over ~1 s and out over 1.5–2 s; never cut it hard at the end.
- Master the finished video with `scripts/loudnorm.mjs`: −14 LUFS for social/web, −16 for voice-led pieces, true peak ≤ −1 dBTP (−2 if the platform re-encodes heavily). Measure on the exported MP4, not on the stems.
- Check mono: phone speakers are often mono; `qa-video.mjs` warns when the downmix loses more than normal (phase problems from wide stereo effects).

## 6. Checks and honesty

- `qa-video.mjs` measures loudness, true peak and mono, and lists the 5 moments with the strongest change: listen to those.
- You cannot hear. Never claim a mix "sounds good"; say what was measured (LUFS, peak, cue times) and name the timestamps a human should check by ear.
