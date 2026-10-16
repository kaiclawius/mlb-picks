// Fusion with Stimme: narration for agent videos. Uses a running Stimme server; if there is none but the
// Stimme folder sits next to Klipp (monorepo), Stimme is started inside this process. One install, one command.
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";

let base = null, starting = null;

async function reachable(url) {
  try { const r = await fetch(url + "/api/status", { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; }
}

export async function stimme() {
  if (base) return base;
  starting ??= (async () => {
    if (await reachable(config.stimmeUrl)) return (base = config.stimmeUrl);
    const entry = join(config.stimmeDir, "server", "index.js");
    if (!existsSync(entry) || !existsSync(join(config.stimmeDir, "node_modules"))) throw new Error(`Stimme ist nicht erreichbar (${config.stimmeUrl}) und nicht installiert. Starte Stimme (cd stimme && npm install && npm start) oder setze STIMME_URL.`);
    const { startServer } = await import(pathToFileURL(entry).href);
    const port = new URL(config.stimmeUrl).port || 4848;
    await startServer({ port: Number(port), quiet: true });
    return (base = `http://127.0.0.1:${port}`);
  })().finally(() => (starting = null));
  return starting;
}

/** Speaks `text` and saves a WAV to `out`. Returns { duration, sentences, voice }. */
export async function narrate(text, { voice, language = "de", speed = 1 } = {}, out) {
  const url = await stimme();
  const r = await fetch(url + "/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice, lang: language, speed, format: "wav" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Stimme: " + (j.error || r.status));
  const audio = await fetch(url + j.url);
  await writeFile(out, Buffer.from(await audio.arrayBuffer()));
  return { duration: j.duration, sentences: j.sentences, voice: j.voiceName };
}

export async function voices() {
  const url = await stimme();
  return (await fetch(url + "/api/voices")).json();
}
export async function speakFile(body) {
  const url = await stimme();
  const r = await fetch(url + "/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Stimme Fehler");
  return { ...j, url: url + j.url };
}
