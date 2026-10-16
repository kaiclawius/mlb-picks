import { AbsoluteFill, useCurrentFrame } from "remotion";
import { reveal, useLayout } from "../anim";
import { display, Rich, Wordmark } from "../parts";
import { Brand, Scene } from "../types";

export function Cta({ scene, brand }: { scene: Extract<Scene, { type: "cta" }>; brand: Brand }) {
  const f = useCurrentFrame();
  const { u, pad } = useLayout();
  const c = brand.colors;
  return (
    <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <div style={reveal(f, 0, 20)}><Wordmark brand={brand} size={64 * u} /></div>
      <h2 style={{ ...display(brand, 112 * u), marginTop: 56 * u, ...reveal(f, 8, 34, 32) }}><Rich text={scene.title} accent={c.accent} /></h2>
      {scene.subtitle && <p style={{ fontFamily: brand.fonts.body, fontSize: 38 * u, color: c.muted, marginTop: 30 * u, ...reveal(f, 20) }}>{scene.subtitle}</p>}
      {scene.url && (
        <div style={{ marginTop: 54 * u, fontFamily: brand.fonts.mono, fontSize: 32 * u, color: c.bg, background: c.ink, padding: `${18 * u}px ${34 * u}px`, borderRadius: 999, ...reveal(f, 30) }}>
          {scene.url}
        </div>
      )}
      {scene.footnote && <p style={{ position: "absolute", bottom: pad * 0.7, left: pad, right: pad, fontFamily: brand.fonts.mono, fontSize: 19 * u, color: c.muted, ...reveal(f, 40, 0) }}>{scene.footnote}</p>}
    </AbsoluteFill>
  );
}
