// "Demo-Film" export: renders remotion/Demo.jsx with the recording as input. The bundle is built once per
// server start. Remotion downloads its own headless Chrome the first time (or uses REMOTION_BROWSER).
import { join } from "node:path";
import { config, ROOT } from "./config.js";
import * as store from "./store.js";
import * as media from "./media.js";

let bundled = null;
async function bundle() {
  const { bundle } = await import("@remotion/bundler");
  bundled ??= bundle({ entryPoint: join(ROOT, "remotion", "index.jsx") }).catch((e) => { bundled = null; throw e; });
  return bundled;
}

export async function renderDemo(id, { name = "demo.mp4", outro = "" } = {}, onProgress) {
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  const meta = await store.get(id);
  const keep = media.keepSegments(meta.duration, meta.edits.cuts);
  const { words = [] } = await store.readJson(id, "transcript.json", { words: [] });
  const mapped = words.map((w) => ({ ...w, s: media.mapTime(w.s, keep), e: media.mapTime(w.e, keep) })).filter((w) => w.s !== null && w.e !== null);
  const base = `http://127.0.0.1:${config.port}/media/${id}/`;
  const inputProps = {
    title: meta.title, summary: meta.summary || "", tldr: meta.tldr || [], outro,
    segments: keep.map(([a, b]) => ({ from: a, dur: b - a })),
    chapters: (meta.chapters || []).map((c) => ({ title: c.title, t: media.mapForward(c.t, keep) })).filter((c, i, all) => c.t !== null && !all.slice(i + 1).some((x) => x.t === c.t)),
    cues: media.cues(mapped), main: base + meta.media.main, cam: meta.media.cam ? base + meta.media.cam : "",
    bubble: meta.bubble, accent: "#ff5a36",
  };
  const serveUrl = await bundle();
  const browserExecutable = process.env.REMOTION_BROWSER || null;
  const composition = await selectComposition({ serveUrl, id: "KlippDemo", inputProps, browserExecutable });
  const out = store.file(id, name);
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: out, inputProps, browserExecutable, crf: 20, colorSpace: "bt709", // tagged limited-range BT.709, not untagged yuvj420p
    concurrency: Math.max(1, Math.min(4, (await import("node:os")).cpus().length - 1)), onProgress: ({ progress }) => onProgress?.(progress) });
  return { file: name };
}
