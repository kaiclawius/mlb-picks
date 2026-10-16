// Klipp as an MCP server: any agent (Claude Code, Claude Desktop, Cursor, …) can watch, search, comment on,
// edit and create videos, and speak with Stimme voices. No setup beyond adding this one command:
//   claude mcp add klipp -- node /path/to/klipp/server/mcp.js
// If Klipp is already running, the tools use it; otherwise Klipp starts inside this process.
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "./config.js";

// stdout carries the MCP protocol; everything else that logs must go to stderr
console.log = console.error;

const BASE = process.env.KLIPP_URL || `http://127.0.0.1:${config.port}`;
let ready = null;
async function klipp() {
  ready ??= (async () => {
    try { const r = await fetch(BASE + "/api/status", { signal: AbortSignal.timeout(1500) }); if (r.ok) return; } catch {}
    const { startServer } = await import("./index.js");
    await startServer({ quiet: true, port: Number(new URL(BASE).port) || config.port });
  })().catch((e) => { ready = null; throw e; });
  return ready;
}
async function api(path, opts = {}) {
  await klipp();
  const r = await fetch(BASE + path, { ...opts, headers: { ...(opts.json ? { "Content-Type": "application/json" } : {}), ...opts.headers }, body: opts.json ? JSON.stringify(opts.json) : opts.body, duplex: opts.body ? "half" : undefined });
  if ((r.headers.get("content-type") || "").includes("image/")) return Buffer.from(await r.arrayBuffer());
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Klipp ${r.status}`);
  return j;
}
const link = (id, t) => `${BASE.replace("127.0.0.1", "localhost")}/v/${id}${t ? `?t=${Math.floor(t)}` : ""}`;
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const text = (s) => ({ content: [{ type: "text", text: typeof s === "string" ? s : JSON.stringify(s, null, 2) }] });
const fail = (e) => ({ content: [{ type: "text", text: "Fehler: " + (e.message || e) }], isError: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Waits until a recording is watchable (and, if asked, until transcript and AI summary are done). */
async function waitFor(id, { ai = true, seconds = 240 } = {}) {
  const end = Date.now() + seconds * 1000;
  let m;
  while (Date.now() < end) {
    m = await api(`/api/recordings/${id}`);
    const busy = ["pending", "running"];
    if (m.status === "error") return m;
    if (m.status === "ready" && (!ai || (!busy.includes(m.ai.transcript) && !busy.includes(m.ai.summary)))) return m;
    await sleep(1500);
  }
  return m;
}

function lines(words) {
  const out = []; let cur = null;
  for (const w of words || []) {
    if (!cur || w.s - cur.end > 1.2 || cur.n >= 20 || /[.!?]$/.test(cur.text)) { cur = { s: w.s, end: w.e, text: w.w, n: 1 }; out.push(cur); }
    else { cur.text += " " + w.w; cur.end = w.e; cur.n++; }
  }
  return out.map((l) => `[${mmss(l.s)}] ${l.text}`).join("\n");
}

function describe(m, { transcript = true } = {}) {
  const parts = [`# ${m.title}`, `Link: ${link(m.id)}`, `ID: ${m.id} · Länge ${mmss(m.duration || 0)} · Status: ${m.status}${m.error ? " (" + m.error + ")" : ""} · aufgenommen ${m.createdAt}${m.source === "agent" ? " · von einem Agent" : ""}`];
  if (m.status !== "ready") parts.push(`Phase: ${m.agent?.phase || m.status}`);
  if (m.summary) parts.push("", "## Zusammenfassung", m.summary);
  if (m.tldr?.length) parts.push("", "## Kernpunkte", ...m.tldr.map((t) => "- " + t));
  if (m.actions?.length) parts.push("", "## To-dos", ...m.actions.map((t) => "- " + t));
  if (m.chapters?.length) parts.push("", "## Kapitel", ...m.chapters.map((c) => `- ${mmss(c.t)} ${c.title}`));
  if (m.comments?.length) parts.push("", "## Kommentare (Feedback)", ...m.comments.map((c) => `- [${mmss(c.t)}] ${c.name}: ${c.text || c.emoji}  (id ${c.id}, ${c.at})`));
  if (m.agent?.warnings?.length) parts.push("", "## Warnungen der Aufnahme", ...m.agent.warnings.map((w) => "- " + w));
  if (transcript) parts.push("", "## Transkript", m.transcript?.length ? lines(m.transcript) : `(${m.ai?.transcript === "off" ? "kein Ton" : "noch nicht fertig: " + m.ai?.transcript})`);
  return parts.join("\n");
}

