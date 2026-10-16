// Downloads a voice pack from Hugging Face once (into <home>/models/<pack>) and reports progress.
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config } from "./config.js";
import { PACKS } from "./catalog.js";

export const dirOf = (pack) => join(config.home, "models", pack);
export const ready = (pack) => existsSync(join(dirOf(pack), ".complete"));
export const progress = {}; // pack -> 0..1 while downloading
const running = {};

async function fetchRetry(url, tries = 4) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url, { redirect: "follow" }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r; }
    catch (e) { if (i >= tries - 1) throw e; await new Promise((r) => setTimeout(r, 1000 * 2 ** i)); }
  }
}

export function ensure(pack) {
  if (ready(pack)) return Promise.resolve(dirOf(pack));
  const p = PACKS[pack];
  if (!p) return Promise.reject(new Error("unknown voice pack " + pack));
  running[pack] ??= (async () => {
    const info = await (await fetchRetry(`${config.hfMirror}/api/models/${p.repo}/tree/main?recursive=true`)).json().catch(() => null);
    const files = (Array.isArray(info) ? info.filter((f) => f.type === "file").map((f) => ({ path: f.path, size: f.size || f.lfs?.size || 0 }))
      : ((await (await fetchRetry(`${config.hfMirror}/api/models/${p.repo}`)).json()).siblings || []).map((s) => ({ path: s.rfilename, size: 0 })))
      .filter((f) => !/^\.git|README|MODEL_CARD|\.py$|\.sh$/.test(f.path) && !(p.skip || []).some((re) => re.test(f.path)));
    const total = files.reduce((s, f) => s + (f.size || 1), 0) || files.length;
    let done = 0;
    const dir = dirOf(pack);
    await mkdir(dir, { recursive: true });
    for (let i = 0; i < files.length; i += 8) {
      await Promise.all(files.slice(i, i + 8).map(async (f) => {
        const out = join(dir, f.path);
        if (existsSync(out)) { done += f.size || 1; return; }
        await mkdir(dirname(out), { recursive: true });
        const r = await fetchRetry(`${config.hfMirror}/${p.repo}/resolve/main/${f.path.split("/").map(encodeURIComponent).join("/")}`);
        const counter = new TransformStream({ transform(chunk, c) { done += chunk.byteLength; progress[pack] = Math.min(0.99, done / total); c.enqueue(chunk); } });
        await pipeline(Readable.fromWeb(r.body.pipeThrough(counter)), createWriteStream(out + ".part"));
        await rename(out + ".part", out);
      }));
    }
    await writeFile(join(dir, ".complete"), new Date().toISOString());
    delete progress[pack];
    return dir;
  })().catch(async (e) => { delete running[pack]; delete progress[pack]; throw e; });
  return running[pack];
}

export async function remove(pack) { await rm(dirOf(pack), { recursive: true, force: true }); delete running[pack]; }
