// The brain: listens to the coin's pump.fun chat and its trades, decides what ChumGPT says about them,
// and hands finished events to the supervisor, which passes them to the stage.
// It runs as its own process: if it crashes or hangs, the stream keeps running as the scripted show.
//
//   chat message -> checkInput (local gates) -> fixed line, or Claude (verdict + reply) -> checkOutput -> stage
//   buy          -> unique minion counter -> "new minion" / milestone event -> stage
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { checkInput } from "./filter.mjs";
import { MILESTONES } from "./canned.mjs";
import { decide } from "./decide.mjs";
import { think, CHAT_MODEL } from "./llm.mjs";
import { PumpChat, Trades } from "./sources.mjs";

const env = (k, d) => (process.env[k] === undefined || process.env[k] === "" ? d : process.env[k]);
const CFG = {
  mint: env("CA", ""),
  supervisor: env("SUPERVISOR_URL", "http://127.0.0.1:8090"),
  port: Number(env("BRAIN_PORT", 8091)),
  chat: env("CHAT_ENABLED", "1") === "1",
  trades: env("TRADES_ENABLED", "1") === "1",
  interval: Number(env("CHAT_INTERVAL_S", 30)) * 1000,   // at most one AI answer per this many seconds
  dailyLimit: Number(env("CHAT_DAILY_LIMIT", 1500)),     // hard cap on AI answers per day (cost brake)
  userCooldown: Number(env("CHAT_USER_COOLDOWN_S", 120)) * 1000,
  stateDir: env("STATE_DIR", "/var/lib/chumstream"),
  dev: env("BRAIN_DEV", "0") === "1",                    // enables /dev/chat and /dev/buy for local tests
  alertUrl: env("ALERT_URL", ""),
};
const log = (...a) => console.log(new Date().toISOString(), ...a);
const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 12);
const minionNo = (wallet) => 1000 + (parseInt(hash(wallet).slice(0, 6), 16) % 9000); // stable 4-digit tag, never the address

/* ---------------- state that survives restarts ---------------- */
fs.mkdirSync(CFG.stateDir, { recursive: true });
const STATE_FILE = path.join(CFG.stateDir, "brain-state.json");
let saved = { minions: [], milestone: 0, day: "", answersToday: 0 };
try { saved = { ...saved, ...JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) }; } catch {}
const minions = new Set(saved.minions);
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = STATE_FILE + ".tmp";
    try { fs.writeFileSync(tmp, JSON.stringify({ ...saved, minions: [...minions] })); fs.renameSync(tmp, STATE_FILE); } catch (e) { log("state not saved:", e.message); }
  }, 2000);
}