const server = new McpServer({ name: "klipp", version: "0.2.0" }, {
  instructions: `Klipp ist eine Video-App (wie Loom) mit KI. Benutze sie, um Bildschirmvideos zu finden, anzusehen und zu verstehen, Feedback als Kommentare an Zeitstellen zu lesen oder zu schreiben, und um selbst Videos aufzunehmen: klipp_record_website steuert einen Browser durch Schritte und spricht dazu mit einer Stimme (Stimme-App, Deutsch/Englisch, auch geklonte Stimmen).
Typischer Ablauf, um Arbeit zu zeigen: Aufgabe erledigen -> klipp_record_website mit kurzen Erklärungen pro Schritt ("say") -> Link an den Menschen geben -> später klipp_get und die Kommentare lesen und das Feedback umsetzen.
Zeiten sind Sekunden ab Videostart. Links funktionieren auf diesem Rechner (oder im Netzwerk, wenn Klipp so gestartet ist).`,
});

server.registerTool("klipp_search", {
  title: "Videos suchen",
  description: "Sucht in allen Klipp-Videos: Titel, Zusammenfassungen, Kommentare und jedes gesprochene Wort. Ohne query: die neuesten Videos.",
  inputSchema: { query: z.string().optional().describe("Suchbegriffe, z. B. 'Export Rechnung'"), limit: z.number().int().min(1).max(50).optional() },
  annotations: { readOnlyHint: true },
}, async ({ query, limit = 10 }) => {
  try {
    const list = (await api("/api/recordings" + (query ? "?q=" + encodeURIComponent(query) : ""))).slice(0, limit);
    if (!list.length) return text(query ? `Keine Videos zu „${query}“.` : "Noch keine Videos.");
    return text(list.map((r) => `- ${r.title} (${mmss(r.duration || 0)}, ${r.createdAt.slice(0, 10)}, ${r.comments} Kommentare) id=${r.id} ${link(r.id)}${r.summary ? "\n  " + r.summary : ""}`).join("\n"));
  } catch (e) { return fail(e); }
});

server.registerTool("klipp_get", {
  title: "Video lesen",
  description: "Alles über ein Video als Text: Zusammenfassung, Kernpunkte, To-dos, Kapitel, Kommentare/Feedback mit Zeitstellen und das Transkript mit Zeitstempeln. So 'schaust' du ein Video in Sekunden. Für Bilder: klipp_frames.",
  inputSchema: { id: z.string().describe("Video-ID oder Klipp-Link"), transcript: z.boolean().optional().describe("Transkript mitliefern (Standard: ja)") },
  annotations: { readOnlyHint: true },
}, async ({ id, transcript = true }) => {
  try { return text(describe(await api(`/api/recordings/${idOf(id)}`), { transcript })); } catch (e) { return fail(e); }
});

server.registerTool("klipp_frames", {
  title: "Standbilder ansehen",
  description: "Standbilder aus einem Video als Bilder, damit du siehst, was auf dem Bildschirm ist. Entweder bestimmte Sekunden (times) oder gleichmäßig verteilt (count). Höchstens 8 Bilder.",
  inputSchema: { id: z.string(), times: z.array(z.number().min(0)).max(8).optional().describe("Sekunden, z. B. [12, 40.5]"), count: z.number().int().min(1).max(8).optional().describe("so viele Bilder gleichmäßig über das Video"), width: z.number().int().min(320).max(1920).optional() },
  annotations: { readOnlyHint: true },
}, async ({ id, times, count = 4, width = 1024 }) => {
  try {
    const m = await api(`/api/recordings/${idOf(id)}`);
    if (m.status !== "ready") return text(`Das Video ist noch nicht fertig (Status: ${m.status}).`);
    const ts = times?.length ? times : Array.from({ length: count }, (_, i) => +(((i + 0.5) / count) * m.duration).toFixed(2));
    const content = [];
    for (const t of ts) {
      const img = await api(`/api/recordings/${m.id}/frame?t=${t}&w=${width}`);
      content.push({ type: "text", text: `Bild bei ${mmss(t)} (${t} s)` }, { type: "image", data: img.toString("base64"), mimeType: "image/jpeg" });
    }
    return { content };
  } catch (e) { return fail(e); }
});

