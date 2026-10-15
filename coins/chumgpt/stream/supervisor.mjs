// ChumGPT lab stream supervisor. Zero dependencies, Node 18+.
// Runs the whole broadcast chain and keeps it alive:
//   Xvfb (virtual screen) -> standby card on the root window -> PulseAudio null sink
//   -> Chromium showing stage/ -> ffmpeg filming screen + sound -> RTMP (pump.fun)
// Every link restarts on its own. The sender (ffmpeg) does not depend on the browser: if Chromium
// dies the stream keeps going and shows the "NO SIGNAL" standby card until a fresh browser is up.
import { spawn, execFileSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const env = (k, d) => (process.env[k] === undefined || process.env[k] === "" ? d : process.env[k]);
const CFG = {
  output: env("OUTPUT_URL", process.env.RTMP_URL && process.env.STREAM_KEY ? `${process.env.RTMP_URL.replace(/\/+$/, "")}/${process.env.STREAM_KEY}` : ""),
  display: `:${env("DISPLAY_NUM", "99")}`,
  width: Number(env("WIDTH", 1280)), height: Number(env("HEIGHT", 720)), fps: Number(env("FPS", 30)),
  vbit: env("VIDEO_BITRATE", "2500k"), abit: env("AUDIO_BITRATE", "128k"), preset: env("X264_PRESET", "veryfast"),
  port: Number(env("PORT", 8090)),
  stageDir: path.resolve(HERE, env("STAGE_DIR", "stage")),
  kitDir: path.resolve(HERE, env("KIT_DIR", "../kit")),
  standby: path.resolve(HERE, env("STANDBY_IMAGE", "standby.png")),
  chromium: env("CHROMIUM_PATH", ""),
  recycleHours: Number(env("RECYCLE_HOURS", 6)),
  alertUrl: env("ALERT_URL", ""),          // e.g. https://ntfy.sh/<your-secret-topic>
  healthcheckUrl: env("HEALTHCHECK_URL", ""), // dead man's switch, e.g. https://hc-ping.com/<uuid>
  runDir: env("RUN_DIR", path.join(os.tmpdir(), "chumstream")),
};
fs.mkdirSync(CFG.runDir, { recursive: true });
const PULSE_SOCKET = path.join(CFG.runDir, "pulse.sock");
const PIDS = path.join(CFG.runDir, "pids.json");
const livePids = new Set();
function savePids() { try { fs.writeFileSync(PIDS, JSON.stringify([...livePids])); } catch {} }
function killLeftovers() { // processes from a supervisor that crashed without cleaning up
  let old = []; try { old = JSON.parse(fs.readFileSync(PIDS, "utf8")); } catch {}
  for (const pid of old) { try { process.kill(-pid, "SIGKILL"); log(`killed leftover process group ${pid}`); } catch {} }
  try { fs.rmSync(PIDS, { force: true }); } catch {}
  // and anything else still holding our screen, sound card or browser profile, even without a pid file
  const marks = [`Xvfb\0${CFG.display}\0`, CFG.runDir, `${CFG.display}.0+0,0`];
  let ids = []; try { ids = fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d)); } catch {}
  for (const id of ids) {
    if (Number(id) === process.pid) continue;
    let cmd = ""; try { cmd = fs.readFileSync(`/proc/${id}/cmdline`, "utf8"); } catch { continue; }
    const exe = path.basename(cmd.split("\0")[0] || "");
    if (!/^(Xvfb|ffmpeg|pulseaudio|chrome|google-chrome|chromium|chromium-browser|chrome_crashpad_handler)$/.test(exe)) continue; // only our own kind of programs
    if (exe === "ffmpeg" && !cmd.includes("-progress\0pipe:1")) continue; // our sender, not someone's manual ffmpeg
    if (marks.some((m) => cmd.includes(m))) { try { process.kill(Number(id), "SIGKILL"); log(`killed leftover ${cmd.split("\0")[0]} (${id})`); } catch {} }
  }
}

