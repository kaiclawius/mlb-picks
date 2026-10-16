// Records the real product in a browser and saves clean MP4 clips for the video.
//   npm run capture -- payroll
// Reads products/<id>.capture.mjs: where the site is, the window size, and a list of clips.
// Each clip is a list of steps (goto, wait, click, type, scroll, waitFor, hover). The recording
// starts on the first `mark: "start"` step (or after the first goto), so page loads never show up.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, rm, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const id = process.argv[2];
if (!id) { console.error("usage: npm run capture -- <product>"); process.exit(1); }
const cfg = (await import(join(ROOT, "products", `${id}.capture.mjs`))).default;
const only = process.argv[3];

/* a tiny static server, so local sites are recorded over http like the real thing */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".mp4": "video/mp4", ".webp": "image/webp" };
async function serve(dir) {
  const base = resolve(ROOT, dir);
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = join(base, p);
    if (!file.startsWith(base)) return res.writeHead(403).end();
    let body;
    try { body = await readFile(file); } catch { return res.writeHead(404).end(); }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }).end(body);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() };
}

const server = cfg.serve ? await serve(cfg.serve) : null;
const baseUrl = server ? server.url : cfg.url;
const out = join(ROOT, "public", id);
await mkdir(out, { recursive: true });
const { width, height } = cfg.viewport || { width: 1920, height: 1080 };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const manifest = existsSync(join(out, "clips.json")) ? JSON.parse(await readFile(join(out, "clips.json"), "utf8")) : {};

for (const clip of cfg.clips) {
  if (only && clip.name !== only) continue;
  const tmp = join(out, `.rec-${clip.name}`);
  await rm(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 1, colorScheme: cfg.colorScheme || "light",
    reducedMotion: "no-preference", recordVideo: { dir: tmp, size: { width, height } },
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  let start = null;
  for (const s of clip.steps) {
    if (s.goto !== undefined) { await page.goto(new URL(s.goto, baseUrl).href, { waitUntil: "networkidle" }); await page.evaluate(() => document.fonts.ready); }
    if (s.css) await page.addStyleTag({ content: s.css });
    if (s.scroll !== undefined) await page.evaluate(([sel, off, smooth]) => {
      const y = typeof sel === "number" ? sel : document.querySelector(sel).getBoundingClientRect().top + scrollY - off;
      scrollTo({ top: y, behavior: smooth ? "smooth" : "instant" });
    }, [s.scroll, s.offset || 0, s.smooth !== false]);
    if (s.hover) await page.hover(s.hover);
    if (s.click) await page.click(s.click, { delay: 60 });
    if (s.type) await page.locator(s.type[0]).pressSequentially(s.type[1], { delay: s.delay || 55 });
    if (s.waitFor) await page.waitForFunction(s.waitFor, null, { timeout: s.timeout || 60_000 });
    if (s.mark === "start" || (start === null && s.goto !== undefined && !clip.steps.some((x) => x.mark === "start"))) start = (Date.now() - t0) / 1000;
    if (s.wait) await page.waitForTimeout(s.wait);
  }
  const length = (Date.now() - t0) / 1000 - (start ?? 0);
  const video = page.video();
  await ctx.close();
  const webm = await video.path();
  const mp4 = join(out, `${clip.name}.mp4`);
  // trim the page load away, constant 30 fps, plays everywhere
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(start ?? 0), "-i", webm, "-t", length.toFixed(2),
    "-r", "30", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", mp4]);
  await rm(tmp, { recursive: true, force: true });
  manifest[clip.name] = { file: `${id}/${clip.name}.mp4`, seconds: Number(length.toFixed(2)), width, height };
  console.log(`✓ ${clip.name}: ${length.toFixed(1)} s -> public/${id}/${clip.name}.mp4`);
}
await writeFile(join(out, "clips.json"), JSON.stringify(manifest, null, 2) + "\n");
await browser.close();
server?.close();
