#!/usr/bin/env node
// Beat map of a music track: tempo, beats, bar downbeats, energy per bar and the biggest lift ("drop").
//   node beats.mjs music.mp3 [--out beats.json] [--fps 30] [--min 70 --max 180]
// Phase comes from the kick band (< 150 Hz): the full band often locks onto hi-hats and puts every cut
// half a beat late. `mode` says whether to cut on the grid ("beat_cut") or to pace by phrases and energy
// ("phrase_flow", for ambient or rubato music where a grid would be invented).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const input = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!input) { console.error("Aufruf: node beats.mjs <musik> [--out beats.json] [--fps 30]"); process.exit(2); }
const fps = Number(opt("--fps", 30)), minBpm = Number(opt("--min", 70)), maxBpm = Number(opt("--max", 180));
const SR = 11025, HOP = 128, WIN = 512, FR = SR / HOP; // ~86 onset frames per second
const ff = process.env.FFMPEG || "ffmpeg";

const pcm = (af) => { const b = execFileSync(ff, ["-v", "error", "-i", input, "-ac", "1", "-ar", String(SR), ...(af ? ["-af", af] : []), "-f", "f32le", "pipe:1"], { maxBuffer: 1 << 30 }); return new Float32Array(b.buffer, b.byteOffset, b.byteLength >> 2); };
const full = pcm(), kick = pcm("lowpass=f=150,lowpass=f=150");
const dur = full.length / SR;

/** onset strength: rise of log energy per hop, minus its local mean, rectified */
function onset(x) {
  const n = Math.floor((x.length - WIN) / HOP); const e = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < WIN; j++) { const v = x[i * HOP + j]; s += v * v; } e[i] = Math.log(1e-9 + s / WIN); }
  const d = new Float32Array(n); for (let i = 1; i < n; i++) d[i] = Math.max(0, e[i] - e[i - 1]);
  const w = Math.round(FR * 0.5), o = new Float32Array(n); let acc = 0;
  for (let i = 0; i < n; i++) { acc += d[i] - (i - w >= 0 ? d[i - w] : 0); o[i] = Math.max(0, d[i] - acc / Math.min(i + 1, w)); }
  return o;
}
const oF = onset(full), oK = onset(kick), n = Math.min(oF.length, oK.length);
const env = Float32Array.from({ length: n }, (_, i) => 0.6 * oK[i] + 0.4 * oF[i]);

// tempo: autocorrelation over the lag range, with a broad preference for 90–140 BPM to settle octave errors
const acf = (lag) => { let s = 0; for (let i = lag; i < n; i++) s += env[i] * env[i - lag]; return s / (n - lag); };
const lo = Math.floor((60 / maxBpm) * FR), hi = Math.ceil((60 / minBpm) * FR);
let best = lo, bestS = -1; const zero = acf(0) || 1, scores = [];
for (let lag = lo; lag <= hi; lag++) {
  const bpm = (60 * FR) / lag, prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 118) / 0.6, 2));
  const s = (acf(lag) + 0.5 * acf(2 * lag)) * prior; scores.push(s);
  if (s > bestS) { bestS = s; best = lag; }
}
// parabolic refinement for a fractional period
const a = acf(best - 1), b = acf(best), c = acf(best + 1), shift = (a - c) / (2 * (a - 2 * b + c) || 1);
const period = best + (Number.isFinite(shift) ? Math.max(-0.5, Math.min(0.5, shift)) : 0);
const bpm = (60 * FR) / period;
const sorted = [...scores].sort((x, y) => x - y), confidence = Math.min(1, (acf(best) / zero) * 2) * (bestS / (sorted[Math.floor(sorted.length / 2)] || 1) > 1.6 ? 1 : 0.5);

// phase from the kick band, then follow the grid allowing ±8 % local drift
let phase = 0, phS = -1;
for (let p = 0; p < Math.ceil(period); p++) { let s = 0; for (let t = p; t < n; t += period) s += oK[Math.round(t)] || 0; if (s > phS) { phS = s; phase = p; } }
const beats = []; const tol = Math.round(period * 0.08);
for (let t = phase; t < n; t += period) {
  let k = Math.round(t), bk = k, bv = -1;
  for (let j = Math.max(0, k - tol); j <= Math.min(n - 1, k + tol); j++) if (env[j] > bv) { bv = env[j]; bk = j; }
  beats.push(+(((bv > 0 ? bk : k) * HOP + WIN / 2) / SR).toFixed(3));
}
// final tempo from a least-squares line through the tracked beats (more exact than the autocorrelation lag)
const fitBpm = (() => { const m = beats.length; if (m < 8) return bpm; let sx = 0, sy = 0, sxx = 0, sxy = 0; beats.forEach((t, i) => { sx += i; sy += t; sxx += i * i; sxy += i * t; }); const slope = (m * sxy - sx * sy) / (m * sxx - sx * sx); return slope > 0 ? 60 / slope : bpm; })();
// downbeats: of the four 4/4 phases, the one with the most kick energy
let dPhase = 0, dS = -1;
for (let q = 0; q < 4; q++) { let s = 0; for (let i = q; i < beats.length; i += 4) s += oK[Math.round((beats[i] * SR - WIN / 2) / HOP)] || 0; if (s > dS) { dS = s; dPhase = q; } }
const downbeats = beats.filter((_, i) => i % 4 === dPhase);
const rms = (t0, t1) => { let s = 0, m = 0; for (let i = Math.floor(t0 * SR); i < Math.min(full.length, Math.floor(t1 * SR)); i++) { s += full[i] * full[i]; m++; } return m ? 20 * Math.log10(Math.sqrt(s / m) + 1e-9) : -90; };
const bars = downbeats.map((t, i) => ({ t, energyDb: +rms(t, downbeats[i + 1] ?? dur).toFixed(1) }));
let drop = null, lift = 0;
for (let i = 1; i < bars.length; i++) { const d = bars[i].energyDb - bars[i - 1].energyDb; if (d > lift) { lift = d; drop = bars[i].t; } }
const mode = confidence >= 0.35 ? "beat_cut" : "phrase_flow";

const out = { file: input, duration: +dur.toFixed(3), bpm: +fitBpm.toFixed(2), confidence: +confidence.toFixed(2), mode, fps, beatSec: +(60 / fitBpm).toFixed(4),
  beats, beatFrames: beats.map((t) => Math.round(t * fps)), downbeats, bars, drop: drop && lift >= 3 ? { t: drop, liftDb: +lift.toFixed(1) } : null };
writeFileSync(opt("--out", "beats.json"), JSON.stringify(out, null, 1));
console.log(`${out.bpm} BPM · Sicherheit ${out.confidence} → ${mode} · ${beats.length} Beats, ${downbeats.length} Takte${out.drop ? ` · Drop bei ${out.drop.t.toFixed(2)} s (+${out.drop.liftDb} dB)` : ""}`);
console.log(`erste Beats: ${beats.slice(0, 8).map((t) => t.toFixed(2)).join("  ")}  → ${opt("--out", "beats.json")}`);
