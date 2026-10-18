// Grok Dog tells his lore: a cut-out puppet film (JibJab / talking-animal meme style) made from the one photo.
// The photo is cut into parts (capture: public/grokdog/rig/rig.json): head, jaw, ball, paws. The jaw flaps
// when he talks (Animal Crossing style babble, one blip per syllable), his own eyes blink, his head tilts, and in
// the flashback he builds the costume: a ball rolls in, tape slaps on, two white stripes, he jumps in.
// One continuous scene graph driven by the frame; the timeline lives in lore.json (the audio script reads it too).
import React from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useFonts } from "../ProductVideo";
import L from "./lore.json";
import RIG from "../../public/grokdog/rig/rig.json";

export const LORE_FPS = 60;
export const LORE_FRAMES = L.scenes.total;
const C = { ball: "#0e0e0d", tape: "#f4f0e6", gold: "#e0a45e", rug: "#b9482f", ink: "#0e0e0d" };
const FAT = "'Bagel Fat One', sans-serif", MARKER = "'Permanent Marker', cursive";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.bezier(0.16, 1, 0.3, 1), inOut = Easing.bezier(0.65, 0, 0.35, 1), easeIn = Easing.bezier(0.55, 0, 0.8, 0.2);
const k = (f: number, a: number, b: number, e = out) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
const pop = (f: number, at: number, damping = 10) => (f < at ? 0 : spring({ frame: f - at, fps: LORE_FPS, config: { damping, stiffness: 200, mass: 0.7 } }));
const TORN = "polygon(1% 8%,6% 0,14% 6%,22% 1%,31% 5%,40% 0,52% 4%,63% 0,74% 5%,85% 1%,94% 6%,100% 2%,99% 92%,93% 100%,83% 95%,71% 100%,60% 96%,48% 100%,37% 95%,26% 100%,15% 96%,5% 100%,0 94%)";
const S = L.scenes;

/* ---------- rig geometry (photo pixels; the rig box starts at RX, RY) ---------- */
const RX = 270, RY = 520, RW = 830, RH = 1100;
const box = (b: number[]) => ({ left: b[0] - RX, top: b[1] - RY, width: b[2], height: b[3] });
const HEAD = RIG.head, JAW = RIG.jaw;
const COSTUME_EYES = [[750, 922, 96, 225], [903, 890, 90, 198]]; // the white tape on the ball
const BALL_BOX = [285, 685, 799, 777];

/** Speech: which line is on, how much is typed, and how open the jaw is (one flap per syllable). */
function speech(f: number) {
  let cur: { text: string; at: number } | null = null;
  for (const l of L.lines) if (f >= l.at) cur = l;
  if (!cur) return { text: "", typed: 0, jaw: 0, show: 0 };
  const len = cur.text.length, n = Math.min(len, Math.floor((f - cur.at) / L.cps)), talking = n < len;
  const ch = cur.text[Math.max(0, n - 1)] || " ", syll = ((f - cur.at) % 6) / 6;
  const jaw = talking && /[a-z0-9]/i.test(ch) ? Math.sin(Math.PI * syll) : 0;
  const next = L.lines.find((l) => l.at > cur!.at), end = Math.min(next ? next.at - 4 : 1e9, cur.at + len * L.cps + 70);
  const show = f < end ? 1 : 1 - k(f, end, end + 10);
  return { text: cur.text, typed: n, jaw, show };
}
const blinkAt = (f: number, list: number[]) => { let s = 0; for (const b of list) { const d = Math.abs(f - b); if (d < 6) s = Math.max(s, 1 - d / 6); } return s; };