const t0 = Date.now();
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- alerts ---------------- */
const lastAlert = new Map();
function alert(key, text) {
  const now = Date.now();
  if (now - (lastAlert.get(key) || 0) < 15 * 60_000) return; // at most one alert per kind per 15 min
  lastAlert.set(key, now);
  log("ALERT", text);
  if (!CFG.alertUrl) return;
  fetch(CFG.alertUrl, { method: "POST", body: `ChumGPT stream: ${text}`, headers: { Title: "ChumGPT stream", Priority: "high" } }).catch(() => {});
}

/* ---------------- managed processes ---------------- */
class Service {
  constructor(name, { cmd, args, env: extraEnv = {}, ready, maxDelay = 30_000, onLine, onExit, killSignal = "SIGTERM" }) {
    Object.assign(this, { name, cmd, args, extraEnv, ready, maxDelay, onLine, onExit, killSignal });
    this.proc = null; this.fails = 0; this.restarts = 0; this.startedAt = 0; this.stopping = false; this.wanted = false; this.tail = [];
  }
  async start() {
    this.wanted = true; this.stopping = false;
    const args = typeof this.args === "function" ? this.args() : this.args;
    this.startedAt = Date.now();
    const p = spawn(this.cmd, args, { env: { ...process.env, ...this.extraEnv }, stdio: ["ignore", "pipe", "pipe"], detached: true });
    this.proc = p; livePids.add(p.pid); savePids();
    const eat = (buf) => {
      for (const line of buf.toString().split("\n")) {
        if (!line.trim()) continue;
        this.tail.push(line); if (this.tail.length > 25) this.tail.shift();
        if (this.onLine) this.onLine(line);
      }
    };
    p.stdout.on("data", eat); p.stderr.on("data", eat);
    p.on("error", (e) => { this.tail.push(String(e)); });
    p.on("exit", (code, sig) => {
      try { process.kill(-p.pid, "SIGKILL"); } catch {} // whatever it left behind (e.g. browser renderers) goes too
      livePids.delete(p.pid); savePids();
      if (this.proc !== p) return;
      this.proc = null;
      const lived = Date.now() - this.startedAt;
      if (this.onExit) this.onExit();
      if (!this.wanted) return;
      this.fails = lived > 30_000 ? 0 : this.fails + 1;
      this.restarts++;
      // first failure: back in half a second; repeated failures back off up to maxDelay
      const delay = this.fails <= 1 ? 500 : Math.min(this.maxDelay, 1000 * 2 ** Math.min(this.fails - 1, 6));
      log(`${this.name} exited (code ${code}, signal ${sig}) after ${Math.round(lived / 1000)}s, restarting in ${delay / 1000}s`);
      if (this.tail.length) log(`${this.name} last output:\n  ` + this.tail.slice(-8).join("\n  "));
      if (this.fails >= 3) alert(this.name, `${this.name} keeps failing (${this.fails}x in a row). Last: ${this.tail.at(-1) || "no output"}`);
      setTimeout(() => { if (this.wanted && !this.proc) this.start().catch((e) => log(this.name, "start failed", e)); }, delay);
    });
    if (this.ready) await this.ready(p);
  }
  kill(sig = this.killSignal) {
    const p = this.proc; if (!p) return;
    try { process.kill(-p.pid, sig); } catch { try { p.kill(sig); } catch {} }
    setTimeout(() => { if (p.exitCode === null && p.signalCode === null) { try { process.kill(-p.pid, "SIGKILL"); } catch {} } }, 5000).unref();
  }
  restart(reason) { log(`restarting ${this.name}: ${reason}`); this.kill(); } // exit handler brings it back
  stop() { this.wanted = false; this.kill(); }
  get alive() { return !!this.proc; }
}

