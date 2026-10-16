// The library: one folder per recording, with a meta.json next to the media files.
//   <library>/<id>/meta.json, screen.webm, cam.webm, thumb.jpg, transcript.json, captions.vtt, …
// Later a cloud backend (Cloudflare R2) can mirror these folders; the app only talks to this module.
import { mkdir, readdir, readFile, rename, rm, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { config } from "./config.js";

export const dir = (id) => join(config.library, id);
export const file = (id, name) => join(config.library, id, name);
const valid = (id) => /^[a-z0-9]{10}$/.test(id);

export async function init() { await mkdir(config.library, { recursive: true }); }

export async function create(fields) {
  const id = randomBytes(8).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(10, "x").slice(0, 10);
  await mkdir(dir(id), { recursive: true });
  const meta = {
    id, title: "", createdAt: new Date().toISOString(), status: "recording", duration: 0,
    tracks: {}, bubble: { corner: "bl", size: 0.2, shape: "circle", hidden: false },
    edits: { cuts: [] }, ai: { transcript: "pending", summary: "pending" },
    summary: "", tldr: [], chapters: [], actions: [], comments: [], exports: {}, guide: null,
    ...fields,
  };
  await save(meta);
  return meta;
}

// one writer at a time per recording, so concurrent updates never lose a field
const locks = new Map();
export async function update(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  let release; const next = new Promise((r) => (release = r));
  locks.set(id, prev.then(() => next));
  await prev;
  try {
    const meta = await get(id);
    if (!meta) return null;
    const out = (await fn(meta)) || meta;
    await save(out);
    return out;
  } finally { release(); if (locks.get(id) === next) locks.delete(id); }
}

export async function get(id) {
  if (!valid(id)) return null;
  try { return JSON.parse(await readFile(file(id, "meta.json"), "utf8")); } catch { return null; }
}

async function save(meta) {
  const tmp = file(meta.id, "meta.json.tmp");
  await writeFile(tmp, JSON.stringify(meta, null, 2));
  await rename(tmp, file(meta.id, "meta.json")); // atomic: a crash never leaves half a meta.json
}

export async function list() {
  const ids = (await readdir(config.library).catch(() => [])).filter(valid);
  const all = (await Promise.all(ids.map(get))).filter(Boolean);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function remove(id) { if (valid(id)) await rm(dir(id), { recursive: true, force: true }); }

export async function readJson(id, name, fallback = null) {
  try { return JSON.parse(await readFile(file(id, name), "utf8")); } catch { return fallback; }
}
export const writeJson = (id, name, data) => writeFile(file(id, name), JSON.stringify(data));
export const exists = (id, name) => existsSync(file(id, name));
export const size = async (id, name) => (await stat(file(id, name)).catch(() => ({ size: 0 }))).size;
export { valid };
