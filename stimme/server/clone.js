// Cloned voices through the Chatterbox sidecar (Python). Started the first time someone needs it,
// so Stimme works without Python and only cloning waits for it.
import { spawn } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { config, ROOT } from "./config.js";

let proc = null, port = 0, starting = null;
const token = randomBytes(24).toString("hex"); // shared secret: nobody else can drive the sidecar
const headers = { "X-Stimme-Token": token };
export const state = { installed: existsSync(config.python), running: false, ready: false, device: null, error: null };

async function health() {
  try { const r = await fetch(`http://127.0.0.1:${port}/health`, { headers }); return await r.json(); } catch { return null; }
}

export function start() {
  if (!existsSync(config.python)) { state.installed = false; return Promise.reject(new Error("Stimmen-Klonen ist nicht installiert. Einmal ausführen: npm run setup-clone")); }
  starting ??= (async () => {
    port = 20000 + Math.floor(Math.random() * 20000);
    // After the first successful start the model is on disk: from then on Hugging Face is never contacted again
    // (without this, the hub library checks for new model versions on every start).
    const marker = join(config.home, "models", ".chatterbox-downloaded");
    const offline = existsSync(marker);
    proc = spawn(config.python, [join(ROOT, "sidecar", "chatterbox_server.py"), String(port), config.cloneDevice], { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, HF_HUB_DISABLE_TELEMETRY: "1", ...(offline ? { HF_HUB_OFFLINE: "1" } : {}), STIMME_SIDECAR_TOKEN: token, STIMME_HOME_DIR: config.home } });
    let err = "";
    proc.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    proc.on("exit", (code) => { state.running = state.ready = false; proc = null; starting = null; if (code) state.error = "Klon-Engine beendet: " + err.split("\n").filter(Boolean).slice(-2).join(" "); });
    state.running = true; state.error = null;
    for (let i = 0; i < 1200; i++) { // first start downloads ~3 GB of model files
      const h = await health();
      if (h?.ready) {
        Object.assign(state, { ready: true, device: h.device });
        if (!offline) { mkdirSync(join(config.home, "models"), { recursive: true }); writeFileSync(marker, new Date().toISOString()); }
        return;
      }
      if (h?.error) throw new Error(h.error);
      if (!proc) throw new Error(state.error || "Klon-Engine startet nicht");
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Klon-Engine hat zu lange zum Starten gebraucht");
  })().catch((e) => { state.error = e.message; starting = null; proc?.kill(); throw e; });
  return starting;
}

async function call(path, body) {
  await start();
  const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Klon-Engine Fehler ${r.status}`);
  return j;
}
export const prepare = (ref, out) => call("/prepare", { ref, out });
export const speak = (o) => call("/speak", o);
export function stop() { proc?.kill(); }
process.on("exit", stop);
