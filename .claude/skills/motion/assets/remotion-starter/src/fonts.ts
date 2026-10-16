// Local brand fonts: holds the render until every font file is loaded, so no frame shows a fallback font.
// Put .woff2 files in public/fonts/ and list them here. Local files beat Google Fonts at render time:
// no network, no rate limits, identical output on every machine.
import { continueRender, delayRender, staticFile } from "remotion";

type Face = { family: string; file: string; weight?: string; style?: string; stretch?: string };
export const FONTS: Face[] = [
  // { family: "Inter", file: "fonts/Inter-Variable.woff2", weight: "100 900" },
];

let started = false;
export function loadFonts() {
  if (started || !FONTS.length || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading brand fonts");
  Promise.all(FONTS.map(async (f) => {
    const face = new FontFace(f.family, `url(${staticFile(f.file)}) format("woff2")`, { weight: f.weight, style: f.style, stretch: f.stretch });
    document.fonts.add(await face.load());
  })).then(() => continueRender(handle), (e) => { console.error("Font failed to load", e); continueRender(handle); });
}
