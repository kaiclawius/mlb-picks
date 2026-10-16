// Agents record a website flow without a human: Klipp drives a real browser through the steps, shows a
// visible cursor and click ripples so viewers can follow, speaks the narration with a Stimme voice, and the
// result becomes a normal Klipp recording (link, transcript, captions, chapters, comments, exports).
import { mkdir, rm, rename } from "node:fs/promises";
import { join } from "node:path";
import * as store from "./store.js";
import * as jobs from "./jobs.js";
import { ffmpeg, probe } from "./media.js";
import { narrate } from "./voice.js";

const ACTIONS = ["goto", "click", "type", "press", "scroll", "hover", "wait", "waitFor", "highlight"];
let queue = Promise.resolve();

/** Validates the request, creates the recording entry and runs the job in the background. */
export async function startAgentRecording(b) {
  const url = String(b.url || "").trim();
  if (!/^https?:\/\//.test(url)) throw Object.assign(new Error("url muss mit http:// oder https:// beginnen."), { status: 400 });
  const steps = (Array.isArray(b.steps) ? b.steps : []).slice(0, 80).map((s) => ({
    action: ACTIONS.includes(s.action) ? s.action : "wait",
    target: s.target ? String(s.target).slice(0, 300) : "",
    value: s.value === undefined ? "" : String(s.value).slice(0, 2000),
    say: s.say ? String(s.say).slice(0, 1500) : "",
    chapter: s.chapter ? String(s.chapter).slice(0, 80) : "",
  }));
  const opts = {
    url, steps,
    voice: b.voice ? String(b.voice) : undefined, language: b.language === "en" ? "en" : "de",
    width: Math.max(640, Math.min(2560, Number(b.width) || 1920)), height: Math.max(480, Math.min(1600, Number(b.height) || 1080)),
    dark: b.colorScheme === "dark",
  };
  const meta = await store.create({
    tracks: {}, source: "agent", language: opts.language === "en" ? "english" : "german",
    title: String(b.title || "").slice(0, 140), titleEdited: Boolean(b.title), agent: { name: String(b.agent || "Agent").slice(0, 60), url, steps: steps.length, voice: opts.voice || null },
    bubble: { corner: "bl", size: 0.2, shape: "circle", hidden: true },
  });
  await jobs.notify(meta.id);
  queue = queue.then(() => run(meta.id, opts)).catch(() => {});
  return { id: meta.id, status: meta.status, link: `/v/${meta.id}` };
}

/** Draws a cursor and click ripples inside the page, so the recording shows what the agent does. */
const OVERLAY = () => {
  const mk = () => {
    if (document.getElementById("__klipp_cursor") || !document.body) return;
    const c = document.createElement("div");
    c.id = "__klipp_cursor";
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3l17 9.5-7.4 1.6L11 21z" fill="#111" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: "fixed", left: "-40px", top: "-40px", zIndex: 2147483647, pointerEvents: "none", transition: "transform .08s", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))" });
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX - 4 + "px"; c.style.top = e.clientY - 2 + "px"; }, true);
    addEventListener("mousedown", (e) => {
      c.style.transform = "scale(.85)";
      const r = document.createElement("div");
      Object.assign(r.style, { position: "fixed", left: e.clientX - 22 + "px", top: e.clientY - 22 + "px", width: "44px", height: "44px", borderRadius: "50%", border: "3px solid #ff5a36", zIndex: 2147483646, pointerEvents: "none", transition: "transform .5s ease-out, opacity .5s" });
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.8)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, true);
    addEventListener("mouseup", () => (c.style.transform = ""), true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mk); else mk();
};

async function launch() {
  const { chromium } = await import("playwright");
  const tries = [process.env.CHROMIUM_PATH && { executablePath: process.env.CHROMIUM_PATH }, {}, { channel: "chrome" }, { channel: "msedge" }].filter(Boolean);
  let last;
  for (const t of tries) { try { return await chromium.launch(t); } catch (e) { last = e; } }
  throw new Error("Kein Browser für Agent-Aufnahmen gefunden. Einmal ausführen: npx playwright install chromium  (" + last?.message?.split("\n")[0] + ")");
}

