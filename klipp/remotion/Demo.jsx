// The "Demo-Film": a recording turned into a calm product video. Intro card, the screen in a floating
// window with the camera bubble, chapter titles as they come up, captions, and a closing card.
import React from "react";
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

export const FPS = 30;
const INTRO = 3.6, OUTRO = 4, XF = 0.6; // seconds
export const demoFrames = (p) => Math.round((INTRO + OUTRO + p.segments.reduce((s, x) => s + x.dur, 0)) * FPS);

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const fade = (f, start, dur = 20) => interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
const C = { bg: "#f7f6f2", ink: "#18191d", muted: "#666a73", line: "#e3e0d8" };
const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

function Intro({ title, summary, accent }) {
  const f = useCurrentFrame();
  const out = interpolate(f, [(INTRO - XF) * FPS, INTRO * FPS], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", padding: "0 160px", opacity: out }}>
      <div style={{ width: 64, height: 8, borderRadius: 4, background: accent, opacity: fade(f, 2), marginBottom: 40 }} />
      <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 104, lineHeight: 1.04, letterSpacing: "-0.035em", color: C.ink, margin: 0, maxWidth: 1500, opacity: fade(f, 6, 26), transform: `translateY(${(1 - fade(f, 6, 26)) * 30}px)` }}>{title}</h1>
      {summary && <p style={{ fontFamily: FONT, fontSize: 38, lineHeight: 1.4, color: C.muted, marginTop: 36, maxWidth: 1400, opacity: fade(f, 20, 26) }}>{summary}</p>}
    </AbsoluteFill>
  );
}

function Outro({ title, tldr, outro, accent }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", padding: "0 160px", opacity: fade(f, 0, 18) }}>
      <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, letterSpacing: "0.14em", textTransform: "uppercase", color: accent, margin: 0 }}>Zusammengefasst</p>
      <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 76, lineHeight: 1.08, letterSpacing: "-0.03em", color: C.ink, margin: "22px 0 34px", maxWidth: 1500 }}>{title}</h2>
      {tldr.slice(0, 4).map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 22, alignItems: "baseline", fontFamily: FONT, fontSize: 36, lineHeight: 1.4, color: C.ink, marginTop: 14, opacity: fade(f, 10 + i * 8), transform: `translateY(${(1 - fade(f, 10 + i * 8)) * 16}px)` }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: accent, flex: "none", transform: "translateY(-6px)" }} />{t}
        </div>
      ))}
      {outro && <p style={{ fontFamily: FONT, fontSize: 32, color: C.muted, marginTop: 50, opacity: fade(f, 30) }}>{outro}</p>}
    </AbsoluteFill>
  );
}

function Screen({ segments, main, cam, bubble, chapters, cues, accent, total }) {
  const f = useCurrentFrame();
  const t = f / FPS; // seconds in the edited timeline
  const { width } = useVideoConfig();
  const winW = 1680, winH = 945, left = (width - winW) / 2, top = 58;
  const appear = fade(f, 0, 24);
  const push = interpolate(f, [0, total * FPS], [1, 1.025]);
  const size = Math.round(winW * Math.max(0.1, Math.min(0.4, bubble.size || 0.2)));
  const m = Math.round(winW * 0.025);
  const c = bubble.corner || "bl";
  const bpos = { [c.endsWith("l") ? "left" : "right"]: m, [c.startsWith("t") ? "top" : "bottom"]: m };
  const chapter = [...chapters].reverse().find((x) => x.t <= t + 0.01);
  const chStart = chapter ? chapter.t : 0;
  const chIn = fade(f, chStart * FPS, 18), chOut = interpolate(f, [(chStart + 3.2) * FPS, (chStart + 3.8) * FPS], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cue = cues.find((x) => t >= x.start && t <= x.end + 0.1);
  let acc = 0;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", left, top, width: winW, height: winH, borderRadius: 22, overflow: "hidden", background: "#000",
        boxShadow: "0 40px 90px rgba(20,25,30,.18), 0 6px 18px rgba(20,25,30,.08)", border: `1.5px solid ${C.line}`,
        opacity: appear, transform: `translateY(${(1 - appear) * 40}px) scale(${push})` }}>
        {segments.map((s, i) => {
          const from = Math.round(acc * FPS), dur = Math.max(1, Math.round(s.dur * FPS)); acc += s.dur;
          return (
            <Sequence key={i} from={from} durationInFrames={dur} layout="none">
              <OffthreadVideo src={main} trimBefore={Math.round(s.from * FPS)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
              {cam && !bubble.hidden && (
                <div style={{ position: "absolute", ...bpos, width: size, height: size, borderRadius: bubble.shape === "rounded" ? "22%" : "50%", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}>
                  <OffthreadVideo src={cam} trimBefore={Math.round(s.from * FPS)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
            </Sequence>
          );
        })}
        {cue && (
          <div style={{ position: "absolute", left: 120, right: 120, bottom: 54, textAlign: "center" }}>
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 40, lineHeight: 1.45, color: "#fff", background: "rgba(0,0,0,.72)", padding: "6px 18px", borderRadius: 10, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{cue.text}</span>
          </div>
        )}
      </div>
      {chapter && chapter.title && (
        <div style={{ position: "absolute", left: left + 36, top: top + 30, display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,.95)", padding: "14px 22px", borderRadius: 14,
          boxShadow: "0 10px 30px rgba(0,0,0,.18)", fontFamily: FONT, opacity: Math.min(chIn, chOut), transform: `translateY(${(1 - chIn) * -12}px)` }}>
          <span style={{ fontWeight: 800, fontSize: 22, color: accent }}>{String(chapters.indexOf(chapter) + 1).padStart(2, "0")}</span>
          <span style={{ fontWeight: 700, fontSize: 30, color: C.ink, letterSpacing: "-0.01em" }}>{chapter.title}</span>
        </div>
      )}
    </AbsoluteFill>
  );
}

export function Demo(p) {
  const total = p.segments.reduce((s, x) => s + x.dur, 0);
  const intro = Math.round(INTRO * FPS), body = Math.round(total * FPS);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence durationInFrames={intro}><Intro {...p} /></Sequence>
      <Sequence from={intro} durationInFrames={body}><Screen {...p} total={total} /></Sequence>
      <Sequence from={intro + body}><Outro {...p} /></Sequence>
    </AbsoluteFill>
  );
}
