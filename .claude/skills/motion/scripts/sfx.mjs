#!/usr/bin/env node
// Sound effects made in code: deterministic, licence-free, no dependencies. 48 kHz stereo WAV.
//
//   node sfx.mjs <type> out.wav [--dur 0.5] [--pitch 880] [--seed 1] [--gain -6]   one sound
//   node sfx.mjs --kit out/sfx/                                                    every type once (to listen)
//   node sfx.mjs --cues cues.json --length 16.8 out/sfx.wav                        a whole SFX track from a cue sheet
//
// Types: click, tick, key, pop, blip, whoosh, riser, impact, chime, success, pad
// Cue sheet: [{ "t": 2.4, "type": "whoosh", "gain": -12, "pan": -0.4, "dur": 0.5, "pitch": 880, "seed": 3 }, ...]
// `t` is the moment the viewer should feel the hit (the visual lands). Each sound is placed so its own
// peak sits on `t`: a whoosh peaks there, a riser ends there, a click starts there. So cue times can come
// straight from the timeline / beat list, and the audio follows any retime.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SR = 48000;
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));

// ---------- small DSP kit ----------
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const db = (x) => Math.pow(10, x / 20);
const N = (sec) => Math.max(1, Math.round(sec * SR));
/** RBJ biquad, coefficients recomputed per sample from fn(i) -> { f, q } (for sweeps) */
function biquad(x, type, fn) {
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const { f, q } = fn(i), w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w);
    let b0, b1, b2; const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
    if (type === "bp") { b0 = al; b1 = 0; b2 = -al; } else if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; } else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const noise = (n, r) => Float32Array.from({ length: n }, () => r() * 2 - 1);
/** sine with a pitch curve f(t) (phase-accumulated, so sweeps stay smooth) */
function osc(n, f, partials = [[1, 1]]) {
  const y = new Float32Array(n); const ph = partials.map(() => 0);
  for (let i = 0; i < n; i++) { const fr = f(i / SR); let v = 0; partials.forEach(([m, a], k) => { ph[k] += (2 * Math.PI * fr * m) / SR; v += a * Math.sin(ph[k]); }); y[i] = v; }
  return y;
}
/** attack (linear) then exponential decay with time constant tau */
const envAD = (n, att, tau) => Float32Array.from({ length: n }, (_, i) => { const t = i / SR; return t < att ? t / att : Math.exp(-(t - att) / tau); });
const mul = (a, b) => a.map((v, i) => v * (b[i] ?? 0));
const add = (...xs) => { const n = Math.max(...xs.map((x) => x.length)); const y = new Float32Array(n); for (const x of xs) for (let i = 0; i < x.length; i++) y[i] += x[i]; return y; };
const scale = (x, g) => x.map((v) => v * g);
function fadeOut(x, sec = 0.01) { const n = Math.min(x.length, N(sec)); for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n; return x; }
function peakNorm(x, peakDb = -1) { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); return p ? scale(x, db(peakDb) / p) : x; }