/** The puppet. Everything is in rig pixels and scaled as one. */
function Rig({ f, ballPhoto, tapes, stripes, head, paws, squash, ballX = 0, ballRot = 0, costumeBlink = 0 }: {
  f: number; ballPhoto: number; tapes: number[]; stripes: number[]; paws: number[]; squash: number; ballX?: number; ballRot?: number; costumeBlink?: number;
  head: { x: number; y: number; rot: number; jaw: number; blink: number; show: number };
}) {
  const b = box(BALL_BOX), sy = 1 - 0.14 * squash, sx = 1 + 0.08 * squash;
  return (
    <div style={{ position: "absolute", width: RW, height: RH }}>
      {/* the rug */}
      <div style={{ position: "absolute", left: -60, top: 830, width: RW + 120, height: 300, borderRadius: "50%", backgroundImage: `url(${staticFile("grokdog/rig/rug.jpg")})`, backgroundSize: "240px 240px",
        WebkitMaskImage: "radial-gradient(closest-side, #000 55%, transparent 100%)", maskImage: "radial-gradient(closest-side, #000 55%, transparent 100%)", opacity: 0.85 }} />
      <div style={{ position: "absolute", left: b.left + 60 + ballX, top: 1120, width: b.width - 120, height: 70, borderRadius: "50%", background: "rgba(0,0,0,.55)", filter: "blur(14px)" }} />
      {/* paws peek out under the ball */}
      <Img src={staticFile("grokdog/rig/paws.png")} style={{ position: "absolute", ...box(RIG.paws), transform: `translateY(${(1 - Math.max(...paws)) * -60}px) scale(${0.2 + 0.8 * Math.min(...paws.map((p) => Math.max(p, 0.001)))})`, transformOrigin: "50% 0%", opacity: Math.max(...paws) > 0.02 ? 1 : 0 }} />
      {/* the ball: drawn (plain exercise ball) or the photo's taped one */}
      <div style={{ position: "absolute", ...b, transform: `translateX(${ballX}px) scale(${sx}, ${sy})`, transformOrigin: "50% 100%" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", transform: `rotate(${ballRot}rad)`,
          background: "radial-gradient(circle at 34% 28%, #5a5a57 0, #222220 18%, #0b0b0b 58%, #050505 100%)" }}>
          <div style={{ position: "absolute", left: "18%", top: "12%", width: "26%", height: "14%", borderRadius: "50%", background: "rgba(255,255,255,.22)", filter: "blur(10px)", transform: "rotate(-30deg)" }} />
          {tapes.map((t, i) => t > 0 && (
            <div key={i} style={{ position: "absolute", left: "-10%", top: `${14 + i * 19}%`, width: "120%", height: "15%", background: "linear-gradient(180deg,#2b2b29,#151514 60%,#232321)",
              boxShadow: "0 2px 0 rgba(255,255,255,.08) inset", transform: `rotate(${[-14, 9, -6, 12][i]}deg) scale(${1.25 - 0.25 * t})`, opacity: Math.min(1, t * 2) }} />
          ))}
        </div>
        <Img src={staticFile("grokdog/rig/ball.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: ballPhoto }} />
        {/* the white stripes, slapped on */}
        {COSTUME_EYES.map((e, i) => { const s = stripes[i], open = 1 - costumeBlink;
          return s > 0 && <div key={i} style={{ position: "absolute", left: e[0] - BALL_BOX[0], top: e[1] - BALL_BOX[1], width: e[2], height: e[3], borderRadius: 999, background: C.tape,
            boxShadow: "inset -4px -6px 0 rgba(0,0,0,.1)", transform: `rotate(-12deg) scale(${(1.6 - 0.6 * s)}, ${(1.6 - 0.6 * s) * Math.max(0.08, open)})`, opacity: Math.min(1, s * 3) }} />; })}
      </div>
      {/* the head: mouth behind, head, eyelids, jaw on top */}
      <div style={{ position: "absolute", ...box(HEAD), opacity: head.show, transform: `translate(${head.x}px, ${head.y}px) rotate(${head.rot}deg)`, transformOrigin: "50% 92%" }}>
        <div style={{ position: "absolute", left: JAW[0] - HEAD[0] + 14, top: JAW[1] - HEAD[1] - 6, width: JAW[2] - 28, height: JAW[3] + 6, borderRadius: "40% 40% 50% 50%", background: "radial-gradient(#5a1d18, #200807)" }} />
        <Img src={staticFile("grokdog/rig/head.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        {(["l", "r"] as const).map((s) => { const e = RIG.eyes_dog[s];
          return <div key={s} style={{ position: "absolute", left: e[0] - HEAD[0] - 3, top: e[1] - HEAD[1] - 4, width: e[2] + 6, height: e[3] + 8, borderRadius: "50%",
            background: "radial-gradient(circle at 50% 30%, #c99257, #9a6633)", transform: `scaleY(${head.blink})`, transformOrigin: "50% 0%" }} />; })}
        <Img src={staticFile("grokdog/rig/jaw.png")} style={{ position: "absolute", left: JAW[0] - HEAD[0], top: JAW[1] - HEAD[1], width: JAW[2], height: JAW[3],
          transform: `translateY(${head.jaw * 16}px) rotate(${head.jaw * 7}deg)`, transformOrigin: "50% 0%" }} />
      </div>
    </div>
  );
}

function Tape({ text, scale = 1, size, rot = -2, bg = C.tape, color = C.ink }: { text: string; scale?: number; size: number; rot?: number; bg?: string; color?: string }) {
  return <div style={{ display: "inline-block", fontFamily: MARKER, fontSize: size, lineHeight: 1.12, color, background: bg, padding: `${size * 0.2}px ${size * 0.55}px ${size * 0.14}px`, clipPath: TORN, transform: `rotate(${rot}deg) scale(${scale})`, whiteSpace: "pre-wrap", textAlign: "center", maxWidth: "88%" }}>{text}</div>;
}

export function GrokDogLore() {
  useFonts("grokdog/fonts/fonts.css");
  const f = useCurrentFrame(), { width: W, height: H, durationInFrames } = useVideoConfig(), u = W / 1080, tall = H / W > 1.5;
  const flash = f >= S.day1 && f < S.now; // the flashback: days 1 to 3
  const sp = speech(f);

  /* ---------- the puppet's state, scene by scene ---------- */
  const idle = Math.sin(f * 0.07), talkTilt = sp.jaw ? Math.sin(f * 0.18) * 3 : 0;
  let ballPhoto = 1, tapes = [0, 0, 0, 0], stripes = [1, 1], paws = [1, 1], squash = 0, ballX = 0, ballRot = 0;
  let head = { x: 0, y: idle * 4, rot: idle * 2 + talkTilt, jaw: sp.jaw, blink: blinkAt(f, [70, 190, 1070, 1230]), show: 1 };
  let costumeBlink = blinkAt(f, [112, 1150, 1260]);
  if (flash) {
    ballPhoto = 0; stripes = [0, 0]; paws = [0, 0];
    const peekL = { x: -460, y: 420 }, peekR = { x: 470, y: 420 };
    if (f < S.day2) {
      // day 1: the ball rolls in, he peeks from the bottom left and tilts his head at it
      const roll = k(f, S.day1 + 20, S.day1 + 85, out), x0 = 1100; ballX = x0 * (1 - roll); ballRot = -ballX / 390; squash = f > S.day1 + 85 ? Math.exp(-(f - S.day1 - 85) / 7) * Math.cos((f - S.day1 - 85) * 0.5) * 0.8 : 0;
      const rise = k(f, S.day1 + 50, S.day1 + 92, out);
      head = { ...head, x: peekL.x, y: peekL.y + (1 - rise) * 500, rot: 6 + interpolate(f, [S.day1 + 100, S.day1 + 118, S.day1 + 150, S.day1 + 168, 440, 455], [0, 14, 14, -10, -10, 22], { ...clamp, easing: inOut }), blink: blinkAt(f, [S.day1 + 100, 420]) };
    } else if (f < S.day3) {
      // day 2: tape strips slap on, the photo's taped ball fades in, then two white stripes
      tapes = L.tapes.map((t) => pop(f, t, 11)); ballPhoto = k(f, 610, 640, inOut); stripes = L.stripes.map((t) => pop(f, t, 9));
      squash = L.tapes.concat(L.stripes).reduce((s, t) => Math.max(s, f >= t ? Math.exp(-(f - t) / 5) * 0.35 : 0), 0);
      head = { ...head, x: peekR.x, y: peekR.y, rot: -8 + Math.sin(f * 0.05) * 4, blink: blinkAt(f, [560, 700]) };
    } else {
      // day 3: he jumps up and drops into the ball, the ball squashes, his paws pop out
      ballPhoto = 1; tapes = [1, 1, 1, 1]; stripes = [1, 1];
      const up = k(f, S.day3 + 25, L.headDrop - 22, out), down = k(f, L.headDrop - 22, L.headDrop, easeIn);
      const hx = peekR.x * (1 - up), hy = peekR.y + (-380 - peekR.y) * up + 380 * down;
      head = { ...head, x: f < L.headDrop ? hx : 0, y: f < L.headDrop ? hy : 0, rot: f < L.headDrop ? -20 * up * (1 - down) : head.rot, blink: blinkAt(f, [920]) };
      squash = f >= L.headDrop ? Math.exp(-(f - L.headDrop) / 8) * Math.cos((f - L.headDrop) * 0.45) : 0;
      paws = L.paws.map((t) => pop(f, t, 8)); costumeBlink = blinkAt(f, [905, 985]);
    }
  }

  /* ---------- camera, transitions, look ---------- */
  const s = Math.min((W * 0.92) / RW, (H * (tall ? 0.56 : 0.6)) / RH);
  const push = 1 + 0.06 * k(f, 0, S.day1, inOut) * (f < S.day1 ? 1 : 0) + 0.05 * k(f, S.now, S.total, inOut) * (f >= S.now ? 1 : 0);
  const wob = [S.day1, S.now].reduce((a, t) => Math.max(a, Math.max(0, 1 - Math.abs(f - t) / 16)), 0); // dream wobble at the flashback edges
  const wipeAt = [S.day2, S.day3].find((t) => Math.abs(f - t) <= 11), wipe = wipeAt !== undefined ? (f - wipeAt + 11) / 22 : -1;
  const grain = Math.floor(f / 2) % 7;
  // a stamp stays until the next one, the day-3 stamp until the title takes its place
  const stamp = [...L.stamps].reverse().find((st) => f >= st.at && f < Math.min(st.at + 240, st.text === "DAY 3" ? L.headDrop - 50 : 1e9) && flash);
  const st = stamp ? pop(f, stamp.at, 9) : 0;
  const titleOn = flash && f >= L.title[0];
  return (
    <AbsoluteFill style={{ background: C.ball, overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: `${flash ? "sepia(.55) saturate(.85) contrast(1.06)" : "none"} ${wob ? `blur(${wob * 6}px)` : ""}`.trim() || undefined,
        transform: `scale(${push}) skewX(${Math.sin(f * 0.9) * wob * 8}deg) scaleY(${1 + Math.sin(f * 0.7) * wob * 0.06})` }}>
        <AbsoluteFill style={{ background: `radial-gradient(70% 45% at 75% 0%, #2a2a27 0, transparent 70%), radial-gradient(60% 40% at 0% 70%, #222220 0, transparent 70%), ${C.ball}` }} />
        <div style={{ position: "absolute", left: W / 2 - (RW * s) / 2, top: H * (tall ? 0.5 : 0.55) - (RH * s) / 2, width: RW, height: RH, transform: `scale(${s})`, transformOrigin: "0 0" }}>
          <Rig f={f} ballPhoto={ballPhoto} tapes={tapes} stripes={stripes} head={head} paws={paws} squash={squash} ballX={ballX} ballRot={ballRot} costumeBlink={costumeBlink} />
        </div>
      </AbsoluteFill>
      {/* flashback film look: vignette and grain */}
      {flash && <AbsoluteFill style={{ background: "radial-gradient(closest-side, transparent 55%, rgba(30,18,6,.55) 100%)", mixBlendMode: "multiply" }} />}
      {flash && <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.16, mixBlendMode: "overlay" }}><filter id={`g${grain}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={grain} /></filter><rect width="100%" height="100%" filter={`url(#g${grain})`} /></svg>}
      {/* the day stamp */}
      {stamp && (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: H * (tall ? 0.1 : 0.05) }}>
          <div style={{ fontFamily: FAT, fontSize: 120 * u, color: C.rug, border: `${10 * u}px solid ${C.rug}`, borderRadius: 18 * u, padding: `${6 * u}px ${34 * u}px 0`, lineHeight: 1.05, background: "rgba(244,240,230,.92)",
            transform: `rotate(${-8 + (1 - st) * 10}deg) scale(${2.2 - 1.2 * st})`, opacity: Math.min(1, st * 3) }}>{stamp.text}</div>
        </AbsoluteFill>
      )}
      {titleOn && (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: H * (tall ? 0.1 : 0.05) }}>
          <div style={{ fontFamily: FAT, fontSize: 150 * u, lineHeight: 0.9, whiteSpace: "nowrap" }}>
            <span style={{ display: "inline-block", color: C.tape, transform: `scale(${pop(f, L.title[0], 8)})` }}>GROK </span>
            <span style={{ display: "inline-block", color: C.gold, transform: `scale(${pop(f, L.title[1], 8)})` }}>DOG</span>
          </div>
        </AbsoluteFill>
      )}
      {/* a giant strip of tape wipes between the days */}
      {wipe >= 0 && <div style={{ position: "absolute", left: -W * 0.5, top: H * 0.5 - H * 0.42, width: W * 2, height: H * 0.84, background: C.tape, clipPath: TORN,
        transform: `translateX(${interpolate(wipe, [0, 1], [-W * 2.1, W * 2.1], { easing: inOut })}px) rotate(-14deg)` }} />}
      {/* subtitles: what he says, typed as he babbles */}
      {sp.typed > 0 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: H * (tall ? 0.17 : 0.06), opacity: sp.show }}>
          <Tape text={sp.text.slice(0, sp.typed)} size={(tall ? 62 : 56) * u} rot={-1.5} />
        </AbsoluteFill>
      )}
      {/* the end: coin and call */}
      {f >= L.end.coin && (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: H * (tall ? 0.07 : 0.03), gap: 10 * u }}>
          <Tape text="$GROKDOG" size={(tall ? 84 : 70) * u} rot={-4} bg={C.gold} scale={1.35 - 0.35 * pop(f, L.end.coin, 9)} />
          {f >= L.end.be && <Tape text="be grok." size={(tall ? 58 : 48) * u} rot={3} scale={1.35 - 0.35 * pop(f, L.end.be, 9)} />}
        </AbsoluteFill>
      )}
      <Audio src={staticFile("grokdog/lore-audio.m4a")} volume={(fr) => interpolate(fr, [durationInFrames - 30, durationInFrames], [1, 0], clamp)} />
    </AbsoluteFill>
  );
}
