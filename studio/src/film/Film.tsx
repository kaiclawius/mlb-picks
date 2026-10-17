// Kinetic film: one short sentence per shot, words built on screen, timed to the beat, one accent colour,
// real product pictures as proof. 60 fps and no hard cuts: shots overlap, the old one blurs up and away while
// the new one builds, a sentence re-centres smoothly as words arrive, a tone change wipes in as a circle,
// numbers roll like an odometer, dots morph instead of jumping, and the camera moves continuously over
// sharp 2x stills (screen recordings run at ~25 fps and look laggy next to 60 fps type).
// Learned from launch films like TasteSkill v2's: structure, timing and transitions only.
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout } from "../anim";
import { Wordmark } from "../parts";
import { useFonts } from "../ProductVideo";
import { Brand, Film as FilmT, Product, Shot, StoryKey, Tone } from "../types";

export const FILM_FPS = 60;
const fpbOf = (bpm: number) => (FILM_FPS * 60) / bpm;
export const filmFrames = (f: FilmT) => Math.round(f.shots.reduce((n, s) => n + s.beats, 0) * fpbOf(f.bpm));
const OV = 16; // frames two shots overlap: the outgoing one leaves while the next one builds
const out = Easing.bezier(0.16, 1, 0.3, 1), inOut = Easing.bezier(0.65, 0, 0.35, 1), pop = Easing.bezier(0.34, 1.45, 0.64, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const k = (f: number, a: number, b: number, e = out) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

type Ctx = { brand: Brand; fpb: number; tone: Tone; u: number; portrait: boolean; square: boolean; width: number; height: number; len: number };
const colorsOf = (b: Brand, t: Tone) => t === "dark" ? { bg: b.colors.ink, ink: b.colors.bg, muted: "#8b99a3", accent: "#8fb0ff", chipBg: "#ffffff", chipInk: b.colors.ink }
  : t === "accent" ? { bg: b.colors.accent, ink: "#ffffff", muted: "rgba(255,255,255,.72)", accent: "#ffffff", chipBg: "#ffffff", chipInk: b.colors.accent }
  : { bg: b.colors.bg, ink: b.colors.ink, muted: b.colors.muted, accent: b.colors.accent, chipBg: b.colors.surface, chipInk: b.colors.ink };

/* ---------- text measuring (fonts are loaded before the first frame) ---------- */
let canvas: HTMLCanvasElement | null = null;
const measure = (text: string, font: string) => { canvas ??= document.createElement("canvas"); const g = canvas.getContext("2d")!; g.font = font; return g.measureText(text).width; };

/* ---------- markup: *accent*, [chip], | = next beat ---------- */
type Seg = { kind: "word" | "accent" | "chip"; text: string; beat: number; i: number; punct?: string };
function parse(text: string): Seg[] {
  const segs: Seg[] = []; let beat = 0, i = 0;
  for (const m of text.matchAll(/\[([^\]]+)\]([.,!?:;]*)|\*([^*]+)\*([.,!?:;]*)|(\|)|(\S+)/g)) {
    if (m[5]) { beat++; i = 0; continue; }
    if (m[1]) segs.push({ kind: "chip", text: m[1], beat, i: i++, punct: m[2] || undefined });
    else if (m[3]) { const ws = m[3].split(" "); ws.forEach((w, j) => segs.push({ kind: "accent", text: w + (j === ws.length - 1 ? m[4] || "" : ""), beat, i: i++ })); }
    else segs.push({ kind: "word", text: m[6], beat, i: i++ });
  }
  return segs;
}

