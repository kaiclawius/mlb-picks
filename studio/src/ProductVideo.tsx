import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, interpolate, staticFile, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Product, Scene } from "./types";
import { Title } from "./scenes/Title";
import { Statement } from "./scenes/Statement";
import { Screen } from "./scenes/Screen";
import { Steps } from "./scenes/Steps";
import { Features } from "./scenes/Features";
import { Cta } from "./scenes/Cta";

export const FPS = 30;
export const transitionFrames = (p: Product) => p.transition ?? 18;
export const sceneFrames = (s: Scene) => Math.round(s.seconds * FPS);
export function totalFrames(p: Product) {
  return p.scenes.reduce((n, s) => n + sceneFrames(s), 0) - transitionFrames(p) * (p.scenes.length - 1);
}

/** Holds the first frame until every brand font file is loaded, so no frame renders in a fallback font. */
function useFonts(css?: string) {
  const [handle] = useState(() => (css ? delayRender("fonts") : null));
  useEffect(() => {
    if (!css || handle === null) return;
    const done = () => continueRender(handle);
    const loadAll = () => Promise.all([...document.fonts].map((f) => f.load().catch(() => null))).then(done, done);
    const id = "brand-fonts";
    if (document.getElementById(id)) { loadAll(); return; }
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet"; l.href = staticFile(css);
    l.onload = loadAll; l.onerror = done;
    document.head.appendChild(l);
  }, [css, handle]);
}

function SceneView({ scene, product }: { scene: Scene; product: Product }) {
  const b = product.brand;
  switch (scene.type) {
    case "title": return <Title scene={scene} brand={b} />;
    case "statement": return <Statement scene={scene} brand={b} />;
    case "screen": return <Screen scene={scene} brand={b} />;
    case "steps": return <Steps scene={scene} brand={b} />;
    case "features": return <Features scene={scene} brand={b} />;
    case "cta": return <Cta scene={scene} brand={b} />;
  }
}

export function ProductVideo({ product, only }: { product: Product; only?: number }) {
  useFonts(product.brand.fontCss);
  const { durationInFrames } = useVideoConfig();
  const c = product.brand.colors;
  const t = transitionFrames(product);
  const scenes = only === undefined ? product.scenes : [product.scenes[only]];
  return (
    <AbsoluteFill style={{ background: c.bg, color: c.ink, fontFamily: product.brand.fonts.body }}>
      <TransitionSeries>
        {scenes.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: t })} />}
            <TransitionSeries.Sequence durationInFrames={sceneFrames(s)}>
              <SceneView scene={s} product={product} />
            </TransitionSeries.Sequence>
          </React.Fragment>
        ))}
      </TransitionSeries>
      {product.music && only === undefined && (
        <Audio src={staticFile(product.music.file)}
          volume={(f) => (product.music!.volume ?? 0.5) * interpolate(f, [0, 30, durationInFrames - 60, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      )}
    </AbsoluteFill>
  );
}
