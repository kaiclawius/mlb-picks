#!/usr/bin/env node
// Brings a rendered video's audio to a target loudness (two-pass EBU R128), video stream copied untouched.
//   node loudnorm.mjs in.mp4 out.mp4 [--target -14] [--tp -1]
// Targets: -14 LUFS social/web (TikTok, Reels, YouTube), -16 voice-led/podcast, -23 broadcast (EBU).
import { execFileSync, spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [input, output] = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!input || !output) { console.error("Aufruf: node loudnorm.mjs in.mp4 out.mp4 [--target -14] [--tp -1]"); process.exit(2); }
const I = Number(opt("--target", -14)), TP = Number(opt("--tp", -1)), LRA = 11;
const ff = process.env.FFMPEG || "ffmpeg";

// pass 1: measure (loudnorm prints its JSON on stderr)
const log = spawnSync(ff, ["-hide_banner", "-nostats", "-i", input, "-af", `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr || "";
const m = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));

// pass 2: apply. loudnorm alone can overshoot the peak when it must add a lot of gain, and the AAC encoder adds
// a little more; so a limiter without make-up gain follows, aiming 0.6 dB under the ceiling, and the result is
// measured again (tightened up to 3 times if the encoded file is still too hot).
const measure = (file) => {
  const r = spawnSync(ff, ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr;
  const sum = r.slice(r.lastIndexOf("Summary:"));
  return { I: Number(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), TP: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]) };
};
let margin = 0.6, res;
for (let k = 0; k < 4; k++) {
  const ceil = Math.pow(10, (TP - margin) / 20);
  const af = `loudnorm=I=${I}:TP=${TP - margin}:LRA=${LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,` +
    `alimiter=limit=${ceil.toFixed(4)}:attack=1:release=60:level=disabled`;
  execFileSync(ff, ["-hide_banner", "-v", "error", "-y", "-i", input, "-c:v", "copy", "-af", af, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output], { stdio: "inherit" });
  res = measure(output);
  if (!(res.TP > TP)) break;
  margin += 0.5;
}
console.log(`vorher ${m.input_i} LUFS (true peak ${m.input_tp} dBTP) → nachher ${res.I} LUFS, true peak ${res.TP} dBFS (Ziel ${I} LUFS, ≤ ${TP}): ${output}`);
