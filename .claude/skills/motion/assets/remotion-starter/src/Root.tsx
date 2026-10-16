import { Composition } from "remotion";
import { FPS } from "./motion/tokens";
import { ProductLaunch, launchFrames } from "./compositions/ProductLaunch";
import { SocialStat, socialFrames } from "./compositions/SocialStat";
import { loadFonts } from "./fonts";

loadFonts();

// One component, several formats. Name compositions <video>-<format> so renders are easy to script.
const FORMATS = { landscape: [1920, 1080], portrait: [1080, 1920], square: [1080, 1080] } as const;

export function Root() {
  return (
    <>
      {Object.entries(FORMATS).map(([fmt, [w, h]]) => (
        <Composition key={fmt} id={`launch-${fmt}`} component={ProductLaunch} durationInFrames={launchFrames()} fps={FPS} width={w} height={h} />
      ))}
      <Composition id="social-portrait" component={SocialStat} durationInFrames={socialFrames()} fps={FPS} width={1080} height={1920} />
    </>
  );
}
