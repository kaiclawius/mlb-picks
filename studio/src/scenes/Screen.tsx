import { AbsoluteFill, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ease, easeInOut, reveal, useLayout } from "../anim";
import { display, Kicker, Rich } from "../parts";
import { Brand, CameraKey, Scene } from "../types";

// The product itself: a real screen recording in a floating browser window, with a slow camera
// that moves between the parts that matter. A caption says what you are looking at.

function camAt(keys: CameraKey[], t: number): Omit<CameraKey, "t"> {
  if (!keys.length) return { x: 0.5, y: 0.5, zoom: 1 };
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) {
      const k = easeInOut((t - a.t) / Math.max(0.001, b.t - a.t));
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: a.zoom + (b.zoom - a.zoom) * k };
    }
  }
  return keys[keys.length - 1];
}

export function Screen({ scene, brand }: { scene: Extract<Scene, { type: "screen" }>; brand: Brand }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, pad, width, height, portrait, square } = useLayout();
  const c = brand.colors;
  const [cw, ch] = scene.clipSize || [1920, 1080];

  // layout: caption on top, window fills the rest
  const capH = (portrait ? 330 : square ? 230 : 190) * u;
  const bar = 46 * u;
  const winW = width - pad * 2;
  const winH = Math.min(height - pad * 2 - capH, portrait ? 1250 * u : Infinity);
  const boxH = winH - bar;

  // camera: "cover" the box at zoom 1, then zoom/pan around the focus point, never showing past the edges
  const cam = camAt((portrait && scene.cameraPortrait) || scene.camera || [], f / fps);
  const base = Math.max(winW / cw, boxH / ch);
  const s = base * cam.zoom;
  const vw = cw * s, vh = ch * s;
  const left = Math.min(0, Math.max(winW - vw, winW / 2 - cam.x * vw));
  const top = Math.min(0, Math.max(boxH - vh, boxH / 2 - cam.y * vh));

  const win = interpolate(f, [0, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

  return (
    <AbsoluteFill style={{ padding: pad, flexDirection: "column" }}>
      <div style={{ height: capH, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 36 * u }}>
        {scene.kicker && <Kicker brand={brand} u={u} style={{ ...reveal(f, 2), marginBottom: 14 * u }}>{scene.kicker}</Kicker>}
        <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", alignItems: portrait ? "flex-start" : "baseline", gap: (portrait ? 14 : 36) * u }}>
          <h2 style={{ ...display(brand, (portrait ? 72 : 64) * u), ...reveal(f, 6) }}><Rich text={scene.title} accent={c.accent} /></h2>
          {scene.body && <p style={{ fontFamily: brand.fonts.body, fontSize: 28 * u, lineHeight: 1.4, color: c.muted, maxWidth: 760 * u, margin: 0, ...reveal(f, 14) }}>{scene.body}</p>}
        </div>
      </div>
      <div style={{
        width: winW, height: winH, borderRadius: 20 * u, overflow: "hidden", background: c.surface,
        border: `${1.5 * u}px solid ${c.line}`,
        boxShadow: `0 ${40 * u}px ${90 * u}px rgba(20,25,30,.16), 0 ${6 * u}px ${18 * u}px rgba(20,25,30,.08)`,
        opacity: win, transform: `translateY(${(1 - win) * 50 * u}px) scale(${0.985 + win * 0.015})`,
      }}>
        <div style={{ height: bar, display: "flex", alignItems: "center", gap: 10 * u, padding: `0 ${20 * u}px`, borderBottom: `${1.5 * u}px solid ${c.line}` }}>
          {[0, 1, 2].map((i) => <span key={i} style={{ width: 13 * u, height: 13 * u, borderRadius: 99, background: c.line }} />)}
          {scene.url && <span style={{ marginLeft: 18 * u, fontFamily: brand.fonts.mono, fontSize: 18 * u, color: c.muted, background: c.bg, borderRadius: 8 * u, padding: `${5 * u}px ${16 * u}px` }}>{scene.url}</span>}
        </div>
        <div style={{ position: "relative", width: winW, height: boxH, overflow: "hidden" }}>
          <OffthreadVideo src={staticFile(scene.clip)} trimBefore={Math.round((scene.from || 0) * fps)} muted
            style={{ position: "absolute", left, top, width: vw, height: vh }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