/* ---------------- 1. virtual screen ---------------- */
function cleanStaleX() {
  const n = CFG.display.slice(1);
  for (const f of [`/tmp/.X${n}-lock`, `/tmp/.X11-unix/X${n}`]) { try { fs.rmSync(f, { force: true }); } catch {} }
}
async function waitFor(check, ms, what) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await check()) return true; await sleep(200); }
  throw new Error(`timed out waiting for ${what}`);
}
const xsock = () => `/tmp/.X11-unix/X${CFG.display.slice(1)}`;
const xvfb = new Service("xvfb", {
  // twice as tall as the picture: only the top half is filmed, new browsers warm up unseen in the bottom half
  cmd: "Xvfb", args: [CFG.display, "-screen", "0", `${CFG.width}x${CFG.height * 2}x24`, "-nolisten", "tcp", "-noreset"],
  ready: async () => {
    await waitFor(() => fs.existsSync(xsock()), 10_000, "Xvfb socket");
    paintStandby();
  },
  onExit: () => { // everything that draws on or films the screen needs a new one
    if (chrome.alive) chrome.restart("screen went away");
    if (ffmpeg.alive) ffmpeg.restart("screen went away");
    cleanStaleX();
  },
});
function paintStandby() {
  try {
    execFileSync("hsetroot", ["-fill", CFG.standby], { env: { ...process.env, DISPLAY: CFG.display }, stdio: "ignore", timeout: 10_000 });
  } catch (e) {
    try { execFileSync("hsetroot", ["-solid", "#000000"], { env: { ...process.env, DISPLAY: CFG.display }, stdio: "ignore", timeout: 10_000 }); } catch {}
    log("standby card could not be painted:", e.message);
  }
}

/* ---------------- 2. sound card ---------------- */
const pulse = new Service("pulseaudio", {
  cmd: "pulseaudio",
  args: ["--daemonize=no", "--exit-idle-time=-1", "--disallow-exit", "-n", "--use-pid-file=no", "--log-target=stderr",
    `--load=module-native-protocol-unix socket=${PULSE_SOCKET} auth-anonymous=1`,
    "--load=module-null-sink sink_name=chum rate=44100 sink_properties=device.description=chum",
    "--load=module-always-sink"],
  env: { PULSE_RUNTIME_PATH: path.join(CFG.runDir, "pulse-rt"), HOME: CFG.runDir },
  ready: async () => { await waitFor(() => fs.existsSync(PULSE_SOCKET), 10_000, "PulseAudio socket"); },
  onExit: () => {
    try { fs.rmSync(PULSE_SOCKET, { force: true }); } catch {}
    if (chrome.alive) chrome.restart("sound card went away");
    if (ffmpeg.alive) ffmpeg.restart("sound card went away");
  },
});
const PULSE_ENV = { PULSE_SERVER: `unix:${PULSE_SOCKET}`, PULSE_SINK: "chum" };

