// Grok Dog ($GROKDOG) ad: 19 s, 60 fps, cut on a 120 BPM grid (one beat = 30 frames).
// A golden retriever in a homemade black-ball costume. The costume's two white tape eyes are the running gag:
// they blink and look around in every scene. Duct-tape meme style like the site (coins/grok-dog).
// Everything is a pure function of the frame; the sticker rain is simulated once per frame size, deterministically.
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useFonts } from "../ProductVideo";

export const AD_FPS = 60;
const B = 30; // frames per beat
// the timeline: every scene starts on a beat
export const T = { open: 0, photo: 4 * B, title: 10 * B, chat: 18 * B, rain: 26 * B, end: 32 * B, total: 38 * B };
const PUSH = 18; // frames of the push between scenes

const C = { ball: "#0e0e0d", tape: "#f4f0e6", gold: "#e0a45e", rug: "#b9482f", ink: "#0e0e0d" };
const FAT = "'Bagel Fat One', sans-serif", MARKER = "'Permanent Marker', cursive";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.bezier(0.16, 1, 0.3, 1), inOut = Easing.bezier(0.65, 0, 0.35, 1), easeIn = Easing.bezier(0.5, 0, 0.75, 0);
const k = (f: number, a: number, b: number, e = out) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
const useU = () => { const { width, height } = useVideoConfig(); return { W: width, H: height, u: width / 1080, tall: height / width > 1.5 }; };
const pop = (f: number, at: number, fps = AD_FPS, damping = 10) => (f < at ? 0 : spring({ frame: f - at, fps, config: { damping, stiffness: 190, mass: 0.7 } }));
const TORN = "polygon(1% 8%,6% 0,14% 6%,22% 1%,31% 5%,40% 0,52% 4%,63% 0,74% 5%,85% 1%,94% 6%,100% 2%,99% 92%,93% 100%,83% 95%,71% 100%,60% 96%,48% 100%,37% 95%,26% 100%,15% 96%,5% 100%,0 94%)";

/** A strip of tape slapped on: it lands a little too big and too rotated, then settles. */
function Tape({ text, at, rot = -3, size = 64, bg = C.tape, color = C.ink, style }: { text: string; at: number; rot?: number; size?: number; bg?: string; color?: string; style?: React.CSSProperties }) {
  const f = useCurrentFrame(), { u } = useU(), s = pop(f, at, AD_FPS, 9);
  if (f < at) return null;
  return (
    <div style={{ display: "inline-block", fontFamily: MARKER, fontSize: size * u, lineHeight: 1.1, color, background: bg, padding: `${0.2 * size * u}px ${0.55 * size * u}px ${0.14 * size * u}px`,
      clipPath: TORN, transform: `rotate(${rot + (1 - s) * 9}deg) scale(${1.35 - 0.35 * s})`, opacity: Math.min(1, s * 3), whiteSpace: "nowrap", ...style }}>{text}</div>
  );
}

/** The costume's eyes: two white pills. `blinks` are frames where they close; `look` moves them (−1…1). */
function Eyes({ w, h, gap, blinks, look = [0, 0], open = 1, rot = -12 }: { w: number; h: number; gap: number; blinks: number[]; look?: [number, number]; open?: number; rot?: number }) {
  const f = useCurrentFrame();
  let s = open;
  for (const b of blinks) { const d = Math.abs(f - b); if (d < 6) s = Math.min(s, 0.08 + 0.92 * (d / 6) ** 1.5); }
  return (
    <div style={{ display: "flex", gap, transform: `translate(${look[0] * w * 0.5}px, ${look[1] * h * 0.12}px) rotate(${rot}deg)` }}>
      {[0, 1].map((i) => <div key={i} style={{ width: w, height: h * (i ? 0.9 : 1), borderRadius: 999, background: C.tape, transform: `scaleY(${s})`, boxShadow: "inset -4px -6px 0 rgba(0,0,0,.08)" }} />)}
    </div>
  );
}

