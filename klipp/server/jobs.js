// Background work after a recording, one heavy job at a time (ffmpeg and Whisper both want the CPU).
// Every change to a recording is pushed to open pages through notify().
import { writeFile, rm } from "node:fs/promises";
import { config } from "./config.js";
import * as store from "./store.js";
import * as media from "./media.js";
import * as ai from "./ai.js";
import { transcribe } from "./transcribe.js";

const listeners = new Set();
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export async function notify(id) {
  const meta = await store.get(id);
  for (const fn of listeners) fn(meta || { id, deleted: true });
}
const set = async (id, fn) => { const m = await store.update(id, fn); await notify(id); return m; };

let chain = Promise.resolve();
const heavy = (fn) => (chain = chain.then(fn, fn));

/** Runs after the recorder says "stop". The share link works as soon as finalize is done (seconds). */
export function afterRecording(id) {
  return heavy(async () => {
    try {
      const r = await media.finalize(id);
      await set(id, (m) => {
        m.status = "ready"; m.duration = r.duration;
        m.media = { main: r.main, cam: r.cam, hasAudio: r.hasAudio, width: r.width, height: r.height };
        if (!r.hasAudio) { m.ai.transcript = "off"; m.ai.summary = "off"; }
        if (!m.title) m.title = `Aufnahme vom ${new Date(m.createdAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}`;
      });
    } catch (e) {
      console.error(`[${id}] finalize`, e.message);
      await set(id, (m) => { m.status = "error"; m.error = "Die Aufnahme konnte nicht verarbeitet werden: " + e.message; });
      return;
    }
    const meta = await store.get(id);
    if (meta.media.hasAudio && config.transcribe) queueTranscript(id);
  });
}

export function queueTranscript(id) {
  return heavy(async () => {
    const meta = await store.get(id);
    if (!meta?.media?.hasAudio) return;
    await set(id, (m) => { m.ai.transcript = "running"; m.ai.progress = 0; });
    const pcm = store.file(id, "speech.f32");
    try {
      await media.speechAudio(id, meta.media.main, pcm);
      let last = 0;
      const t = await transcribe(pcm, (p) => {
        if (p - last > 0.08) { last = p; set(id, (m) => { m.ai.progress = p; }); }
      }, meta.language);
      await store.writeJson(id, "transcript.json", t);
      await writeFile(store.file(id, "captions.vtt"), media.toVtt(media.cues(t.words)));
      await set(id, (m) => { m.ai.transcript = t.words.length ? "done" : "empty"; delete m.ai.progress; m.words = t.words.length; });
      if (t.words.length) runDescribe(id);
      else await set(id, (m) => { m.ai.summary = "off"; });
    } catch (e) {
      console.error(`[${id}] transcript`, e);
      await set(id, (m) => { m.ai.transcript = "error"; m.ai.error = e.message; });
    } finally { await rm(pcm, { force: true }); }
  });
}

/** Claude: title, summary, chapters. Not a heavy job, runs next to the queue. */
export async function runDescribe(id) {
  if (!config.hasClaude) return set(id, (m) => { m.ai.summary = "nokey"; });
  await set(id, (m) => { m.ai.summary = "running"; });
  try {
    const meta = await store.get(id);
    const { words } = await store.readJson(id, "transcript.json", { words: [] });
    const d = await ai.describe(words, meta.duration);
    await set(id, (m) => {
      if (!m.titleEdited) m.title = d.title || m.title;
      m.summary = d.summary; m.tldr = d.tldr; m.actions = d.actions;
      if (!m.chaptersFixed) m.chapters = (d.chapters || []).filter((c) => c.t >= 0 && c.t < m.duration).sort((a, b) => a.t - b.t);
      m.ai.summary = "done";
    });
  } catch (e) {
    console.error(`[${id}] describe`, e.message);
    await set(id, (m) => { m.ai.summary = "error"; m.ai.error = ai.explainError(e); });
  }
}

export async function runGuide(id) {
  await set(id, (m) => { m.guide = { status: "running" }; });
  try {
    const meta = await store.get(id);
    const { words } = await store.readJson(id, "transcript.json", { words: [] });
    const g = await ai.guide(words, meta.title);
    const steps = [];
    for (const [i, s] of g.steps.entries()) {
      const t = Math.max(0, Math.min(meta.duration - 0.2, s.t + 0.8)); // a beat after the words: the click has happened
      const shot = `guide-${i + 1}.jpg`;
      await media.frame(id, meta.media.main, t, store.file(id, shot)).catch(() => null);
      steps.push({ ...s, t, shot: store.exists(id, shot) ? shot : null });
    }
    await set(id, (m) => { m.guide = { status: "done", title: g.title, intro: g.intro, steps, tips: g.tips }; });
  } catch (e) {
    console.error(`[${id}] guide`, e.message);
    await set(id, (m) => { m.guide = { status: "error", error: ai.explainError(e) }; });
  }
}

export async function runTranslate(id, language) {
  const key = language.toLowerCase().replace(/[^a-z]/g, "").slice(0, 20);
  await set(id, (m) => { m.translations = { ...(m.translations || {}), [key]: { status: "running", language } }; });
  try {
    const { words } = await store.readJson(id, "transcript.json", { words: [] });
    const cs = media.cues(words);
    const texts = await ai.translate(cs.map((c) => c.text), language);
    await writeFile(store.file(id, `captions.${key}.vtt`), media.toVtt(cs.map((c, i) => ({ ...c, text: texts[i] }))));
    await set(id, (m) => { m.translations[key] = { status: "done", language, file: `captions.${key}.vtt` }; });
  } catch (e) {
    await set(id, (m) => { m.translations[key] = { status: "error", language, error: ai.explainError(e) }; });
  }
}

export function runExport(id, kind, opts = {}) {
  return heavy(async () => {
    await set(id, (m) => { m.exports[kind] = { status: "running", progress: 0 }; });
    try {
      let last = 0;
      const progress = (p) => { if (p - last > 0.04) { last = p; set(id, (m) => { m.exports[kind].progress = p; }); } };
      const name = kind === "demo" ? "demo.mp4" : kind === "mp4-captions" ? "export-captions.mp4" : "export.mp4";
      if (kind === "demo") await (await import("./demo.js")).renderDemo(id, { ...opts, name }, progress);
      else await media.exportMp4(id, { captions: kind === "mp4-captions", name }, progress);
      await set(id, (m) => { m.exports[kind] = { status: "done", file: name, at: new Date().toISOString(), editsAt: m.editsAt || null }; });
    } catch (e) {
      console.error(`[${id}] export ${kind}`, e);
      await set(id, (m) => { m.exports[kind] = { status: "error", error: e.message.slice(0, 300) }; });
    }
  });
}

/** On start: recordings whose browser tab died mid-recording are finalized with what arrived. Nothing is lost. */
export async function recover() {
  for (const m of await store.list()) {
    if (m.status === "recording" || m.status === "processing") {
      const any = Object.values(m.tracks).some((t) => t.raw && store.exists(m.id, t.raw));
      if (any) { await store.update(m.id, (x) => { x.status = "processing"; x.recovered = true; }); afterRecording(m.id); }
      else await store.update(m.id, (x) => { x.status = "error"; x.error = x.source === "agent" ? "Die Agent-Aufnahme wurde unterbrochen (Klipp wurde beendet)." : "Die Aufnahme enthielt keine Daten."; });
    }
  }
}