/* ---------------- 3. the browser ---------------- */
function findChromium() {
  const cands = [CFG.chromium, "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/snap/bin/chromium"];
  try { for (const d of fs.readdirSync("/opt/pw-browsers")) if (d.startsWith("chromium-")) cands.push(`/opt/pw-browsers/${d}/chrome-linux/chrome`); } catch {}
  return cands.find((c) => c && fs.existsSync(c));
}
let profileDir = null, chromeGen = 0;
// The page is our own local file, so running without Chrome's sandbox is an acceptable fallback when the
// server can't provide one (running as root, or a kernel that blocks user namespaces).
let noSandbox = (process.getuid && process.getuid() === 0) || process.env.CHROME_NO_SANDBOX === "1";
const hb = { at: 0, frames: -1, framesAt: 0, seg: "", segAge: 0, errors: 0, audio: "", count: 0 };
const chrome = new Service("chromium", {
  cmd: findChromium() || "chromium",
  args: () => {
    if (profileDir) { try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {} }
    profileDir = path.join(CFG.runDir, `chrome-${++chromeGen}`);
    Object.assign(hb, { at: 0, frames: -1, framesAt: 0, count: 0, placed: !canPlace, smallCount: 0 });
    return [
      `--user-data-dir=${profileDir}`, `--app=http://127.0.0.1:${CFG.port}/?boot=1&gen=${chromeGen}`, `--window-position=0,${canPlace ? CFG.height : 0}`, `--window-size=${CFG.width},${CFG.height}`,
      "--no-first-run", "--no-default-browser-check", "--noerrdialogs", "--disable-infobars", "--disable-session-crashed-bubble",
      "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows", "--disable-features=Translate,MediaRouter,OptimizationHints,DialMediaRouteProvider",
      "--disable-component-update", "--disable-sync", "--disable-background-networking", "--no-pings", "--disable-domain-reliability", "--disable-extensions", "--password-store=basic", "--disk-cache-size=1",
      "--hide-scrollbars", "--force-device-scale-factor=1", "--disable-dev-shm-usage", "--force-dark-mode",
      "--simulate-outdated-no-au=Tue, 31 Dec 2099 23:59:59 GMT", "--check-for-update-interval=31536000",
      ...(noSandbox ? ["--no-sandbox", "--test-type"] : []),
    ];
  },
  env: { DISPLAY: CFG.display, ...PULSE_ENV, GOOGLE_API_KEY: "no", GOOGLE_DEFAULT_CLIENT_ID: "no", GOOGLE_DEFAULT_CLIENT_SECRET: "no" },
  maxDelay: 15_000,
  killSignal: "SIGKILL", // a throwaway profile, nothing to save: a hung browser must go at once
  onExit: () => {
    if (!noSandbox && chrome.fails >= 1 && chrome.tail.some((l) => /sandbox/i.test(l))) {
      noSandbox = true; log("Chrome sandbox unavailable on this server, falling back to --no-sandbox for our local page");
    }
  },
});

// Move the browser window into the filmed area once its page is up, so viewers never see it load.
const onPath = (bin) => (process.env.PATH || "/usr/bin:/bin").split(":").some((d) => { try { fs.accessSync(path.join(d, bin), fs.constants.X_OK); return true; } catch { return false; } });
let canPlace = onPath("xdotool");
let placing = false, placeFails = 0;
async function placeWindow() {
  if (placing || hb.placed || !chrome.proc) return;
  placing = true;
  const pid = chrome.proc.pid, envX = { ...process.env, DISPLAY: CFG.display };
  try {
    const ids = execFileSync("xdotool", ["search", "--onlyvisible", "--pid", String(pid)], { env: envX, timeout: 5000 }).toString().trim().split(/\s+/).filter(Boolean);
    if (!ids.length) throw new Error("no window yet");
    for (const id of ids) execFileSync("xdotool", ["windowmove", id, "0", "0"], { env: envX, timeout: 5000 });
    if (chrome.proc && chrome.proc.pid === pid) { hb.placed = true; placeFails = 0; log("browser window is on air"); }
  } catch (e) {
    if (++placeFails >= 8) { // xdotool can't do it here: fall back to starting browsers directly in the picture
      canPlace = false; placeFails = 0; log("cannot move browser windows, starting them on-picture from now on:", e.message);
      chrome.restart("window placement unavailable");
    }
  } finally { placing = false; }
}

function hideBrowser() {
  if (!canPlace || !chrome.proc) return;
  try {
    const envX = { ...process.env, DISPLAY: CFG.display };
    const ids = execFileSync("xdotool", ["search", "--onlyvisible", "--pid", String(chrome.proc.pid)], { env: envX, timeout: 2000 }).toString().trim().split(/\s+/).filter(Boolean);
    for (const id of ids) execFileSync("xdotool", ["windowmove", id, "0", String(CFG.height)], { env: envX, timeout: 2000 });
  } catch {}
}
function replaceBrowser(reason) { hideBrowser(); chrome.restart(reason); }

