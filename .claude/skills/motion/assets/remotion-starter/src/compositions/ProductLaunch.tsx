// Example: a 20-second product launch film in the calm, premium style (works in 16:9, 9:16 and 1:1).
// Beats: hook -> problem -> product in action -> three features -> proof number -> end card.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Series } from "remotion";
import { BRAND } from "../brand";
import { DUR, EASE, s } from "../motion/tokens";
import { BrowserFrame, browserBar, Camera, Counter, Cursor, DriftBackground, KineticText, Pop, progress, Reveal, Scene, Stagger, Underline, useLayout } from "../motion/primitives";

const C = BRAND.colors, F = BRAND.fonts;
const display = (size: number): React.CSSProperties => ({ fontFamily: F.display, fontWeight: 800, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.035em", color: C.ink, margin: 0, textWrap: "balance" });

export const BEATS = { hook: s(3.4), problem: s(3), product: s(5.4), features: s(4.2), proof: s(3.2), end: s(3.4) };
export const launchFrames = () => Object.values(BEATS).reduce((a, b) => a + b, 0);

function Hook() {
  const { u, pad, portrait } = useLayout();
  return (
    <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: portrait ? "flex-start" : "center", textAlign: portrait ? "left" : "center" }}>
      <KineticText text={"Deine To-dos.\n*Endlich* im Griff."} at={6} gap={4} accent={C.accent} style={display((portrait ? 118 : 132) * u)} />
      <Reveal at={30} style={{ marginTop: 34 * u }}>
        <p style={{ fontFamily: F.body, fontSize: (portrait ? 40 : 38) * u, color: C.muted, margin: 0 }}>{BRAND.name}: die To-do-App, die mitdenkt.</p>
      </Reveal>
    </AbsoluteFill>
  );
}

function Problem() {
  const f = useCurrentFrame();
  const { u, pad, portrait } = useLayout();
  const items = ["12 Apps.", "40 offene Tabs.", "Kein Überblick."];
  return (
    <AbsoluteFill style={{ padding: pad, justifyContent: "center" }}>
      {items.map((t, i) => {
        const last = i === items.length - 1;
        // the first two lines dim when the third (the point) arrives: guide the eye to one thing at a time
        const dim = last ? 1 : 1 - 0.65 * progress(f, 34, 14);
        return (
          <Reveal key={t} at={4 + i * 11} from="up" style={{ opacity: dim }}>
            <p style={{ ...display((portrait ? 104 : 96) * u), color: last ? C.accent : C.ink, marginBottom: 10 * u }}>{t}</p>
          </Reveal>
        );
      })}
    </AbsoluteFill>
  );
}

