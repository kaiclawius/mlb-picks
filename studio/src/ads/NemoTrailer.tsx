// Nemo introduces himself: a 35 s trailer in the Mucron cartoon style, with his voice (Stimme, French voice "Tom",
// English written in French spelling so it comes out as Franglais) and English subtitles.
// His jaw is driven by the loudness of the voice (nemo-env.json, one value per frame), so the mouth moves with
// every word. Scenes follow the voice lines (nemo-timeline.json); every number below is seconds on that timeline.
import React from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useFonts } from "../ProductVideo";
import LINES from "./nemo-timeline.json";
import ENV from "./nemo-env.json";

export const NEMO_FPS = 60;
export const NEMO_FRAMES = 35 * NEMO_FPS;
const C = { ink: "#0e1f29", blue: "#173286", red: "#e7171e", skin: "#ffcbba", fur: "#1d1d21", paper: "#ffffff" };
const TOON = "'Luckiest Guy', sans-serif", HAND = "'Patrick Hand', sans-serif";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.bezier(0.16, 1, 0.3, 1), inOut = Easing.bezier(0.65, 0, 0.35, 1);
const k = (f: number, a: number, b: number, e = out) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
const S = (sec: number) => Math.round(sec * NEMO_FPS);
const pop = (f: number, atSec: number, damping = 10) => (f < S(atSec) ? 0 : spring({ frame: f - S(atSec), fps: NEMO_FPS, config: { damping, stiffness: 200, mass: 0.7 } }));
// scene edges (a brush stroke wipes across at each one)
const CUTS = { mucron: 7.0, diff: 9.8, close: 14.2, life: 17.6, decree: 23.8, end: 27.9 };
const toonText = (u: number, size: number, color: string): React.CSSProperties => ({ fontFamily: TOON, fontSize: size * u, lineHeight: 0.95, color, WebkitTextStroke: `${5 * u}px ${C.ink}`, paintOrder: "stroke fill", textShadow: `${7 * u}px ${7 * u}px 0 ${C.ink}` });

/** Rough tricolore brush strokes behind everything. */
function Brushes({ f }: { f: number }) {
  const a = k(f, 0, 18), b = k(f, 6, 26);
  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs><filter id="rough" x="-10%" y="-20%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.08" numOctaves="3" seed="5" /><feDisplacementMap in="SourceGraphic" scale="40" /></filter></defs>
      <g filter="url(#rough)">
        <path d="M -60 560 L 420 420 L 500 660 L -20 820 Z" fill={C.red} style={{ transformOrigin: "0 600px", transform: `scaleX(${a})` }} />
        <path d="M 420 -80 L 1100 -80 L 1100 540 Q 900 640 700 500 Z" fill={C.blue} style={{ transformOrigin: "1000px 0", transform: `scale(${b})` }} />
      </g>
    </svg>
  );
}

/** The talking Nemo: the rig (head and body, plus a jaw that opens with the voice). */
function Rig({ f, size, talk = true }: { f: number; size: number; talk?: boolean }) {
  const env = ENV[Math.min(ENV.length - 1, f)] || 0;
  const open = talk ? Math.min(1, env) * 8 : 0;          // degrees
  const bob = Math.sin(f * 0.06) * 1.2 + (talk ? env * 1.6 : 0);
  return (
    <div style={{ position: "relative", width: size, height: size, transform: `rotate(${bob}deg)`, transformOrigin: "40% 100%" }}>
      <Img src={staticFile("nemo/base.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <Img src={staticFile("nemo/jaw.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: `rotate(${open}deg)`, transformOrigin: "78.61% 48.83%" }} />
    </div>
  );
}

function Frame({ children, size, rot = 1.5 }: { children: React.ReactNode; size: number; rot?: number }) {
  const u = size / 1000;
  return <div style={{ position: "relative", width: size, height: size, border: `${7 * u}px solid ${C.ink}`, borderRadius: `${34 * u}px ${22 * u}px ${38 * u}px ${20 * u}px`, boxShadow: `${14 * u}px ${14 * u}px 0 ${C.ink}`, overflow: "hidden", background: C.paper, transform: `rotate(${rot}deg)` }}>{children}</div>;
}

