// Building blocks for motion design in Remotion. Everything is driven by the frame number (never by CSS
// transitions, timers or Math.random), so every render is identical and scrubbing in the Studio is exact.
import React, { useMemo } from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import { useAudioData } from "@remotion/media-utils";
import { DUR, EASE, SPRING } from "./tokens";

type Ease = (t: number) => number;

/** 0 -> 1 between `start` and `start + dur` frames, eased and clamped. */
export function progress(frame: number, start: number, dur: number, ease: Ease = EASE.enter) {
  return interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
}

/**
 * Layout for any aspect ratio. `u` scales sizes so 1 unit = 1 px on a 1080-wide portrait or 1920-wide landscape frame.
 * `safe` keeps text clear of platform UI (captions, buttons, profile) on 9:16 feeds.
 */
export function useLayout() {
  const { width, height } = useVideoConfig();
  const portrait = height > width * 1.2;
  const square = !portrait && height > width * 0.8;
  const u = portrait || square ? width / 1080 : Math.min(width / 1920, height / 1080);
  const pad = (portrait ? 84 : square ? 90 : 120) * u;
  const safe = portrait ? { top: height * 0.12, bottom: height * 0.2, side: width * 0.08 } : { top: pad, bottom: pad, side: pad };
  return { width, height, portrait, square, u, pad, safe };
}

type From = "up" | "down" | "left" | "right" | "scale" | "none";
const offset = (from: From, d: number, k: number) => {
  const r = 1 - k;
  switch (from) {
    case "up": return `translate3d(0, ${r * d}px, 0)`;
    case "down": return `translate3d(0, ${-r * d}px, 0)`;
    case "left": return `translate3d(${r * d}px, 0, 0)`;
    case "right": return `translate3d(${-r * d}px, 0, 0)`;
    case "scale": return `scale(${0.92 + 0.08 * k})`;
    default: return "none";
  }
};

/** Fade + move in at `at`, optionally out at `out`. The workhorse for every element that appears. */
export function Reveal({ at = 0, dur = DUR.enter, from = "up", distance = 28, out, outDur = DUR.exit, blur = false, style, children }: {
  at?: number; dur?: number; from?: From; distance?: number; out?: number; outDur?: number; blur?: boolean; style?: React.CSSProperties; children: React.ReactNode;
}) {
  const f = useCurrentFrame();
  const { u } = useLayout();
  const k = progress(f, at, dur);
  const o = out === undefined ? 0 : progress(f, out, outDur, EASE.exit);
  return (
    <div style={{ ...style, opacity: k * (1 - o), transform: offset(from, distance * u, k * (1 - o * 0.6)), filter: blur ? `blur(${(1 - k) * 8 * u}px)` : undefined, willChange: "transform, opacity" }}>
      {children}
    </div>
  );
}

/** Children appear one after another (reading order). */
export function Stagger({ at = 0, gap = DUR.stagger, from = "up", style, itemStyle, children }: {
  at?: number; gap?: number; from?: From; style?: React.CSSProperties; itemStyle?: React.CSSProperties; children: React.ReactNode;
}) {
  return (
    <div style={style}>
      {React.Children.toArray(children).map((c, i) => <Reveal key={i} at={at + i * gap} from={from} style={itemStyle}>{c}</Reveal>)}
    </div>
  );
}

/**
 * Kinetic headline: words (or lines) rise out of a mask one after another, the classic premium title reveal.
 * Wrap words in *stars* to color them with `accent`.
 */
