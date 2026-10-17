// Kinetic film: one short sentence per shot, words built on screen, hard cuts on the beat, one accent colour,
// real product footage as proof. Learned from launch films like TasteSkill v2's (structure and timing only).
// Every duration is in beats, so the whole film follows the music's tempo.
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout } from "../anim";
import { Wordmark } from "../parts";
import { useFonts } from "../ProductVideo";
import { Brand, Film as FilmT, Product, Shot, Tone } from "../types";

export const FILM_FPS = 30;
const fpbOf = (bpm: number) => (FILM_FPS * 60) / bpm;
export const filmFrames = (f: FilmT) => Math.round(f.shots.reduce((n, s) => n + s.beats, 0) * fpbOf(f.bpm));
const out = Easing.bezier(0.16, 1, 0.3, 1), pop = Easing.bezier(0.34, 1.56, 0.64, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const k = (f: number, a: number, b: number, e = out) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

type Ctx = { brand: Brand; fpb: number; tone: Tone; u: number; portrait: boolean; square: boolean; width: number; height: number };
const colorsOf = (b: Brand, t: Tone) => t === "dark" ? { bg: b.colors.ink, ink: b.colors.bg, muted: b.colors.line, accent: "#8fb0ff" }
  : t === "accent" ? { bg: b.colors.accent, ink: "#ffffff", muted: "rgba(255,255,255,.7)", accent: "#ffffff" }
  : { bg: b.colors.bg, ink: b.colors.ink, muted: b.colors.muted, accent: b.colors.accent };

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
function Words({ text, c, size, frame, x }: { text: string; c: Ctx; size: number; frame: number; x?: React.CSSProperties }) {
  const col = colorsOf(c.brand, c.tone);
  return (
    <div style={{ fontFamily: c.brand.fonts.body, fontWeight: 500, fontSize: size, lineHeight: 1.18, letterSpacing: "-0.02em", color: col.ink, textAlign: "center", textWrap: "balance" as any, ...x }}>
      {parse(text).map((s, n) => {
        const t0 = s.beat * c.fpb + s.i * 2, e = k(frame, t0, t0 + 10);
        const base: React.CSSProperties = { display: "inline-block", opacity: e, transform: `translateY(${(1 - e) * 0.32}em)`, filter: `blur(${(1 - e) * 6}px)`, marginRight: "0.26em" };
        if (s.kind === "chip") {
          const p = k(frame, t0, t0 + 9, pop);
          return <span key={n} style={{ whiteSpace: "nowrap", display: "inline-block" }}><span style={{ ...base, transform: `scale(${0.8 + 0.2 * p})`, fontFamily: c.brand.fonts.mono, fontWeight: 500, fontSize: "0.72em", color: c.tone === "accent" ? c.brand.colors.accent : c.brand.colors.ink,
            marginRight: s.punct ? "0.06em" : "0.26em", background: c.tone === "light" ? c.brand.colors.surface : "#ffffff", border: `${2 * c.u}px solid ${c.tone === "light" ? c.brand.colors.line : "transparent"}`, borderRadius: 10 * c.u, padding: "0.14em 0.5em", verticalAlign: "0.12em", boxShadow: c.tone === "light" ? `0 ${6 * c.u}px ${18 * c.u}px rgba(0,0,0,.06)` : "none" }}>{s.text}</span>{s.punct && <span style={{ ...base, color: col.ink }}>{s.punct}</span>}</span>;
        }
        return <span key={n} style={{ ...base, color: s.kind === "accent" ? col.accent : col.ink }}>{s.text}</span>;
      })}
    </div>
  );
}

/* ---------- a clip in a browser window, with a slow push-in ---------- */
function Window({ clip, from = 0, focus = [0.5, 0.5], zoom = [1, 1.08], url, c, frame, len, w }: { clip: string; from?: number; focus?: [number, number]; zoom?: [number, number]; url?: string; c: Ctx; frame: number; len: number; w: number }) {
  const z = interpolate(frame, [0, len], zoom, clamp), enter = k(frame, 0, 10);
  // move the focus point to the centre, but never so far that the clip's edge shows
  const lim = (1 - 1 / z) / 2, tx = Math.max(-lim, Math.min(lim, 0.5 - focus[0])) * 100, ty = Math.max(-lim, Math.min(lim, 0.5 - focus[1])) * 100;
  const h = w * (c.portrait ? 5 / 4 : c.square ? 3 / 4 : 9 / 16), b = c.brand.colors;
  return (
    <div style={{ width: w, borderRadius: 18 * c.u, overflow: "hidden", background: b.surface, border: `${2 * c.u}px solid ${b.line}`, boxShadow: `0 ${30 * c.u}px ${80 * c.u}px rgba(20,32,42,.18)`, transform: `translateY(${(1 - enter) * 30 * c.u}px)`, opacity: enter }}>
      <div style={{ height: 44 * c.u, display: "flex", alignItems: "center", gap: 10 * c.u, padding: `0 ${18 * c.u}px`, borderBottom: `${2 * c.u}px solid ${b.line}` }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 12 * c.u, height: 12 * c.u, borderRadius: "50%", background: b.line }} />)}
        {url && <span style={{ marginLeft: 16 * c.u, fontFamily: c.brand.fonts.mono, fontSize: 18 * c.u, color: b.muted }}>{url}</span>}
      </div>
      <div style={{ width: w, height: h, overflow: "hidden" }}>
        <OffthreadVideo src={staticFile(clip)} trimBefore={Math.round(from * FILM_FPS)} muted
          style={{ width: w, height: h, objectFit: "cover", transform: `scale(${z}) translate(${tx}%, ${ty}%)` }} />
      </div>
    </div>
  );
}

