import { AbsoluteFill, useCurrentFrame } from "remotion";
import { reveal, useLayout } from "../anim";
import { display, Kicker } from "../parts";
import { Brand, Scene } from "../types";

export function Features({ scene, brand }: { scene: Extract<Scene, { type: "features" }>; brand: Brand }) {
  const f = useCurrentFrame();
  const { u, pad, portrait, square } = useLayout();
  const c = brand.colors;
  const stack = portrait || square;
  return (
    <AbsoluteFill style={{ padding: pad, justifyContent: "center" }}>
      {scene.kicker && <Kicker brand={brand} u={u} style={reveal(f, 0)}>{scene.kicker}</Kicker>}
      <h2 style={{ ...display(brand, (stack ? 84 : 92) * u), marginTop: 18 * u, ...reveal(f, 4) }}>{scene.title}</h2>
      <div style={{ marginTop: 60 * u, display: "grid", gridTemplateColumns: stack ? "1fr" : `repeat(${scene.items.length}, 1fr)`, gap: (stack ? 26 : 34) * u }}>
        {scene.items.map((it, i) => (
          <div key={i} style={{ background: c.surface, border: `${1.5 * u}px solid ${c.line}`, borderRadius: 18 * u, padding: 40 * u, ...reveal(f, 16 + i * 10) }}>
            <div style={{ width: 14 * u, height: 14 * u, borderRadius: 99, background: c.accent, marginBottom: 26 * u }} />
            <div style={{ ...display(brand, 40 * u) }}>{it.title}</div>
            <div style={{ fontFamily: brand.fonts.body, fontSize: 28 * u, lineHeight: 1.42, color: c.muted, marginTop: 14 * u }}>{it.body}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