/** A sentence that builds word by word. Each word's slot opens from zero width, so the line re-centres smoothly. */
function Words({ text, c, size, frame, maxWidth }: { text: string; c: Ctx; size: number; frame: number; maxWidth?: number }) {
  const col = colorsOf(c.brand, c.tone), segs = useMemo(() => parse(text), [text]);
  const font = `500 ${size}px ${c.brand.fonts.body}`, mono = `500 ${size * 0.72}px ${c.brand.fonts.mono}`, space = measure(" ", font);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", rowGap: size * 0.18, maxWidth, fontFamily: c.brand.fonts.body, fontWeight: 500, fontSize: size, lineHeight: 1.18, letterSpacing: "-0.02em", color: col.ink }}>
      {segs.map((s, n) => {
        const t0 = s.beat * c.fpb + s.i * 5, e = k(frame, t0, t0 + 22), slot = k(frame, t0, t0 + 18, inOut);
        if (s.kind === "chip") {
          // the chip grows while its label types in
          const typed = Math.round(interpolate(frame, [t0 + 4, t0 + 4 + s.text.length * 1.6], [0, s.text.length], clamp));
          const full = measure(s.text, mono) + size * 0.72 * 1.0, wNow = measure(s.text.slice(0, Math.max(1, typed)), mono) + size * 0.72 * 1.0;
          const p = k(frame, t0, t0 + 14, pop), pw = s.punct ? measure(s.punct, font) : 0;
          return (
            <span key={n} style={{ display: "inline-flex", alignItems: "center", width: (full + space * 0.6 + pw + space) * slot, overflow: "visible", whiteSpace: "nowrap" }}>
              <span style={{ display: "inline-block", width: wNow, marginLeft: space * 0.3, opacity: e, transform: `scale(${0.7 + 0.3 * p})`, fontFamily: c.brand.fonts.mono, fontSize: "0.72em", color: col.chipInk, background: col.chipBg,
                border: `${2 * c.u}px solid ${c.tone === "light" ? c.brand.colors.line : "transparent"}`, borderRadius: 12 * c.u, padding: "0.16em 0.5em", boxSizing: "content-box", overflow: "hidden", boxShadow: c.tone === "light" ? `0 ${8 * c.u}px ${24 * c.u}px rgba(0,0,0,.07)` : "none" }}>{s.text.slice(0, typed)}</span>
              {s.punct && <span style={{ opacity: k(frame, t0 + 10, t0 + 20) }}>{s.punct}</span>}
            </span>
          );
        }
        const w = measure(s.text, font);
        return (
          <span key={n} style={{ display: "inline-block", width: (w + space) * slot, whiteSpace: "nowrap" }}>
            <span style={{ display: "inline-block", opacity: e, transform: `translateY(${(1 - e) * 0.35}em)`, filter: `blur(${(1 - e) * 8}px)`, color: s.kind === "accent" ? col.accent : col.ink }}>{s.text}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Odometer: every digit rolls to its place. */
function Roll({ value, c, size, color }: { value: number; c: Ctx; size: number; color: string }) {
  const txt = Math.round(value).toLocaleString("en-US"), font = `${c.brand.fonts.display}`;
  return (
    <span style={{ display: "inline-flex", fontFamily: font, ...c.brand.displayStyle, fontSize: size, lineHeight: 1, color, fontVariantNumeric: "tabular-nums", height: size, overflow: "hidden" }}>
      {txt.split("").map((ch, i) => /\d/.test(ch)
        ? <span key={i} style={{ display: "inline-block", height: size }}><span style={{ display: "block", transform: `translateY(${-(Number(ch)) * size}px)`, transition: "none" }}>{"0123456789".split("").map((d) => <span key={d} style={{ display: "block", height: size }}>{d}</span>)}</span></span>
        : <span key={i}>{ch}</span>)}
    </span>
  );
}

/* ---------- a still in a browser window with a smooth camera over keys ---------- */
function Story({ keys, c, frame, w, url }: { keys: StoryKey[]; c: Ctx; frame: number; w: number; url?: string }) {
  const b = c.brand.colors, h = w * (c.portrait ? 5 / 4 : c.square ? 3 / 4 : 9 / 16);
  const at = keys.map((x) => x.at * c.fpb), idx = Math.max(0, at.filter((t) => frame >= t).length - 1);
  // camera: hold, then ease to the next key over 0.8 beat
  const cam = (field: "focus" | "zoom") => {
    const val = (x: StoryKey) => field === "zoom" ? [x.zoom ?? 1.4] : ((c.portrait && x.pfocus) || x.focus || [0.5, 0.5]);
    let v = val(keys[0]);
    for (let i = 1; i < keys.length; i++) { const p = k(frame, at[i] - c.fpb * 0.15, at[i] + c.fpb * 0.65, inOut); v = v.map((x, j) => x + (val(keys[i])[j] - x) * p); }
    return v;
  };
  const [fx, fy] = cam("focus"), [z0] = cam("zoom"), z = z0 * (1 + 0.025 * frame / c.len); // a slow drift on top keeps it alive
  const lim = (1 - 1 / z) / 2, tx = Math.max(-lim, Math.min(lim, 0.5 - fx)) * 100, ty = Math.max(-lim, Math.min(lim, 0.5 - fy)) * 100;
  const enter = k(frame, 0, 26);
  return (
    <div style={{ width: w, borderRadius: 20 * c.u, overflow: "hidden", background: b.surface, border: `${2 * c.u}px solid ${b.line}`, boxShadow: `0 ${34 * c.u}px ${90 * c.u}px rgba(20,32,42,.18)`, transform: `translateY(${(1 - enter) * 60 * c.u}px) scale(${0.96 + 0.04 * enter})`, opacity: enter }}>
      <div style={{ height: 46 * c.u, display: "flex", alignItems: "center", gap: 10 * c.u, padding: `0 ${18 * c.u}px`, borderBottom: `${2 * c.u}px solid ${b.line}` }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 12 * c.u, height: 12 * c.u, borderRadius: "50%", background: b.line }} />)}
        {url && <span style={{ marginLeft: 16 * c.u, fontFamily: c.brand.fonts.mono, fontSize: 18 * c.u, color: b.muted }}>{url}</span>}
      </div>
      <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: b.bg }}>
        <div style={{ position: "absolute", inset: 0, transform: `scale(${z}) translate(${tx}%, ${ty}%)` }}>
          {keys.map((key, i) => { if (i > 0 && keys[i].img === keys[i - 1].img) return null; const op = i === 0 ? 1 : k(frame, at[i] - 4, at[i] + 10);
            return <Img key={i} src={staticFile(key.img)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${fx * 100}% ${fy * 100}%` /* narrow windows crop the sides: aim the crop too */, opacity: op }} />; })}
        </div>
      </div>
      {void idx}
    </div>
  );
}

/* ---------- shots ---------- */
function ShotView({ shot, c }: { shot: Shot; c: Ctx }) {
  const frame = useCurrentFrame(), b = c.brand, col = colorsOf(b, c.tone), u = c.u, len = c.len;
  const lineSize = (c.portrait ? 66 : 76) * u, pad = (c.portrait ? 80 : 140) * u;
  const center: React.CSSProperties = { alignItems: "center", justifyContent: "center", padding: pad, flexDirection: "column", gap: 44 * u };
  switch (shot.type) {
    case "line":
      return <AbsoluteFill style={center}><Words text={shot.text} c={c} size={lineSize} frame={frame} maxWidth={(c.portrait ? 980 : 1500) * u} /></AbsoluteFill>;
    case "slam": {
      const phrases = shot.text.split("|").map((s) => s.trim()), i = Math.min(phrases.length - 1, Math.floor(frame / c.fpb)), local = frame - i * c.fpb;
      const p = k(local, 0, 16, pop), rows = c.portrait ? 11 : 7, pat = (shot.pattern || phrases[phrases.length - 1] + "  ").repeat(6);
      return (
        <AbsoluteFill style={{ ...center, overflow: "hidden" }}>
          <AbsoluteFill style={{ justifyContent: "space-around", opacity: 0.15 * k(frame, 0, 20) }}>
            {Array.from({ length: rows }, (_, r) => <div key={r} style={{ whiteSpace: "nowrap", fontFamily: b.fonts.display, ...b.displayStyle, fontSize: 120 * u, lineHeight: 1, color: col.ink,
              transform: `translateX(${(r % 2 ? -1 : 1) * (frame * 1.6 * u) - 400 * u}px)` }}>{pat}</div>)}
          </AbsoluteFill>
          <div style={{ fontFamily: b.fonts.display, ...b.displayStyle, fontSize: (c.portrait ? 120 : 150) * u, lineHeight: 0.95, letterSpacing: "-0.02em", color: col.ink, textAlign: "center", textWrap: "balance" as any,
            transform: `scale(${1.18 - 0.18 * p})`, filter: `blur(${(1 - k(local, 0, 10)) * 10}px)`, opacity: k(local, 0, 8) }}>{phrases[i]}</div>
        </AbsoluteFill>
      );
    }
    case "type": {
      // the camera starts close on the cursor and pulls back while the command types
      const n = Math.round(interpolate(frame, [6, len * 0.75], [0, shot.text.length], clamp)), caret = Math.floor(frame / 16) % 2 === 0;
      const zoom = interpolate(frame, [0, len * 0.85], [2.3, 1], { ...clamp, easing: inOut }), size = (c.portrait ? 36 : 46) * u;
      const typedW = measure((shot.prompt ?? "$") + " " + shot.text.slice(0, n), `400 ${size}px ${b.fonts.mono}`), fullW = measure((shot.prompt ?? "$") + " " + shot.text, `400 ${size}px ${b.fonts.mono}`);
      const follow = (fullW / 2 - typedW) * (zoom - 1) / zoom; // keep the cursor near the centre while zoomed in
      return (
        <AbsoluteFill style={center}>
          <div style={{ transform: `scale(${zoom}) translateX(${follow}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 * u }}>
            {shot.label && <div style={{ fontFamily: b.fonts.body, fontSize: 36 * u, color: col.muted, opacity: k(frame, len * 0.4, len * 0.6) }}>{shot.label}</div>}
            <div style={{ fontFamily: b.fonts.mono, fontSize: size, background: b.colors.ink, color: b.colors.bg, borderRadius: 16 * u, padding: `${24 * u}px ${34 * u}px`, whiteSpace: "pre", width: fullW + 70 * u + size * 0.6, boxShadow: `0 ${24 * u}px ${60 * u}px rgba(0,0,0,.18)` }}>
              <span style={{ color: "#8fb0ff" }}>{shot.prompt ?? "$"} </span>{shot.text.slice(0, n)}<span style={{ opacity: caret ? 1 : 0, background: "#ff8a3d", display: "inline-block", width: "0.5em", height: "1.05em", verticalAlign: "-0.18em", marginLeft: 3 * u }} />
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "field": {
      // a grid of dots that morphs into one row when the caption changes
      const cols = shot.cols || Math.ceil(Math.sqrt(shot.count)), [t1, t2] = shot.text.split("|").map((s) => s.trim()), half = Math.floor(len / 2);
      const m = k(frame, half - 10, half + 22, inOut), gap = 104 * u, rowGap = 74 * u;
      return (
        <AbsoluteFill style={center}>
          <div style={{ position: "relative", width: Math.max(cols * gap, shot.count * rowGap), height: Math.ceil(shot.count / cols) * gap }}>
            {Array.from({ length: shot.count }, (_, i) => {
              const gx = (i % cols - (cols - 1) / 2) * gap, gy = (Math.floor(i / cols) - (Math.ceil(shot.count / cols) - 1) / 2) * gap, rx = (i - (shot.count - 1) / 2) * rowGap;
              const p = k(frame, i * 3, i * 3 + 18, pop), x = gx + (rx - gx) * m, y = gy * (1 - m), s = 64 * u * (1 - 0.35 * m);
              return <span key={i} style={{ position: "absolute", left: "50%", top: "50%", width: s, height: s, marginLeft: x - s / 2, marginTop: y - s / 2, borderRadius: "50%", background: m > 0.5 ? col.accent : col.ink, transform: `scale(${p})` }} />;
            })}
          </div>
          <div style={{ position: "relative", height: lineSize * 1.4, width: "100%" }}>
            <AbsoluteFill style={{ opacity: 1 - k(frame, half - 10, half + 4), filter: `blur(${k(frame, half - 10, half + 4) * 8}px)` }}><Words text={t1} c={c} size={lineSize} frame={frame - 12} /></AbsoluteFill>
            {t2 && <AbsoluteFill><Words text={t2} c={c} size={lineSize} frame={frame - half} /></AbsoluteFill>}
          </div>
        </AbsoluteFill>
      );
    }
    case "story": {
      const w = c.square ? c.width * 0.84 : (c.portrait ? 940 : 1300) * u, at = shot.keys.map((x) => x.at * c.fpb), idx = Math.max(0, at.filter((t) => frame >= t).length - 1);
      const stampKey = shot.keys.findIndex((x) => x.stamp), sk = stampKey >= 0 ? k(frame, at[stampKey], at[stampKey] + 14, pop) : 0;
      const shake = stampKey >= 0 && frame >= at[stampKey] && frame < at[stampKey] + 10 ? Math.sin(frame * 2.2) * 7 * u * (1 - (frame - at[stampKey]) / 10) : 0;
      return (
        <AbsoluteFill style={{ ...center, gap: 46 * u, transform: `translate(${shake}px, ${shake * 0.5}px)` }}>
          <div style={{ position: "relative", height: (c.portrait ? 58 : 52) * u * 2.6, width: w, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            {shot.keys.map((key, i) => key.text && (i === 0 || key.text !== shot.keys[i - 1].text) ? (
              <AbsoluteFill key={i} style={{ justifyContent: "flex-end", alignItems: "center", opacity: i < idx ? 1 - k(frame, at[i + 1] - 8, at[i + 1] + 6) : 1, filter: i < idx ? `blur(${k(frame, at[i + 1] - 8, at[i + 1] + 6) * 8}px)` : undefined }}>
                {frame >= at[i] - 2 && <Words text={key.text} c={c} size={(c.portrait ? 58 : 52) * u} frame={frame - at[i]} maxWidth={w} />}
              </AbsoluteFill>) : null)}
          </div>
          <Story keys={shot.keys} c={c} frame={frame} w={w} url={shot.url} />
          {stampKey >= 0 && (
            <div style={{ position: "absolute", left: "50%", top: "60%", transform: `translate(-50%,-50%) rotate(-9deg) scale(${2.3 - 1.3 * sk})`, opacity: k(frame, at[stampKey], at[stampKey] + 4),
              fontFamily: b.fonts.display, ...b.displayStyle, fontSize: (c.portrait ? 130 : 170) * u, color: "#1d7a46", border: `${10 * u}px solid #1d7a46`, borderRadius: 18 * u, padding: `${6 * u}px ${34 * u}px`, background: "rgba(246,249,245,.88)", letterSpacing: "0.04em" }}>{shot.keys[stampKey].stamp}</div>
          )}
        </AbsoluteFill>
      );
    }
    case "score":
      return (
        <AbsoluteFill style={center}>
          {shot.text && <Words text={shot.text} c={c} size={lineSize * 0.85} frame={frame} />}
          <div style={{ display: "flex", flexDirection: c.portrait ? "column" : "row", gap: (c.portrait ? 60 : 140) * u, alignItems: "center" }}>
            {shot.rows.map((r, i) => { const t0 = 10 + i * c.fpb, v = interpolate(frame, [t0, t0 + c.fpb * 1.6], [r.from, r.to], { ...clamp, easing: out }), size = (c.portrait ? 170 : 190) * u;
              return <div key={i} style={{ textAlign: "center", opacity: k(frame, t0 - 6, t0 + 8), transform: `translateY(${(1 - k(frame, t0 - 6, t0 + 14)) * 30 * u}px)` }}>
                <Roll value={v} c={c} size={size} color={i === shot.rows.length - 1 ? col.accent : col.ink} />
                <div style={{ fontFamily: b.fonts.mono, fontSize: 26 * u, letterSpacing: "0.12em", textTransform: "uppercase", color: col.muted, marginTop: 20 * u }}>{r.label}</div>
              </div>; })}
          </div>
        </AbsoluteFill>
      );
    case "mask": {
      const size = Math.min((c.width * 0.9) / (shot.word.length * 1.02), c.height * 0.42), s = 1.12 - 0.12 * k(frame, 0, len * 0.8, out);
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{ transform: `scale(${1.3 - 0.15 * k(frame, 0, len, inOut)}) translateX(${interpolate(frame, [0, len], [3, -3])}%)` }}><Img src={staticFile(shot.img)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.62) contrast(1.6) saturate(1.3)" /* light UI shots need depth inside the letters */ }} /></AbsoluteFill>
          {/* multiply: the dark layer stays dark, the white word lets the picture through */}
          <AbsoluteFill style={{ background: "#04070a", mixBlendMode: "multiply", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: b.fonts.display, ...b.displayStyle, fontSize: size, lineHeight: 0.9, color: "#fff", transform: `scale(${s})`, whiteSpace: "nowrap", filter: `blur(${(1 - k(frame, 0, 18)) * 12}px)` }}>{shot.word}</div>
          </AbsoluteFill>
          {shot.text && <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: (c.portrait ? 260 : 110) * u }}><Words text={shot.text} c={{ ...c, tone: "dark" }} size={lineSize * 0.7} frame={frame - 14} /></AbsoluteFill>}
        </AbsoluteFill>
      );
    }
    case "montage": {
      // one picture per beat, each crossfading in over a few frames with its own slow push
      return (
        <AbsoluteFill style={{ background: b.colors.ink }}>
          {shot.cuts.map((cut, i) => { const t0 = i * c.fpb, op = i === 0 ? 1 : k(frame, t0 - 3, t0 + 5), z = (cut.zoom || 1.5) + 0.12 * k(frame, t0, t0 + c.fpb * 1.3, out);
            if (frame < t0 - 3 || frame > t0 + c.fpb * 1.4 + OV) return null;
            return <AbsoluteFill key={i} style={{ opacity: op }}><Img src={staticFile(cut.img)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})`, transformOrigin: `${(cut.focus?.[0] ?? 0.5) * 100}% ${(cut.focus?.[1] ?? 0.5) * 100}%` }} /></AbsoluteFill>; })}
          {shot.text && <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: (c.portrait ? 220 : 90) * u }}>
            <div style={{ fontFamily: b.fonts.mono, fontSize: 34 * u, background: b.colors.ink, color: b.colors.bg, padding: `${12 * u}px ${24 * u}px`, borderRadius: 12 * u, opacity: k(frame, 6, 18) }}>{shot.text}</div></AbsoluteFill>}
        </AbsoluteFill>
      );
    }
    case "end": {
      const letters = b.wordmark.join(""), size = Math.min(170 * u, (c.width * 0.86) / (letters.length * 0.98)), tg = k(frame, c.fpb, c.fpb + 24), ch = k(frame, c.fpb * 2, c.fpb * 2 + 18, pop);
      let n = 0;
      return (
        <AbsoluteFill style={center}>
          <div style={{ fontFamily: b.fonts.display, ...b.displayStyle, fontSize: size, lineHeight: 1, whiteSpace: "nowrap", display: "flex" }}>
            {b.wordmark.map((part, pi) => part && part.split("").map((ch2) => { const t0 = 2 + n++ * 2.2, e = k(frame, t0, t0 + 24);
              return <span key={n} style={{ display: "inline-block", color: pi ? b.colors.accent : col.ink, opacity: e, transform: `translateY(${(1 - e) * 0.5}em)`, filter: `blur(${(1 - e) * 10}px)` }}>{ch2}</span>; }))}
          </div>
          <div style={{ fontFamily: b.fonts.body, fontWeight: 500, fontSize: 48 * u, color: col.ink, opacity: tg, filter: `blur(${(1 - tg) * 8}px)`, textAlign: "center", textWrap: "balance" as any, maxWidth: 1300 * u }}>{shot.tagline}</div>
          {shot.chip && <div style={{ fontFamily: b.fonts.mono, fontSize: 36 * u, background: b.colors.ink, color: b.colors.bg, padding: `${14 * u}px ${30 * u}px`, borderRadius: 14 * u, transform: `scale(${0.8 + 0.2 * ch})`, opacity: ch }}>{shot.chip}</div>}
          {shot.url && <div style={{ fontFamily: b.fonts.mono, fontSize: 30 * u, color: col.muted, opacity: ch }}>{shot.url}</div>}
          {shot.footnote && <div style={{ position: "absolute", bottom: 50 * u, fontFamily: b.fonts.body, fontSize: 22 * u, color: col.muted, opacity: tg }}>{shot.footnote}</div>}
        </AbsoluteFill>
      );
    }
  }
}

/** Wraps a shot: its background (a circle wipe when the tone changes, a quick fade when it stays) and its exit
 *  (blur, fade and drift up) during the frames the next shot overlaps it. */
function ShotFrame({ shot, c, wipe, last }: { shot: Shot; c: Ctx; wipe: boolean; last: boolean }) {
  const frame = useCurrentFrame(), col = colorsOf(c.brand, c.tone);
  const exit = last ? 0 : k(frame, c.len - 2, c.len + OV - 2, inOut);
  const r = wipe ? interpolate(frame, [0, 22], [0, 150], { ...clamp, easing: inOut }) : 150;
  return (
    <AbsoluteFill style={{ clipPath: wipe ? `circle(${r}% at 50% 50%)` : undefined }}>
      <AbsoluteFill style={{ background: col.bg, opacity: wipe ? 1 : k(frame, 0, OV) }} />
      <AbsoluteFill style={{ opacity: 1 - exit, filter: exit ? `blur(${exit * 14}px)` : undefined, transform: `translateY(${-exit * 40 * c.u}px) scale(${1 - exit * 0.03})` }}>
        <ShotView shot={shot} c={c} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Film({ product }: { product: Product }) {
  useFonts(product.brand.fontCss);
  const film = product.film!, fpb = fpbOf(film.bpm), L = useLayout(), { durationInFrames } = useVideoConfig();
  const u = L.square ? L.width / 1300 : L.u; // square: size by width, not by a 1080p frame
  let beat = 0;
  return (
    <AbsoluteFill style={{ background: colorsOf(product.brand, film.shots[0].tone || "light").bg }}>
      {film.shots.map((s, i) => {
        const from = Math.round(beat * fpb), len = Math.round((beat + s.beats) * fpb) - from; beat += s.beats;
        const tone = s.tone || "light", prev = i ? film.shots[i - 1].tone || "light" : tone, last = i === film.shots.length - 1;
        return (
          <Sequence key={i} from={from} durationInFrames={len + (last ? 0 : OV)}>
            <ShotFrame shot={s} wipe={i > 0 && prev !== tone} last={last}
              c={{ brand: product.brand, fpb, tone, u, portrait: L.portrait, square: L.square, width: L.width, height: L.height, len }} />
          </Sequence>
        );
      })}
      {film.music && <Audio src={staticFile(film.music.file)} trimBefore={Math.round((film.music.offset || 0) * FILM_FPS)}
        volume={(f) => (film.music!.volume ?? 1) * interpolate(f, [durationInFrames - 40, durationInFrames], [1, 0], clamp)} />}
    </AbsoluteFill>
  );
}