server.registerTool("klipp_comment", {
  title: "Kommentar schreiben",
  description: "Schreibt einen Kommentar an eine Stelle im Video (z. B. eine Antwort auf Feedback oder ein Hinweis 'hier behoben').",
  inputSchema: { id: z.string(), t: z.number().min(0).describe("Sekunde im Video"), text: z.string().min(1).max(2000), name: z.string().max(40).optional().describe("Anzeigename, Standard 'Agent'") },
}, async ({ id, t, text: body, name = "Agent" }) => {
  try { const c = await api(`/api/recordings/${idOf(id)}/comments`, { method: "POST", json: { t, text: body, name } }); return text(`Kommentar gespeichert bei ${mmss(c.t)}. ${link(idOf(id), c.t)}`); } catch (e) { return fail(e); }
});

server.registerTool("klipp_ask", {
  title: "Frag das Video",
  description: "Beantwortet eine Frage zu einem Video mit Claude und nennt die passenden Stellen. (Braucht einen Anthropic-Key in Klipp. Du kannst auch selbst mit klipp_get das Transkript lesen.)",
  inputSchema: { id: z.string(), question: z.string().min(3).max(500) },
  annotations: { readOnlyHint: true },
}, async ({ id, question }) => {
  try { const a = await api(`/api/recordings/${idOf(id)}/ask`, { method: "POST", json: { question } }); return text(`${a.answer}\n\n${(a.moments || []).map((x) => `- ${mmss(x.t)} ${x.label}: ${link(idOf(id), x.t)}`).join("\n")}`); } catch (e) { return fail(e); }
});

server.registerTool("klipp_record_website", {
  title: "Website aufnehmen (mit Stimme)",
  description: `Nimmt ein Video auf, ohne dass ein Mensch etwas tun muss: Klipp öffnet die URL in einem echten Browser, führt die Schritte aus (sichtbarer Mauszeiger, Klick-Effekte) und spricht zu jedem Schritt den Text in "say" mit einer Stimme. Ergebnis: ein Klipp-Video mit Link, Untertiteln, Kapiteln und Kommentaren. Ideal, um Menschen zu zeigen, was du gebaut oder geändert hast.
Schritte: action ist goto (value=URL), click (target=Selektor), type (target, value=Text), press (value=Taste, z. B. Enter), scroll (target oder value=Pixel), hover, highlight (rahmt target ein), wait (value=ms), waitFor (target). Selektoren sind Playwright-Selektoren: CSS ('#save'), Text ('text=Speichern') oder Rolle ('role=button[name="Speichern"]').
Halte "say" kurz und natürlich (ein bis zwei Sätze pro Schritt). "chapter" setzt ein Kapitel ab diesem Schritt.`,
  inputSchema: {
    url: z.string().url().describe("Startseite, z. B. http://localhost:3000"),
    steps: z.array(z.object({
      action: z.enum(["goto", "click", "type", "press", "scroll", "hover", "wait", "waitFor", "highlight"]),
      target: z.string().optional(), value: z.union([z.string(), z.number()]).optional(),
      say: z.string().optional().describe("Was die Stimme während dieses Schritts sagt"), chapter: z.string().optional(),
    })).max(80),
    title: z.string().max(140).optional(),
    voice: z.string().optional().describe("Stimmen-ID aus stimme_voices, z. B. thorsten, heart oder eine geklonte (c-…). Standard je nach Sprache."),
    language: z.enum(["de", "en"]).optional(),
    width: z.number().int().optional(), height: z.number().int().optional(),
    colorScheme: z.enum(["light", "dark"]).optional(),
    agent: z.string().max(60).optional().describe("Dein Name, erscheint als Absender"),
    wait: z.boolean().optional().describe("Warten, bis das Video fertig ist (Standard: ja, höchstens ~4 Minuten)"),
  },
}, async (args) => {
  try {
    const r = await api("/api/agent/record", { method: "POST", json: args });
    if (args.wait === false) return text(`Aufnahme läuft. ID ${r.id}, Link ${link(r.id)}. Später mit klipp_get prüfen.`);
    const m = await waitFor(r.id, { ai: false, seconds: 600 });
    if (m.status === "error") return fail(new Error(m.error));
    if (m.status !== "ready") return text(`Noch nicht fertig (${m.agent?.phase || m.status}). ID ${r.id}, Link ${link(r.id)}. Mit klipp_get nachsehen.`);
    const warn = m.agent?.warnings?.length ? `\nWarnungen:\n${m.agent.warnings.map((w) => "- " + w).join("\n")}` : "";
    return text(`Fertig: ${m.title} (${mmss(m.duration)})\nLink: ${link(m.id)}\nID: ${m.id}\nTranskript, Untertitel und Zusammenfassung entstehen jetzt im Hintergrund.${warn}`);
  } catch (e) { return fail(e); }
});

