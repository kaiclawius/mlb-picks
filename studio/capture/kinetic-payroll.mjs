// One-off captures of the rebuilt Payroll.exe site for the kinetic film: the printer boot + wordmark,
// and the pinned work order filling in until APPROVED. Site must be served on PORT (default 4840).
import { chromium } from "playwright"; import { execFileSync } from "node:child_process"; import { mkdirSync, readdirSync, rmSync } from "node:fs";
const base = `http://127.0.0.1:${process.env.PORT || 4840}`, out = new URL("../public/payroll/", import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
async function rec(name, fn, trim) {
  const dir = `${out}.rec-${name}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir, size: { width: 1920, height: 1080 } } });
  const p = await ctx.newPage(); const t0 = Date.now(); const start = await fn(p, t0); await ctx.close();
  const f = `${dir}/${readdirSync(dir)[0]}`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(start), "-i", f, ...(trim ? ["-t", String(trim)] : []), "-an", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30", `${out}${name}.mp4`]);
  rmSync(dir, { recursive: true, force: true }); console.log("saved", name);
}
// boot: fresh session, so the loader plays; start shortly after navigation
await rec("boot", async (p, t0) => { await p.goto(base + "/?mode=recorded"); const s = (Date.now() - t0) / 1000; await p.waitForTimeout(6500); return Math.max(0, s - 0.2); }, 6.5);
// work order: skip the loader, scroll to the pinned section, then wheel through the five steps
await rec("workorder", async (p, t0) => {
  await p.addInitScript(() => sessionStorage.setItem("m-intro", "1"));
  await p.goto(base + "/?mode=recorded"); await p.waitForTimeout(1800);
  const top = await p.evaluate(() => document.querySelector("#how").getBoundingClientRect().top + scrollY);
  await p.evaluate((y) => window.Motion?.lenis ? window.Motion.lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y), top); await p.waitForTimeout(1200);
  const s = (Date.now() - t0) / 1000; await p.mouse.move(960, 600);
  for (let i = 0; i < 64; i++) { await p.mouse.wheel(0, 85); await p.waitForTimeout(95); }
  await p.waitForTimeout(1500); return s;
});
await b.close();
