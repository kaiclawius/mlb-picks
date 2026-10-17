#!/usr/bin/env node
// A licence-free beat track made in code, laid out in beats so it matches a kinetic film exactly.
//   node capture/beat.mjs out.wav --bpm 120 --beats 78 [--break 16] [--rise 20] [--drop 24] [--hits 50,66] [--end 66] [--key 45]
// Sections: intro (hats, soft pulse, pad) → break at --break (low kicks only) → riser and snare roll from --rise
// → drop at --drop (crash, four-on-the-floor, claps, hats, bass) → accent hits at --hits → from --end a final
// chord that rings out. 48 kHz stereo WAV; run loudnorm afterwards (-14 LUFS for social).
import { writeFileSync } from "node:fs";
const a = process.argv.slice(2), o = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? Number(a[i + 1]) : d; };
const file = a[0], BPM = o("bpm", 120), BEATS = o("beats", 64), BREAK = o("break", -1), RISE = o("rise", -1), DROP = o("drop", 16), END = o("end", BEATS - 8), KEY = o("key", 45);
const HITS = (a[a.indexOf("--hits") + 1] && a.includes("--hits") ? a[a.indexOf("--hits") + 1].split(",").map(Number) : []);
const SR = 48000, spb = 60 / BPM, len = Math.ceil((BEATS * spb + 3) * SR), L = new Float32Array(len), R = new Float32Array(len);
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const hz = (m) => 440 * 2 ** ((m - 69) / 12), at = (beat) => Math.round(beat * spb * SR);
const add = (start, buf, gain = 1, pan = 0) => { const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan); for (let i = 0; i < buf.length && start + i < len; i++) { if (start + i < 0) continue; L[start + i] += buf[i] * gl; R[start + i] += buf[i] * gr; } };
const env = (n, att, dec) => (i) => (i < att ? i / att : Math.exp(-(i - att) / dec));
function kick(g = 1) { const n = Math.round(0.45 * SR), b = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, f = 48 + 110 * Math.exp(-t * 28); ph += 2 * Math.PI * f / SR; b[i] = Math.sin(ph) * Math.exp(-t * 6.5) * g + (i < 200 ? rnd() * 0.25 * (1 - i / 200) : 0); } return b; }
function noiseHit(dur, decay, hp = 0.6, g = 1) { const n = Math.round(dur * SR), b = new Float32Array(n); let prev = 0; for (let i = 0; i < n; i++) { const x = rnd(); const y = x - hp * prev; prev = x; b[i] = y * Math.exp(-i / SR * decay) * g; } return b; }
function clap() { const b = noiseHit(0.25, 18, 0.3, 0.8); for (const d of [0.011, 0.022]) for (let i = 0; i < 300; i++) b[Math.round(d * SR) + i] += rnd() * 0.5 * (1 - i / 300); return b; }
function tone(midi, dur, { wave = "saw", att = 0.005, rel = 0.25, cut = 1, g = 0.3 } = {}) { const n = Math.round(dur * SR), b = new Float32Array(n), f = hz(midi); let ph = 0, lp = 0;
  for (let i = 0; i < n; i++) { ph += f / SR; const x = wave === "saw" ? (ph % 1) * 2 - 1 : wave === "sq" ? ((ph % 1) < 0.5 ? 1 : -1) : Math.sin(2 * Math.PI * ph); const t = i / SR, e = Math.min(1, t / att) * (t > dur - rel ? Math.max(0, (dur - t) / rel) : 1); lp += cut * (x - lp); b[i] = lp * e * g; } return b; }
function pad(midis, dur, g = 0.12) { const n = Math.round(dur * SR), b = new Float32Array(n); for (const m of midis) for (const det of [-0.08, 0.08]) { const t = tone(m + det, dur, { wave: "saw", att: 0.4, rel: 0.8, cut: 0.03, g }); for (let i = 0; i < n; i++) b[i] += t[i]; } return b; }
function riser(dur) { const n = Math.round(dur * SR), b = new Float32Array(n); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n, c = 0.01 + 0.5 * t * t; lp += c * (rnd() - lp); b[i] = lp * t * 0.9; } return b; }
const chords = [[KEY, KEY + 7, KEY + 12, KEY + 15], [KEY - 4, KEY + 3, KEY + 8, KEY + 12], [KEY - 2, KEY + 5, KEY + 10, KEY + 14], [KEY - 5, KEY + 2, KEY + 7, KEY + 11]];
for (let beat = 0; beat < BEATS; beat++) {
  const bar = Math.floor(beat / 4), ch = chords[bar % 4], t = at(beat), main = beat >= DROP && beat < END, isBreak = BREAK >= 0 && beat >= BREAK && beat < (RISE >= 0 ? RISE : DROP);
  if (beat % 4 === 0 && beat < END && !isBreak) add(t, pad(ch.map((m) => m + 12), spb * 4 * 1.02, main ? 0.05 : 0.07), 1, 0);
  if (main) { add(t, kick(1)); if (beat % 2 === 1) add(t, clap(), 0.5, 0.1); for (const h of [0.5]) add(t + Math.round(h * spb * SR), noiseHit(0.05, 90, 0.95, 0.35), 1, 0.3);
    add(t, tone(ch[0] - 12, spb * 0.9, { wave: "saw", cut: 0.08, g: 0.32, rel: 0.1 })); add(t + Math.round(0.5 * spb * SR), tone(ch[0] - 12, spb * 0.45, { wave: "saw", cut: 0.06, g: 0.22, rel: 0.08 })); }
  else if (isBreak) { add(t, kick(0.8)); }
  else if (beat < DROP) { if (beat % 2 === 0) add(t, kick(0.45)); add(t + Math.round(0.5 * spb * SR), noiseHit(0.04, 110, 0.95, 0.22), 1, -0.2); }
}
if (RISE >= 0) { add(at(RISE), riser((DROP - RISE) * spb)); for (let s = RISE * 4; s < DROP * 4; s++) { const p = (s - RISE * 4) / ((DROP - RISE) * 4); if (p > 0.5 || s % 2 === 0) add(at(s / 4), noiseHit(0.08, 40, 0.3, 0.15 + 0.4 * p)); } }
add(at(DROP), noiseHit(1.8, 1.6, 0.85, 0.5), 1, 0); add(at(DROP), kick(1.2));               // crash + boom on the drop
for (const h of HITS) { add(at(h), kick(1.3)); add(at(h), noiseHit(0.9, 3.5, 0.6, 0.45)); }
add(at(END), pad(chords[0].concat(KEY + 19), spb * 10, 0.09)); add(at(END), kick(1.1)); add(at(END), noiseHit(2.5, 1.2, 0.85, 0.35));
// soft limiter and stereo WAV
let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.89 / peak, buf = Buffer.alloc(44 + len * 4); buf.write("RIFF", 0); buf.writeUInt32LE(36 + len * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(len * 4, 40);
for (let i = 0; i < len; i++) { const l = Math.tanh(L[i] * g * 1.2), r = Math.tanh(R[i] * g * 1.2); buf.writeInt16LE(Math.round(l * 32000), 44 + i * 4); buf.writeInt16LE(Math.round(r * 32000), 46 + i * 4); }
writeFileSync(file, buf); console.log(`${file}: ${BPM} BPM, ${BEATS} beats, drop at beat ${DROP} (${(DROP * spb).toFixed(2)} s)`);
