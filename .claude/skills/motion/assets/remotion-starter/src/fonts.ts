// Local brand fonts with @remotion/fonts: loadFont() holds the render until the file is loaded, so no frame
// shows a fallback font. Put .woff2 files in public/fonts/ and list them here. Local files beat Google Fonts at
// render time: no network, no rate limits, identical output on every machine. (@remotion/google-fonts is fine
// for drafts: `import { loadFont } from "@remotion/google-fonts/Inter"`.)
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

type Face = { family: string; file: string; weight?: string; style?: string; stretch?: string };
export const FONTS: Face[] = [
  // { family: "Inter", file: "fonts/Inter-Variable.woff2", weight: "100 900" },
];

let started = false;
export function loadFonts() {
  if (started) return;
  started = true;
  for (const f of FONTS) {
    loadFont({ family: f.family, url: staticFile(f.file), weight: f.weight, style: f.style, stretch: f.stretch })
      .catch((e) => console.error(`Font ${f.family} failed to load`, e));
  }
}