export function NemoTrailer() {
  useFonts("nemo/fonts/fonts.css");
  const f = useCurrentFrame(), { width: W, height: H, durationInFrames } = useVideoConfig(), u = W / 1080, tall = H / W > 1.5, sec = f / NEMO_FPS;
  const art = Math.min(W * 0.9, H * (tall ? 0.56 : 0.62));
  const line = [...LINES].reverse().find((l) => sec >= l.at - 0.05);
  const lineOn = line && sec < line.at + line.dur + 0.5;
  const scene = sec < 1.2 ? "intro" : sec < CUTS.mucron ? "talk" : sec < CUTS.diff ? "mucron" : sec < CUTS.close ? "diff" : sec < CUTS.life ? "close" : sec < CUTS.decree ? "life" : sec < CUTS.end ? "decree" : "end";
  const centerTop = H * (tall ? 0.42 : 0.44) - art / 2;

  // spot the difference: the handle walks across on "same neck / same face / same look"
  const d0 = CUTS.diff, x = 100 - 34 * k(f, S(d0 + 0.35), S(d0 + 0.75), inOut) - 33 * k(f, S(d0 + 1.67), S(d0 + 2.07), inOut) - 33 * k(f, S(d0 + 3.27), S(d0 + 3.67), inOut);
  // the brush wipe at every scene edge
  const wipeAt = Object.values(CUTS).find((c) => Math.abs(sec - c) < 0.22), wipe = wipeAt === undefined ? -1 : (sec - wipeAt + 0.22) / 0.44;
  const wipeColor = wipeAt !== undefined && Object.values(CUTS).indexOf(wipeAt) % 2 ? C.red : C.blue;

  return (
    <AbsoluteFill style={{ background: C.paper, overflow: "hidden" }}>
      <Brushes f={f} />
      {/* the title, slammed in, then parked small at the top while he talks */}
      {scene !== "end" && scene !== "diff" && (() => {
        const park = k(f, S(1.0), S(1.6), inOut), size = interpolate(park, [0, 1], [128, 70]), top = interpolate(park, [0, 1], [H * 0.36, H * (tall ? 0.06 : 0.035)]);
        return (
          <div style={{ position: "absolute", left: 0, right: 0, top, textAlign: "center", whiteSpace: "nowrap", zIndex: 4 }}>
            <span style={{ ...toonText(u, size, C.blue), display: "inline-block", transform: `scale(${pop(f, 0.25, 8)})` }}>NEMO </span>
            <span style={{ ...toonText(u, size, C.red), display: "inline-block", transform: `scale(${pop(f, 0.5, 8)})` }}>MUCRON</span>
          </div>
        );
      })()}

      {(scene === "talk" || scene === "close") && (() => {
        const z = scene === "close" ? 1 + 0.55 * k(f, S(CUTS.close), S(CUTS.close + 1.2), inOut) + 0.04 * k(f, S(CUTS.close + 1.2), S(CUTS.life)) : 1 + 0.05 * k(f, S(1.2), S(CUTS.mucron));
        const enter = k(f, S(1.1), S(1.6));
        return (
          <div style={{ position: "absolute", left: (W - art) / 2, top: centerTop + (1 - enter) * 80 * u, opacity: enter, transform: `scale(${z})`, transformOrigin: scene === "close" ? "62% 32%" : "50% 60%" }}>
            <Frame size={art}><Rig f={f} size={art} /></Frame>
            {scene === "close" && sec > CUTS.close + 1.7 && (
              <div style={{ position: "absolute", right: -10 * u, top: art * 0.04, ...toonText(u, 54, "#fff"), transform: `rotate(-8deg) scale(${pop(f, CUTS.close + 1.7, 8)})` }}>★</div>
            )}
          </div>
        );
      })()}

      {scene === "mucron" && (
        <div style={{ position: "absolute", left: (W - art) / 2, top: centerTop, transform: `scale(${1 + 0.06 * k(f, S(CUTS.mucron), S(CUTS.diff))})` }}>
          <Frame size={art} rot={-1.5}><Img src={staticFile("nemo/mucron-1000.png")} style={{ width: "100%", height: "100%" }} /></Frame>
          <div style={{ position: "absolute", left: 20 * u, top: 20 * u, fontFamily: TOON, fontSize: 34 * u, background: C.skin, border: `${5 * u}px solid ${C.ink}`, borderRadius: 14 * u, padding: `${8 * u}px ${16 * u}px ${2 * u}px`, boxShadow: `${4 * u}px ${4 * u}px 0 ${C.ink}`, transform: `rotate(-6deg) scale(${pop(f, CUTS.mucron + 0.3)})` }}>MY HUMAN</div>
        </div>
      )}

      {scene === "diff" && (
        <div style={{ position: "absolute", left: (W - art) / 2, top: centerTop }}>
          <Frame size={art}>
            <Img src={staticFile("nemo/mucron-1000.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            <Img src={staticFile("nemo/nemo-full-1000.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", clipPath: `inset(0 0 0 ${x}%)` }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${x}%`, width: 8 * u, marginLeft: -4 * u, background: C.ink }} />
            <div style={{ position: "absolute", top: "50%", left: `${x}%`, width: 76 * u, height: 76 * u, margin: `${-38 * u}px 0 0 ${-38 * u}px`, borderRadius: "50%", background: "#fff", border: `${6 * u}px solid ${C.ink}`, display: "grid", placeItems: "center", fontFamily: TOON, fontSize: 30 * u }}>⇆</div>
          </Frame>
          <div style={{ position: "absolute", right: 0, left: 0, top: -64 * u, textAlign: "center", ...toonText(u, 54, C.blue), transform: `rotate(-2deg) scale(${pop(f, CUTS.diff + 0.15, 9)})` }}>trouvez la différence</div>
        </div>
      )}

      {scene === "life" && (() => {
        const items = [{ t: 0.23, w: "CROISSANTS", bg: C.skin, c: C.ink, r: -5 }, { t: 1.89, w: "PALAIS", bg: C.blue, c: "#fff", r: 4 }, { t: 4.41, w: "DÉCRETS", bg: C.red, c: "#fff", r: -3 }];
        return (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34 * u, paddingBottom: H * 0.12 }}>
            {items.map((it, i) => { const s = pop(f, CUTS.life + 0.1 + it.t, 9);
              return sec >= CUTS.life + 0.1 + it.t && <div key={i} style={{ fontFamily: TOON, fontSize: 96 * u, color: it.c, background: it.bg, border: `${7 * u}px solid ${C.ink}`, borderRadius: `${30 * u}px ${20 * u}px ${34 * u}px ${18 * u}px`, boxShadow: `${10 * u}px ${10 * u}px 0 ${C.ink}`, padding: `${22 * u}px ${44 * u}px ${8 * u}px`, transform: `rotate(${it.r}deg) scale(${1.4 - 0.4 * s})`, opacity: Math.min(1, s * 3) }}>{it.w}</div>; })}
            <div style={{ position: "absolute", right: 30 * u, bottom: H * (tall ? 0.22 : 0.15), width: 280 * u, transform: `rotate(${Math.sin(f * 0.2) * 4}deg)` }}><Img src={staticFile("nemo/nemo-sticker.png")} style={{ width: "100%" }} /></div>
          </AbsoluteFill>
        );
      })()}

      {scene === "decree" && (() => {
        const dw = Math.min(W * 0.86, 860 * u), st = pop(f, CUTS.decree + 3.43, 9), e = k(f, S(CUTS.decree), S(CUTS.decree + 0.5));
        return (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: H * 0.1 }}>
            <div style={{ position: "relative", width: dw, background: "#fff", border: `${7 * u}px solid ${C.ink}`, borderRadius: 16 * u, boxShadow: `${12 * u}px ${12 * u}px 0 ${C.ink}`, padding: `${44 * u}px ${46 * u}px ${130 * u}px`, transform: `rotate(-1.5deg) translateY(${(1 - e) * 120 * u}px)`, opacity: e }}>
              <div style={{ position: "absolute", inset: 14 * u, border: `${4 * u}px dashed ${C.blue}`, borderRadius: 10 * u }} />
              <div style={{ fontFamily: TOON, fontSize: 70 * u, color: C.blue, lineHeight: 1 }}>DÉCRET N° 001</div>
              <div style={{ fontFamily: HAND, fontSize: 34 * u, color: "#4b5862", margin: `${6 * u}px 0 ${30 * u}px` }}>du bureau du premier chien de France</div>
              <div style={{ fontFamily: TOON, fontSize: 40 * u, color: C.red }}>ARTICLE 1.</div>
              <div style={{ fontFamily: HAND, fontSize: 54 * u, lineHeight: 1.15, color: C.ink, marginTop: 6 * u, maxWidth: "88%" }}>Tous les croissants appartiennent à Nemo.</div>
              {st > 0 && <div style={{ position: "absolute", right: 30 * u, bottom: 26 * u, fontFamily: TOON, fontSize: 46 * u, color: C.red, border: `${8 * u}px solid ${C.red}`, borderRadius: 16 * u, padding: `${10 * u}px ${18 * u}px ${2 * u}px`, lineHeight: 1.05, textAlign: "center", background: "rgba(255,255,255,.9)", transform: `rotate(${-14 - (1 - st) * 12}deg) scale(${2.3 - 1.3 * st})`, opacity: Math.min(1, st * 2) }}>APPROUVÉ<br />· WOUF ·</div>}
            </div>
          </AbsoluteFill>
        );
      })()}

      {scene === "end" && (() => {
        const e = k(f, S(CUTS.end), S(CUTS.end + 0.6)), coin = pop(f, CUTS.end + 2.46, 8), sz = art * 0.82;
        return (
          <AbsoluteFill style={{ alignItems: "center", paddingTop: H * (tall ? 0.1 : 0.05), gap: 26 * u }}>
            <div style={{ whiteSpace: "nowrap", opacity: e }}><span style={toonText(u, 84, C.blue)}>NEMO </span><span style={toonText(u, 84, C.red)}>MUCRON</span></div>
            <div style={{ transform: `translateY(${(1 - e) * 60 * u}px) scale(${0.96 + 0.04 * e})`, opacity: e }}><Frame size={sz} rot={1.5}><Img src={staticFile("nemo/nemo-mucron-square.png")} style={{ width: "100%", height: "100%" }} /></Frame></div>
            {coin > 0 && <div style={{ ...toonText(u, 120, C.red), transform: `rotate(-4deg) scale(${coin})`, marginTop: -40 * u }}>$NEMO</div>}
            {sec > CUTS.end + 3.66 && <div style={{ fontFamily: HAND, fontSize: 40 * u, color: C.ink, opacity: k(f, S(CUTS.end + 3.66), S(CUTS.end + 4.1)) }}>on solana · en même temps, a coin.</div>}
          </AbsoluteFill>
        );
      })()}

      {/* the brush wipe */}
      {wipe >= 0 && <div style={{ position: "absolute", left: -W * 0.4, top: H * 0.5 - H * 0.42, width: W * 1.8, height: H * 0.84, background: wipeColor, filter: "url(#rough)",
        transform: `translateX(${interpolate(wipe, [0, 1], [-W * 1.9, W * 1.9], { easing: inOut })}px) rotate(-12deg)`, zIndex: 8 }} />}

      {/* subtitles: what he says, in English */}
      {lineOn && line && scene !== "intro" && (() => { const s = pop(f, line.at, 12);
        return (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: H * (tall ? 0.15 : 0.05), zIndex: 9 }}>
            <div style={{ fontFamily: HAND, fontSize: (tall ? 52 : 48) * u, lineHeight: 1.15, color: C.ink, background: "#fff", border: `${5 * u}px solid ${C.ink}`, borderRadius: `${22 * u}px ${16 * u}px ${24 * u}px ${14 * u}px`, boxShadow: `${6 * u}px ${6 * u}px 0 ${C.ink}`,
              padding: `${12 * u}px ${28 * u}px ${8 * u}px`, maxWidth: "86%", textAlign: "center", transform: `scale(${0.85 + 0.15 * s}) rotate(-1deg)`, opacity: Math.min(1, s * 2) }}>{line.sub}</div>
          </AbsoluteFill>
        ); })()}
      <Audio src={staticFile("nemo/trailer-audio.m4a")} volume={(fr) => interpolate(fr, [durationInFrames - 30, durationInFrames], [1, 0], clamp)} />
    </AbsoluteFill>
  );
}
