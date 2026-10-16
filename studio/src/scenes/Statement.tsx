import { AbsoluteFill, useCurrentFrame } from "remotion";
import { reveal, useLayout } from "../anim";
import { display, Rich } from "../parts";
import { Brand, Scene } from "../types";

// Big sentences, one after the other. The problem, the turn, the promise.
export function Statement({ scene, brand }: { scene: Extract<Scene, { type: "statement" }>; brand: Brand }) {
  const f = useCurrentFrame();
  const { u, pad, portrait } = useLayout();
  const gap = Math.min(40, Math.floor((scene.seconds * 30 - 40) / Math.max(1, scene.lines.length)));
  return (
    <AbsoluteFill style={{ padding: pad, justifyContent: "center" }}>
      <div style={{ maxWidth: portrait ? "100%" : 1500 * u, display: "flex", flexDirection: "column", gap: 30 * u }}>
        {scene.lines.map((l, i) => (
          <p key={i} style={{ ...display(brand, (portrait ? 92 : 96) * u), fontWeight: 700, ...reveal(f, 6 + i * gap, 30, 30) }}>
            <Rich text={l} accent={brand.colors.accent} />
          </p>
        ))}
      </div>
    </AbsoluteFill>
  );
}