/** Eyes placed on a picture of the costume: a dark patch hides the real tape, so a blink really closes them. */
const EYE_PHOTO = { l: [0.568, 0.561, 0.073, 0.137], r: [0.684, 0.542, 0.068, 0.1205] } as const;
const EYE_STICKER = { l: [0.5774, 0.3626, 0.1143, 0.2032], r: [0.7591, 0.3344, 0.1065, 0.1787] } as const;
function EyesOn({ box, blinks, look = [0, 0] }: { box: typeof EYE_PHOTO | typeof EYE_STICKER; blinks: number[]; look?: [number, number] }) {
  const f = useCurrentFrame();
  let s = 1;
  for (const b of blinks) { const d = Math.abs(f - b); if (d < 6) s = Math.min(s, 0.08 + 0.92 * (d / 6) ** 1.5); }
  return (
    <>
      {(["l", "r"] as const).map((k2) => { const [x, y, w, h] = box[k2];
        const st: React.CSSProperties = { position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, borderRadius: 999, transform: "rotate(-12deg)" };
        return (
          <React.Fragment key={k2}>
            <div style={{ ...st, background: "#151514", transform: "rotate(-12deg) scale(1.18)", filter: "blur(2px)" }} />
            <div style={{ ...st, background: C.tape, transform: `translate(${look[0] * 6}%, ${look[1] * 4}%) rotate(-12deg) scaleY(${s})`, boxShadow: "inset -3px -5px 0 rgba(0,0,0,.1)" }} />
          </React.Fragment>
        ); })}
    </>
  );
}

/** The photo, covering the frame, with a camera on it: focus point (0-1 of the photo) and zoom. */
function PhotoCam({ fx, fy, z, children }: { fx: number; fy: number; z: number; children?: React.ReactNode }) {
  const { W, H } = useU(), IW = 1320, IH = 1643, s = Math.max(W / IW, H / IH) * z, dw = IW * s, dh = IH * s;
  const x = Math.min(0, Math.max(W - dw, W / 2 - fx * dw)), y = Math.min(0, Math.max(H - dh, H / 2 - fy * dh));
  return (
    <div style={{ position: "absolute", left: x, top: y, width: dw, height: dh }}>
      <Img src={staticFile("grokdog/photo.jpg")} style={{ width: "100%", height: "100%" }} />
      {children}
    </div>
  );
}

const Bg = () => <AbsoluteFill style={{ background: `radial-gradient(70% 45% at 75% 0%, #2a2a27 0, transparent 70%), radial-gradient(60% 40% at 0% 70%, #222220 0, transparent 70%), ${C.ball}` }} />;

/* ---------- scenes (frames are local to each scene) ---------- */
function Open() {
  const f = useCurrentFrame(), { u, H } = useU();
  const open = pop(f, 8, AD_FPS, 12);
  const look: [number, number] = [interpolate(f, [34, 44, 56, 66, 80, 88], [0, -1, -1, 1, 1, 0], { ...clamp, easing: inOut }), 0];
  return (
    <AbsoluteFill>
      <Bg />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: H * 0.12 }}>
        <Eyes w={110 * u} h={300 * u} gap={70 * u} blinks={[100]} look={look} open={open} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: H * 0.2 }}>
        <Tape text="this is a good boy." at={30} rot={-3} size={70} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Photo() {
  const f = useCurrentFrame(), { H } = useU();
  // pull back from his face to the whole costume, hold, then dive into the ball
  const back = k(f, 6, 96, inOut), dive = k(f, 150, 180, easeIn);
  const fx = 0.47 + (0.5 - 0.47) * back + (0.5 - 0.5) * dive, fy = 0.44 + (0.56 - 0.44) * back + (0.72 - 0.56) * dive;
  const z = Math.exp(Math.log(3.1) + (Math.log(1.02) - Math.log(3.1)) * back) * (1 + 0.0006 * f) * Math.exp(Math.log(9) * dive);
  return (
    <AbsoluteFill style={{ background: C.ball }}>
      <PhotoCam fx={fx} fy={fy} z={z}><EyesOn box={EYE_PHOTO} blinks={[118, 136]} look={[interpolate(f, [100, 112, 126], [0, -0.6, 0], clamp), 0]} /></PhotoCam>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: H * 0.17, gap: 26, flexDirection: "column", opacity: 1 - k(f, 146, 160) }}>
        <Tape text="he is in a ball." at={50} rot={2} size={66} />
        <Tape text="he did not ask for this." at={90} rot={-2.5} size={58} bg={C.gold} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.ball, opacity: k(f, 166, 180, easeIn) }} />
    </AbsoluteFill>
  );
}