// ---------- the sounds (mono; `anchor` = where the felt hit is, in seconds from the sound's start) ----------
const SOUNDS = {
  click: ({ r }) => { const n = N(0.05); return { y: add(mul(biquad(noise(n, r), "hp", () => ({ f: 2500, q: 0.7 })), envAD(n, 0.0005, 0.004)), scale(mul(osc(n, () => 3200), envAD(n, 0.0003, 0.006)), 0.5)), anchor: 0 }; },
  tick: ({ r, pitch = 1800 }) => { const n = N(0.07); return { y: add(mul(osc(n, () => pitch, [[1, 1], [2.7, 0.2]]), envAD(n, 0.001, 0.014)), scale(mul(noise(n, r), envAD(n, 0.0005, 0.002)), 0.15)), anchor: 0 }; },
  key: ({ r }) => { const n = N(0.06), f = 2600 + r() * 1400; return { y: add(mul(biquad(noise(n, r), "bp", () => ({ f, q: 2.5 })), envAD(n, 0.0008, 0.008)), scale(mul(osc(n, () => 180 + r() * 60), envAD(n, 0.001, 0.012)), 0.25)), anchor: 0 }; },
  pop: ({ r, pitch = 900 }) => { const n = N(0.16); return { y: add(mul(osc(n, (t) => pitch * 0.28 + pitch * 0.72 * Math.exp(-t / 0.018)), envAD(n, 0.002, 0.045)), scale(mul(biquad(noise(n, r), "bp", () => ({ f: 1800, q: 1 })), envAD(n, 0.0005, 0.004)), 0.3)), anchor: 0.002 }; },
  blip: ({ pitch = 1200 }) => { const n = N(0.09); return { y: mul(osc(n, () => pitch, [[1, 1], [3, 0.12]]), Float32Array.from({ length: n }, (_, i) => { const t = i / SR; return Math.min(1, t / 0.003) * Math.max(0, 1 - t / 0.09); })), anchor: 0.003 }; },
  whoosh: ({ r, dur = 0.55 }) => {
    const n = N(dur), pk = 0.62; // peak at 62 % of the sound
    const env = Float32Array.from({ length: n }, (_, i) => { const u = i / n; return u < pk ? Math.pow(u / pk, 2.2) : Math.pow(1 - (u - pk) / (1 - pk), 1.6); });
    const sweep = (i) => { const u = i / n; return { f: u < pk ? 350 * Math.pow(3200 / 350, u / pk) : 3200 * Math.pow(900 / 3200, (u - pk) / (1 - pk)), q: 1.1 }; };
    return { y: mul(add(biquad(noise(n, r), "bp", sweep), scale(biquad(noise(n, r), "lp", () => ({ f: 600, q: 0.7 })), 0.35)), env), anchor: dur * pk, pan: true };
  },
  riser: ({ r, dur = 1.6, pitch = 220 }) => {
    const n = N(dur);
    const env = Float32Array.from({ length: n }, (_, i) => Math.pow(i / n, 2.4) * (i > n - N(0.01) ? (n - i) / N(0.01) : 1));
    const nz = biquad(noise(n, r), "bp", (i) => ({ f: 250 * Math.pow(7000 / 250, i / n), q: 1.4 }));
    const tone = osc(n, (t) => pitch * Math.pow(4, t / dur), [[1, 1], [2, 0.35], [3, 0.15]]);
    return { y: mul(add(nz, scale(tone, 0.22)), env), anchor: dur }; // a riser ENDS on the hit
  },
  impact: ({ r, pitch = 58 }) => {
    const n = N(1.1);
    const body = mul(osc(n, (t) => pitch + pitch * 1.6 * Math.exp(-t / 0.035), [[1, 1], [2, 0.18]]), envAD(n, 0.002, 0.32));
    const crack = mul(biquad(noise(n, r), "lp", (i) => ({ f: 5000 * Math.exp(-i / SR / 0.05) + 300, q: 0.7 })), envAD(n, 0.0008, 0.06));
    return { y: add(body, scale(crack, 0.55)), anchor: 0.002 };
  },
  chime: ({ pitch = 1046.5 }) => {
    const n = N(1.4), parts = [[1, 1, 0.55], [2.01, 0.42, 0.32], [3.02, 0.22, 0.2], [4.17, 0.12, 0.12]];
    return { y: add(...parts.map(([m, a, tau]) => scale(mul(osc(n, () => pitch * m), envAD(n, 0.004, tau)), a))), anchor: 0.004 };
  },
  success: ({ pitch = 1318.5 }) => { const a = SOUNDS.chime({ pitch }).y, b = SOUNDS.chime({ pitch: pitch * 1.5 }).y, off = N(0.085); const y = new Float32Array(b.length + off); y.set(scale(a, 0.8)); for (let i = 0; i < b.length; i++) y[i + off] += b[i] * 0.9; return { y, anchor: 0.004 }; },
  pad: ({ dur = 8, pitch = 110 }) => {
    // soft major-ninth chord of slightly detuned harmonic stacks, low-passed: a quiet bed under silent films
    const n = N(dur), chord = [1, 1.5, 2, 2.52, 3.0], att = Math.min(1.5, dur / 3), rel = Math.min(2, dur / 3);
    const env = Float32Array.from({ length: n }, (_, i) => { const t = i / SR; return Math.min(1, t / att, (dur - t) / rel); });
    const voices = chord.flatMap((m, k) => [-1, 1].map((d) => scale(osc(n, (t) => pitch * m * (1 + d * 0.0035) * (1 + 0.002 * Math.sin(2 * Math.PI * (0.11 + k * 0.03) * t)), [[1, 1], [2, 0.4], [3, 0.2], [4, 0.1]]), 1 / (k + 2))));
    return { y: mul(biquad(add(...voices), "lp", () => ({ f: 1400, q: 0.6 })), env), anchor: 0 };
  },
};
const GAIN = { impact: -6, riser: -10, whoosh: -12, pop: -12, chime: -10, success: -10, blip: -16, click: -16, tick: -18, key: -20, pad: -24 };

