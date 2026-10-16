// Stimme server: text to speech with built-in voices (German/English) and cloned voices.
//   npm start  ->  http://localhost:4848      API: see README ("API für Programme und Agents")
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { config, ROOT } from "./config.js";
import * as voices from "./voices.js";
import { speak, history, removeItem, audioPath } from "./speak.js";
import { ensure, ready, progress } from "./models.js";
import { PACKS, DEFAULT_VOICE } from "./catalog.js";
import { state as cloneState, start as startClone } from "./clone.js";
import * as guard from "./guard.js";

const WEB = join(ROOT, "web");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".json": "application/json" };
const json = (res, code, data) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
async function body(req, limit) { const parts = []; let n = 0; for await (const c of req) { n += c.length; if (n > limit) throw Object.assign(new Error("Datei zu groß"), { code: 413 }); parts.push(c); } return Buffer.concat(parts); }

function sendFile(req, res, path, extra = {}) {
  let st; try { st = statSync(path); } catch { return json(res, 404, { error: "not found" }); }
  const head = { "Content-Type": TYPES[extname(path)] || "application/octet-stream", "Accept-Ranges": "bytes", ...extra };
  const m = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]); const end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
    res.writeHead(206, { ...head, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 });
    return createReadStream(path, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...head, "Content-Length": st.size });
  createReadStream(path).pipe(res);
}

async function route(req, res) {
  const url = new URL(req.url, "http://x"), p = url.pathname;
  let m;
  const blocked = guard.check(req);
  if (blocked) return json(res, 403, { error: blocked });

  if (p === "/api/status") return json(res, 200, { ok: true, defaults: DEFAULT_VOICE, clone: cloneState,
    packs: Object.fromEntries(Object.entries(PACKS).map(([k, v]) => [k, { ready: ready(k), downloading: progress[k] ?? null, size: v.size, license: v.license }])) });
  if (p === "/api/voices" && req.method === "GET") return json(res, 200, await voices.list());

  if (p === "/api/speak" && req.method === "POST") {
    const b = JSON.parse((await body(req, 1e6)).toString("utf8") || "{}");
    const voice = b.voice || DEFAULT_VOICE[b.lang === "en" ? "en" : "de"];
    const r = await speak({ ...b, voice });
    if (url.searchParams.has("raw")) return sendFile(req, res, audioPath(r.file), { "X-Duration": String(r.duration) });
    return json(res, 200, { ...r, url: `/audio/${r.file}` });
  }
  if (p === "/api/history" && req.method === "GET") return json(res, 200, (await history(+url.searchParams.get("limit") || 50)).map((h) => ({ ...h, url: `/audio/${h.file}` })));
  if ((m = p.match(/^\/api\/history\/([a-f0-9]{16})$/)) && req.method === "DELETE") { await removeItem(m[1]); return json(res, 200, { ok: true }); }

  if (p === "/api/voices/clone" && req.method === "POST") {
    const audio = await body(req, 40e6);
    const q = url.searchParams;
    const v = await voices.create({ name: q.get("name"), lang: q.get("lang"), audio, consent: { confirmed: q.get("consent") === "1", person: q.get("person") } });
    return json(res, 201, v);
  }
  if ((m = p.match(/^\/api\/voices\/(c-[a-z0-9]{8})$/)) && req.method === "DELETE") { await voices.remove(m[1]); return json(res, 200, { ok: true }); }
  if ((m = p.match(/^\/api\/voices\/(c-[a-z0-9]{8})\/sample$/))) return sendFile(req, res, voices.refPath(m[1]));
  if ((m = p.match(/^\/api\/packs\/([a-z-]+)\/download$/)) && req.method === "POST") {
    if (!PACKS[m[1]]) return json(res, 404, { error: "unknown pack" });
    ensure(m[1]).catch((e) => console.error("download", m[1], e.message));
    return json(res, 202, { ok: true });
  }
  if (p === "/api/clone/start" && req.method === "POST") { startClone().catch(() => {}); return json(res, 202, cloneState); }

  if ((m = p.match(/^\/audio\/([a-f0-9]{16}\.(mp3|wav))$/))) return sendFile(req, res, audioPath(m[1]), url.searchParams.has("download") ? { "Content-Disposition": `attachment; filename="stimme-${m[1]}"` } : {});
  if (p === "/") return sendFile(req, res, join(WEB, "index.html"));
  const f = normalize(join(WEB, p));
  if (f.startsWith(WEB) && extname(f)) return sendFile(req, res, f);
  json(res, 404, { error: "not found" });
}

export function startServer({ port = config.port, host = config.host, quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const srv = createServer((req, res) => route(req, res).catch((e) => { if (e.code !== 400 && e.code !== 404 && e.code !== 409) console.error(e); if (!res.headersSent) json(res, typeof e.code === "number" ? e.code : 500, { error: e.message }); else res.end(); }));
    srv.on("error", reject);
    srv.listen(port, host, () => {
      const log = quiet ? console.error : console.log;
      log(`\n  Stimme läuft:  http://localhost:${port}\n  Daten:         ${config.home}\n  Klonen:        ${cloneState.installed ? "installiert (startet bei Bedarf)" : "nicht installiert (npm run setup-clone)"}\n`);
      resolve(srv);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) startServer();
