// Klipp server: serves the app, receives recordings while they happen, and runs the processing.
//   npm start  ->  http://localhost:4747
import { createServer } from "node:http";
import { createReadStream, createWriteStream, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import * as media from "./media.js";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { randomBytes } from "node:crypto";
import { config, ROOT } from "./config.js";
import * as store from "./store.js";
import * as jobs from "./jobs.js";
import * as ai from "./ai.js";
import { state as whisper } from "./transcribe.js";
import { guideHtml, guideMarkdown } from "./guide.js";
import * as guard from "./guard.js";

const WEB = join(ROOT, "web");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".json": "application/json", ".webm": "video/webm", ".mp4": "video/mp4", ".vtt": "text/vtt; charset=utf-8", ".woff2": "font/woff2", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const TRACKS = { screen: "video", cam: "video", mic: "audio" };

const json = (res, code, data) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
const bad = (res, msg, code = 400) => json(res, code, { error: msg });
async function body(req, limit = 1e6) {
  const parts = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw Object.assign(new Error("too large"), { code: 413 }); parts.push(c); }
  return Buffer.concat(parts);
}
const jsonBody = async (req) => { const b = await body(req); return b.length ? JSON.parse(b.toString("utf8")) : {}; };

/** Files with HTTP range support, so the player can seek without downloading everything. */
function sendFile(req, res, path, extra = {}) {
  let st; try { st = statSync(path); } catch { return bad(res, "not found", 404); }
  if (!st.isFile()) return bad(res, "not found", 404);
  const type = TYPES[extname(path)] || "application/octet-stream";
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  const head = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": extname(path) === ".html" ? "no-cache" : "private, max-age=60", ...extra };
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) { res.writeHead(416, { "Content-Range": `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { ...head, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 });
    return createReadStream(path, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...head, "Content-Length": st.size });
  if (req.method === "HEAD") return res.end();
  createReadStream(path).pipe(res);
}

/* ----- search over titles, summaries and transcripts ----- */
const textCache = new Map();
async function searchText(m) {
  const key = `${m.id}:${m.words || 0}:${m.title}:${m.summary}`;
  if (textCache.get(m.id)?.key === key) return textCache.get(m.id).text;
  const t = await store.readJson(m.id, "transcript.json", { text: "" });
  const text = [m.title, m.summary, ...(m.tldr || []), ...(m.chapters || []).map((c) => c.title), t.text, ...(m.comments || []).map((c) => c.text)].join(" \n ").toLowerCase();
  textCache.set(m.id, { key, text });
  return text;
}
const card = (m) => ({ id: m.id, title: m.title, createdAt: m.createdAt, duration: m.duration, status: m.status, summary: m.summary,
  chapters: m.chapters?.length || 0, comments: m.comments?.length || 0, hasCam: Boolean(m.media?.cam), ai: m.ai, views: m.views || 0, source: m.source || "", agent: m.agent?.name || "", phase: m.agent?.phase || "" });

/* ----- the upload of a running recording: ordered chunks, appended to disk as they arrive ----- */
const expected = new Map(); // "id:track" -> next sequence number

async function route(req, res) {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  let m;
  const blocked = guard.check(req);
  if (blocked) return bad(res, blocked, 403);

  if (p === "/api/status") return json(res, 200, { claude: config.hasClaude, model: config.claudeModel, whisper, library: config.library, transcribe: config.transcribe });

  if (p === "/api/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write(": hi\n\n");
    const off = jobs.subscribe((meta) => res.write(`data: ${JSON.stringify(meta)}\n\n`));
    const ping = setInterval(() => res.write(": ping\n\n"), 20_000);
    req.on("close", () => { off(); clearInterval(ping); });
    return;
  }

  if (p === "/api/recordings" && req.method === "GET") {
    const q = (url.searchParams.get("q") || "").toLowerCase().trim();
    const all = await store.list();
    if (!q) return json(res, 200, all.map(card));
    const terms = q.split(/\s+/);
    const hits = [];
    for (const r of all) { const t = await searchText(r); if (terms.every((x) => t.includes(x))) hits.push(card(r)); }
    return json(res, 200, hits);
  }

  if (p === "/api/recordings" && req.method === "POST") {
    const b = await jsonBody(req);
    const tracks = {};
    for (const [k, v] of Object.entries(b.tracks || {})) {
      if (!TRACKS[k]) continue;
      const mime = String(v.mime || "");
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      tracks[k] = { raw: `${k}.raw.${ext}`, mime, width: v.width | 0, height: v.height | 0 };
    }
    if (!tracks.screen && !tracks.cam) return bad(res, "Nothing to record.");
    const meta = await store.create({ tracks, language: String(b.language || "").slice(0, 20), bubble: { corner: "bl", size: 0.2, shape: "circle", hidden: false, ...(b.bubble || {}) } });
    return json(res, 201, meta);
  }

  if ((m = p.match(/^\/api\/recordings\/([a-z0-9]{10})\/tracks\/(screen|cam|mic)\/(\d+)$/)) && req.method === "PUT") {
    const [, id, track, seqS] = m; const seq = Number(seqS);
    const meta = await store.get(id);
    if (!meta || meta.status !== "recording" || !meta.tracks[track]) return bad(res, "not recording", 409);
    const key = `${id}:${track}`;
    const want = expected.get(key) ?? 0;
    const data = await body(req, 64e6);
    if (seq < want) return json(res, 200, { ok: true, duplicate: true });
    if (seq > want) return json(res, 409, { expected: want });
    await appendFile(store.file(id, meta.tracks[track].raw), data);
    expected.set(key, want + 1);
    return json(res, 200, { ok: true, next: want + 1 });
  }

  if ((m = p.match(/^\/api\/recordings\/([a-z0-9]{10})\/finish$/)) && req.method === "POST") {
    const id = m[1];
    const b = await jsonBody(req);
    const meta = await store.update(id, (x) => { if (x.status === "recording") { x.status = "processing"; x.recordedSeconds = Number(b.seconds) || 0; } });
    if (!meta) return bad(res, "not found", 404);
    for (const t of Object.keys(TRACKS)) expected.delete(`${id}:${t}`);
    jobs.notify(id);
    jobs.afterRecording(id);
    return json(res, 200, meta);
  }

  if ((m = p.match(/^\/api\/recordings\/([a-z0-9]{10})$/))) {
    const id = m[1];
    if (req.method === "GET") {
      const meta = await store.get(id);
      if (!meta) return bad(res, "not found", 404);
      const t = await store.readJson(id, "transcript.json", { words: [] });
      return json(res, 200, { ...meta, transcript: t.words });
    }
    if (req.method === "PATCH") {
      const b = await jsonBody(req);
      const meta = await store.update(id, (x) => {
        if (typeof b.title === "string" && b.title.trim()) { x.title = b.title.trim().slice(0, 140); x.titleEdited = true; }
        if (b.bubble) x.bubble = { ...x.bubble, ...pick(b.bubble, ["corner", "size", "shape", "hidden"]) };
        if (Array.isArray(b.cuts)) { x.edits.cuts = b.cuts.filter((c) => Array.isArray(c) && c.length === 2).map(([a, z]) => [Math.max(0, +a), Math.min(x.duration, +z)]).filter(([a, z]) => z > a); x.editsAt = new Date().toISOString(); }
        if (typeof b.summary === "string") x.summary = b.summary.slice(0, 2000);
        if (Array.isArray(b.chapters)) x.chapters = b.chapters.map((c) => ({ t: Math.max(0, +c.t || 0), title: String(c.title || "").slice(0, 80) })).sort((a, z) => a.t - z.t);
        if (b.bubble || Array.isArray(b.cuts)) x.editsAt = new Date().toISOString();
      });
      if (!meta) return bad(res, "not found", 404);
      jobs.notify(id);
      return json(res, 200, meta);
    }
    if (req.method === "DELETE") { await store.remove(id); jobs.notify(id); return json(res, 200, { ok: true }); }
  }

  if ((m = p.match(/^\/api\/recordings\/([a-z0-9]{10})\/(view|comments|ask|guide|translate|export|describe|transcribe)$/)) && req.method === "POST") {
    const [, id, action] = m;
    const meta = await store.get(id);
    if (!meta) return bad(res, "not found", 404);
    const b = await jsonBody(req);
    const needWords = ["ask", "guide", "translate", "describe"].includes(action);
    if (needWords && meta.ai.transcript !== "done") return bad(res, "Das Transkript ist noch nicht fertig.", 409);
    if (needWords && !config.hasClaude) return bad(res, "Für diese Funktion braucht Klipp einen Anthropic API-Key (ANTHROPIC_API_KEY in .env).", 412);
    switch (action) {
      case "view": await store.update(id, (x) => { x.views = (x.views || 0) + 1; }); return json(res, 200, { ok: true });
      case "comments": {
        const text = String(b.text || "").trim().slice(0, 2000);
        if (!text && !b.emoji) return bad(res, "Leerer Kommentar.");
        const c = { id: randomBytes(4).toString("hex"), t: Math.max(0, +b.t || 0), text, emoji: String(b.emoji || "").slice(0, 8), name: String(b.name || "").trim().slice(0, 40) || "Gast", at: new Date().toISOString() };
        await store.update(id, (x) => { x.comments.push(c); x.comments.sort((a, z) => a.t - z.t); });
        jobs.notify(id);
        return json(res, 201, c);
      }
      case "ask": {
        const q = String(b.question || "").trim().slice(0, 500);
        if (q.length < 3) return bad(res, "Frage fehlt.");
        const { words } = await store.readJson(id, "transcript.json", { words: [] });
        try { return json(res, 200, await ai.answer(words, q, meta.title)); }
        catch (e) { return bad(res, ai.explainError(e), 502); }
      }
      case "guide": jobs.runGuide(id); return json(res, 202, { ok: true });
      case "describe": jobs.runDescribe(id); return json(res, 202, { ok: true });
      case "translate": {
        const lang = String(b.language || "").trim().slice(0, 30);
        if (!lang) return bad(res, "Sprache fehlt.");
        jobs.runTranslate(id, lang); return json(res, 202, { ok: true });
      }
      case "transcribe":
        if (b.language !== undefined) await store.update(id, (x) => { x.language = String(b.language).slice(0, 20); });
        if (!meta.media?.hasAudio) return bad(res, "Diese Aufnahme hat keinen Ton.", 409);
        jobs.queueTranscript(id); return json(res, 202, { ok: true });
      case "export": {
        const kind = ["mp4", "mp4-captions", "demo"].includes(b.kind) ? b.kind : "mp4";
        if (meta.status !== "ready") return bad(res, "Die Aufnahme ist noch nicht fertig.", 409);
        jobs.runExport(id, kind, b.options || {}); return json(res, 202, { ok: true });
      }
    }
  }

  // one frame as JPEG: lets agents "see" the video
  if ((m = p.match(/^\/api\/recordings\/([a-z0-9]{10})\/frame$/)) && req.method === "GET") {
    const meta = await store.get(m[1]);
    if (meta?.status !== "ready") return bad(res, "not ready", 409);
    const t = Math.max(0, Math.min(meta.duration - 0.05, Number(url.searchParams.get("t")) || 0));
    const w = Math.max(320, Math.min(1920, Number(url.searchParams.get("w")) || 1280));
    const out = store.file(m[1], `frame-${Math.round(t * 10)}-${w}.jpg`);
    if (!store.exists(m[1], `frame-${Math.round(t * 10)}-${w}.jpg`)) await media.frame(m[1], meta.media.main, t, out, w);
    return sendFile(req, res, out);
  }

  // a finished video file from elsewhere (an agent's own screen recording, a Loom download, a phone video)
  if (p === "/api/recordings/import" && req.method === "POST") {
    const q = url.searchParams;
    const ext = /^(mp4|mov|webm|mkv|m4v)$/.test(q.get("ext") || "") ? q.get("ext") : "mp4";
    const meta = await store.create({ tracks: { screen: { raw: `screen.raw.${ext}`, mime: "video/" + ext } }, language: String(q.get("language") || "").slice(0, 20),
      title: String(q.get("title") || "").slice(0, 140), titleEdited: Boolean(q.get("title")), source: String(q.get("source") || "import").slice(0, 40) });
    await pipeline(req, createWriteStream(store.file(meta.id, `screen.raw.${ext}`)));
    await store.update(meta.id, (x) => { x.status = "processing"; });
    jobs.afterRecording(meta.id);
    return json(res, 201, await store.get(meta.id));
  }

  // agents record a website flow, optionally narrated with a voice from Stimme
  if (p === "/api/agent/record" && req.method === "POST") {
    const b = await jsonBody(req);
    const { startAgentRecording } = await import("./agent-record.js");
    return json(res, 202, await startAgentRecording(b));
  }

  if ((m = p.match(/^\/api\/recordings\/([a-z0-9]{10})\/comments\/([a-f0-9]{8})$/)) && req.method === "DELETE") {
    await store.update(m[1], (x) => { x.comments = x.comments.filter((c) => c.id !== m[2]); });
    jobs.notify(m[1]);
    return json(res, 200, { ok: true });
  }

  if ((m = p.match(/^\/api\/recordings\/([a-z0-9]{10})\/guide\.(md|html)$/))) {
    const meta = await store.get(m[1]);
    if (!meta?.guide?.steps) return bad(res, "no guide", 404);
    const name = slug(meta.guide.title || meta.title) + "." + m[2];
    const out = m[2] === "md" ? guideMarkdown(meta) : await guideHtml(meta);
    res.writeHead(200, { "Content-Type": m[2] === "md" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` });
    return res.end(out);
  }

  if ((m = p.match(/^\/media\/([a-z0-9]{10})\/([a-z0-9][a-z0-9._-]*)$/i))) {
    const [, id, name] = m;
    if (name === "meta.json" || name.includes("..") || /\.(f32|pcm|tmp)$/.test(name)) return bad(res, "not found", 404);
    const extra = {};
    if (url.searchParams.has("download")) {
      const meta = await store.get(id);
      extra["Content-Disposition"] = `attachment; filename="${slug(meta?.title || id)}${extname(name)}"`;
    }
    return sendFile(req, res, store.file(id, name), extra);
  }

  // pages
  if (p === "/" ) return sendFile(req, res, join(WEB, "index.html"));
  if (p === "/record") return sendFile(req, res, join(WEB, "record.html"));
  if (/^\/v\/[a-z0-9]{10}$/.test(p)) return sendFile(req, res, join(WEB, "watch.html"));
  if (/^\/g\/[a-z0-9]{10}$/.test(p)) return sendFile(req, res, join(WEB, "guide.html"));
  const f = normalize(join(WEB, p));
  if (f.startsWith(WEB) && extname(f)) return sendFile(req, res, f);
  return bad(res, "not found", 404);
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  import("node:child_process").then(({ spawn }) => spawn(cmd[0], cmd[1], { stdio: "ignore", detached: true }).on("error", () => {}).unref());
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const slug = (s) => String(s).normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "klipp";

/** Starts Klipp. `quiet` sends the banner to stderr (stdout belongs to the MCP protocol). */
export async function startServer({ quiet = false, port = config.port } = {}) {
  await store.init();
  await jobs.recover();
  return new Promise((resolve, reject) => {
    const srv = createServer((req, res) => {
      route(req, res).catch((e) => {
        if (!e.status) console.error(e);
        if (!res.headersSent) bad(res, e.code === 413 ? "too large" : e.status ? e.message : "Serverfehler: " + e.message, e.code === 413 ? 413 : e.status || 500);
        else res.end();
      });
    });
    srv.on("error", reject);
    srv.listen(port, config.host, () => {
      if (config.open && !quiet) openBrowser(`http://localhost:${port}`);
      (quiet ? console.error : console.log)(`\n  Klipp läuft:  http://localhost:${port}\n  Bibliothek:   ${config.library}\n  Claude:       ${config.hasClaude ? "an (" + config.claudeModel + ")" : "aus (ANTHROPIC_API_KEY fehlt)"}\n  Transkript:   ${config.transcribe ? "lokal mit " + config.whisperModel : "aus"}\n`);
      resolve(srv);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) startServer();
