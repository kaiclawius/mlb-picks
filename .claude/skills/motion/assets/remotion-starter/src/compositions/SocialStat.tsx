// Example: an 8-second vertical social clip. One number, one message, big type, made for the feed.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BRAND } from "../brand";
import { EASE, s } from "../motion/tokens";
import { Counter, KineticText, progress, Reveal, Underline, useLayout } from "../motion/primitives";

const C = BRAND.colors, F = BRAND.fonts;
export const socialFrames = () => s(8);

export function SocialStat() {
  const f = useCurrentFrame();
  const { u, safe, width } = useLayout();
  // a dark stage with one slow light sweep: contrast for the feed, motion that never competes with the text
  const sweep = progress(f, 0, s(8), EASE.linear);
  return (
    <AbsoluteFill style={{ background: C.ink, paddingTop: safe.top, paddingBottom: safe.bottom, paddingLeft: safe.side, paddingRight: safe.side, justifyContent: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(70% 45% at ${20 + sweep * 60}% 35%, ${C.accent}55, transparent 70%)` }} />
      <Reveal at={2}><p style={{ fontFamily: F.body, fontSize: 34 * u, color: "#ffffffaa", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Wusstest du?</p></Reveal>
      <div style={{ fontFamily: F.display, fontWeight: 850, fontSize: 300 * u, lineHeight: 0.95, letterSpacing: "-0.05em", color: "#fff", marginTop: 20 * u }}>
        <Counter to={68} at={10} dur={42} suffix="%" />
      </div>
      <Underline at={50} color={C.accent2} width={width / u * 0.62} thickness={12} />
      <KineticText text={"der Teams verlieren\njede Woche *einen Tag*\nan Suchen."} at={60} gap={3} accent={C.accent2}
        style={{ fontFamily: F.display, fontWeight: 750, fontSize: 82 * u, lineHeight: 1.08, letterSpacing: "-0.03em", color: "#fff", marginTop: 34 * u }} />
      <Reveal at={150}><p style={{ fontFamily: F.body, fontSize: 36 * u, color: "#ffffffcc", marginTop: 60 * u }}>{BRAND.name} findet alles in einer Sekunde. <b style={{ color: "#fff" }}>{BRAND.url}</b></p></Reveal>
      <p style={{ position: "absolute", left: safe.side, right: safe.side, bottom: safe.bottom * 0.45, fontFamily: F.body, fontSize: 20 * u, color: "#ffffff66", margin: 0 }}>Quelle: Beispielzahl, vor Veröffentlichung durch echte Quelle ersetzen.</p>
    </AbsoluteFill>
  );
}