function make(type, o = {}) {
  const f = SOUNDS[type]; if (!f) throw new Error(`Unbekannter Typ "${type}". Typen: ${Object.keys(SOUNDS).join(", ")}`);
  const r = rng(Number(o.seed ?? 1) * 7919 + type.length);
  const { y, anchor, pan } = f({ r, dur: o.dur ? Number(o.dur) : undefined, pitch: o.pitch ? Number(o.pitch) : undefined });
  return { y: fadeOut(peakNorm(y)), anchor, autopan: pan };
}

function wav(L, R) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 4, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
  return b;
}
/** equal-power pan, p in -1..1 (or a function of progress for moving sounds) */
function place(L, R, y, at, gainDb, pan) {
  const g = db(gainDb);
  for (let i = 0; i < y.length; i++) {
    const j = at + i; if (j < 0 || j >= L.length) continue;
    const p = typeof pan === "function" ? pan(i / y.length) : pan, a = ((p + 1) * Math.PI) / 4;
    L[j] += y[i] * g * Math.cos(a); R[j] += y[i] * g * Math.sin(a);
  }
}

if (argv.includes("--kit")) {
  const dir = opt("--kit"); mkdirSync(dir, { recursive: true });
  for (const t of Object.keys(SOUNDS)) { const { y } = make(t, { dur: t === "pad" ? 4 : undefined }); const s = scale(y, db(-3)); writeFileSync(join(dir, `${t}.wav`), wav(s, s)); }
  console.log(`${Object.keys(SOUNDS).length} Sounds in ${dir}`);
} else if (argv.includes("--cues")) {
  const cues = JSON.parse(readFileSync(opt("--cues"), "utf8")), out = pos[0] || "sfx.wav";
  const len = Number(opt("--length", Math.max(...cues.map((c) => c.t + 2))));
  const L = new Float32Array(N(len)), R = new Float32Array(N(len));
  cues.forEach((c, k) => {
    const { y, anchor, autopan } = make(c.type, { ...c, seed: c.seed ?? k + 1 });
    const pan = c.pan ?? (autopan ? (u) => -0.5 + u : 0); // whooshes travel left → right unless told otherwise
    place(L, R, y, N(c.t - anchor), c.gain ?? GAIN[c.type] ?? -12, pan);
  });
  // gentle safety limiter (tanh above -3 dBFS); final loudness belongs to loudnorm.mjs on the finished video
  const lim = (v) => { const k = db(-3); return Math.abs(v) <= k ? v : Math.sign(v) * (k + (1 - k) * Math.tanh((Math.abs(v) - k) / (1 - k))); };
  writeFileSync(out, wav(L.map(lim), R.map(lim)));
  console.log(`${cues.length} Cues → ${out} (${len.toFixed(2)} s)`);
  for (const c of cues) console.log(`  ${c.t.toFixed(2).padStart(6)} s  ${c.type.padEnd(8)} ${String(c.gain ?? GAIN[c.type]).padStart(4)} dB`);
} else {
  const [type, out] = pos;
  if (!type || !out) { console.error("Aufruf: node sfx.mjs <typ> out.wav [--dur s] [--pitch hz] [--seed n] [--gain db] | --kit dir | --cues cues.json --length s out.wav\nTypen: " + Object.keys(SOUNDS).join(", ")); process.exit(2); }
  const { y } = make(type, { dur: opt("--dur"), pitch: opt("--pitch"), seed: opt("--seed") });
  const s = scale(y, db(Number(opt("--gain", 0))));
  writeFileSync(out, wav(s, s));
  console.log(`${type} → ${out} (${(y.length / SR).toFixed(2)} s)`);
}