async function run(id, o) {
  const dir = store.dir(id);
  const tmp = join(dir, "agent");
  await mkdir(tmp, { recursive: true });
  const set = async (fn) => { await store.update(id, fn); await jobs.notify(id); };
  let browser;
  try {
    // 1. narration first, so we know how long to stay on each step
    const clips = [];
    for (const [i, s] of o.steps.entries()) {
      if (!s.say) continue;
      await set((m) => { m.agent.phase = `Stimme spricht Schritt ${i + 1}`; });
      const file = join(tmp, `say-${i}.wav`);
      const r = await narrate(s.say, { voice: o.voice, language: o.language }, file);
      clips.push({ step: i, file, duration: r.duration, text: s.say });
    }

    // 2. the browser run
    await set((m) => { m.agent.phase = "Browser nimmt auf"; });
    browser = await launch();
    const ctx = await browser.newContext({ viewport: { width: o.width, height: o.height }, deviceScaleFactor: 1, colorScheme: o.dark ? "dark" : "light",
      recordVideo: { dir: tmp, size: { width: o.width, height: o.height } } });
    await ctx.addInitScript(OVERLAY);
    const page = await ctx.newPage();
    const born = Date.now();
    await page.goto(o.url, { waitUntil: "load", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.mouse.move(o.width * 0.6, o.height * 0.55);
    await page.waitForTimeout(500);
    const t0 = Date.now();
    const at = () => (Date.now() - t0) / 1000;
    const timeline = [], chapters = [], warnings = [];
    for (const [i, s] of o.steps.entries()) {
      const start = at();
      if (s.chapter) chapters.push({ t: Math.max(0, start), title: s.chapter });
      const clip = clips.find((c) => c.step === i);
      if (clip) timeline.push({ at: start + 0.15, file: clip.file, text: clip.text, duration: clip.duration });
      try { await act(page, s, o); } catch (e) { warnings.push(`Schritt ${i + 1} (${s.action} ${s.target}): ${e.message.split("\n")[0]}`); }
      const need = clip ? clip.duration + 0.45 : s.action === "wait" ? 0 : 0.7;
      const left = need - (at() - start);
      if (left > 0) await page.waitForTimeout(left * 1000);
    }
    await page.waitForTimeout(900);
    const length = at();
    const video = page.video();
    await ctx.close(); await browser.close(); browser = null;
    const raw = await video.path();
    const offset = (t0 - born) / 1000;

    // 3. one MP4: picture trimmed to the run, narration placed at its steps
    await set((m) => { m.agent.phase = "Video wird zusammengesetzt"; });
    const out = join(tmp, "out.mp4");
    const args = ["-ss", offset.toFixed(3), "-i", raw];
    timeline.forEach((c) => args.push("-i", c.file));
    const vf = "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p";
    if (timeline.length) {
      const parts = timeline.map((c, k) => `[${k + 1}:a]aresample=48000,adelay=${Math.round(c.at * 1000)}:all=1[a${k}]`);
      parts.push(`${timeline.map((_, k) => `[a${k}]`).join("")}amix=inputs=${timeline.length}:normalize=0:duration=longest,apad[aout]`);
      parts.push(`[0:v]${vf}[vout]`);
      args.push("-filter_complex", parts.join(";"), "-map", "[vout]", "-map", "[aout]", "-c:a", "aac", "-b:a", "160k");
    } else args.push("-vf", vf);
    args.push("-t", length.toFixed(3), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-movflags", "+faststart", out);
    await ffmpeg(args);
    await rename(out, store.file(id, "screen.raw.mp4"));
    await rm(tmp, { recursive: true, force: true });

    await set((m) => {
      m.tracks = { screen: { raw: "screen.raw.mp4", mime: "video/mp4" } };
      m.status = "processing";
      if (chapters.length) { m.chapters = chapters; m.chaptersFixed = true; }
      m.agent.phase = null; m.agent.warnings = warnings;
      m.agent.narration = timeline.map((c) => ({ t: +c.at.toFixed(2), text: c.text }));
      if (!m.title) m.title = `${m.agent.name}: ${new URL(o.url).hostname}`;
    });
    await jobs.afterRecording(id);
  } catch (e) {
    console.error(`[${id}] agent recording`, e);
    await browser?.close().catch(() => {});
    await set((m) => { m.status = "error"; m.error = "Agent-Aufnahme fehlgeschlagen: " + e.message; m.agent.phase = null; });
  }
}

/** One step. Mouse moves are smooth and visible, typing has a human rhythm. */
async function act(page, s, o) {
  const loc = () => page.locator(s.target).first();
  const glide = async () => {
    const l = loc();
    await l.scrollIntoViewIfNeeded({ timeout: 8000 });
    const b = await l.boundingBox();
    if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 22 });
    return l;
  };
  switch (s.action) {
    case "goto": {
      const to = new URL(s.value || s.target, page.url());
      if (!/^https?:$/.test(to.protocol)) throw new Error("goto erlaubt nur http(s)-Adressen"); // no file://, chrome://, javascript:
      await page.goto(to.href, { waitUntil: "load", timeout: 45_000 });
      break;
    }
    case "click": { const l = await glide(); await page.waitForTimeout(180); await l.click({ timeout: 8000 }); await page.waitForLoadState("load", { timeout: 8000 }).catch(() => {}); break; }
    case "type": { const l = await glide(); await l.click({ timeout: 8000 }); await l.pressSequentially(s.value, { delay: 45 }); break; }
    case "press": await page.keyboard.press(s.value || "Enter"); break;
    case "hover": await glide(); break;
    case "scroll":
      if (s.target) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "center" }), s.target);
      else await page.evaluate((y) => scrollBy({ top: y, behavior: "smooth" }), Number(s.value) || o.height * 0.7);
      await page.waitForTimeout(700); break;
    case "wait": await page.waitForTimeout(Math.max(0, Math.min(15000, Number(s.value) || 1000))); break;
    case "waitFor": await loc().waitFor({ timeout: Math.min(30000, Number(s.value) || 15000) }); break;
    case "highlight": {
      const l = await glide();
      await l.evaluate((el) => {
        const r = el.getBoundingClientRect(), d = document.createElement("div");
        Object.assign(d.style, { position: "fixed", left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px", border: "3px solid #ff5a36", borderRadius: "10px", boxShadow: "0 0 0 9999px rgba(0,0,0,.18)", zIndex: 2147483645, pointerEvents: "none", transition: "opacity .3s" });
        document.body.appendChild(d);
        setTimeout(() => { d.style.opacity = "0"; setTimeout(() => d.remove(), 350); }, 2200);
      });
      break;
    }
  }
}

export { probe };
