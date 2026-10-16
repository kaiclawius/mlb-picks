#!/usr/bin/env node
// Look at motion before you ship it. Makes a contact sheet (one image, many moments) from
//   a) a rendered video:            node frames.mjs out/video.mp4 [--every 1] [--cols 4] [--width 480] [--out sheet.png]
//   b) a Remotion composition:      node frames.mjs --remotion <projectDir> <compositionId> [--frames 0,15,30 | --every 30] [--out sheet.png]
//      (renders only the chosen frames as stills, so checking a layout takes seconds instead of a full render)
// Prints which time each tile shows. Needs ffmpeg with the tile filter: system ffmpeg, $FFMPEG, or ffmpeg-static via npx.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };
const cols = Number(opt("cols", 4)), width = Number(opt("width", 480));

function findFfmpeg() {
  const cands = [process.env.FFMPEG, "ffmpeg"].filter(Boolean);
  for (const c of cands) {
    const r = spawnSync(c, ["-hide_banner", "-filters"], { encoding: "utf8" });
    if (r.status === 0 && / tile /.test(r.stdout)) return c;
  }
  try {
    const p = execFileSync("npx", ["--yes", "-p", "ffmpeg-static@5.2.0", "node", "-e", "process.stdout.write(require('ffmpeg-static'))"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (p && existsSync(p)) return p;
  } catch {}
  console.error("Kein ffmpeg mit 'tile'-Filter gefunden. Installiere ffmpeg oder setze FFMPEG=/pfad/zu/ffmpeg.");
  process.exit(1);
}
const ff = (bin, a) => execFileSync(bin, ["-hide_banner", "-loglevel", "error", "-y", ...a], { stdio: ["ignore", "inherit", "inherit"] });
const probeDuration = (bin, file) => {
  const r = spawnSync(bin, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = (r.stderr || "").match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
};

const bin = findFfmpeg();
const tmp = mkdtempSync(join(tmpdir(), "frames-"));
let label = [];
try {
  if (args[0] === "--remotion") {
    const [, dir, id] = args;
    // bundle once, then render only the requested frames as stills (uses the project's own Remotion install)
    const req = createRequire(join(resolve(dir), "package.json"));
    const { bundle } = await import(pathToFileURL(req.resolve("@remotion/bundler")).href);
    const { selectComposition, renderStill } = await import(pathToFileURL(req.resolve("@remotion/renderer")).href);
    const entry = ["src/index.ts", "src/index.tsx", "src/index.js", "src/index.jsx"].map((e) => join(resolve(dir), e)).find(existsSync);
    const serveUrl = await bundle({ entryPoint: entry });
    const browserExecutable = process.env.REMOTION_BROWSER || null;
    const props = opt("props", null) ? JSON.parse(opt("props")) : {};
    const comp = await selectComposition({ serveUrl, id, inputProps: props, browserExecutable });
    let frames = opt("frames", "").split(",").filter(Boolean).map(Number);
    if (!frames.length) { const every = Number(opt("every", comp.fps)); for (let f = 0; f < comp.durationInFrames; f += every) frames.push(f); }
    for (const [i, f] of frames.entries()) {
      await renderStill({ composition: comp, serveUrl, frame: Math.min(f, comp.durationInFrames - 1), output: join(tmp, `f${String(i).padStart(4, "0")}.png`), inputProps: props, browserExecutable, imageFormat: "png" });
      label.push(`#${i + 1}: frame ${f} (${(f / comp.fps).toFixed(2)} s)`);
    }
    ff(bin, ["-i", join(tmp, "f%04d.png"), "-vf", `scale=${width}:-2,tile=${cols}x${Math.ceil(frames.length / cols)}:padding=6:color=white`, "-frames:v", "1", resolve(opt("out", "sheet.png"))]);
    console.log(`${id}: ${comp.width}x${comp.height}, ${comp.durationInFrames} frames (${(comp.durationInFrames / comp.fps).toFixed(2)} s)`);
  } else {
    const file = resolve(args[0]);
    const every = Number(opt("every", 1));
    const dur = probeDuration(bin, file);
    const n = Math.max(1, Math.floor(dur / every));
    ff(bin, ["-i", file, "-vf", `fps=1/${every},scale=${width}:-2,tile=${cols}x${Math.ceil(n / cols)}:padding=6:color=white`, "-frames:v", "1", resolve(opt("out", "sheet.png"))]);
    for (let i = 0; i < n; i++) label.push(`#${i + 1}: ${(i * every).toFixed(2)} s`);
  }
  console.log(`Kontaktbogen: ${resolve(opt("out", "sheet.png"))} (${cols} Spalten, Lesereihenfolge links→rechts, oben→unten)`);
  console.log(label.join("\n"));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