/* ---------------- 4. the sender ---------------- */
const prog = { frame: 0, frameAt: 0, fps: 0, speed: 0, slowSince: 0, startedAt: 0 };
const ffmpeg = new Service("ffmpeg", {
  cmd: "ffmpeg",
  args: () => {
    Object.assign(prog, { frame: 0, frameAt: Date.now(), startedAt: Date.now(), slowSince: 0 });
    const out = CFG.output || "-";
    return [
      "-hide_banner", "-loglevel", "warning", "-nostats", "-progress", "pipe:1",
      "-thread_queue_size", "128", "-f", "x11grab", "-draw_mouse", "0", "-framerate", String(CFG.fps), "-video_size", `${CFG.width}x${CFG.height}`, "-i", `${CFG.display}.0+0,0`,
      "-thread_queue_size", "1024", "-f", "pulse", "-i", "chum.monitor",
      "-map", "0:v", "-map", "1:a",
      "-c:v", "libx264", "-preset", CFG.preset, "-tune", "zerolatency", "-profile:v", "main", "-pix_fmt", "yuv420p",
      "-r", String(CFG.fps), "-g", String(CFG.fps * 2), "-keyint_min", String(CFG.fps * 2), "-sc_threshold", "0",
      "-b:v", CFG.vbit, "-maxrate", CFG.vbit, "-bufsize", `${parseInt(CFG.vbit, 10) * 2}k`, "-x264-params", "nal-hrd=cbr",
      "-c:a", "aac", "-b:a", CFG.abit, "-ar", "44100", "-ac", "2",
      ...(CFG.output ? ["-f", "flv", "-flvflags", "no_duration_filesize", out] : ["-f", "null", "-"]),
    ];
  },
  env: { DISPLAY: CFG.display, ...PULSE_ENV },
  maxDelay: 5_000, // reconnect attempts are cheap: when the platform is back, so are we
  onLine: (line) => {
    const m = line.match(/^(\w+)=(.*)$/); if (!m) return;
    const [, k, v] = m;
    if (k === "frame") { const f = Number(v); if (f > prog.frame) { prog.frame = f; prog.frameAt = Date.now(); } }
    else if (k === "fps") prog.fps = Number(v) || 0;
    else if (k === "speed") prog.speed = parseFloat(v) || 0;
  },
});

/* ---------------- stage server + heartbeat ---------------- */
// RECYCLE_HOURS=0 turns the scheduled swap off
const recycleMs = () => (CFG.recycleHours > 0 ? CFG.recycleHours * 3_600_000 : Infinity);
let wantRecycle = false, recycleAskedAt = 0, nextRecycle = Date.now() + recycleMs(), lastLowMemSwap = 0;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}
function safeJoin(root, rel) { const p = path.resolve(root, "." + path.posix.normalize("/" + rel)); return p.startsWith(root) ? p : null; }
function readBody(req) { return new Promise((r) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > 1e5) req.destroy(); }); req.on("end", () => r(b)); req.on("error", () => r("")); }); }