/* ---------- shots ---------- */
function ShotView({ shot, c, len }: { shot: Shot; c: Ctx; len: number }) {
  // +2: a hard cut should never land on an empty frame (it reads as a one-frame flash)
  const raw = useCurrentFrame(), frame = raw + 2, b = c.brand, col = colorsOf(b, c.tone), u = c.u; // raw: for events that must sit exactly on a beat
  const lineSize = (c.portrait ? 84 : 76) * u, pad = (c.portrait ? 80 : 140) * u;
  const center: React.CSSProperties = { alignItems: "center", justifyContent: "center", padding: pad, flexDirection: "column", gap: 40 * u };
  switch (shot.type) {
    case "line":
      return <AbsoluteFill style={center}><Words text={shot.text} c={c} size={lineSize} frame={frame} x={{ maxWidth: (c.portrait ? 900 : 1400) * u }} /></AbsoluteFill>;
    case "slam": {
      const phrases = shot.text.split("|").map((s) => s.trim()), i = Math.min(phrases.length - 1, Math.floor(raw / c.fpb)), local = raw - i * c.fpb + (i ? 0 : 2);
      const p = k(local, 0, 7, pop), rows = c.portrait ? 11 : 7, pat = (shot.pattern || phrases[phrases.length - 1] + "  ").repeat(6);
      return (
        <AbsoluteFill style={{ ...center, overflow: "hidden" }}>
          <AbsoluteFill style={{ justifyContent: "space-around", opacity: 0.16 }}>
            {Array.from({ length: rows }, (_, r) => <div key={r} style={{ whiteSpace: "nowrap", fontFamily: b.fonts.display, ...b.displayStyle, fontSize: 120 * u, lineHeight: 1, color: col.ink,
              transform: `translateX(${(r % 2 ? -1 : 1) * (frame * 3 * u) - 400 * u}px)` }}>{pat}</div>)}
          </AbsoluteFill>
          <div style={{ fontFamily: b.fonts.display, ...b.displayStyle, fontSize: (c.portrait ? 120 : 150) * u, lineHeight: 0.95, letterSpacing: "-0.02em", color: col.ink, textAlign: "center", textWrap: "balance" as any, transform: `scale(${1.25 - 0.25 * p})`, opacity: k(local, 0, 3) }}>{phrases[i]}</div>
        </AbsoluteFill>
      );
    }
    case "type": {
      const n = Math.round(interpolate(frame, [4, len * 0.7], [0, shot.text.length], clamp)), caret = Math.floor(frame / 8) % 2 === 0;
      return (
        <AbsoluteFill style={center}>
          {shot.label && <div style={{ fontFamily: b.fonts.body, fontSize: 40 * u, color: col.muted, opacity: k(frame, 0, 8) }}>{shot.label}</div>}
          <div style={{ fontFamily: b.fonts.mono, fontSize: (c.portrait ? 38 : 46) * u, background: b.colors.ink, color: b.colors.bg, borderRadius: 16 * u, padding: `${26 * u}px ${36 * u}px`, whiteSpace: "pre", boxShadow: `0 ${24 * u}px ${60 * u}px rgba(0,0,0,.2)` }}>
            <span style={{ color: "#8fb0ff" }}>{shot.prompt ?? "$"} </span>{shot.text.slice(0, n)}<span style={{ opacity: caret ? 1 : 0, background: b.colors.bg, display: "inline-block", width: "0.55em", height: "1.05em", verticalAlign: "-0.18em", marginLeft: 4 * u }} />
          </div>
        </AbsoluteFill>
      );
    }
    case "field": {
      const cols = shot.cols || Math.ceil(Math.sqrt(shot.count)), [t1, t2] = shot.text.split("|").map((s) => s.trim()), half = Math.floor(len / 2);
      return (
        <AbsoluteFill style={center}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${70 * u}px)`, gap: 34 * u }}>
            {Array.from({ length: shot.count }, (_, i) => { const p = k(frame, i * 1.4, i * 1.4 + 8, pop), lit = frame > half + i; return <span key={i} style={{ width: 70 * u, height: 70 * u, borderRadius: "50%", background: lit ? col.accent : col.ink, transform: `scale(${p})`, transition: "none" }} />; })}
          </div>
          <div style={{ position: "relative", height: lineSize * 1.3, width: "100%" }}>
            <AbsoluteFill style={{ opacity: 1 - k(frame, half - 3, half) }}><Words text={t1} c={c} size={lineSize} frame={frame - 8} /></AbsoluteFill>
            {t2 && <AbsoluteFill><Words text={t2} c={c} size={lineSize} frame={frame - half} /></AbsoluteFill>}
          </div>
        </AbsoluteFill>
      );
    }
    case "shot": case "stamp": {
      const w = c.square ? c.width * 0.84 : (c.portrait ? 940 : 1280) * u, clip = shot.clip;
      const sk = shot.type === "stamp" ? k(raw, c.fpb, c.fpb + 7, pop) : 0, shake = shot.type === "stamp" && raw >= c.fpb && raw < c.fpb + 6 ? Math.sin(raw * 3) * 6 * u : 0;
      return (
        <AbsoluteFill style={{ ...center, gap: 44 * u, transform: `translate(${shake}px, ${shake * 0.5}px)` }}>
          {shot.text && <Words text={shot.text} c={c} size={(c.portrait ? 58 : 52) * u} frame={frame} x={{ maxWidth: w }} />}
          {clip && <Window clip={clip} from={shot.from} focus={shot.focus} zoom={shot.zoom} url={(shot as any).url} c={c} frame={frame} len={len} w={w} />}
          {shot.type === "stamp" && (
            <div style={{ position: "absolute", left: "50%", top: clip ? "58%" : "50%", transform: `translate(-50%,-50%) rotate(-9deg) scale(${2.4 - 1.4 * sk})`, opacity: k(raw, c.fpb, c.fpb + 2),
              fontFamily: b.fonts.display, ...b.displayStyle, fontSize: (c.portrait ? 130 : 170) * u, color: "#1d7a46", border: `${10 * u}px solid #1d7a46`, borderRadius: 18 * u, padding: `${6 * u}px ${34 * u}px`, background: "rgba(246,249,245,.86)", letterSpacing: "0.04em" }}>{shot.stamp}</div>
          )}
        </AbsoluteFill>
      );
    }
    case "score":
      return (
        <AbsoluteFill style={center}>
          {shot.text && <Words text={shot.text} c={c} size={lineSize * 0.85} frame={frame} />}
          <div style={{ display: "flex", flexDirection: c.portrait ? "column" : "row", gap: (c.portrait ? 50 : 120) * u, alignItems: "center" }}>
            {shot.rows.map((r, i) => { const t0 = 4 + i * c.fpb, v = interpolate(frame, [t0, t0 + c.fpb * 1.5], [r.from, r.to], { ...clamp, easing: out });
              return <div key={i} style={{ textAlign: "center", opacity: k(frame, t0 - 2, t0 + 4) }}>
                <div style={{ fontFamily: b.fonts.display, ...b.displayStyle, fontSize: (c.portrait ? 170 : 190) * u, lineHeight: 1, color: i === shot.rows.length - 1 ? col.accent : col.ink, fontVariantNumeric: "tabular-nums" }}>{v.toLocaleString("en-US", { minimumFractionDigits: r.decimals || 0, maximumFractionDigits: r.decimals || 0 })}{r.suffix || ""}</div>
                <div style={{ fontFamily: b.fonts.mono, fontSize: 26 * u, letterSpacing: "0.12em", textTransform: "uppercase", color: col.muted, marginTop: 18 * u }}>{r.label}</div>
              </div>; })}
          </div>
        </AbsoluteFill>
      );
    case "mask": {
      const size = Math.min((c.width * 0.9) / (shot.word.length * 1.02), c.height * 0.42) /* wide display face: ~1em per letter */, s = 1.18 - 0.18 * k(frame, 0, len, out);
      return (
        <AbsoluteFill>
          <AbsoluteFill><OffthreadVideo src={staticFile(shot.clip)} trimBefore={Math.round((shot.from || 0) * FILM_FPS)} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.25 - 0.1 * k(frame, 0, len)})` }} /></AbsoluteFill>
          {/* multiply: the dark layer stays dark, the white word lets the footage through */}
          <AbsoluteFill style={{ background: "#04070a", mixBlendMode: "multiply", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: b.fonts.display, ...b.displayStyle, fontSize: size, lineHeight: 0.9, color: "#fff", transform: `scale(${s})`, whiteSpace: "nowrap" }}>{shot.word}</div>
          </AbsoluteFill>
          {shot.text && <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: (c.portrait ? 260 : 110) * u }}><Words text={shot.text} c={{ ...c, tone: "dark" }} size={lineSize * 0.7} frame={frame - 6} /></AbsoluteFill>}
        </AbsoluteFill>
      );
    }
    case "montage": {
      const i = Math.floor(raw / c.fpb) % shot.cuts.length, cut = shot.cuts[i], local = raw - Math.floor(raw / c.fpb) * c.fpb;
      return (
        <AbsoluteFill style={{ background: b.colors.ink }}>
          <OffthreadVideo key={i} src={staticFile(cut.clip)} trimBefore={Math.round((cut.from + local / FILM_FPS) * FILM_FPS)} muted
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${(cut.zoom || 1.3) + 0.04 * local / c.fpb})`, transformOrigin: `${(cut.focus?.[0] ?? 0.5) * 100}% ${(cut.focus?.[1] ?? 0.5) * 100}%` }} />
          {shot.text && <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: (c.portrait ? 220 : 90) * u }}>
            <div style={{ fontFamily: b.fonts.mono, fontSize: 34 * u, background: b.colors.ink, color: b.colors.bg, padding: `${12 * u}px ${24 * u}px`, borderRadius: 12 * u }}>{shot.text}</div></AbsoluteFill>}
        </AbsoluteFill>
      );
    }
    case "end": {
      const wm = k(frame, 0, 14), tg = k(frame, c.fpb, c.fpb + 12), ch = k(frame, c.fpb * 2, c.fpb * 2 + 9, pop);
      return (
        <AbsoluteFill style={center}>
          <div style={{ opacity: wm, transform: `translateY(${(1 - wm) * 40 * u}px)` }}><Wordmark brand={b} size={Math.min(170 * u, (c.width * 0.86) / (b.wordmark.join("").length * 0.98))} /></div>
          <div style={{ fontFamily: b.fonts.body, fontWeight: 500, fontSize: 48 * u, color: col.ink, opacity: tg, textAlign: "center", textWrap: "balance" as any, maxWidth: 1300 * u }}>{shot.tagline}</div>
          {shot.chip && <div style={{ fontFamily: b.fonts.mono, fontSize: 36 * u, background: b.colors.ink, color: b.colors.bg, padding: `${14 * u}px ${30 * u}px`, borderRadius: 14 * u, transform: `scale(${0.8 + 0.2 * ch})`, opacity: ch }}>{shot.chip}</div>}
          {shot.url && <div style={{ fontFamily: b.fonts.mono, fontSize: 30 * u, color: col.muted, opacity: ch }}>{shot.url}</div>}
          {shot.footnote && <div style={{ position: "absolute", bottom: 50 * u, fontFamily: b.fonts.body, fontSize: 22 * u, color: col.muted, opacity: tg }}>{shot.footnote}</div>}
        </AbsoluteFill>
      );
    }
  }
}

