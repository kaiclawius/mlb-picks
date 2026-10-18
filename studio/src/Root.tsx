import { Composition } from "remotion";
import { PRODUCTS } from "../products";
import { FORMATS, Format } from "./types";
import { FPS, ProductVideo, sceneFrames, totalFrames } from "./ProductVideo";
import { Film, FILM_FPS, filmFrames } from "./film/Film";
import { Walk, WALK_FPS, walkFrames } from "./film/Walk";
import { AD_FPS, GrokDogAd, T as GROK_T } from "./ads/GrokDogAd";

// Every product gets three video formats and a social preview image:
//   <id>-landscape, <id>-portrait, <id>-square, <id>-og
export function Root() {
  return (
    <>
      {PRODUCTS.flatMap((p) => [
        ...(Object.keys(FORMATS) as Format[]).map((fmt) => (
          <Composition key={`${p.id}-${fmt}`} id={`${p.id}-${fmt}`} component={ProductVideo} defaultProps={{ product: p }}
            durationInFrames={totalFrames(p)} fps={FPS} width={FORMATS[fmt][0]} height={FORMATS[fmt][1]} />
        )),
        // the first scene alone, for a still frame once it has settled (render.mjs picks the frame)
        <Composition key={`${p.id}-og`} id={`${p.id}-og`} component={ProductVideo} defaultProps={{ product: p, only: 0 }}
          durationInFrames={sceneFrames(p.scenes[0])} fps={FPS} width={1200} height={630} />,
        // the kinetic film, if the product has one
        ...(p.film ? (Object.keys(FORMATS) as Format[]).map((fmt) => (
          <Composition key={`${p.id}-film-${fmt}`} id={`${p.id}-film-${fmt}`} component={Film} defaultProps={{ product: p }}
            durationInFrames={filmFrames(p.film!)} fps={FILM_FPS} width={FORMATS[fmt][0]} height={FORMATS[fmt][1]} />
        )) : []),
        // the UI walkthrough, if the product has one
        ...(p.walk ? (Object.keys(FORMATS) as Format[]).map((fmt) => (
          <Composition key={`${p.id}-walk-${fmt}`} id={`${p.id}-walk-${fmt}`} component={Walk} defaultProps={{ product: p }}
            durationInFrames={walkFrames(p.walk!)} fps={WALK_FPS} width={FORMATS[fmt][0]} height={FORMATS[fmt][1]} />
        )) : []),
      ])}
      {/* one-off ads */}
      <Composition id="grokdog-ad-4x5" component={GrokDogAd} durationInFrames={GROK_T.total} fps={AD_FPS} width={1080} height={1350} />
      <Composition id="grokdog-ad-9x16" component={GrokDogAd} durationInFrames={GROK_T.total} fps={AD_FPS} width={1080} height={1920} />
    </>
  );
}