function health() {
  const now = Date.now();
  const sending = ffmpeg.alive && now - prog.frameAt < 15_000;
  const showing = chrome.alive && hb.at && now - hb.at < 15_000 && hb.placed;
  return {
    ok: sending && (showing || !!recycleAskedAt), sending, showing,
    output: CFG.output ? CFG.output.replace(/[^/]+$/, "****") : "none (dry run)",
    uptimeMin: Math.round((now - t0) / 60000),
    ffmpeg: { frame: prog.frame, fps: prog.fps, speed: prog.speed, lastFrameAgoS: Math.round((now - prog.frameAt) / 1000), restarts: ffmpeg.restarts },
    page: { placed: hb.placed, size: hb.size, seg: hb.seg, lastBeatAgoS: hb.at ? Math.round((now - hb.at) / 1000) : null, errors: hb.errors, audio: hb.audio, restarts: chrome.restarts },
    xvfbRestarts: xvfb.restarts, pulseRestarts: pulse.restarts,
    memAvailableMB: memAvailableMB(), load1: os.loadavg()[0].toFixed(2),
    nextRecycleMin: Number.isFinite(nextRecycle) ? Math.round((nextRecycle - now) / 60000) : null,
  };
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/hb") {
    let j = {}; try { j = JSON.parse(await readBody(req)); } catch {}
    const now = Date.now();
    if (Number(j.gen) !== chromeGen) { // a beat from a browser that is already gone: ignore it
      res.writeHead(200, { "Content-Type": "application/json" }); return res.end("{}");
    }
    if (typeof j.frames === "number" && j.frames > hb.frames) { hb.frames = j.frames; hb.framesAt = now; }
    Object.assign(hb, { at: now, seg: String(j.seg || ""), segAge: Number(j.segAge) || 0, errors: Number(j.errors) || 0, audio: String(j.audio || ""), count: hb.count + 1 });
    // a page smaller than the picture means some browser bar is eating space
    hb.size = `${j.vw}x${j.vh}`;
    hb.smallCount = (Number(j.vw) && Number(j.vh) && (j.vw < CFG.width - 2 || j.vh < CFG.height - 2)) ? hb.smallCount + 1 : 0;
    if (!hb.placed && hb.count >= 1) placeWindow();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(wantRecycle ? { cmd: "powercut" } : {}));
  }
  if (req.method === "POST" && url.pathname === "/ready") {
    res.writeHead(204); res.end();
    if (wantRecycle) { log("page went dark for the planned power cut, swapping the browser"); finishRecycle(); }
    return;
  }
  if (req.method === "POST" && url.pathname === "/control/recycle") {
    startRecycle("requested by operator"); res.writeHead(202); return res.end("ok, the next power cut swaps the browser\n");
  }
  if (url.pathname === "/snapshot.png") { // what the stream shows right now (open through an SSH tunnel)
    const shot = spawn("ffmpeg", ["-v", "error", "-f", "x11grab", "-draw_mouse", "0", "-video_size", `${CFG.width}x${CFG.height}`, "-i", `${CFG.display}.0+0,0`, "-frames:v", "1", "-f", "image2", "-c:v", "png", "pipe:1"], { stdio: ["ignore", "pipe", "ignore"] });
    const parts = []; shot.stdout.on("data", (c) => parts.push(c));
    const timer = setTimeout(() => shot.kill("SIGKILL"), 10_000);
    shot.on("close", () => { clearTimeout(timer); const png = Buffer.concat(parts); if (!png.length) { res.writeHead(503); return res.end(); } res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" }); res.end(png); });
    return;
  }
  if (url.pathname === "/health") {
    const h = health(); res.writeHead(h.ok ? 200 : 503, { "Content-Type": "application/json" }); return res.end(JSON.stringify(h, null, 2));
  }
  if (url.pathname.startsWith("/kit/")) { const f = safeJoin(CFG.kitDir, url.pathname.slice(5)); return f ? serveFile(res, f) : (res.writeHead(403), res.end()); }
  const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const f = safeJoin(CFG.stageDir, rel); return f ? serveFile(res, f) : (res.writeHead(403), res.end());
});

/* ---------------- planned browser swap, hidden inside the power-cut gag ---------------- */
function startRecycle(why) {
  if (wantRecycle) return;
  log(`planned browser swap requested (${why}), waiting for the page to cut the power`);
  wantRecycle = true; recycleAskedAt = Date.now();
}
function finishRecycle() {
  wantRecycle = false; recycleAskedAt = 0;
  nextRecycle = Date.now() + recycleMs();
  chrome.restart("planned swap");
}