function Title() {
  const f = useCurrentFrame(), { u, W, H, tall } = useU(), size = (tall ? 290 : 232) * u;
  // GROK drops in from above, DOG bounces up from below, so no letter flies through another line
  const letter = (ch: string, at: number, color: string, i: number, dir = -1) => {
    const s = pop(f, at, AD_FPS, 8);
    return <span key={i} style={{ display: "inline-block", color, opacity: f < at ? 0 : Math.min(1, s * 4), transform: `translateY(${(1 - s) * dir * 70 * u}px) scale(${0.7 + 0.3 * s}, ${1.5 - 0.5 * s}) rotate(${(i % 2 ? 4 : -5) * (1 - s)}deg)`, transformOrigin: "50% 100%" }}>{ch}</span>;
  };
  // the sticker rolls in like a ball and the title shakes when it lands
  const land = 150, roll = k(f, 96, land, out), r = (tall ? 280 : 225) * u, x0 = W + r * 2, x1 = W * 0.5, x = x0 + (x1 - x0) * roll;
  const shake = f > land ? Math.sin((f - land) * 1.9) * 18 * u * Math.exp(-(f - land) / 9) : 0;
  return (
    <AbsoluteFill>
      <Bg />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: H * (tall ? 0.16 : 0.08) }}>
        <div style={{ fontFamily: MARKER, fontSize: 64 * u, color: C.tape, marginBottom: 34 * u, opacity: k(f, 0, 14), transform: `translateY(${(1 - k(f, 0, 20)) * 30}px) rotate(-3deg)` }}>he is</div>
        <div style={{ fontFamily: FAT, fontSize: size, lineHeight: 0.84, textAlign: "center", transform: `translateX(${shake}px)` }}>
          <div>{["G", "R", "O", "K"].map((ch, i) => letter(ch, 15 + i * 15, C.tape, i))}</div>
          <div>{["D", "O", "G"].map((ch, i) => letter(ch, 78 + i * 7, C.gold, i + 4, 1))}</div>
        </div>
        <div style={{ marginTop: 16 * u }}><Tape text="now." at={102} rot={4} size={56} bg={C.rug} color={C.tape} /></div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: x - r, top: H - r * 2.75 - H * (tall ? 0.035 : 0.02), width: r * 2, height: r * 2.63, transform: `rotate(${-(x - x1) / r}rad)`, transformOrigin: "50% 62%" }}>
        <Img src={staticFile("grokdog/sticker.png")} style={{ width: "100%", height: "100%" }} />
        <EyesOn box={EYE_STICKER} blinks={[176, 214]} />
      </div>
    </AbsoluteFill>
  );
}

function Chat() {
  const f = useCurrentFrame(), { u, H, tall } = useU();
  const msgs = [
    { at: 16, me: true, text: "wen moon?" }, { at: 52, me: false, text: "bork." },
    { at: 112, me: true, text: "is he ok?" }, { at: 148, me: false, text: "no thoughts. only ball." },
  ];
  const talking = msgs.some((m) => !m.me && f >= m.at && f < m.at + 24);
  return (
    <AbsoluteFill>
      <Bg />
      <AbsoluteFill style={{ padding: `${H * (tall ? 0.13 : 0.07)}px ${70 * u}px`, gap: 40 * u, display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: FAT, fontSize: 96 * u, color: C.tape, lineHeight: 1, opacity: k(f, 0, 14), transform: `translateY(${(1 - k(f, 0, 20)) * 40}px)` }}>ask grok dog</div>
        {msgs.map((m, i) => { const s = pop(f, m.at, AD_FPS, 11);
          return f < m.at ? null : (
            <div key={i} style={{ alignSelf: m.me ? "flex-end" : "flex-start", transform: `scale(${0.6 + 0.4 * s})`, transformOrigin: m.me ? "100% 100%" : "0% 100%", opacity: Math.min(1, s * 2.5) }}>
              {m.me ? <Tape text={m.text} at={m.at} rot={2} size={74} bg={C.gold} />
                : <div style={{ background: C.tape, color: C.ink, borderRadius: 34 * u, padding: `${26 * u}px ${38 * u}px`, maxWidth: (tall ? 820 : 700) * u }}>
                    <div style={{ fontFamily: "monospace", fontSize: 26 * u, color: "#7c766a", marginBottom: 6 * u }}>grok dog</div>
                    <div style={{ fontFamily: MARKER, fontSize: (m.text.length < 8 ? 130 : tall ? 72 : 60) * u, lineHeight: 1.05 }}>{m.text}</div>
                  </div>}
            </div>
          ); })}
      </AbsoluteFill>
      <div style={{ position: "absolute", right: -30 * u, bottom: -60 * u, width: (tall ? 420 : 340) * u, height: (tall ? 552 : 447) * u, transform: `rotate(${-8 + (talking ? Math.sin(f * 0.9) * 5 : 0)}deg) translateY(${talking ? -Math.abs(Math.sin(f * 0.45)) * 30 * u : 0}px)` }}>
        <Img src={staticFile("grokdog/sticker.png")} style={{ width: "100%", height: "100%" }} />
        <EyesOn box={EYE_STICKER} blinks={[90, 196]} look={[0.6, 0]} />
      </div>
    </AbsoluteFill>
  );
}

