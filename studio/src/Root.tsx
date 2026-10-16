import { Composition } from "remotion";
import { PRODUCTS } from "../products";
import { FORMATS, Format } from "./types";
import { FPS, ProductVideo, sceneFrames, totalFrames } from "./ProductVideo";

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
      ])}
    </>
  );
}