export function Film({ product }: { product: Product }) {
  useFonts(product.brand.fontCss);
  const film = product.film!, fpb = fpbOf(film.bpm), L = useLayout(), { durationInFrames } = useVideoConfig();
  let beat = 0;
  return (
    <AbsoluteFill style={{ background: product.brand.colors.bg }}>
      {film.shots.map((s, i) => {
        const from = Math.round(beat * fpb), len = Math.round((beat + s.beats) * fpb) - from; beat += s.beats;
        const tone = s.tone || "light", col = colorsOf(product.brand, tone);
        return (
          <Sequence key={i} from={from} durationInFrames={len}>
            <AbsoluteFill style={{ background: col.bg }}>
              <ShotView shot={s} len={len} c={{ brand: product.brand, fpb, tone, u: L.square ? L.width / 1300 : L.u /* square: size by width, not by a 1080p frame */, portrait: L.portrait, square: L.square, width: L.width, height: L.height }} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      {film.music && <Audio src={staticFile(film.music.file)} trimBefore={Math.round((film.music.offset || 0) * FILM_FPS)}
        volume={(f) => (film.music!.volume ?? 1) * interpolate(f, [durationInFrames - 20, durationInFrames], [1, 0], clamp)} />}
    </AbsoluteFill>
  );
}