/** Sticker rain: simulated once (deterministic), then read by frame. */
function useRain(W: number, H: number, u: number, frames: number) {
  return useMemo(() => {
    let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const balls: { x: number; y: number; vx: number; vy: number; r: number; a: number; born: number }[] = [];
    const track: { x: number; y: number; r: number; a: number }[][] = [];
    for (let fr = 0; fr < frames; fr++) {
      if (fr < 110 && fr % 2 === 0) { const r = (52 + rnd() * 34) * u; balls.push({ x: r + rnd() * (W - 2 * r), y: -r - rnd() * 200 * u, vx: (rnd() - 0.5) * 10 * u, vy: 0, r, a: rnd() * 6, born: fr }); }
      for (const b of balls) {
        b.vy += 1.1 * u; b.x += b.vx; b.y += b.vy;
        if (b.y > H - b.r) { b.y = H - b.r; b.vy *= -0.35; b.vx *= 0.97; }
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.6; } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
      }
      for (let it = 0; it < 2; it++) for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = (a.r + b.r) * 0.9;
        if (d > 0 && d < m) { const p = (m - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { const im = rv * 0.6; a.vx += im * nx; a.vy += im * ny; b.vx -= im * nx; b.vy -= im * ny; } }
      }
      for (const b of balls) b.a += b.vx / b.r;
      track.push(balls.map((b) => ({ x: b.x, y: b.y, r: b.r, a: b.a })));
    }
    return track;
  }, [W, H, u, frames]);
}

function Rain() {
  const f = useCurrentFrame(), { u, W, H, tall } = useU(), track = useRain(W, H, u, T.end - T.rain + PUSH);
  const now = track[Math.min(track.length - 1, Math.max(0, f))];
  const n = Math.round(interpolate(f, [4, 130], [0, 420], { ...clamp, easing: Easing.bezier(0.3, 0, 0.2, 1) }));
  const wipe = k(f, T.end - T.rain - 22, T.end - T.rain + 2, inOut);
  return (
    <AbsoluteFill>
      <Bg />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: H * (tall ? 0.15 : 0.08) }}>
        <Tape text="grok dogs on your screen" at={2} rot={-2} size={50} />
        <div style={{ fontFamily: FAT, fontSize: 300 * u, lineHeight: 1, color: C.gold, marginTop: 10 * u, transform: `scale(${1 + 0.05 * Math.sin(f * 0.5) * (f < 130 ? 1 : 0)})` }}>{n}</div>
      </AbsoluteFill>
      {now.map((b, i) => (
        <Img key={i} src={staticFile("grokdog/sticker.png")} style={{ position: "absolute", left: b.x - b.r * 0.95, top: b.y - b.r * 1.45, width: b.r * 1.9, height: b.r * 2.5, transform: `rotate(${b.a}rad)`, transformOrigin: "50% 58%" }} />
      ))}
      {/* the ball eats the frame: a black circle grows from the middle into the end card */}
      <AbsoluteFill style={{ background: C.ball, clipPath: `circle(${wipe * 75}% at 50% 55%)` }} />
    </AbsoluteFill>
  );
}

