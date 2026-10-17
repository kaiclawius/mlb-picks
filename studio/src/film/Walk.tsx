// UI walkthrough: the grammar of the Claude product films (Claude Design, Managed Agents). Real UI panels float on
// a quiet patterned canvas and one camera glides between them; a cursor clicks, a prompt is typed into the real
// input, a status pill shimmers while the work runs, a checklist ticks, and short serif titles carry the argument
// between the UI shots. Few cuts: shots cross-fade, and inside a shot everything is one continuous move.
// The panels are sharp 3x stills with marks (capture/walk-*.mjs), so the camera, the cursor and the typed text
// land exactly on the real elements, and everything runs at 60 fps.
import React, { createContext, useContext, useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Brand, Product, Walk as WalkT, WalkCam, WalkShot, WalkWin } from "../types";

export const WALK_FPS = 60;
const OV = 24; // frames two shots cross-fade
export const walkFrames = (w: WalkT) => Math.round(w.shots.reduce((n, s) => n + s.seconds, 0) * WALK_FPS);
const out = Easing.bezier(0.16, 1, 0.3, 1), inOut = Easing.bezier(0.65, 0, 0.35, 1), pop = Easing.bezier(0.34, 1.4, 0.64, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const k = (f: number, a: number, b: number, e = out) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
const S = (sec: number) => sec * WALK_FPS;

/** Shot time: a shot starts OV frames early (it fades in over the last one), so its own clock starts at -OV. */
const Lead = createContext(0);
const useF = () => useCurrentFrame() - useContext(Lead);

type Ctx = { brand: Brand; walk: WalkT; u: number; portrait: boolean; square: boolean; width: number; height: number; len: number };

/** Loads every stylesheet before the first frame (the brand fonts and the serif). */
function useFontsAll(files: (string | undefined)[]) {
  const list = files.filter(Boolean) as string[];
  const [handle] = useState(() => (list.length ? delayRender("walk fonts") : null));
  useEffect(() => {
    if (handle === null) return;
    const done = () => continueRender(handle);
    Promise.all(list.map((css, i) => new Promise<void>((res) => {
      const id = "walk-fonts-" + i; if (document.getElementById(id)) return res();
      const l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; l.href = staticFile(css);
      l.onload = () => res(); l.onerror = () => res(); document.head.appendChild(l);
    }))).then(() => Promise.all([...document.fonts].map((f) => f.load().catch(() => null)))).then(done, done);
  }, [handle]);
}

/* ---------- geometry: windows and marks on the canvas ---------- */
const placeOf = (w: { x: number; y: number; w: number; p?: { x: number; y: number; w: number } }, c: Ctx) => (c.portrait && w.p ? w.p : w);
const stateAt = (w: WalkWin, sec: number) => { let s = w.states[0][1]; for (const [t, st] of w.states) if (sec >= t) s = st; return s; };
function winBox(w: WalkWin, c: Ctx, sec: number) {
  const pl = placeOf(w, c), st = c.walk.panels[w.panel].states[stateAt(w, sec)], h = (pl.w * st.size[1]) / st.size[0];
  return { x: pl.x, y: pl.y, w: pl.w, h, st, scale: pl.w / st.size[0] };
}
function markPoint(shot: Extract<WalkShot, { type: "ui" }>, c: Ctx, win: string, mark: string | undefined, sec: number): [number, number] {
  const w = shot.windows.find((x) => x.id === win); if (!w) return [0, 0];
  const b = winBox(w, c, sec), m = mark ? b.st.marks[mark] : undefined;
  return m ? [b.x + (m[0] + m[2] / 2) * b.w, b.y + (m[1] + m[3] / 2) * b.h] : [b.x + b.w / 2, b.y + b.h / 2];
}

/** The camera at a second: eased between keys, zoom in log space so pushes feel even, plus a slow drift. */
function camAt(shot: Extract<WalkShot, { type: "ui" }>, c: Ctx, sec: number) {
  const z = (key: WalkCam) => (c.portrait || c.square) ? key.pz ?? Math.max(0.92, key.zoom * 0.72) : key.zoom;
  // 9:16 can look somewhere else (px/py), e.g. at the start of a long input instead of its middle
  const pt = (key: WalkCam): [number, number] => {
    const base: [number, number] = key.win ? markPoint(shot, c, key.win, key.mark, key.t) : [key.x ?? 0, key.y ?? 0];
    return c.portrait ? [key.px ?? base[0], key.py ?? base[1]] : base;
  };
  const keys = shot.camera;
  let i = 0; while (i < keys.length - 1 && sec > keys[i + 1].t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const e = b === a ? 0 : inOut(Math.min(1, Math.max(0, (sec - a.t) / (b.t - a.t))));
  const [ax, ay] = pt(a), [bx, by] = pt(b);
  const zoom = Math.exp(Math.log(z(a)) + (Math.log(z(b)) - Math.log(z(a))) * e) * (1 + 0.006 * sec);
  return { x: ax + (bx - ax) * e, y: ay + (by - ay) * e, zoom };
}

/* ---------- pieces ---------- */
/** Text with *accent* words, each word fading up out of a blur. */
function SerifLine({ text, c, frame, size }: { text: string; c: Ctx; frame: number; size: number }) {
  const words = [...text.matchAll(/\*([^*]+)\*|(\S+)/g)].flatMap((m) => m[1] ? m[1].split(" ").map((w) => ({ w, acc: true })) : [{ w: m[2], acc: false }]);
  return (
    <div style={{ fontFamily: c.walk.serif, fontWeight: 400, fontSize: size, lineHeight: 1.2, letterSpacing: "-0.01em", color: c.brand.colors.ink, textAlign: "center", textWrap: "balance" as any, maxWidth: (c.portrait ? 900 : 1300) * c.u }}>
      {words.map(({ w, acc }, n) => { const e = k(frame, n * 4, n * 4 + 30);
        return <span key={n} style={{ display: "inline-block", marginRight: "0.26em", opacity: e, filter: `blur(${(1 - e) * 10}px)`, transform: `translateY(${(1 - e) * 14 * c.u}px)`, color: acc ? c.brand.colors.accent : undefined, fontStyle: acc ? "italic" : undefined }}>{w}</span>; })}
    </div>
  );
}

function Cursor({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 20 25" style={{ display: "block", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.25))" }}>
      <path d="M2 1.5 L2 20 L6.6 15.8 L9.6 23 L13 21.6 L10 14.6 L16.4 14.6 Z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** A floating status: a turning ring and a serif label with light running through it. */
function Pill({ text, c, frame, from, to }: { text: string; c: Ctx; frame: number; from: number; to: number }) {
  const e = k(frame, from, from + 18, pop) * (1 - k(frame, to - 12, to, inOut));
  if (e <= 0) return null;
  const u = c.u * (c.portrait ? 1.15 : 1), shine = ((frame - from) / 70) % 1;
  return (
    <div style={{ position: "absolute", left: "50%", top: c.portrait ? "74%" : "80%", transform: `translate(-50%,-50%) scale(${0.86 + 0.14 * e})`, opacity: Math.min(1, e * 1.4),
      display: "flex", alignItems: "center", gap: 16 * u, padding: `${18 * u}px ${34 * u}px ${18 * u}px ${26 * u}px`, background: c.brand.colors.surface, borderRadius: 999,
      boxShadow: `0 ${18 * u}px ${50 * u}px rgba(22,32,42,.16), 0 0 0 ${1.5 * u}px ${c.brand.colors.line}` }}>
      <div style={{ width: 26 * u, height: 26 * u, borderRadius: "50%", border: `${3.5 * u}px solid ${c.brand.colors.line}`, borderTopColor: c.brand.colors.accent, transform: `rotate(${frame * 9}deg)` }} />
      <div style={{ fontFamily: c.walk.serif, fontStyle: "italic", fontSize: 40 * u, whiteSpace: "nowrap",
        backgroundImage: `linear-gradient(100deg, ${c.brand.colors.ink} ${shine * 160 - 40}%, ${c.brand.colors.line} ${shine * 160 - 20}%, ${c.brand.colors.ink} ${shine * 160}%)`,
        WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{text}</div>
    </div>
  );
}

/** The canvas shot: windows, checklist, typed text and cursor live on the canvas; the pill stays on screen. */
function UiShot({ shot, c }: { shot: Extract<WalkShot, { type: "ui" }>; c: Ctx }) {
  const frame = useF(), sec = frame / WALK_FPS, b = c.brand, cam = camAt(shot, c, sec);
  const scale = c.u * cam.zoom;
  // the cursor glides to each target and lands on its second; it enters from below the first target
  let cur: [number, number] | null = null, press = 0, ring: { p: [number, number]; e: number } | null = null;
  if (shot.cursor?.length) {
    const ks = shot.cursor, pts = ks.map((q) => markPoint(shot, c, q.win, q.mark, q.t));
    const first = ks[0].t, start: [number, number] = [pts[0][0] + 260, pts[0][1] + 320];
    if (sec >= first - 0.9) {
      let i = 0; while (i < ks.length - 1 && sec > ks[i + 1].t - 0.75) i++;
      const from = sec < first ? start : pts[i], toI = sec < first ? 0 : Math.min(i + 1, ks.length - 1), to = pts[toI];
      const t0 = sec < first ? first - 0.9 : ks[toI].t - 0.75, t1 = sec < first ? first : ks[toI].t;
      const e = toI === i && sec >= first ? 1 : inOut(Math.min(1, Math.max(0, (sec - t0) / (t1 - t0))));
      cur = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
      for (let j = 0; j < ks.length; j++) if (ks[j].click) { const d = sec - ks[j].t; if (d >= 0 && d < 0.5) { press = Math.max(press, 1 - Math.abs(d - 0.08) / 0.12); ring = { p: pts[j], e: d / 0.5 }; } }
    }
  }
  const ty = shot.typing;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", left: c.width / 2, top: c.height / 2, transform: `scale(${scale}) translate(${-cam.x}px, ${-cam.y}px)`, transformOrigin: "0 0" }}>
        {/* the canvas pattern: continuous-feed bands that move with the camera */}
        <div style={{ position: "absolute", left: -4000, top: -4000, width: 8000, height: 8000, background: `repeating-linear-gradient(180deg, ${b.colors.bg} 0 54px, ${c.walk.band || b.colors.bg} 54px 108px)` }} />
        {shot.windows.map((w) => {
          const bx = winBox(w, c, sec), e = w.in === undefined ? 1 : k(frame, S(w.in), S(w.in) + 34);
          // every state a window has had so far is stacked, the newest fades in over the last
          const changes = w.states.filter(([t], i) => i === 0 || sec >= t); // the first state also covers the fade-in (sec < 0)
          const shown = changes.slice(-2);
          return (
            <div key={w.id} style={{ position: "absolute", left: bx.x, top: bx.y, width: bx.w, height: bx.h, borderRadius: 10, overflow: "hidden", opacity: e,
              transform: `translateY(${(1 - e) * 40}px)`, filter: e < 1 ? `blur(${(1 - e) * 12}px)` : undefined,
              boxShadow: "0 30px 80px rgba(22,32,42,.13), 0 6px 18px rgba(22,32,42,.06)", background: b.colors.surface }}>
              {shown.map(([t, st], n) => (
                <Img key={st} src={staticFile(`${c.walk.dir}/${w.panel}-${st}.jpg`)} style={{ position: "absolute", left: 0, top: 0, width: "100%",
                  opacity: n === shown.length - 1 && shown.length > 1 ? k(frame, S(t), S(t) + 10, inOut) : 1 }} />
              ))}
            </div>
          );
        })}
        {shot.checklist && (() => {
          const cl = placeOf(shot.checklist, c), e = k(frame, S(shot.checklist.items[0][0]) - 30, S(shot.checklist.items[0][0]));
          return (
            <div style={{ position: "absolute", left: cl.x, top: cl.y, width: cl.w, padding: "22px 26px", borderRadius: 14, background: b.colors.surface, opacity: e,
              transform: `translateY(${(1 - e) * 30}px)`, boxShadow: "0 30px 80px rgba(22,32,42,.13), 0 0 0 1.5px " + b.colors.line, fontFamily: b.fonts.body }}>
              {shot.checklist.title && <div style={{ fontFamily: b.fonts.mono, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: b.colors.muted, marginBottom: 14 }}>{shot.checklist.title}</div>}
              {shot.checklist.items.map(([t, label], n) => { const d = k(frame, S(t), S(t) + 14, pop);
                return (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 0", fontSize: 21, color: d > 0.5 ? b.colors.muted : b.colors.ink }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, flex: "none", border: `2px solid ${d > 0 ? b.colors.accent : b.colors.line}`, background: d > 0 ? b.colors.accent : "transparent", display: "grid", placeItems: "center", transform: `scale(${0.8 + 0.2 * d})` }}>
                      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2.5 7.4 L5.6 10.3 L11.5 3.8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="14" strokeDashoffset={14 * (1 - d)} /></svg>
                    </div>
                    <span style={{ textDecoration: d > 0.5 ? "line-through" : undefined, textDecorationColor: b.colors.line }}>{label}</span>
                  </div>
                ); })}
            </div>
          );
        })()}
        {ty && sec >= ty.t - 0.2 && (() => {
          const w = shot.windows.find((x) => x.id === ty.win)!, bx = winBox(w, c, sec), m = bx.st.marks[ty.mark], f = c.walk.panels[w.panel].inputFont!;
          const n = Math.max(0, Math.min(ty.text.length, Math.floor((sec - ty.t) * (ty.cps || 20)))), doneAt = ty.t + ty.text.length / (ty.cps || 20);
          if (sec > doneAt + 0.25) return null; // the "then" state shows the typed text from here on
          const caret = Math.floor(frame / 30) % 2 === 0 || sec < doneAt;
          return (
            <div style={{ position: "absolute", left: bx.x + m[0] * bx.w + (f.padLeft + 2) * bx.scale, top: bx.y + (m[1] + m[3] / 2) * bx.h, transform: "translateY(-50%)",
              fontFamily: f.family, fontSize: f.size * bx.scale, color: f.color, whiteSpace: "pre", display: "flex", alignItems: "center" }}>
              {ty.text.slice(0, n)}<span style={{ width: 1.5 * bx.scale, height: f.size * 1.25 * bx.scale, marginLeft: 1, background: caret ? f.color : "transparent" }} />
            </div>
          );
        })()}
        {ring && <div style={{ position: "absolute", left: ring.p[0], top: ring.p[1], width: 70, height: 70, marginLeft: -35, marginTop: -35, borderRadius: "50%",
          border: `3px solid ${b.colors.accent}`, opacity: 0.5 * (1 - ring.e), transform: `scale(${(0.2 + ring.e) / cam.zoom})` }} />}
        {cur && <div style={{ position: "absolute", left: cur[0], top: cur[1], transform: `scale(${(1 - press * 0.16) / cam.zoom})`, transformOrigin: "2px 2px" }}><Cursor size={30} /></div>}
      </div>
      {shot.pills?.map((p, i) => <Pill key={i} text={p.text} c={c} frame={frame} from={S(p.t)} to={S(p.until)} />)}
    </AbsoluteFill>
  );
}

function ShotView({ shot, c }: { shot: WalkShot; c: Ctx }) {
  const frame = useF(), b = c.brand, u = c.u, size = (c.portrait ? 76 : 64) * u;
  switch (shot.type) {
    case "ui": return <UiShot shot={shot} c={c} />;
    case "title": {
      const at = S(shot.at ?? shot.seconds / 2), swap = shot.then ? k(frame, at - 10, at + 8, inOut) : 0;
      return (
        <AbsoluteFill style={{ background: b.colors.bg, alignItems: "center", justifyContent: "center", padding: 80 * u, transform: `scale(${1 + Math.max(0, frame) * 0.0001})` }}>
          <div style={{ position: "absolute", opacity: 1 - swap, filter: swap ? `blur(${swap * 10}px)` : undefined }}><SerifLine text={shot.text} c={c} frame={frame} size={size} /></div>
          {shot.then && frame >= at - 10 && <div style={{ position: "absolute" }}><SerifLine text={shot.then} c={c} frame={frame - at + 4} size={size} /></div>}
        </AbsoluteFill>
      );
    }
    case "end": {
      const [a, w2] = b.wordmark; let n = 0; const tg = k(frame, 30, 64);
      return (
        <AbsoluteFill style={{ background: b.colors.bg, alignItems: "center", justifyContent: "center", gap: 34 * u, padding: 80 * u, transform: `scale(${1 + frame * 0.00008})` }}>
          <div style={{ fontFamily: b.fonts.display, ...b.displayStyle, fontSize: (c.portrait ? 120 : 132) * u, lineHeight: 1, display: "flex", whiteSpace: "nowrap" }}>
            {[a, w2].map((part, pi) => part && part.split("").map((ch) => { const t0 = 4 + n++ * 2.2, e = k(frame, t0, t0 + 26);
              return <span key={n} style={{ display: "inline-block", color: pi ? b.colors.accent : b.colors.ink, opacity: e, filter: `blur(${(1 - e) * 10}px)`, transform: `translateY(${(1 - e) * 0.3}em)` }}>{ch}</span>; }))}
          </div>
          <div style={{ opacity: tg, filter: `blur(${(1 - tg) * 8}px)` }}><SerifLine text={shot.tagline} c={c} frame={frame - 30} size={size * 0.72} /></div>
          {shot.url && <div style={{ fontFamily: b.fonts.mono, fontSize: 30 * u, color: b.colors.muted, opacity: k(frame, 54, 80) }}>{shot.url}</div>}
          {shot.footnote && <div style={{ position: "absolute", bottom: 54 * u, fontFamily: b.fonts.body, fontSize: 22 * u, color: b.colors.muted, opacity: k(frame, 60, 90), textAlign: "center", padding: `0 ${60 * u}px` }}>{shot.footnote}</div>}
        </AbsoluteFill>
      );
    }
  }
}

export function Walk({ product }: { product: Product }) {
  const walk = product.walk!, { width, height, durationInFrames } = useVideoConfig();
  useFontsAll([product.brand.fontCss, walk.serifCss]);
  const portrait = height > width * 1.2, square = !portrait && height > width * 0.8, u = portrait || square ? width / 1080 : height / 1080;
  let at = 0;
  return (
    <AbsoluteFill style={{ background: product.brand.colors.bg }}>
      {walk.shots.map((s, i) => {
        const from = Math.round(S(at)), len = Math.round(S(at + s.seconds)) - from, last = i === walk.shots.length - 1; at += s.seconds;
        return (
          <Sequence key={i} from={Math.max(0, from - (i ? OV : 0))} durationInFrames={len + (i ? OV : 0)}>
            <Fade first={i === 0}><ShotView shot={s} c={{ brand: product.brand, walk, u, portrait, square, width, height, len }} /></Fade>
          </Sequence>
        );
      })}
      {walk.music && <Audio src={staticFile(walk.music.file)}
        volume={(f) => (walk.music!.volume ?? 1) * interpolate(f, [0, 20, durationInFrames - 60, durationInFrames], [0, 1, 1, 0], clamp)} />}
    </AbsoluteFill>
  );
}

/** Each shot after the first fades in over the last one; the content inside keeps its own time. */
function Fade({ first, children }: { first: boolean; children: React.ReactNode }) {
  const frame = useCurrentFrame(), e = first ? 1 : k(frame, 0, OV, inOut);
  return <AbsoluteFill style={{ opacity: e }}><Lead.Provider value={first ? 0 : OV}>{children}</Lead.Provider></AbsoluteFill>;
}
