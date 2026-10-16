// The voice library: built-in voices from the catalog plus voices cloned by the user.
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { config } from "./config.js";
import { VOICES, PACKS } from "./catalog.js";
import { ready, progress } from "./models.js";
import * as clone from "./clone.js";
import { toReference } from "./audio.js";

const cloneDir = (id) => join(config.home, "voices", id);

export async function list() {
  const builtin = VOICES.map((v) => ({ ...v, kind: "builtin", engine: PACKS[v.pack].type === "kokoro" ? "Kokoro" : "Piper", license: PACKS[v.pack].license,
    downloaded: ready(v.pack), downloading: progress[v.pack] ?? null, size: PACKS[v.pack].size }));
  return [...(await cloned()), ...builtin];
}

export async function cloned() {
  const dir = join(config.home, "voices");
  const ids = await readdir(dir).catch(() => []);
  const out = [];
  for (const id of ids) {
    try { out.push({ ...JSON.parse(await readFile(join(dir, id, "meta.json"), "utf8")), kind: "clone", engine: "Chatterbox" }); } catch {}
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function get(id) {
  const b = VOICES.find((v) => v.id === id);
  if (b) return { ...b, kind: "builtin" };
  if (!/^c-[a-z0-9]{8}$/.test(id)) return null;
  try { return { ...JSON.parse(await readFile(join(cloneDir(id), "meta.json"), "utf8")), kind: "clone", dir: cloneDir(id) }; } catch { return null; }
}

/** A recording of a real person becomes a voice. Consent is required and stored with the voice. */
export async function create({ name, lang, audio, consent }) {
  if (!consent?.confirmed || !consent.person) throw Object.assign(new Error("Ohne Einwilligung der Person kann keine Stimme geklont werden."), { code: 400 });
  const id = "c-" + randomBytes(6).toString("hex").slice(0, 8);
  const dir = cloneDir(id);
  await mkdir(dir, { recursive: true });
  const ref = await toReference(audio);
  const seconds = (ref.length - 44) / 2 / 24000;
  if (seconds < 5) { await rm(dir, { recursive: true, force: true }); throw Object.assign(new Error(`Die Probe ist zu kurz (${seconds.toFixed(1)} s). Bitte mindestens 10 Sekunden sprechen.`), { code: 400 }); }
  await writeFile(join(dir, "ref.wav"), ref);
  const meta = { id, name: String(name || "Meine Stimme").slice(0, 60), lang: lang === "en" ? "en" : "de", createdAt: new Date().toISOString(), seconds: +seconds.toFixed(1),
    status: "preparing", consent: { person: String(consent.person).slice(0, 80), statement: "Ich bin diese Person oder habe ihre ausdrückliche Erlaubnis, ihre Stimme zu klonen.", at: new Date().toISOString() } };
  await writeFile(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  clone.prepare(join(dir, "ref.wav"), join(dir, "conds.pt"))
    .then(() => patch(id, { status: "ready" }))
    .catch((e) => patch(id, { status: "error", error: e.message }));
  return meta;
}

async function patch(id, fields) {
  const p = join(cloneDir(id), "meta.json");
  const m = JSON.parse(await readFile(p, "utf8"));
  await writeFile(p, JSON.stringify({ ...m, ...fields }, null, 2));
}
export async function remove(id) { if (/^c-[a-z0-9]{8}$/.test(id)) await rm(cloneDir(id), { recursive: true, force: true }); }
export const refPath = (id) => join(cloneDir(id), "ref.wav");
export const hasConds = (id) => existsSync(join(cloneDir(id), "conds.pt"));
