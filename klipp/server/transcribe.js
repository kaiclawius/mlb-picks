// Transcripts are made on this computer with Whisper (transformers.js + ONNX). Free, private, offline after
// the first model download (~150 MB for "base", cached in <library>/.models).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";

let asr = null;
let loading = null;
export const state = { model: config.whisperModel, ready: false, error: null };

async function load() {
  if (asr) return asr;
  loading ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.cacheDir = join(config.library, ".models");
    asr = await pipeline("automatic-speech-recognition", config.whisperModel, { dtype: "fp32", device: "cpu" });
    state.ready = true;
    return asr;
  })().catch((e) => { state.error = e.message; loading = null; throw e; });
  return loading;
}

/**
 * f32 = path to mono 16 kHz float32 PCM. Returns { text, language, words: [{ w, s, e }] }.
 * Long recordings are processed in 30 s windows; onProgress gets 0..1.
 */
export async function transcribe(f32, onProgress, language) {
  const run = await load();
  const buf = await readFile(f32);
  const audio = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
  const total = audio.length / 16000;
  const words = [];
  let text = "";
  // our own windowing (30 s, cut at the quietest moment near the end) so progress is visible and memory stays flat
  let at = 0;
  while (at < audio.length - 1600) {
    let end = Math.min(audio.length, at + 30 * 16000);
    if (end < audio.length) end = quietest(audio, end - 4 * 16000, end);
    const chunk = audio.subarray(at, end);
    const out = await run(chunk, {
      return_timestamps: "word", chunk_length_s: 30,
      ...((language || config.language) ? { language: language || config.language } : {}), task: "transcribe",
    });
    const off = at / 16000;
    for (const c of out.chunks || []) {
      const w = String(c.text || "").trim();
      if (!w) continue;
      const [s, e] = c.timestamp || [];
      words.push({ w, s: +(off + (s ?? 0)).toFixed(2), e: +(off + (e ?? s ?? 0)).toFixed(2) });
    }
    text += (text ? " " : "") + String(out.text || "").trim();
    at = end;
    onProgress?.(Math.min(1, at / 16000 / total));
  }
  const clean = collapseLoops(words.filter((w) => w.e >= w.s));
  return { text: clean.map((w) => w.w).join(" "), words: clean };
}

/** Whisper can get stuck repeating a phrase on noisy audio. A phrase of 2-8 words repeated 3+ times in a row is kept once. */
export function collapseLoops(words) {
  const key = (w) => w.w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const out = [...words];
  for (let n = 8; n >= 2; n--) {
    for (let i = 0; i + n * 3 <= out.length; i++) {
      let reps = 1;
      while (i + (reps + 1) * n <= out.length && out.slice(i + reps * n, i + (reps + 1) * n).every((w, k) => key(w) === key(out[i + k]))) reps++;
      if (reps >= 3) out.splice(i + n, (reps - 1) * n);
    }
  }
  return out;
}

function quietest(a, from, to) {
  let best = to, bestE = Infinity;
  for (let i = from; i + 1600 <= to; i += 800) {
    let e = 0; for (let j = i; j < i + 1600; j++) e += a[j] * a[j];
    if (e < bestE) { bestE = e; best = i + 800; }
  }
  return best;
}
