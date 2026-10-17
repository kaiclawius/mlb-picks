#!/usr/bin/env node
// Measures a rendered video instead of trusting it: export settings, loudness, and motion problems that are
// easy to miss on a contact sheet (single-frame pops and flashes, dead stretches, strobing, loop seams,
// cuts off the beat).
//   node qa-video.mjs out/film.mp4 [--target -14] [--tp -1] [--dead 4] [--loop] [--beats beats.json] [--json report.json]
// Exit code 1 when something must be fixed before delivery.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, openSync, readSync, closeSync, statSync } from "node:fs";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const input = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!input) { console.error("Aufruf: node qa-video.mjs <video> [--target -14] [--tp -1] [--dead 4] [--loop] [--beats beats.json]"); process.exit(2); }
const ff = process.env.FFMPEG || "ffmpeg", fp = process.env.FFPROBE || "ffprobe";
const target = Number(opt("--target", -14)), tpMax = Number(opt("--tp", -1)), deadSec = Number(opt("--dead", 4));
const issues = []; // { level: "Fehler" | "Warnung" | "Info", at?: seconds, text }
const say = (level, text, at) => issues.push({ level, text, at });
const ts = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;

// ---------- 1. export gate ----------
const probe = JSON.parse(execFileSync(fp, ["-v", "error", "-show_streams", "-show_format", "-of", "json", input], { encoding: "utf8" }));
const v = probe.streams.find((s) => s.codec_type === "video"), au = probe.streams.find((s) => s.codec_type === "audio");
const [num, den] = String(v?.avg_frame_rate || "30/1").split("/").map(Number), fps = num / (den || 1);
const duration = Number(probe.format.duration);
if (!v) { console.error("Keine Videospur."); process.exit(1); }
if (v.codec_name !== "h264") say("Warnung", `Codec ${v.codec_name}: für Social/Web H.264 liefern (oder bewusst VP9/ProRes für Transparenz).`);
if (v.pix_fmt !== "yuv420p") say(v.pix_fmt?.startsWith("yuva") ? "Info" : "Fehler", `Pixelformat ${v.pix_fmt}: Plattformen und Safari erwarten yuv420p.`);
if (v.color_range && v.color_range !== "tv") say("Warnung", `Farbbereich ${v.color_range}: "tv" (limited) ist Standard, sonst wirken Schwarz/Weiß verschoben.`);
if (!v.color_primaries || v.color_primaries === "unknown") say("Info", "Keine Farbraum-Angabe: -colorspace bt709 -color_primaries bt709 -color_trc bt709 setzen, damit Browser nicht raten.");
if (v.width % 2 || v.height % 2) say("Fehler", `Ungerade Auflösung ${v.width}x${v.height}.`);
if (!au) say("Warnung", "Keine Tonspur: manche Plattformen lehnen das ab oder zeigen es als defekt. Stille AAC-Spur anhängen.");
else if (au.codec_name !== "aac") say("Warnung", `Audio-Codec ${au.codec_name}: AAC ist der sichere Standard.`);
// faststart: the moov atom must come before mdat so the video starts before it has fully downloaded
try {
  const fd = openSync(input, "r"), size = statSync(input).size, buf = Buffer.alloc(16); let off = 0, order = [];
  while (off < size && order.length < 12) { readSync(fd, buf, 0, 16, off); let len = buf.readUInt32BE(0); const type = buf.toString("latin1", 4, 8); if (len === 1) len = Number(buf.readBigUInt64BE(8)); if (len < 8) break; order.push(type); off += len; }
  closeSync(fd);
  if (order.indexOf("moov") > order.indexOf("mdat") && order.includes("mdat")) say("Warnung", "Kein faststart (moov nach mdat): mit -movflags +faststart neu muxen (loudnorm.mjs macht das).");
} catch {}

