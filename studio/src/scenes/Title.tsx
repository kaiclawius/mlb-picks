import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { reveal, useLayout } from "../anim";
import { display, Kicker, Rich } from "../parts";
import { Brand, Scene } from "../types";

export function Title({ scene, brand }: { scene: Extract<Scene, { type: "title" }>; brand: Brand }) {
  const f = useCurrentFrame();
  const { u, pad, portrait } = useLayout();
  // a slow push-in on the whole card, like a camera on a dolly
  const s = interpolate(f, [0, scene.seconds * 30], [1, 1.035]);
  return (
    <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: portrait ? "flex-start" : "center", textAlign: portrait ? "left" : "center" }}>
      <div style={{ transform: `scale(${s})`, maxWidth: portrait ? "100%" : 1500 * u }}>
        {scene.kicker && <Kicker brand={brand} u={u} style={{ ...reveal(f, 4), marginBottom: 34 * u }}>{scene.kicker}</Kicker>}
        <h1 style={{ ...display(brand, (portrait ? 128 : 136) * u), ...reveal(f, 10, 40, 34) }}><Rich text={scene.title} accent={brand.colors.accent} /></h1>
        {scene.subtitle && <p style={{ fontFamily: brand.fonts.body, fontSize: 42 * u, color: brand.colors.muted, marginTop: 40 * u, ...reveal(f, 26) }}>{scene.subtitle}</p>}
      </div>
    </AbsoluteFill>
  );
}
