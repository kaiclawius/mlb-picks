// Everything that touches video goes through ffmpeg here (bundled via ffmpeg-static, no install needed).
import { spawn } from "node:child_process";
import { writeFile, rm, readFile, rename } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import * as store from "./store.js";

const FFMPEG = process.env.KLIPP_FFMPEG || ffmpegPath || "ffmpeg";
const FFPROBE = process.env.KLIPP_FFPROBE || ffprobe.path || "ffprobe";

/** Runs ffmpeg; onProgress gets seconds of output written so far. */
export function ffmpeg(args, onProgress) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ["-hide_banner", "-y", "-nostdin", ...args]);
    let err = "";
    p.stderr.on("data", (d) => {
      const s = d.toString(); err = (err + s).slice(-6000);
      const m = s.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (m && onProgress) onProgress(+m[1] * 3600 + +m[2] * 60 + +m[3]);
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${err.split("\n").slice(-6).join(" ")}`))));
  });
}

export function probe(path) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path]);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error("ffprobe failed for " + path));
      const j = JSON.parse(out || "{}");
      const v = (j.streams || []).find((s) => s.codec_type === "video");
      const a = (j.streams || []).find((s) => s.codec_type === "audio");
      resolve({ duration: Number(j.format?.duration) || 0, video: v && { codec: v.codec_name, width: v.width, height: v.height }, audio: a && { codec: a.codec_name } });
    });
  });
}

/** Reads a raw upload's real duration. MediaRecorder files have no duration header, so decode to the end. */
async function measure(path) {
  const p = await probe(path).catch(() => null);
  if (p?.duration) return p.duration;
  let last = 0;
  await ffmpeg(["-i", path, "-f", "null", "-"], (t) => (last = t)).catch(() => {});
  return last;
}

/**
 * After a recording stops: make the raw uploads seekable (no re-encode of video), mix the mic into the main
 * track, write a thumbnail and the 16 kHz audio for the transcript. Takes seconds, not minutes.
 */
export async function finalize(id) {
  const meta = await store.get(id);
  const t = meta.tracks;
  const f = (n) => store.file(id, n);
  const mainRaw = t.screen?.raw || t.cam?.raw;
  if (!mainRaw) throw new Error("no video was recorded");
  const mainInfo = await probe(f(mainRaw));
  const isMp4 = mainInfo.video?.codec === "h264";
  const ext = isMp4 ? "mp4" : "webm";
  const micRaw = t.mic?.raw;
  const args = ["-fflags", "+genpts", "-i", f(mainRaw)];
  if (micRaw) args.push("-i", f(micRaw));
  args.push("-map", "0:v:0");
  const acodec = isMp4 ? ["-c:a", "aac", "-b:a", "160k"] : ["-c:a", "libopus", "-b:a", "128k"];
  if (micRaw && mainInfo.audio) args.push("-filter_complex", "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0[a]", "-map", "[a]", ...acodec);
  else if (micRaw) args.push("-map", "1:a:0", ...acodec);
  else if (mainInfo.audio) args.push("-map", "0:a:0", ...acodec);
  const main = `main.${ext}`;
  args.push("-c:v", "copy", ...(isMp4 ? ["-movflags", "+faststart"] : []), f(main));
  await ffmpeg(args);

  let cam = null;
  if (t.screen?.raw && t.cam?.raw) {
    const ci = await probe(f(t.cam.raw));
    const cext = ci.video?.codec === "h264" ? "mp4" : "webm";
    cam = `cam.${cext}`;
    await ffmpeg(["-fflags", "+genpts", "-i", f(t.cam.raw), "-map", "0:v:0", "-c:v", "copy", ...(cext === "mp4" ? ["-movflags", "+faststart"] : []), f(cam)]);
  }
  const info = await probe(f(main));
  const duration = info.duration || (await measure(f(main)));
  const hasAudio = Boolean(info.audio);
  if (hasAudio) await writePeaks(id, main);
  await thumbnail(id, { main, cam, duration, width: info.video.width, height: info.video.height });
  // the raw files are kept until the result is known good; then they go, to save disk
  for (const r of [t.screen?.raw, t.cam?.raw, t.mic?.raw]) if (r) await rm(f(r), { force: true });
  return { main, cam, duration, hasAudio, width: info.video.width, height: info.video.height };
}

async function thumbnail(id, { main, cam, duration, width, height }) {
  const at = Math.min(1.5, duration / 2).toFixed(2);
  const meta = await store.get(id);
  const args = ["-ss", at, "-i", store.file(id, main)];
  if (cam) {
    args.push("-ss", at, "-i", store.file(id, cam));
    const { chain, x, y } = bubbleChain("1:v", meta.bubble, 960, Math.round((960 * height) / width / 2) * 2);
    args.push("-filter_complex", `[0:v]scale=960:-2[bg];${chain}[b];[bg][b]overlay=${x}:${y}`);
  } else args.push("-vf", "scale=960:-2");
  args.push("-frames:v", "1", "-q:v", "4", store.file(id, "thumb.jpg"));
  await ffmpeg(args).catch(() => ffmpeg(["-ss", at, "-i", store.file(id, main), "-frames:v", "1", "-vf", "scale=960:-2", store.file(id, "thumb.jpg")]));
}

/** Loudness overview for the editor's timeline: 300 values between 0 and 1. */
async function writePeaks(id, main, n = 300) {
  const tmp = store.file(id, "peaks.pcm");
  await ffmpeg(["-i", store.file(id, main), "-vn", "-ac", "1", "-ar", "2000", "-f", "s16le", tmp]);
  const buf = await readFile(tmp);
  const a = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2));
  const step = Math.max(1, Math.floor(a.length / n)), out = [];
  for (let i = 0; i < n && i * step < a.length; i++) { let m = 0; for (let j = i * step; j < Math.min(a.length, (i + 1) * step); j++) m = Math.max(m, Math.abs(a[j])); out.push(m); }
  const max = Math.max(1, ...out);
  await writeFile(store.file(id, "peaks.json"), JSON.stringify(out.map((v) => +Math.sqrt(v / max).toFixed(3))));
  await rm(tmp, { force: true });
}

/** Mono 16 kHz float audio for Whisper, made when needed and deleted afterwards. */
export const speechAudio = (id, main, out) => ffmpeg(["-i", store.file(id, main), "-vn", "-ac", "1", "-ar", "16000", "-af", "highpass=f=80", "-f", "f32le", out]);

/** One frame as JPEG, e.g. for guides. */
export const frame = (id, src, t, out, width = 1280) =>
  ffmpeg(["-ss", String(Math.max(0, t)), "-i", store.file(id, src), "-frames:v", "1", "-vf", `scale='min(${width},iw)':-2`, "-q:v", "3", out]);

/** ffmpeg filter chain that turns a camera stream into the round (or rounded-square) bubble. */
export function bubbleChain(input, bubble, outW, outH) {
  const s = Math.round(Math.max(0.08, Math.min(0.45, bubble.size || 0.2)) * outW / 2) * 2;
  const m = Math.round(outW * 0.025);
  const r = bubble.shape === "rounded" ? `if(lte(hypot(max(abs(X-W/2)-W*0.32,0),max(abs(Y-H/2)-H*0.32,0)),W*0.18),255,0)` : `if(lte(hypot(X-W/2,Y-H/2),W/2-1),255,0)`;
  const chain = `[${input}]crop='min(iw,ih)':'min(iw,ih)',scale=${s}:${s},format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='${r}'`;
  const c = bubble.corner || "bl";
  const x = c.endsWith("l") ? m : outW - s - m;
  const y = c.startsWith("t") ? m : outH - s - m;
  return { chain, x, y, s };
}

/** The parts of the recording to keep, after cuts. */
export function keepSegments(duration, cuts = []) {
  const cs = cuts.map(([a, b]) => [Math.max(0, a), Math.min(duration, b)]).filter(([a, b]) => b - a > 0.05).sort((p, q) => p[0] - q[0]);
  const keep = []; let at = 0;
  for (const [a, b] of cs) { if (a > at + 0.05) keep.push([at, a]); at = Math.max(at, b); }
  if (duration - at > 0.05) keep.push([at, duration]);
  return keep;
}

/** Maps a time in the original recording to the time in the cut version (or null if it was cut). */
export function mapTime(t, keep) {
  let out = 0;
  for (const [a, b] of keep) { if (t < a) return null; if (t <= b) return out + (t - a); out += b - a; }
  return null;
}

/** Like mapTime, but a moment inside a cut moves to where the video continues (for chapters). */
export function mapForward(t, keep) {
  const m = mapTime(t, keep);
  if (m !== null) return m;
  let out = 0;
  for (const [a, b] of keep) { if (a >= t) return out; out += b - a; }
  return null;
}

const srtTime = (s) => { const ms = Math.round(s * 1000); return new Date(ms).toISOString().slice(11, 23).replace(".", ","); };

/** Caption cues from words: ~7 words or 3.2 s per line, broken at pauses. */
export function cues(words) {
  const out = []; let cur = [];
  const flush = () => { if (cur.length) out.push({ start: cur[0].s, end: cur[cur.length - 1].e, text: cur.map((w) => w.w).join(" ").replace(/\s+([,.!?;:])/g, "$1").trim() }); cur = []; };
  for (const w of words) {
    if (cur.length && (cur.length >= 7 || w.e - cur[0].s > 3.2 || w.s - cur[cur.length - 1].e > 0.8)) flush();
    cur.push(w);
  }
  flush();
  return out;
}

export function toVtt(cs) {
  return "WEBVTT\n\n" + cs.map((c) => `${srtTime(c.start).replace(",", ".")} --> ${srtTime(c.end).replace(",", ".")}\n${c.text}\n`).join("\n");
}

/**
 * Exports one MP4 (H.264/AAC, plays everywhere): cuts applied, camera bubble burnt in, optional captions.
 */
export async function exportMp4(id, { captions = false, name = "export.mp4" } = {}, onProgress) {
  const meta = await store.get(id);
  const f = (n) => store.file(id, n);
  const info = await probe(f(meta.media.main));
  const keep = keepSegments(meta.duration, meta.edits.cuts);
  if (!keep.length) throw new Error("everything was cut");
  const outW = Math.min(1920, info.video.width) & ~1;
  const outH = Math.round((info.video.height * outW) / info.video.width / 2) * 2;
  const useCam = meta.media.cam && !meta.bubble.hidden;
  const hasA = meta.media.hasAudio;
  const args = ["-i", f(meta.media.main)];
  if (useCam) args.push("-i", f(meta.media.cam));
  const parts = [];
  keep.forEach(([a, b], i) => {
    parts.push(`[0:v]trim=${a}:${b},setpts=PTS-STARTPTS,fps=30,scale=${outW}:${outH},setsar=1[v${i}]`);
    if (useCam) parts.push(`[1:v]trim=${a}:${b},setpts=PTS-STARTPTS,fps=30[c${i}]`);
    if (hasA) parts.push(`[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS[a${i}]`);
  });
  const n = keep.length;
  const ins = keep.map((_, i) => `[v${i}]${useCam ? `[c${i}]` : ""}${hasA ? `[a${i}]` : ""}`).join("");
  parts.push(`${ins}concat=n=${n}:v=${useCam ? 2 : 1}:a=${hasA ? 1 : 0}[vv]${useCam ? "[cc]" : ""}${hasA ? "[aa]" : ""}`);
  let last = "vv";
  if (useCam) {
    const { chain, x, y } = bubbleChain("cc", meta.bubble, outW, outH);
    parts.push(`${chain}[bub]`, `[vv][bub]overlay=${x}:${y}:shortest=1[ov]`);
    last = "ov";
  }
  if (captions) {
    const words = (await store.readJson(id, "transcript.json", { words: [] })).words
      .map((w) => ({ ...w, s: mapTime(w.s, keep), e: mapTime(w.e, keep) })).filter((w) => w.s !== null && w.e !== null);
    const srt = cues(words).map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n");
    await writeFile(f("export.srt"), srt);
    const fs = Math.round(outH / 22);
    parts.push(`[${last}]subtitles=${f("export.srt").replace(/([:\\'])/g, "\\$1")}:force_style='FontName=Arial,FontSize=${Math.round(fs * 288 / outH)},PrimaryColour=&H00FFFFFF,OutlineColour=&H60000000,BackColour=&H60000000,BorderStyle=4,Outline=6,Shadow=0,MarginV=${Math.round(288 * 0.06)}'[sub]`);
    last = "sub";
  }
  const total = keep.reduce((s, [a, b]) => s + b - a, 0);
  const out = f(name + ".part.mp4");
  await ffmpeg(["-filter_complex_threads", "2", ...args, "-filter_complex", parts.join(";"), "-map", `[${last}]`, ...(hasA ? ["-map", "[aa]", "-c:a", "aac", "-b:a", "160k"] : []),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], (t) => onProgress?.(Math.min(1, t / total)));
  await rm(f("export.srt"), { force: true });
  await rename(out, f(name));
  return { file: name, seconds: total };
}
