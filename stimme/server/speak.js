// Text -> speech file. Splits into sentences, renders each with the right engine, joins with natural pauses,
// and remembers where each sentence starts (Klipp uses that to place narration and captions).
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { config } from "./config.js";
import * as voices from "./voices.js";
import * as builtin from "./builtin.js";
import * as clone from "./clone.js";
import { sentences, join as joinAudio, resample, wav, readWav, toMp3 } from "./audio.js";

const HIST = () => join(config.home, "history");
const OUT_SR = 24000;
let queue = Promise.resolve(); // one synthesis at a time keeps the CPU responsive
const serial = (fn) => (queue = queue.then(fn, fn));

export async function speak({ text, voice: voiceId, speed = 1, format = "mp3", lang, exaggeration = 0.5, onProgress }) {
  text = String(text || "").trim();
  if (!text) throw Object.assign(new Error("Kein Text."), { code: 400 });
  if (text.length > 20000) throw Object.assign(new Error("Höchstens 20 000 Zeichen pro Auftrag."), { code: 400 });
  const voice = await voices.get(voiceId);
  if (!voice) throw Object.assign(new Error("Unbekannte Stimme: " + voiceId), { code: 404 });
  if (voice.kind === "clone" && voice.status !== "ready") throw Object.assign(new Error(voice.status === "error" ? "Diese Stimme konnte nicht vorbereitet werden: " + voice.error : "Die Stimme wird noch vorbereitet."), { code: 409 });
  speed = Math.max(0.6, Math.min(1.6, Number(speed) || 1));
  format = format === "wav" ? "wav" : "mp3";
  const language = voice.kind === "clone" ? (lang === "en" || lang === "de" ? lang : voice.lang) : voice.lang;
  const key = createHash("sha1").update(JSON.stringify([text, voice.id, speed, language, exaggeration, format])).digest("hex").slice(0, 16);
  await mkdir(HIST(), { recursive: true });
  const metaPath = join(HIST(), key + ".json");
  if (existsSync(metaPath)) { const m = JSON.parse(await readFile(metaPath, "utf8")); return { ...m, cached: true }; }

  return serial(async () => {
    const parts = sentences(text);
    const chunks = [];
    for (const [i, s] of parts.entries()) {
      let a;
      if (voice.kind === "clone") {
        const tmp = join(HIST(), `${key}.${i}.wav`);
        await clone.speak({ text: s, lang: language, conds: join(voice.dir, "conds.pt"), out: tmp, exaggeration });
        a = readWav(await readFile(tmp)); await rm(tmp, { force: true });
        if (speed !== 1) a = { samples: resample(a.samples, a.sampleRate * speed, a.sampleRate), sampleRate: a.sampleRate };
      } else a = await builtin.synth(voice, s, speed);
      chunks.push(trimSilence(resample(a.samples, a.sampleRate, OUT_SR), OUT_SR));
      onProgress?.((i + 1) / parts.length);
    }
    const pauses = parts.map((s) => (/[.!?…]["“”»']?$/.test(s) ? 0.35 : 0.18) / speed);
    pauses[pauses.length - 1] = 0.1;
    const { samples, starts } = joinAudio(chunks, OUT_SR, pauses);
    const w = wav(samples, OUT_SR);
    const file = `${key}.${format}`;
    await writeFile(join(HIST(), file), format === "mp3" ? await toMp3(w) : w);
    const meta = { id: key, file, text, voice: voice.id, voiceName: voice.name, lang: language, speed, format, createdAt: new Date().toISOString(),
      duration: +(samples.length / OUT_SR).toFixed(3), sentences: parts.map((s, i) => ({ text: s, start: +starts[i].toFixed(3), end: +(starts[i] + chunks[i].length / OUT_SR).toFixed(3) })) };
    await writeFile(metaPath, JSON.stringify(meta));
    return meta;
  });
}

/** Cuts leading/trailing near-silence from one sentence, keeps 40 ms of air. */
function trimSilence(s, sr) {
  const th = 0.01, pad = Math.round(0.04 * sr);
  let a = 0, b = s.length - 1;
  while (a < b && Math.abs(s[a]) < th) a++;
  while (b > a && Math.abs(s[b]) < th) b--;
  return s.subarray(Math.max(0, a - pad), Math.min(s.length, b + pad));
}

export async function history(limit = 50) {
  const files = (await readdir(HIST()).catch(() => [])).filter((f) => f.endsWith(".json"));
  const all = [];
  for (const f of files) { try { all.push(JSON.parse(await readFile(join(HIST(), f), "utf8"))); } catch {} }
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
export async function removeItem(id) {
  if (!/^[a-f0-9]{16}$/.test(id)) return;
  for (const ext of ["json", "mp3", "wav"]) await rm(join(HIST(), `${id}.${ext}`), { force: true });
}
export const audioPath = (file) => join(HIST(), file);