/* ---------------- watchdogs ---------------- */
function memAvailableMB() {
  try { const m = fs.readFileSync("/proc/meminfo", "utf8").match(/MemAvailable:\s+(\d+)/); return m ? Math.round(Number(m[1]) / 1024) : null; } catch { return null; }
}
let lastPing = 0, chromeRestartTimes = [], seenChromeRestarts = 0;
setInterval(() => {
  const now = Date.now();
  // sender: frames must keep coming
  if (ffmpeg.alive && now - prog.startedAt > 20_000 && now - prog.frameAt > 12_000) ffmpeg.restart("no new frames for 12s");
  if (ffmpeg.alive && prog.speed && prog.speed < 0.93 && now - prog.startedAt > 60_000) {
    if (!prog.slowSince) prog.slowSince = now;
    else if (now - prog.slowSince > 120_000) { alert("slow", `encoder too slow (speed ${prog.speed}x). The server needs more CPU or a lower X264_PRESET/FPS.`); prog.slowSince = now; }
  } else prog.slowSince = 0;
  while (seenChromeRestarts < chrome.restarts) { seenChromeRestarts++; chromeRestartTimes.push(now); }
  // browser: heartbeats must keep coming and the page must keep painting
  if (chrome.alive && !recycleAskedAt) {
    const up = now - chrome.startedAt;
    if (up > 45_000 && (!hb.at || now - hb.at > 8_000)) replaceBrowser("no heartbeat from the page for 8s");
    else if (hb.at && hb.framesAt && now - hb.framesAt > 8_000) replaceBrowser("page stopped painting");
    else if (hb.segAge > 12 * 60_000) replaceBrowser("show loop stuck");
    else if (hb.count > 15 && hb.audio && hb.audio !== "running") replaceBrowser(`page audio is ${hb.audio}`);
    else if (hb.smallCount >= 3) { alert("bar", "the browser showed a bar over the stage, replaced it"); replaceBrowser("browser bar over the stage"); }
    else if (!hb.placed && up > 45_000) replaceBrowser("window never reached the picture");
  }
  const recent = (chromeRestartTimes = chromeRestartTimes.filter((t) => now - t < 3_600_000)).length;
  if (recent >= 6) alert("chrome", `browser restarted ${recent} times in the last hour. Check the stage page and the logs.`);
  // planned swap on schedule or when memory runs low; if the page never answers, swap anyway
  const mem = memAvailableMB();
  if (!wantRecycle && now > nextRecycle) startRecycle("schedule");
  if (!wantRecycle && mem !== null && mem < 250 && now - lastLowMemSwap > 30 * 60_000) { lastLowMemSwap = now; startRecycle(`low memory (${mem} MB free)`); alert("mem", `server is low on memory (${mem} MB free)`); }
  if (wantRecycle && now - recycleAskedAt > 12 * 60_000) { log("page never cut the power, swapping the browser anyway"); finishRecycle(); }
  // dead man's switch: ping only while we are really on air
  if (CFG.healthcheckUrl && now - lastPing > 60_000 && health().ok) { lastPing = now; fetch(CFG.healthcheckUrl).catch(() => {}); }
}, 2000).unref();
setInterval(() => log("status", JSON.stringify(health())), 5 * 60_000).unref();

/* ---------------- start + stop ---------------- */
async function main() {
  if (!fs.existsSync(path.join(CFG.stageDir, "index.html"))) throw new Error(`stage not found in ${CFG.stageDir}`);
  if (!findChromium()) throw new Error("Chromium not found. Set CHROMIUM_PATH.");
  if (!CFG.output) log("no RTMP_URL/STREAM_KEY set: dry run, the video is encoded but not sent anywhere");
  await new Promise((r, j) => { server.once("error", j); server.listen(CFG.port, "127.0.0.1", r); });
  log(`stage served on http://127.0.0.1:${CFG.port}`);
  killLeftovers();
  await sleep(500);
  cleanStaleX();
  await xvfb.start();
  await pulse.start();
  await ffmpeg.start(); // the sender goes first: from now on the stream is on air, showing the standby card
  await chrome.start();
  log(`on air (new browsers ${canPlace ? "warm up off-picture and slide in when ready" : "start directly in the picture: install xdotool to hide their loading"})`);
}
let shuttingDown = false;
function shutdown(sig) {
  if (shuttingDown) return; shuttingDown = true;
  log(`${sig}: shutting down`);
  for (const s of [chrome, ffmpeg, pulse, xvfb]) s.stop();
  setTimeout(() => process.exit(0), 6000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (e) => { log("uncaught", e); alert("crash", `supervisor error: ${e.message}`); });
process.on("unhandledRejection", (e) => { log("unhandled", e); });
main().catch((e) => { log("fatal", e); alert("fatal", `could not start: ${e.message}`); process.exit(1); }); // systemd starts us again
