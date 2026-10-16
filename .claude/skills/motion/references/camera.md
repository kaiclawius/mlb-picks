# Camera language for motion design

The camera decides what the viewer looks at and how the piece feels. In motion design it is a virtual camera (scale and translate on a container, `Camera`/`ScreenShot` in the starter, or real 3D with `@remotion/three`). Treat it like a real one: it has weight, a reason for every move, and it is quiet most of the time.

## Contents
1. Energy dial (decide first)
2. Shot sizes
3. Moves and when to use them
4. Rules with numbers
5. Cuts and continuity
6. Camera and music

## 1. Energy dial

Pick one level per film, from the brand and the platform, and write it in the brief. It decides which moves are allowed.

| Level | Feel | Allowed | Typical use |
|---|---|---|---|
| 1 Locked | still, editorial | no moves; cuts only; ≤ 0.5 % creep on holds | luxury, finance, serious B2B |
| 2 Calm | premium product film | slow push-ins (2–5 % per scene), gentle pans to the region that matters | Apple/Stripe/Anthropic-style launches |
| 3 Guided | demo with a narrator | push to detail (zoom 1.3–1.7), pan between UI areas, match cuts | product demos, explainers |
| 4 Lively | social, energetic | faster pushes, punch-ins on beats, whip pans between scenes | TikTok/Reels, launches with music |
| 5 Kinetic | showreel | continuous movement, shake on hits, speed ramps | sizzle reels, event openers |

Above level 3 every move still needs a cause; energy is not randomness.

## 2. Shot sizes (for UI and objects)

- **Wide**: the whole product or window; orientation. Open with it so viewers recognise the thing.
- **Medium**: one area (a panel, a card); where the story happens.
- **Close**: one control, one number, one line of text; the payoff. At least one close-up per film; text must be readable at phone size (key items ≥ 100 px on a 1080-wide frame).
- Progress wide → medium → close as the story narrows; go back to wide to reset before the next topic.

## 3. Moves

| Move | What it does | Use for | Numbers |
|---|---|---|---|
| Push-in (dolly/zoom in) | builds attention | "look at this" | 0.8–1.2 s for a reframing; slow creep 2–5 % over a whole scene |
| Pull-out | reveals context, ends a thought | from detail back to the product, end of a chapter | same as push |
| Pan / truck | moves attention sideways | from one UI area to the next, following a cursor | 0.7–1.2 s, `EASE.move` |
| Tilt / pedestal | vertical version | long pages, lists | |
| Rotation (2.5D) | depth, premium feel | hero product shots | ≤ 6° yaw, ≤ 5° pitch; rotation alone gives no parallax, combine with translation |
| Rack focus | shifts focus between layers | foreground label → background UI | blur 0 ↔ 4–8 px over 12–20 frames |
| Whip pan | energetic scene change | level 4–5 transitions | 6–10 frames, motion blur, land with slight overshoot |
| Punch-in | instant emphasis | beat hits, key words | +3–6 % scale in 2–4 frames, ease back over 10–20 |
| Dolly-zoom | unease, "everything changes" | once per film at most | keep subject size constant: scale × distance compensation |

## 4. Rules

- **Cause before move.** The thing that motivates a move (a click, a word, a beat) happens first; the camera reacts 6–14 frames later, like an operator who noticed it. A camera that moves before anything happened feels random.
- **Hold after arriving.** ≥ 1 s on what the camera moved to before the next move or the scene exit (the most common failure in first renders).
- **Ease in-out, end soft.** Moves start and stop gently; after a move, let a tiny drift continue (0.2–0.5 %) instead of a dead stop.
- **Zoom in log space.** Interpolate scale perceptually (`interpolate(..., { output: "perceptual-scale" })` in Remotion), otherwise zooms feel fast at the start and slow at the end.
- **No zoom ping-pong.** Never zoom in and straight back out; if you must return, cut or pan instead.
- **One mover.** When elements animate, the camera holds or slows (drift dips while UI animates, returns 1 s later). Never move camera and content in opposite directions at once.
- **Keep the hero in the middle half** of the frame during moves; the frame edge is not a destination.
- **Text being read does not move.** Push-ins finish before the viewer starts reading; captions sit outside the camera layer.
- **Motion blur only at speed.** Blur fast moves (whips, punch-ins) with a 180° shutter look; slow moves stay sharp. No `will-change` on layers the camera scales up (blurry text in Chrome).
- **Respect the safe area**: in 9:16 plan the camera path so the action stays above the bottom 20 %.

## 5. Cuts and continuity

- **Match the direction.** If the outgoing shot moves right, the incoming one starts already moving right at a similar speed (within ~10 %): the cut becomes invisible.
- **Match shapes.** End on a card, circle or window; start the next shot from the same shape in the same place.
- **No empty frames between scenes.** The next scene has something on screen within 2 frames of the cut; "exit → empty background → entrance" reads as a gap (the starter's `Scene` exit is short so the next build starts immediately).
- **J- and L-cuts with sound**: the next scene's audio starts 4–12 frames before its picture (J), or the old audio trails 12–24 frames into the new picture (L). Smooths cuts in narrated films.
- **Shorter shots toward the climax**, longer at the start and the end.

## 6. Camera and music

- Cut on bar lines or strong beats, animate on the off-beats in between; punch-ins on kicks only at energy 4–5.
- A reveal may move up to ±0.15 s to land on a musical accent; never more (it starts to feel late to the picture).
- Before a drop: a half-beat of stillness or pull-back, then the hit. Use `scripts/beats.mjs` for the grid and check the render with `qa-video.mjs --beats`.
