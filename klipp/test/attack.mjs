// Security regression test: what can a foreign website (or a malicious commenter) do to Klipp and Stimme?
//   node test/attack.mjs <klipp-url> <stimme-url> <evil-origin-url> <recording-id>
import { chromium } from "playwright";
const [K, S, EVIL, ID] = process.argv.slice(2);
const out = {};
const comments = async () => (await (await fetch(`${K}/api/recordings/${ID}`)).json()).comments.length;

// 1. CSRF: a foreign page posts a comment (and could start exports or agent recordings the same way)
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(EVIL);
const before = await comments();
await p.evaluate(async ([k, id]) => {
  await fetch(`${k}/api/recordings/${id}/comments`, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ t: 1, text: "CSRF von fremder Seite", name: "Angreifer" }) }).catch(() => {});
}, [K.replace("127.0.0.1", "localhost"), ID]);
await new Promise((r) => setTimeout(r, 500));
out.csrf_comment_accepted = (await comments()) > before;

// 2. Cross-site read: can a foreign page read what you typed into Stimme?
out.stimme_history_readable = await p.evaluate(async (s) => { try { const r = await fetch(`${s}/api/history`); const j = await r.json(); return Array.isArray(j); } catch { return false; } }, S.replace("127.0.0.1", "localhost"));
out.stimme_voices_readable = await p.evaluate(async (s) => { try { const r = await fetch(`${s}/api/voices`); return Array.isArray(await r.json()); } catch { return false; } }, S.replace("127.0.0.1", "localhost"));

// 3. DNS rebinding: requests that arrive with a foreign Host header
// (fetch cannot set Host, so this uses node:http directly, the way a rebound browser request arrives)
const { request } = await import("node:http");
const rebind = (url) => new Promise((res) => { const u = new URL(url); request({ host: u.hostname, port: u.port, path: u.pathname, headers: { Host: "evil.example:" + u.port } }, (r) => { r.resume(); res(r.statusCode); }).on("error", () => res(null)).end(); });
out.rebinding_klipp_status = await rebind(`${K}/api/recordings`);
out.rebinding_stimme_status = await rebind(`${S}/api/history`);

// 4. Stored XSS via a comment name (comments can come from anyone with the link)
await fetch(`${K}/api/recordings/${ID}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: 2, emoji: "<img>", name: '"><img src=x id=pwn onerror="window.__pwned=1">' }) });
const v = await b.newPage();
await v.goto(`${K}/v/${ID}`); await v.waitForTimeout(1800);
out.xss_executed = await v.evaluate(() => Boolean(window.__pwned || document.getElementById("pwn")));
await b.close();
console.log(JSON.stringify(out, null, 1));