/* ---------------- talking to the supervisor ---------------- */
async function post(pathname, body) {
  try {
    const r = await fetch(CFG.supervisor + pathname, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    return r.ok ? await r.json().catch(() => ({})) : null;
  } catch { return null; }
}
async function queued() { // how many events the stage still has to play
  try { const r = await fetch(`${CFG.supervisor}/events/size`, { signal: AbortSignal.timeout(3000) }); return (await r.json()).size ?? 0; } catch { return 99; }
}
const lastAlert = new Map();
function alert(key, text) {
  const now = Date.now();
  if (now - (lastAlert.get(key) || 0) < 30 * 60_000) return;
  lastAlert.set(key, now); log("ALERT", text);
  if (CFG.alertUrl) fetch(CFG.alertUrl, { method: "POST", body: `ChumGPT brain: ${text}`, headers: { Title: "ChumGPT brain", Priority: "high" } }).catch(() => {});
}

/* ---------------- chat ---------------- */
const stats = { heard: 0, dropped: 0, canned: 0, answered: 0, blocked: 0, refused: 0, errors: 0, lastError: "" };
let chatOn = CFG.chat, pausedUntil = 0, lastAnswer = 0, busy = false;
const queue = [];                // waiting viewer messages, newest kept
const lastByUser = new Map();    // per-viewer cooldown
const recentTexts = new Map();   // same text again within 10 min is ignored
const blockedTimes = [], hostileTimes = [];

function hear(msg) {
  if (!chatOn) return;
  stats.heard++;
  const now = Date.now(), user = hash(msg.wallet), key = msg.text.toLowerCase().trim();
  const gate = checkInput(msg.text);
  if (gate.verdict === "drop") {
    stats.dropped++;
    if (gate.reason !== "empty" && gate.reason !== "too long" && now >= pausedUntil) hostileTimes.push(now); // a pause isn't extended by the flood it paused
    return;
  }
  if (now - (lastByUser.get(user) || 0) < CFG.userCooldown) return;
  if (now - (recentTexts.get(key) || 0) < 10 * 60_000) return;
  lastByUser.set(user, now); recentTexts.set(key, now);
  if (lastByUser.size > 5000) lastByUser.clear();
  if (recentTexts.size > 5000) recentTexts.clear();
  queue.push({ ...msg, user, verdict: gate.verdict, at: now });
  while (queue.length > 20) queue.shift();
}

function autoPause(now) {
  // Someone is attacking: many hostile messages, or the AI keeps producing replies the output gate stops.
  while (hostileTimes.length && now - hostileTimes[0] > 120_000) hostileTimes.shift();
  while (blockedTimes.length && now - blockedTimes[0] > 600_000) blockedTimes.shift();
  if (hostileTimes.length >= 15 || blockedTimes.length >= 3) {
    pausedUntil = now + 30 * 60_000;
    hostileTimes.length = 0; blockedTimes.length = 0;
    alert("pause", "chat answers paused for 30 minutes: too many hostile messages or blocked replies. Check the logs.");
    return true;
  }
  return false;
}

async function answerNext() {
  const now = Date.now();
  if (busy || !chatOn || now < pausedUntil || autoPause(now)) return;
  const today = new Date().toISOString().slice(0, 10);
  if (saved.day !== today) { saved.day = today; saved.answersToday = 0; }
  while (queue.length && now - queue[0].at > 90_000) queue.shift();   // stale, the moment has passed
  if (!queue.length || now - lastAnswer < CFG.interval) return;
  if ((await queued()) >= 2) return;                                   // the stage is still busy
  busy = true;
  try {
    const msg = queue.pop();                                           // newest first: live reactions feel live
    queue.length = 0;                                                  // the rest is old by the time we're done
    const tag = `minion #${minionNo(msg.wallet)}`;
    if (msg.verdict === "ok" && saved.answersToday >= CFG.dailyLimit) return; // cost brake: the scripted show goes on
    const d = await decide(msg.text, async (t) => { saved.answersToday++; save(); return think(t); });
    lastAnswer = Date.now(); // the pause counts after every attempt, so failures can't turn into a flood of requests
    if (d.stage === "fixed") stats.canned++;
    else if (d.stage === "error") { stats.errors++; stats.lastError = d.why; log("AI error:", d.why); if (/key/i.test(d.why)) alert("key", d.why); return; }
    else if (d.stage === "refused") { stats.refused++; return; }
    else if (d.stage === "unsafe" || d.stage === "dropped") { stats.dropped++; return; }
    else if (d.stage === "blocked") { stats.blocked++; blockedTimes.push(Date.now()); log(`blocked a reply (${d.why}):`, JSON.stringify(d.reply)); return; }
    else stats.answered++;
    const out = { who: tag, ...d.out };
    await post("/events", { type: "chat", ...out });
  } finally { busy = false; }
}
setInterval(() => { answerNext().catch((e) => { stats.errors++; stats.lastError = e.message; busy = false; }); }, 1000);

/* ---------------- minions (buys) ---------------- */
let pendingMinions = [], minionTimer = null;
function buy({ wallet }) {
  const h = hash(wallet);
  if (minions.has(h)) return;      // only a wallet's first buy recruits a minion
  minions.add(h); save();
  pendingMinions.push(minionNo(wallet));
  // batch bursts into one event so a buying frenzy doesn't flood the stage
  if (!minionTimer) minionTimer = setTimeout(flushMinions, 8000);
}
async function flushMinions() {
  minionTimer = null;
  const tags = pendingMinions.splice(0);
  if (!tags.length) return;
  await post("/events", { type: "minions", tags: tags.slice(0, 5), count: tags.length, total: minions.size });
  const hit = MILESTONES.filter((m) => m <= minions.size && m > saved.milestone).pop();
  if (hit) { saved.milestone = hit; save(); await post("/events", { type: "milestone", n: hit }); }
}

/* ---------------- sources ---------------- */
let chatSrc = null, tradeSrc = null;
if (CFG.mint && CFG.chat) chatSrc = new PumpChat({ roomId: CFG.mint, onMessage: hear, log }).start();
if (CFG.mint && CFG.trades) tradeSrc = new Trades({ mint: CFG.mint, onBuy: buy, log }).start();
if (!CFG.mint) log("no CA set: not listening to pump.fun yet", CFG.dev ? "(dev mode: /dev/chat and /dev/buy are open)" : "");

/* ---------------- status + control ---------------- */
function status() {
  return {
    pid: process.pid, model: CHAT_MODEL, chatOn, paused: Date.now() < pausedUntil ? Math.round((pausedUntil - Date.now()) / 60000) + " min" : false,
    queue: queue.length, answersToday: saved.answersToday, dailyLimit: CFG.dailyLimit, minions: minions.size,
    chat: chatSrc ? chatSrc.state : "off", trades: tradeSrc ? tradeSrc.state : "off", stats,
  };
}
setInterval(() => post("/brain/status", status()), 5000);
post("/brain/status", status());

const read = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > 1e4) req.destroy(); }); req.on("end", () => { try { r(JSON.parse(b || "{}")); } catch { r({}); } }); });
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const reply = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (url.pathname === "/status") return reply(200, status());
  if (req.method === "POST" && url.pathname === "/control/chat") {
    const on = url.searchParams.get("on");
    if (on === "0") { chatOn = false; queue.length = 0; }
    else if (on === "1") { chatOn = true; pausedUntil = 0; hostileTimes.length = 0; blockedTimes.length = 0; queue.length = 0; } // a fresh start, not the old flood
    log(`chat answers ${chatOn ? "on" : "off"} (operator)`); return reply(200, { chatOn });
  }
  if (CFG.dev && req.method === "POST" && url.pathname === "/dev/chat") { const b = await read(req); hear({ id: crypto.randomUUID(), text: String(b.text || ""), wallet: String(b.wallet || crypto.randomUUID()) }); return reply(200, { ok: true }); }
  if (CFG.dev && req.method === "POST" && url.pathname === "/dev/buy") { const b = await read(req); buy({ wallet: String(b.wallet || crypto.randomUUID()) }); return reply(200, { ok: true }); }
  reply(404, { error: "not found" });
}).listen(CFG.port, "127.0.0.1", () => log(`brain on 127.0.0.1:${CFG.port} · model ${CHAT_MODEL} · chat ${CFG.chat ? "on" : "off"} · trades ${CFG.trades ? "on" : "off"}`));

process.on("unhandledRejection", (e) => log("unhandled", e));
process.on("SIGTERM", () => { chatSrc?.stop(); tradeSrc?.stop(); process.exit(0); });