server.registerTool("klipp_import_video", {
  title: "Videodatei importieren",
  description: "Macht aus einer Videodatei auf diesem Rechner (MP4, MOV, WebM, MKV) ein Klipp-Video mit Link, Transkript, Zusammenfassung und Kommentaren.",
  inputSchema: { path: z.string().describe("Absoluter Pfad zur Datei"), title: z.string().max(140).optional(), language: z.enum(["german", "english"]).optional() },
}, async ({ path, title, language }) => {
  try {
    const p = resolve(path); const st = await stat(p);
    if (!st.isFile()) throw new Error("Keine Datei: " + p);
    const ext = extname(p).slice(1).toLowerCase();
    const q = new URLSearchParams({ ext, source: "agent-import", ...(title ? { title } : {}), ...(language ? { language } : {}) });
    const r = await api(`/api/recordings/import?${q}`, { method: "POST", body: createReadStream(p) });
    const m = await waitFor(r.id, { ai: false, seconds: 300 });
    return m.status === "ready" ? text(`Importiert: ${m.title} (${mmss(m.duration)})\nLink: ${link(m.id)}\nID: ${m.id}`) : fail(new Error(m.error || "Import noch nicht fertig: " + m.status));
  } catch (e) { return fail(e); }
});

server.registerTool("klipp_guide", {
  title: "Anleitung aus Video",
  description: "Erstellt aus einem Video eine schriftliche Schritt-für-Schritt-Anleitung mit Screenshots (Claude) und gibt sie als Markdown zurück, plus Link zur Seite.",
  inputSchema: { id: z.string() },
}, async ({ id }) => {
  try {
    id = idOf(id);
    await api(`/api/recordings/${id}/guide`, { method: "POST" });
    for (let i = 0; i < 160; i++) {
      const m = await api(`/api/recordings/${id}`);
      if (m.guide?.status === "done") {
        const g = m.guide;
        return text([`# ${g.title}`, g.intro, ...g.steps.map((s, k) => `${k + 1}. **${s.title}**: ${s.text} (Video ${mmss(s.t)}${s.shot ? `, Bild: ${BASE}/media/${id}/${s.shot}` : ""})`), ...(g.tips || []).map((t) => "- Tipp: " + t), "", `Seite: ${BASE.replace("127.0.0.1", "localhost")}/g/${id}`].join("\n"));
      }
      if (m.guide?.status === "error") throw new Error(m.guide.error);
      await sleep(1500);
    }
    return text("Die Anleitung wird noch erstellt. Später klipp_guide erneut aufrufen.");
  } catch (e) { return fail(e); }
});