export function KineticText({ text, at = 0, by = "word", gap = 3, dur = DUR.enter, accent, style }: {
  text: string; at?: number; by?: "word" | "line"; gap?: number; dur?: number; accent?: string; style?: React.CSSProperties;
}) {
  const f = useCurrentFrame();
  // mark which words sit inside *...* (a highlight may span several words: "*einen Tag*")
  let inside = false;
  const tokens = (by === "line" ? text.split("\n") : text.split(/(\s+)/)).filter((w) => w.length).map((w) => {
    if (/^\s+$/.test(w)) return { w, space: true, hi: false };
    const opens = w.startsWith("*"), closes = /\*[.,!?:;]?$/.test(w);
    const hi = inside || opens;
    if (opens) inside = true;
    if (closes) inside = false;
    return { w: w.replace(/\*/g, ""), space: false, hi };
  });
  let i = 0;
  return (
    <div style={{ ...style, whiteSpace: by === "line" ? "normal" : "pre-wrap" }}>
      {tokens.map((t, idx) => {
        if (t.space) return <span key={idx}>{t.w.includes("\n") ? <br /> : " "}</span>;
        const k = progress(f, at + i++ * gap, dur);
        return (
          <span key={idx} style={{ display: by === "line" ? "block" : "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.08em", marginBottom: "-0.08em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - k) * 105}%)`, opacity: k > 0 ? 1 : 0, color: t.hi && accent ? accent : undefined }}>{t.w}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Number that counts up with an ease-out, in tabular figures so it does not jitter. */
export function Counter({ from = 0, to, at = 0, dur = 45, decimals = 0, prefix = "", suffix = "", locale = "de-DE", style }: {
  from?: number; to: number; at?: number; dur?: number; decimals?: number; prefix?: string; suffix?: string; locale?: string; style?: React.CSSProperties;
}) {
  const f = useCurrentFrame();
  const v = from + (to - from) * progress(f, at, dur, EASE.enter);
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{prefix}{v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/** A hand-drawn feeling underline that draws itself under text (SVG path animation). */
export function Underline({ at = 0, dur = 18, color, width = 400, thickness = 10, style }: {
  at?: number; dur?: number; color: string; width?: number; thickness?: number; style?: React.CSSProperties;
}) {
  const f = useCurrentFrame();
  const { u } = useLayout();
  const w = width * u, h = thickness * 3 * u;
  const d = `M ${thickness * u} ${h * 0.62} C ${w * 0.3} ${h * 0.25}, ${w * 0.62} ${h * 0.4}, ${w - thickness * u} ${h * 0.45}`;
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress(f, at, dur, EASE.move), d);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible", ...style }}>
      <path d={d} fill="none" stroke={color} strokeWidth={thickness * u} strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
    </svg>
  );
}

/** Pop-in with a spring, e.g. icons, badges, logo marks. */
export function Pop({ at = 0, preset = "snappy", style, children }: { at?: number; preset?: keyof typeof SPRING; style?: React.CSSProperties; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: f - at, fps, config: SPRING[preset] });
  return <div style={{ ...style, transform: `scale(${k})`, opacity: Math.min(1, k * 2) }}>{children}</div>;
}

/**
 * Keyframed camera. Shows `content` (laid out at its natural size, contentWidth × contentHeight px) through a
 * viewport of width × height px. zoom 1 = the content just covers the viewport; x/y = the focus point as a
 * fraction of the content (pixel x / contentWidth). The focus is centred, but the camera never shows past the
 * content's edges, so a focus near an edge simply stops there.
 */
export type CamKey = { t: number; x: number; y: number; zoom: number };
export function Camera({ keys, width, height, contentWidth = width, contentHeight = height, children, style }: {
  keys: CamKey[]; width: number; height: number; contentWidth?: number; contentHeight?: number; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const f = useCurrentFrame();
  let cam: Omit<CamKey, "t"> = keys[0] || { x: 0.5, y: 0.5, zoom: 1 };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (f >= a.t) {
      const k = progress(f, a.t, b.t - a.t, EASE.move);
      cam = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: a.zoom + (b.zoom - a.zoom) * k };
    }
  }
  const sc = Math.max(width / contentWidth, height / contentHeight) * Math.max(1, cam.zoom);
  const place = (view: number, size: number, focus: number) => {
    const total = size * sc;
    return total <= view ? (view - total) / 2 : Math.min(0, Math.max(view - total, view / 2 - focus * total));
  };
  return (
    <div style={{ position: "relative", overflow: "hidden", width, height, ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: contentWidth, height: contentHeight, transformOrigin: "0 0",
        transform: `translate(${place(width, contentWidth, cam.x)}px, ${place(height, contentHeight, cam.y)}px) scale(${sc})` }}>{children}</div>
    </div>
  );
}

/** Height of the BrowserFrame title bar; the content area is `height - browserBar(u)`. */
export const browserBar = (u: number) => 44 * u;

/** A clean browser window for product UI (screenshots, recordings or UI built in JSX). */
export function BrowserFrame({ url, width, height, theme, children, style }: {
  url?: string; width: number; height: number; theme: { surface: string; line: string; muted: string; bg: string }; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const { u } = useLayout();
  const bar = browserBar(u);
  return (
    <div style={{ width, height, borderRadius: 18 * u, overflow: "hidden", background: theme.surface, border: `${1.5 * u}px solid ${theme.line}`,
      boxShadow: `0 ${40 * u}px ${90 * u}px rgba(15,20,30,.16), 0 ${6 * u}px ${18 * u}px rgba(15,20,30,.08)`, ...style }}>
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: 9 * u, padding: `0 ${18 * u}px`, borderBottom: `${1.5 * u}px solid ${theme.line}` }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 12 * u, height: 12 * u, borderRadius: 99, background: theme.line }} />)}
        {url && <span style={{ marginLeft: 16 * u, fontSize: 17 * u, color: theme.muted, background: theme.bg, borderRadius: 8 * u, padding: `${4 * u}px ${14 * u}px`, fontFamily: "ui-monospace, monospace" }}>{url}</span>}
      </div>
      <div style={{ position: "relative", width, height: height - bar, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

/**
 * A pointer that glides between points and clicks, for demos built from screenshots or JSX UI.
 * points: [{ t, x, y, click? }] with t in frames and x/y in px inside the parent.
 */
export function Cursor({ points, color = "#111", ring = "#ff5a36", scale = 1 }: { points: { t: number; x: number; y: number; click?: boolean }[]; color?: string; ring?: string; scale?: number }) {
  const f = useCurrentFrame();
  let x = points[0].x, y = points[0].y;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (f >= a.t) { const k = progress(f, a.t, b.t - a.t, EASE.move); x = a.x + (b.x - a.x) * k; y = a.y + (b.y - a.y) * k; }
  }
  const click = points.filter((p) => p.click).map((p) => f - p.t).find((d) => d >= 0 && d < 18);
  const press = click !== undefined && click < 5 ? 0.86 : 1;
  return (
    <>
      {click !== undefined && <div style={{ position: "absolute", left: x - 26 * scale, top: y - 26 * scale, width: 52 * scale, height: 52 * scale, borderRadius: 99,
        border: `${3 * scale}px solid ${ring}`, opacity: 1 - click / 18, transform: `scale(${0.6 + (click / 18) * 1.2})`, pointerEvents: "none" }} />}
      <svg width={30 * scale} height={30 * scale} viewBox="0 0 28 28" style={{ position: "absolute", left: x - 5 * scale, top: y - 3 * scale, transform: `scale(${press})`, transformOrigin: "5px 3px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))" }}>
        <path d="M5 3l17 9.5-7.4 1.6L11 21z" fill={color} stroke="#fff" strokeWidth={1.8} strokeLinejoin="round" />
      </svg>
    </>
  );
}

/** Slow drifting gradient background: alive but quiet. */
export function DriftBackground({ colors, speed = 1 }: { colors: [string, string, string]; speed?: number }) {
  const f = useCurrentFrame();
  const a = (f * 0.25 * speed) % 360;
  const x = 50 + Math.sin((f / 240) * speed) * 18, y = 40 + Math.cos((f / 300) * speed) * 14;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(60% 60% at ${x}% ${y}%, ${colors[1]} 0%, transparent 70%), radial-gradient(50% 50% at ${100 - x}% ${100 - y}%, ${colors[2]} 0%, transparent 70%), ${colors[0]}`, filter: `hue-rotate(${Math.sin((a * Math.PI) / 180) * 4}deg)` }} />
  );
}

/**
 * A scene that leaves before the next one arrives ("dip through the background"): the content drifts up and fades
 * over the last `exit` frames. Use this between text-heavy scenes; crossfading two blocks of text at the same spot reads as mush.
 */
export function Scene({ dur, exit = 10, enter = 0, lift = 18, style, children }: { dur: number; exit?: number; enter?: number; lift?: number; style?: React.CSSProperties; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const { u } = useLayout();
  const kOut = progress(f, dur - exit, exit, EASE.exit);
  const kIn = enter ? progress(f, 0, enter, EASE.enter) : 1;
  return <AbsoluteFill style={{ ...style, opacity: kIn * (1 - kOut), transform: `translate3d(0, ${-kOut * lift * u}px, 0)` }}>{children}</AbsoluteFill>;
}

/**
 * A real screenshot in a browser window, framed by a camera path, with an optional cursor.
 * Give the screenshot's pixel size; camera keys and cursor points use the screenshot's own pixels
 * (x: 540 means 540 px from the screenshot's left edge), so they stay right in every format.
 */
export function ScreenShot({ src, size, width, height, keys, cursor, cursorScale = 1, url, theme, ring }: {
  src: string; size: { w: number; h: number }; width: number; height: number;
  keys: { t: number; x: number; y: number; zoom: number }[]; cursor?: { t: number; x: number; y: number; click?: boolean }[]; cursorScale?: number;
  url?: string; theme: { surface: string; line: string; muted: string; bg: string }; ring?: string;
}) {
  const { u } = useLayout();
  return (
    <BrowserFrame url={url} width={width} height={height} theme={theme}>
      <Camera width={width} height={height - browserBar(u)} contentWidth={size.w} contentHeight={size.h} keys={keys.map((k) => ({ ...k, x: k.x / size.w, y: k.y / size.h }))}>
        <Img src={src} style={{ width: size.w, height: size.h, display: "block" }} />
        {cursor && <Cursor points={cursor} scale={cursorScale} ring={ring} />}
      </Camera>
    </BrowserFrame>
  );
}

/**
 * Social captions synced to speech: pages of a few words, the spoken word highlighted (color, or a `pill` background).
 * captions: Caption[] from scripts/captions.mjs (or @remotion/captions' parseSrt). at: frame where the audio starts.
 * Place it yourself (it is an inline block): on 9:16 centre it at 55-65 % height, inside the safe area.
 */
export function Captions({ captions, at = 0, combineMs = 900, color = "#fff", active = "#ffd23f", pill, style }: {
  captions: Caption[]; at?: number; combineMs?: number; color?: string; active?: string; pill?: string; style?: React.CSSProperties;
}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { pages } = useMemo(() => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: combineMs }), [captions, combineMs]);
  const ms = ((f - at) / fps) * 1000;
  const page = pages.find((p) => ms >= p.startMs && ms < p.startMs + p.durationMs && ms < (p.tokens.at(-1)?.toMs ?? 0) + 700);
  if (!page) return null;
  const k = progress(ms, page.startMs, 130); // 130 ms pop-in per page (ms-based clock)
  return (
    <div style={{ ...style, opacity: k, transform: `translateY(${(1 - k) * 12}px) scale(${0.96 + 0.04 * k})` }}>
      {page.tokens.map((t, i) => {
        const on = ms >= t.fromMs && ms < t.toMs;
        const lead = t.text.match(/^\s*/)![0];
        // no scale on the active word: it would eat the spaces next to it. A pill uses negative margins so the layout never shifts.
        return <React.Fragment key={i}>{lead}<span style={{ color: on ? active : color, borderRadius: "0.18em", padding: "0 0.12em", margin: "0 -0.12em",
          background: on && pill ? pill : "transparent" }}>{t.text.slice(lead.length)}</span></React.Fragment>;
      })}
    </div>
  );
}

/**
 * Bars that follow the loudness of an audio file (voice, music), e.g. under a speaker or as a logo motif.
 * Deterministic: computed from the decoded samples for each frame. at: frame where the audio starts.
 */
export function VoiceBars({ src, at = 0, bars = 32, width, height, color, gap = 0.45, span = 0.6, style }: {
  src: string; at?: number; bars?: number; width: number; height: number; color: string; gap?: number; span?: number; style?: React.CSSProperties;
}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = useAudioData(src);
  const levels = useMemo(() => {
    if (!data) return new Array(bars).fill(0);
    const ch = data.channelWaveforms[0], sr = data.sampleRate, t = (f - at) / fps;
    return Array.from({ length: bars }, (_, i) => {
      // bar i looks at a short window; the row covers `span` seconds around now, centre = now
      const c = t + (i / (bars - 1) - 0.5) * span, a = Math.floor((c - 0.02) * sr), b = Math.floor((c + 0.02) * sr);
      if (b <= 0 || a >= ch.length) return 0;
      let e = 0, n = 0; for (let j = Math.max(0, a); j < Math.min(ch.length, b); j++) { e += ch[j] * ch[j]; n++; }
      return Math.min(1, Math.sqrt(e / Math.max(1, n)) * 4.5);
    });
  }, [data, f, at, fps, bars, span]);
  const bw = width / (bars + (bars - 1) * gap);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: bw * gap, width, height, ...style }}>
      {levels.map((v, i) => {
        const edge = Math.sin((Math.PI * (i + 0.5)) / bars); // quieter at the ends: reads as a voice, not an EQ
        return <span key={i} style={{ width: bw, height: Math.max(bw, height * (0.08 + 0.92 * v * edge)), borderRadius: bw, background: color }} />;
      })}
    </div>
  );
}