// ---------- 2. loudness, true peak, mono ----------
let loud = null;
if (au) {
  const r = spawnSync(ff, ["-hide_banner", "-nostats", "-i", input, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr;
  const sum = r.slice(r.lastIndexOf("Summary:"));
  const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), TP = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]);
  const m = spawnSync(ff, ["-hide_banner", "-nostats", "-i", input, "-map", "0:a:0", "-af", "pan=mono|c0=0.5*c0+0.5*c1,ebur128", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr;
  const Im = Number(/I:\s+(-?[\d.]+) LUFS/.exec(m.slice(m.lastIndexOf("Summary:")))?.[1]);
  loud = { I, TP, monoI: Im };
  if (Number.isFinite(I) && I < -50) say("Info", "Tonspur ist (fast) still.");
  else if (Number.isFinite(I) && Math.abs(I - target) > 1.5) say("Fehler", `Lautheit ${I} LUFS, Ziel ${target}: node loudnorm.mjs ${input} out.mp4 --target ${target}`);
  if (Number.isFinite(TP) && TP > tpMax) say("Fehler", `True Peak ${TP} dBFS über ${tpMax}: übersteuert nach dem Encoding auf Handys.`);
  // identical channels lose exactly 3 dB in a (L+R)/2 downmix, uncorrelated ones about 6 dB; more means phase cancellation
  if (au.channels >= 2 && Number.isFinite(Im) && Number.isFinite(I) && I - Im > 6.5) say("Warnung", `Mono-Downmix ${(I - Im).toFixed(1)} dB leiser (normal 3–6): Phasenauslöschung, auf Handy-Lautsprechern (oft mono) verschwindet Ton.`);
}

// ---------- 3. motion: frame differences on a tiny grayscale copy ----------
const W = 64, H = 36, FS = W * H;
const raw = execFileSync(ff, ["-v", "error", "-i", input, "-vf", `scale=${W}:${H}:flags=area,format=gray`, "-f", "rawvideo", "pipe:1"], { maxBuffer: 1 << 30 });
const frames = Math.floor(raw.length / FS), luma = new Float32Array(frames), diff = new Float32Array(frames);
const px = (f, i) => raw[f * FS + i];
const d = (a, b) => { let s = 0; for (let i = 0; i < FS; i++) s += Math.abs(px(a, i) - px(b, i)); return s / FS / 255; };
// local change: the busiest 8x6 tile, so a small element moving counts even when the frame average barely changes
const TW = 8, TH = 6, tile = new Float32Array(frames);
const tileMax = (a, b) => { let best = 0; for (let ty = 0; ty < H; ty += TH) for (let tx = 0; tx < W; tx += TW) { let s = 0; for (let y = ty; y < ty + TH; y++) for (let x = tx; x < tx + TW; x++) s += Math.abs(px(a, y * W + x) - px(b, y * W + x)); best = Math.max(best, s / (TW * TH) / 255); } return best; };
for (let f = 0; f < frames; f++) { let s = 0; for (let i = 0; i < FS; i++) s += px(f, i); luma[f] = s / FS / 255; if (f) { diff[f] = d(f - 1, f); tile[f] = tileMax(f - 1, f); } }
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); return a[Math.floor(a.length / 2)] || 0; };
const t = (f) => f / fps;

// cuts: a frame that changes far more than its surroundings and keeps the new picture
const cuts = [], pops = [];
for (let f = 2; f < frames - 2; f++) {
  const local = median([diff[f - 2], diff[f - 1], diff[f + 1], diff[f + 2]]);
  if (diff[f] > 0.08 && diff[f] > 4 * local + 0.01) {
    const back = d(f - 1, f + 1); // A, B, A: a single odd frame = flash/pop, not a cut
    if (back < diff[f] * 0.35) pops.push(f); else cuts.push(f);
  } else if (diff[f] > 3 * local + 0.02 && diff[f] > 0.03 && local < 0.01) {
    // a jump inside smooth motion: a pop only if the picture snaps back (A, B, A); if the new picture stays,
    // it is a low-contrast hard cut (e.g. between two light shots with the same background)
    if (d(f - 1, f + 1) < diff[f] * 0.35) pops.push(f); else cuts.push(f);
  }
}
for (const f of pops.slice(0, 8)) say("Fehler", `Sprung/Blitz in einem einzelnen Frame (${(diff[f] * 100).toFixed(1)} % Änderung): fehlendes clamp, Asset lädt zu spät oder Szenengrenze mit Lücke.`, t(f));
if (pops.length > 8) say("Fehler", `… und ${pops.length - 8} weitere Sprünge.`);

// dead stretches: nothing changes for longer than --dead seconds (the final end-card hold is fine up to 3 s)
const still = 0.004; let run = 0;
for (let f = 1; f <= frames; f++) {
  if (f < frames && tile[f] < still) { run++; continue; }
  if (run / fps >= deadSec) { const start = f - run, end = f; const isEnd = end >= frames - 1; if (!(isEnd && run / fps <= 3.2)) say(isEnd ? "Info" : "Warnung", `${(run / fps).toFixed(1)} s ohne jede Bewegung${isEnd ? " am Ende" : ""}: braucht der Text so lange Lesezeit? Sonst kürzen oder leise beleben (Drift, Kamera-Kriechen ≤ 0,5 %).`, t(start)); }
  run = 0;
}

