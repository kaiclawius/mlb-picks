// Audio helpers: sentence splitting, joining with natural pauses, WAV/MP3 encoding (ffmpeg-static).
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export function ffmpeg(args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.STIMME_FFMPEG || ffmpegPath || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
    const out = []; let err = "";
    p.stdout.on("data", (d) => out.push(d)); p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve(Buffer.concat(out)) : reject(new Error("ffmpeg: " + err.slice(-400)))));
    if (input) p.stdin.end(input); else p.stdin.end();
  });
}

/** Sentences (and very long sentences split at commas), so each chunk is short and pauses fall naturally. */
export function sentences(text, max = 220) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  const parts = clean.match(/[^.!?…]+(?:[.!?…]+["“”»']?|$)/g) || [clean];
  const out = [];
  for (let s of parts.map((x) => x.trim()).filter(Boolean)) {
    while (s.length > max) {
      const cut = Math.max(s.lastIndexOf(", ", max), s.lastIndexOf("; ", max), s.lastIndexOf(" ", max));
      out.push(s.slice(0, cut > 40 ? cut + 1 : max).trim()); s = s.slice(cut > 40 ? cut + 1 : max).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

export function resample(samples, from, to) {
  if (from === to) return samples;
  const ratio = from / to, n = Math.floor(samples.length / ratio), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * ratio, a = Math.floor(x), f = x - a; out[i] = (samples[a] || 0) * (1 - f) + (samples[a + 1] || 0) * f; }
  return out;
}

/** Joins chunks with a pause after each (longer after paragraph ends). Returns samples and where each chunk starts. */
export function join(chunks, sampleRate, pauses) {
  const total = chunks.reduce((n, c, i) => n + c.length + Math.round((pauses[i] || 0) * sampleRate), 0);
  const out = new Float32Array(total), starts = [];
  let at = 0;
  chunks.forEach((c, i) => { starts.push(at / sampleRate); out.set(c, at); at += c.length + Math.round((pauses[i] || 0) * sampleRate); });
  return { samples: out, starts };
}

export function wav(samples, sampleRate) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return buf;
}

export function readWav(buf) {
  let p = 12, fmt = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString("ascii", p, p + 4), size = buf.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { ch: buf.readUInt16LE(p + 10), sr: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22), type: buf.readUInt16LE(p + 8) };
    if (id === "data" && fmt) {
      const n = Math.floor(size / (fmt.bits / 8) / fmt.ch), out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const o = p + 8 + i * fmt.ch * (fmt.bits / 8);
        out[i] = fmt.type === 3 ? buf.readFloatLE(o) : fmt.bits === 16 ? buf.readInt16LE(o) / 32768 : buf.readInt32LE(o) / 2147483648;
      }
      return { samples: out, sampleRate: fmt.sr };
    }
    p += 8 + size + (size % 2);
  }
  throw new Error("not a WAV file");
}

/** Loudness to about -16 LUFS (podcast level) and MP3, in one ffmpeg call. */
export const toMp3 = (wavBuf) => ffmpeg(["-f", "wav", "-i", "pipe:0", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "libmp3lame", "-b:a", "128k", "-f", "mp3", "pipe:1"], wavBuf);
/** Any uploaded recording -> clean mono 24 kHz WAV, trimmed silence, max 30 s (reference for cloning). */
export const toReference = (input) => ffmpeg(["-i", "pipe:0", "-ac", "1", "-ar", "24000", "-af", "highpass=f=70,silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.6:stop_threshold=-45dB,loudnorm=I=-20", "-t", "30", "-f", "wav", "pipe:1"], input);