function End() {
  const f = useCurrentFrame(), { u, H, tall } = useU(), s = pop(f, 2, AD_FPS, 9), w = 520 * u;
  return (
    <AbsoluteFill>
      <Bg />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 18 * u, paddingBottom: H * (tall ? 0.05 : 0) }}>
        <div style={{ fontFamily: FAT, fontSize: 200 * u, lineHeight: 0.85, color: C.tape, whiteSpace: "nowrap", opacity: k(f, 10, 24), transform: `translateY(${(1 - k(f, 10, 34)) * -40}px)` }}>
          GROK <span style={{ color: C.gold }}>DOG</span>
        </div>
        <div style={{ width: w, height: w * 1.314, transform: `scale(${s}) rotate(${(1 - s) * -30 + Math.sin(f * 0.06) * 2}deg)` }}>
          <Img src={staticFile("grokdog/sticker.png")} style={{ width: "100%", height: "100%" }} />
          <EyesOn box={EYE_STICKER} blinks={[70, 150]} look={[interpolate(f, [90, 104, 124, 138], [0, 0.8, 0.8, 0], clamp), 0]} />
        </div>
        <div style={{ display: "flex", gap: 22 * u, alignItems: "center", marginTop: -30 * u }}>
          <Tape text="$GROKDOG" at={36} rot={-4} size={72} bg={C.gold} />
          <Tape text="be grok." at={54} rot={3} size={60} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Scene with a push: the next scene slides up over the last PUSH frames of this one. */
function Push({ from, to, children, push = true }: { from: number; to: number; children: React.ReactNode; push?: boolean }) {
  return (
    <Sequence from={from} durationInFrames={to - from + PUSH}>
      <Slide len={to - from} push={push}>{children}</Slide>
    </Sequence>
  );
}
function Slide({ len, push, children }: { len: number; push: boolean; children: React.ReactNode }) {
  const f = useCurrentFrame(), { H } = useU(), e = push ? k(f, len, len + PUSH, inOut) : 0;
  return <AbsoluteFill style={{ transform: `translateY(${-e * H}px)` }}>{children}</AbsoluteFill>;
}
function Enter({ children, push = true }: { children: React.ReactNode; push?: boolean }) {
  const f = useCurrentFrame(), { H } = useU(), e = push ? 1 - k(f, 0, PUSH, inOut) : 0;
  return <AbsoluteFill style={{ transform: `translateY(${e * H}px)` }}>{children}</AbsoluteFill>;
}

export function GrokDogAd() {
  useFonts("grokdog/fonts/fonts.css");
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.ball }}>
      {/* open → photo: the photo fades up under the eyes */}
      <Sequence from={T.open} durationInFrames={T.photo + 14}><FadeOut at={T.photo} len={14}><Open /></FadeOut></Sequence>
      <Sequence from={T.photo} durationInFrames={T.title - T.photo}><FadeIn len={14}><Photo /></FadeIn></Sequence>
      {/* photo → title: we dive into the black ball, so the title starts on black */}
      <Push from={T.title} to={T.chat}><Title /></Push>
      <Sequence from={T.chat} durationInFrames={T.rain - T.chat + PUSH}><Enter><Slide len={T.rain - T.chat} push><Chat /></Slide></Enter></Sequence>
      <Sequence from={T.rain} durationInFrames={T.end - T.rain}><Enter><Rain /></Enter></Sequence>
      <Sequence from={T.end} durationInFrames={T.total - T.end}><End /></Sequence>
      <Audio src={staticFile("grokdog/ad-audio.m4a")} volume={(fr) => interpolate(fr, [durationInFrames - 30, durationInFrames], [1, 0], clamp)} />
    </AbsoluteFill>
  );
}
function FadeOut({ at, len, children }: { at: number; len: number; children: React.ReactNode }) {
  const f = useCurrentFrame(); return <AbsoluteFill style={{ opacity: 1 - k(f, at, at + len, inOut) }}>{children}</AbsoluteFill>;
}
function FadeIn({ len, children }: { len: number; children: React.ReactNode }) {
  const f = useCurrentFrame(); return <AbsoluteFill style={{ opacity: k(f, 0, len, inOut) }}>{children}</AbsoluteFill>;
}
