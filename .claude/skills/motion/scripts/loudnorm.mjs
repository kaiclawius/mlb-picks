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

// pass 2: apply with the measured values (linear when possible: no pumping)
const af = `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
execFileSync(ff, ["-hide_banner", "-v", "error", "-y", "-i", input, "-c:v", "copy", "-af", af, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output], { stdio: "inherit" });
console.log(`vorher ${m.input_i} LUFS (true peak ${m.input_tp} dBTP) → Ziel ${I} LUFS: ${output}`);