// strobing: more than 3 brightness flashes in any second (WCAG 2.3.1)
const flips = []; for (let f = 2; f < frames; f++) { const a = luma[f - 1] - luma[f - 2], b = luma[f] - luma[f - 1]; if (Math.abs(a) > 0.1 && Math.abs(b) > 0.1 && Math.sign(a) !== Math.sign(b)) flips.push(f); }
for (let i = 0; i + 3 < flips.length; i++) if (flips[i + 3] - flips[i] <= fps) { say("Fehler", "Mehr als 3 Helligkeitsblitze pro Sekunde (WCAG 2.3.1, Anfallsrisiko).", t(flips[i])); break; }

// loop seam: last frame vs first, and motion into the cut vs motion out of it
if (argv.includes("--loop") && frames > 4) {
  const seam = d(frames - 1, 0), typical = median(Array.from(diff).slice(1));
  if (seam > Math.max(0.01, typical * 3)) say("Fehler", `Loop-Naht sichtbar: letzter und erster Frame unterscheiden sich um ${(seam * 100).toFixed(1)} % (typisch ${(typical * 100).toFixed(1)} %).`, t(frames - 1));
  const vIn = diff[frames - 1], vOut = diff[1];
  if (Math.abs(vIn - vOut) > Math.max(0.01, 2 * Math.min(vIn, vOut))) say("Warnung", "Loop-Naht: Geschwindigkeit vor und nach dem Sprung passt nicht zusammen (ruckt beim Wiederholen).", 0);
}

// cuts against the beat grid
let beatReport = null;
if (opt("--beats")) {
  const beats = JSON.parse(readFileSync(opt("--beats"), "utf8")).beats || [];
  const offs = cuts.map((f) => { const ct = t(f); const nb = beats.reduce((a, b) => (Math.abs(b - ct) < Math.abs(a - ct) ? b : a), Infinity); return { at: ct, ms: Math.round((ct - nb) * 1000) }; });
  const abs = offs.map((o) => Math.abs(o.ms)); beatReport = { cuts: offs, meanMs: abs.length ? Math.round(abs.reduce((a, b) => a + b, 0) / abs.length) : null, maxMs: abs.length ? Math.max(...abs) : null };
  for (const o of offs) if (Math.abs(o.ms) > 1000 / fps * 1.5) say("Warnung", `Schnitt ${o.ms > 0 ? "+" : ""}${o.ms} ms neben dem Beat (Ziel: innerhalb ±${Math.round(1000 / fps)} ms).`, o.at);
}

// ---------- report ----------
const order = { Fehler: 0, Warnung: 1, Info: 2 };
issues.sort((a, b) => order[a.level] - order[b.level] || (a.at ?? 0) - (b.at ?? 0));
console.log(`${input}: ${v.width}x${v.height} ${fps.toFixed(2)} fps · ${duration.toFixed(2)} s · ${v.codec_name}/${v.pix_fmt}${au ? ` · Ton ${au.codec_name} ${au.channels}ch` : " · ohne Ton"}`);
if (loud) console.log(`Lautheit ${loud.I} LUFS (Ziel ${target}) · True Peak ${loud.TP} dBFS · Mono ${loud.monoI} LUFS`);
console.log(`Schnitte: ${cuts.length}${cuts.length ? ` (${cuts.slice(0, 12).map((f) => t(f).toFixed(2)).join(", ")}${cuts.length > 12 ? ", …" : ""})` : ""}${beatReport?.meanMs != null ? ` · zum Beat Ø ${beatReport.meanMs} ms, max ${beatReport.maxMs} ms` : ""}`);
console.log(issues.length ? "\nBefunde:" : "\nKeine Befunde.");
for (const i of issues) console.log(`  ${i.level.padEnd(7)} ${i.at != null ? ts(i.at).padStart(8) + "  " : "          "}${i.text}`);
// the moments a human should still look at / listen to: biggest changes that are not cuts
const watch = Array.from(diff).map((x, f) => [x, f]).filter(([, f]) => f > 1 && !cuts.includes(f)).sort((a, b) => b[0] - a[0]).slice(0, 5).map(([, f]) => ts(t(f)));
console.log(`\nSelbst ansehen/anhören (stärkste Änderungen ohne Schnitt): ${watch.join(", ")}`);
if (opt("--json")) writeFileSync(opt("--json"), JSON.stringify({ input, fps, duration, loudness: loud, cuts: cuts.map(t), pops: pops.map(t), beat: beatReport, issues }, null, 1));
process.exit(issues.some((i) => i.level === "Fehler") ? 1 : 0);
