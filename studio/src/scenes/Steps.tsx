import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ease, reveal, useLayout } from "../anim";
import { display, Kicker } from "../parts";
import { Brand, Scene } from "../types";

export function Steps({ scene, brand }: { scene: Extract<Scene, { type: "steps" }>; brand: Brand }) {
  const f = useCurrentFrame();
  const { u, pad, portrait, square } = useLayout();
  const c = brand.colors;
  const stack = portrait || square;
  const line = interpolate(f, [14, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <AbsoluteFill style={{ padding: pad, justifyContent: "center" }}>
      {scene.kicker && <Kicker brand={brand} u={u} style={reveal(f, 0)}>{scene.kicker}</Kicker>}
      <h2 style={{ ...display(brand, (stack ? 84 : 92) * u), marginTop: 18 * u, ...reveal(f, 4) }}>{scene.title}</h2>
      <div style={{ position: "relative", marginTop: 64 * u, display: "grid", gridTemplateColumns: stack ? "1fr" : `repeat(${scene.steps.length}, 1fr)`, gap: stack ? 34 * u : 0 }}>
        {!stack && <div style={{ position: "absolute", left: 0, top: 0, height: 3 * u, width: `${line * 100}%`, background: c.ink }} />}
        {scene.steps.map((s, i) => (
          <div key={i} style={{ paddingTop: stack ? 0 : 30 * u, paddingRight: 30 * u, display: stack ? "grid" : "block", gridTemplateColumns: stack ? `${90 * u}px 1fr` : undefined, ...reveal(f, 18 + i * 9) }}>
            <div style={{ fontFamily: brand.fonts.mono, fontSize: 24 * u, fontWeight: 700, color: c.accent }}>{String(i + 1).padStart(2, "0")}</div>
            <div>
              <div style={{ ...display(brand, 42 * u), marginTop: stack ? 0 : 12 * u }}>{s.title}</div>
              <div style={{ fontFamily: brand.fonts.body, fontSize: 27 * u, lineHeight: 1.4, color: c.muted, marginTop: 12 * u }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
