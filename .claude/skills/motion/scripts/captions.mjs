#!/usr/bin/env node
// Word-timed captions from a voice-over or any audio/video, locally with Whisper (transformers.js).
// Output is the Caption[] format of @remotion/captions ({ text, startMs, endMs, timestampMs, confidence }),
// ready for createTikTokStyleCaptions().
//
//   node captions.mjs voice.wav --out src/captions.json [--lang de] [--script "the exact text that was spoken"]
//                    [--model onnx-community/whisper-base_timestamped] [--from <dir with @huggingface/transformers>]
//
// --script: when you know the words (TTS, a read script), pass them; the Whisper timings are kept but the words
// are taken from your script, so names and spelling are always right.
// Needs ffmpeg and @huggingface/transformers (npm i -D @huggingface/transformers in the video project, or --from).
// The model (~150 MB) is downloaded once into ~/.cache/motion-whisper.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const input = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!input) { console.error("Aufruf: node captions.mjs <audio|video> --out captions.json [--lang de] [--script \"...\"]"); process.exit(2); }
const out = opt("--out", "captions.json"), lang = opt("--lang"), script = opt("--script");
const model = opt("--model", "onnx-community/whisper-base_timestamped");

// 1. audio -> mono 16 kHz float32
const pcm = execFileSync(process.env.FFMPEG || "ffmpeg", ["-v", "error", "-i", input, "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"], { maxBuffer: 1 << 30 });
const audio = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4));

// 2. Whisper with word timestamps
const req = createRequire(join(resolve(opt("--from", process.cwd())), "package.json"));
let tf;
try { tf = await import(pathToFileURL(req.resolve("@huggingface/transformers")).href); }
catch { console.error("@huggingface/transformers nicht gefunden: npm i -D @huggingface/transformers (oder --from <ordner>)"); process.exit(1); }
tf.env.cacheDir = join(homedir(), ".cache", "motion-whisper");
const asr = await tf.pipeline("automatic-speech-recognition", model, { dtype: "fp32", device: "cpu" });
const words = [];
for (let at = 0; at < audio.length - 1600; at += 30 * 16000) {
  const r = await asr(audio.subarray(at, Math.min(audio.length, at + 30 * 16000)), { return_timestamps: "word", chunk_length_s: 30, task: "transcribe", ...(lang ? { language: lang } : {}) });
  for (const c of r.chunks || []) {
    const w = String(c.text || "").trim(); const [s, e] = c.timestamp || [];
    if (w) words.push({ w, s: at / 16000 + (s ?? 0), e: at / 16000 + (e ?? s ?? 0) });
  }
}

// 3. optional: put the known script words onto the heard timings (edit-distance alignment on normalised words)
const norm = (w) => w.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "");
function align(heard, said) {
  const n = heard.length, m = said.length, D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (norm(heard[i - 1].w) === norm(said[j - 1]) ? 0 : 1));
  const map = new Array(m).fill(null);
  for (let i = n, j = m; i > 0 && j > 0;) {
    const sub = D[i - 1][j - 1] + (norm(heard[i - 1].w) === norm(said[j - 1]) ? 0 : 1);
    if (D[i][j] === sub) { map[j - 1] = heard[i - 1]; i--; j--; } else if (D[i][j] === D[i - 1][j] + 1) i--; else j--;
  }
  // words Whisper missed share the gap between their neighbours
  return said.map((w, j) => {
    if (map[j]) return { w, s: map[j].s, e: map[j].e };
    let a = j - 1; while (a >= 0 && !map[a]) a--; let b = j + 1; while (b < m && !map[b]) b++;
    const from = a >= 0 ? map[a].e : 0, to = b < m ? map[b].s : (heard.at(-1)?.e ?? from + 0.4);
    const k = (j - a) / (b - a); return { w, s: from + (to - from) * (k - 0.5 / (b - a)), e: from + (to - from) * k };
  });
}
const final = script ? align(words, script.split(/\s+/).filter(Boolean)) : words;

const captions = final.map((x, i) => ({ text: (i ? " " : "") + x.w, startMs: Math.round(x.s * 1000), endMs: Math.round(Math.max(x.e, x.s + 0.05) * 1000), timestampMs: Math.round(((x.s + x.e) / 2) * 1000), confidence: null }));
writeFileSync(out, JSON.stringify(captions, null, 1));
console.log(`${captions.length} Wörter, ${(audio.length / 16000).toFixed(2)} s → ${out}`);
console.log(captions.map((c) => `${(c.startMs / 1000).toFixed(2)} ${c.text.trim()}`).join("  "));