/** A task list built in JSX, so it stays sharp at any size. Replace with a screenshot or screen recording when you have one. */
function MockApp({ w, h }: { w: number; h: number }) {
  const f = useCurrentFrame();
  const { u } = useLayout();
  const tasks = ["Angebot an Müller GmbH senden", "Präsentation Q4 fertigstellen", "Feedback zum Logo einholen", "Rechnungen prüfen"];
  const doneAt = [52, 92, -1, -1];
  return (
    <div style={{ width: w, height: h, background: C.surface, display: "flex" }}>
      <div style={{ width: w * 0.24, borderRight: `${1.5 * u}px solid ${C.line}`, padding: 26 * u, background: C.bg, fontFamily: F.body, fontSize: 19 * u, color: C.muted, display: "flex", flexDirection: "column", gap: 16 * u }}>
        <b style={{ color: C.ink, fontSize: 22 * u }}>{BRAND.name}</b>
        {["Heute", "Diese Woche", "Projekte", "Erledigt"].map((x, i) => <span key={x} style={{ color: i === 0 ? C.accent : undefined, fontWeight: i === 0 ? 700 : 500 }}>{x}</span>)}
      </div>
      <div style={{ flex: 1, padding: `${34 * u}px ${40 * u}px`, fontFamily: F.body }}>
        <div style={{ fontSize: 34 * u, fontWeight: 800, color: C.ink, letterSpacing: "-0.02em" }}>Heute</div>
        <div style={{ fontSize: 18 * u, color: C.muted, marginTop: 4 * u }}>4 Aufgaben · 2 Termine</div>
        <div style={{ marginTop: 26 * u, display: "flex", flexDirection: "column", gap: 12 * u }}>
          {tasks.map((t, i) => {
            const k = doneAt[i] < 0 ? 0 : progress(f, doneAt[i], 12, EASE.enter);
            return (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 16 * u, padding: `${16 * u}px ${18 * u}px`, borderRadius: 12 * u, border: `${1.5 * u}px solid ${C.line}`, background: k > 0.5 ? C.bg : C.surface }}>
                <span style={{ width: 26 * u, height: 26 * u, borderRadius: 8 * u, border: `${2.5 * u}px solid ${k > 0 ? C.accent : C.line}`, background: k > 0 ? C.accent : "transparent", display: "grid", placeItems: "center", transform: `scale(${1 + Math.sin(k * Math.PI) * 0.18})` }}>
                  <svg width={16 * u} height={16 * u} viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={16} strokeDashoffset={16 * (1 - k)} /></svg>
                </span>
                <span style={{ position: "relative", fontSize: 22 * u, color: k > 0.5 ? C.muted : C.ink }}>
                  {t}<span style={{ position: "absolute", left: 0, top: "52%", height: 2 * u, width: `${k * 100}%`, background: C.muted }} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Product() {
  const { u, pad, width, height, portrait, safe } = useLayout();
  const capH = (portrait ? 300 : 170) * u;
  const winW = width - pad * 2, winH = height - pad - capH - (portrait ? safe.bottom : pad); // 9:16: stay above the platform UI
  const appW = Math.max(winW, 1500 * u), appH = Math.max(winH - 44 * u, 860 * u); // the app keeps its desktop layout; the camera frames it
  // cursor path in app pixels: to the first checkbox, click, to the second, click
  const cx = appW * 0.24 + 40 * u + 18 * u + 13 * u, row = (i: number) => 34 * u + 40 * u + 26 * u + 26 * u + i * (60 * u + 12 * u) + 30 * u;
  return (
    <AbsoluteFill style={{ padding: pad, flexDirection: "column" }}>
      <div style={{ height: capH, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 30 * u }}>
        <Reveal at={2}><p style={{ fontFamily: F.body, fontSize: 22 * u, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, margin: 0 }}>So einfach geht's</p></Reveal>
        <Reveal at={8}><h2 style={{ ...display((portrait ? 70 : 64) * u), marginTop: 10 * u }}>Abhaken. <span style={{ color: C.accent }}>Weitermachen.</span></h2></Reveal>
      </div>
      <Reveal at={4} from="up" distance={50} dur={DUR.enterBig}>
        <BrowserFrame url={BRAND.url} width={winW} height={winH} theme={C}>
          <Camera width={winW} height={winH - browserBar(u)} contentWidth={appW} contentHeight={appH} keys={[{ t: 0, x: 0.5, y: 0.4, zoom: 1 }, { t: 40, x: 0.5, y: 0.4, zoom: 1 }, { t: 110, x: 0.45, y: 0.32, zoom: portrait ? 1.6 : 1.35 }, { t: 160, x: 0.45, y: 0.32, zoom: portrait ? 1.65 : 1.4 }]}>
            <MockApp w={appW} h={appH} />
            <Cursor scale={u * 1.3} points={[{ t: 0, x: appW * 0.7, y: appH * 0.8 }, { t: 22, x: appW * 0.7, y: appH * 0.8 }, { t: 48, x: cx, y: row(0), click: true }, { t: 70, x: cx, y: row(0) }, { t: 88, x: cx, y: row(1), click: true }, { t: 160, x: cx + 60 * u, y: row(1) + 40 * u }]} ring={C.accent2} />
          </Camera>
        </BrowserFrame>
      </Reveal>
    </AbsoluteFill>
  );
}

function Features() {
  const { u, pad, portrait, square } = useLayout();
  const stack = portrait || square;
  const items = [
    { t: "Plant deinen Tag", b: "Sortiert Aufgaben nach Fristen und Energie.", icon: "M4 6h16M4 12h10M4 18h6" },
    { t: "Erinnert rechtzeitig", b: "Nicht zu früh, nicht zu spät.", icon: "M12 4v8l5 3" },
    { t: "Teilt mit dem Team", b: "Ein Link, alle auf dem gleichen Stand.", icon: "M8 12a4 4 0 1 0 0-.01M16 8a3 3 0 1 0 0-.01M16 16a3 3 0 1 0 0-.01" },
  ];
  return (
    <AbsoluteFill style={{ padding: pad, justifyContent: "center" }}>
      <Reveal at={0}><h2 style={display((stack ? 84 : 80) * u)}>Mehr als eine Liste.</h2></Reveal>
      <Stagger at={12} gap={6} style={{ display: "grid", gridTemplateColumns: stack ? "1fr" : "repeat(3, 1fr)", gap: 26 * u, marginTop: 50 * u }}>
        {items.map((it) => (
          <div key={it.t} style={{ background: C.surface, border: `${1.5 * u}px solid ${C.line}`, borderRadius: 20 * u, padding: 36 * u, height: "100%", boxSizing: "border-box" }}>
            <div style={{ width: 54 * u, height: 54 * u, borderRadius: 14 * u, background: `${C.accent}14`, display: "grid", placeItems: "center", marginBottom: 22 * u }}>
              <svg width={28 * u} height={28 * u} viewBox="0 0 24 24"><path d={it.icon} fill="none" stroke={C.accent} strokeWidth={2.2} strokeLinecap="round" /></svg>
            </div>
            <div style={{ fontFamily: F.display, fontWeight: 750, fontSize: 36 * u, color: C.ink, letterSpacing: "-0.02em" }}>{it.t}</div>
            <div style={{ fontFamily: F.body, fontSize: 26 * u, color: C.muted, marginTop: 10 * u, lineHeight: 1.4 }}>{it.b}</div>
          </div>
        ))}
      </Stagger>
    </AbsoluteFill>
  );
}

function Proof() {
  const { u, pad, portrait } = useLayout();
  return (
    <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <Reveal at={0} from="scale"><div style={{ ...display((portrait ? 230 : 250) * u), color: C.accent }}><Counter from={0} to={2.5} decimals={1} at={4} dur={40} suffix=" Std." /></div></Reveal>
      <Underline at={34} color={C.accent2} width={portrait ? 560 : 640} style={{ marginTop: -6 * u }} />
      <Reveal at={24}><p style={{ fontFamily: F.body, fontSize: (portrait ? 46 : 44) * u, color: C.ink, margin: `${26 * u}px 0 0`, fontWeight: 600 }}>gespart, jede Woche.</p></Reveal>
      <Reveal at={40}><p style={{ fontFamily: F.body, fontSize: 24 * u, color: C.muted, marginTop: 18 * u }}>Durchschnitt aus der Beta mit 1.200 Nutzern (Beispielwert)</p></Reveal>
    </AbsoluteFill>
  );
}

function End() {
  const { u, pad } = useLayout();
  return (
    <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <Pop at={4}><div style={{ width: 120 * u, height: 120 * u, borderRadius: 34 * u, background: C.accent, display: "grid", placeItems: "center", boxShadow: `0 ${20 * u}px ${50 * u}px ${C.accent}55` }}>
        <svg width={64 * u} height={64 * u} viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg></div></Pop>
      <Reveal at={14}><h2 style={{ ...display(110 * u), marginTop: 40 * u }}>{BRAND.name}</h2></Reveal>
      <Reveal at={22}><p style={{ fontFamily: F.body, fontSize: 38 * u, color: C.muted, marginTop: 18 * u }}>Jetzt kostenlos testen.</p></Reveal>
      <Reveal at={30}><div style={{ marginTop: 40 * u, fontFamily: F.mono, fontSize: 32 * u, color: C.bg, background: C.ink, padding: `${16 * u}px ${34 * u}px`, borderRadius: 99 }}>{BRAND.url}</div></Reveal>
    </AbsoluteFill>
  );
}

// Scenes run one after another; each one exits before the next enters (see Scene). The shared drifting
// background keeps the film continuous, so no crossfades are needed.
const SCENES: [keyof typeof BEATS, React.FC][] = [["hook", Hook], ["problem", Problem], ["product", Product], ["features", Features], ["proof", Proof], ["end", End]];

export function ProductLaunch() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <DriftBackground colors={[C.bg, `${C.accent}12`, `${C.accent2}10`]} />
      <Series>
        {SCENES.map(([k, View], i) => (
          <Series.Sequence key={k} durationInFrames={BEATS[k]}>
            <Scene dur={BEATS[k]} exit={i === SCENES.length - 1 ? 0 : 10}><View /></Scene>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