server.registerTool("klipp_edit", {
  title: "Video bearbeiten",
  description: "Titel ändern, Stellen herausschneiden (cuts: [[start, ende], …] in Sekunden), Füllwörter und lange Pausen automatisch entfernen. Schnitte wirken sofort beim Abspielen und in Exporten.",
  inputSchema: {
    id: z.string(), title: z.string().max(140).optional(),
    cuts: z.array(z.tuple([z.number(), z.number()])).optional().describe("ersetzt alle Schnitte"),
    remove_fillers: z.boolean().optional(), shorten_pauses: z.boolean().optional(),
  },
}, async ({ id, title, cuts, remove_fillers, shorten_pauses }) => {
  try {
    id = idOf(id);
    const m = await api(`/api/recordings/${id}`);
    let cs = cuts ?? m.edits.cuts;
    if (remove_fillers || shorten_pauses) {
      const C = await import("../web/js/cuts.js");
      if (remove_fillers) cs = [...cs, ...C.fillerCuts(m.transcript || [])];
      if (shorten_pauses) cs = [...cs, ...C.pauseCuts(m.transcript || [], m.duration)];
      cs = C.normalize(cs, m.duration);
    }
    const r = await api(`/api/recordings/${id}`, { method: "PATCH", json: { ...(title ? { title } : {}), cuts: cs } });
    const removed = r.edits.cuts.reduce((s, [a, b]) => s + b - a, 0);
    return text(`Gespeichert. ${r.edits.cuts.length} Schnitte, neue Länge ${mmss(r.duration - removed)} (vorher ${mmss(r.duration)}). ${link(id)}`);
  } catch (e) { return fail(e); }
});

server.registerTool("klipp_export", {
  title: "Exportieren",
  description: "Exportiert ein Video als Datei: mp4 (mit Schnitten), mp4-captions (Untertitel im Bild) oder demo (polierter Demo-Film mit Intro, Kapiteln, Outro). Gibt Pfad und Download-Link zurück.",
  inputSchema: { id: z.string(), kind: z.enum(["mp4", "mp4-captions", "demo"]).optional() },
}, async ({ id, kind = "mp4" }) => {
  try {
    id = idOf(id);
    await api(`/api/recordings/${id}/export`, { method: "POST", json: { kind } });
    for (let i = 0; i < 400; i++) {
      await sleep(1500);
      const e = (await api(`/api/recordings/${id}`)).exports?.[kind];
      if (e?.status === "done") return text(`Fertig: ${config.library}/${id}/${e.file}\nDownload: ${BASE}/media/${id}/${e.file}?download=1`);
      if (e?.status === "error") throw new Error(e.error);
    }
    return text("Export läuft noch. Später klipp_export erneut aufrufen.");
  } catch (e) { return fail(e); }
});

/* ---- Stimme (fusion): voices for everything an agent wants to say out loud ---- */
server.registerTool("stimme_voices", {
  title: "Stimmen auflisten",
  description: "Alle Stimmen der Stimme-App: fertige deutsche und englische Stimmen und geklonte Stimmen (c-…).",
  inputSchema: {}, annotations: { readOnlyHint: true },
}, async () => {
  try {
    const { voices } = await import("./voice.js");
    const vs = await voices();
    return text(vs.map((v) => `- ${v.id}: ${v.name} (${v.lang}${v.accent ? " " + v.accent : ""}, ${v.kind === "clone" ? "geklont, " + v.status : v.gender === "f" ? "weiblich" : "männlich"})${v.note ? " " + v.note : ""}`).join("\n"));
  } catch (e) { return fail(e); }
});

server.registerTool("stimme_speak", {
  title: "Text sprechen",
  description: "Macht aus Text eine Audiodatei (MP3 oder WAV) mit einer Stimme. Gibt Datei-Link, Dauer und Satz-Zeiten zurück.",
  inputSchema: { text: z.string().min(1).max(20000), voice: z.string().optional(), language: z.enum(["de", "en"]).optional(), speed: z.number().min(0.6).max(1.6).optional(), format: z.enum(["mp3", "wav"]).optional() },
}, async ({ text: t, voice, language = "de", speed, format }) => {
  try {
    const { speakFile } = await import("./voice.js");
    const r = await speakFile({ text: t, voice, lang: language, speed, format });
    return text(`Fertig: ${r.voiceName}, ${r.duration.toFixed(1)} s\nDatei: ${r.url}\n${r.sentences.map((s) => `- ${s.start.toFixed(1)} s: ${s.text}`).join("\n")}`);
  } catch (e) { return fail(e); }
});

const idOf = (s) => (String(s).match(/([a-z0-9]{10})(?:[/?#].*)?$/) || [])[1] || String(s);

await server.connect(new StdioServerTransport());
console.error("Klipp MCP bereit (" + BASE + ")");
