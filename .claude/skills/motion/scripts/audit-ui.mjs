#!/usr/bin/env node
// Watches a web page move, so UI motion can be judged on evidence instead of by reading CSS.
//   node audit-ui.mjs <url> [--steps steps.json] [--out dir] [--width 1280 --height 800] [--mobile]
// Records a video, takes a screenshot every 250 ms, lists every animation/transition that ran (element,
// properties, duration, easing), measures layout shift, and repeats the run with prefers-reduced-motion.
// steps.json: [{ "scroll": 800 }, { "hover": ".btn" }, { "click": "text=Mehr" }, { "wait": 600 }]
// Needs Playwright (npx playwright install chromium) in the project or globally.
import { mkdirSync, readFileSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const url = args[0];
if (!url) { console.error("Benutzung: node audit-ui.mjs <url> [--steps steps.json] [--out dir]"); process.exit(1); }
const out = resolve(opt("out", "motion-audit"));
const mobile = args.includes("--mobile");
const vw = Number(opt("width", mobile ? 390 : 1280)), vh = Number(opt("height", mobile ? 844 : 800));
const steps = opt("steps") ? JSON.parse(readFileSync(opt("steps"), "utf8")) : [{ wait: 1200 }, { scroll: Math.round(vh * 0.9) }, { wait: 900 }, { scroll: Math.round(vh * 0.9) }, { wait: 900 }];
mkdirSync(out, { recursive: true });

let chromium;
for (const base of [process.cwd() + "/", import.meta.url]) {
  try { const m = await import(createRequire(base).resolve("playwright")); chromium = m.chromium ?? m.default?.chromium; if (chromium) break; } catch {}
}
if (!chromium) { try { chromium = (await import("playwright")).chromium; } catch { console.error("Playwright fehlt: npm i -D playwright && npx playwright install chromium"); process.exit(1); } }

// Runs in the page: records every animation that starts, and layout shifts.
const PROBE = () => {
  window.__motion = { anims: new Map(), cls: 0 };
  const name = (el) => !el ? "?" : (el.id ? `#${el.id}` : el.tagName.toLowerCase() + (el.classList.length ? "." + [...el.classList].slice(0, 2).join(".") : ""));
  const scan = () => {
    for (const a of document.getAnimations()) {
      const t = a.effect?.getTiming?.() || {}, kf = a.effect?.getKeyframes?.() || [];
      const props = [...new Set(kf.flatMap((k) => Object.keys(k).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p))))];
      const key = (a.id || a.transitionProperty || a.animationName || props.join(",")) + "@" + name(a.effect?.target);
      if (!window.__motion.anims.has(key)) window.__motion.anims.set(key, { target: name(a.effect?.target), kind: a.constructor.name, name: a.animationName || a.transitionProperty || "", props, duration: t.duration, delay: t.delay, fill: t.fill,
        // CSS animations carry their timing function per keyframe; the effect itself reports "linear"
        easing: t.easing === "linear" && kf[0]?.easing && kf[0].easing !== "linear" ? kf[0].easing : t.easing, iterations: t.iterations });
    }
    requestAnimationFrame(scan);
  };
  requestAnimationFrame(scan);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__motion.cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
};

async function run(reduced, tag) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference", recordVideo: reduced ? undefined : { dir: out, size: { width: vw, height: vh } } });
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let shot = 0, stop = false;
  const snap = async () => { while (!stop) { await page.screenshot({ path: join(out, `${tag}-${String(shot++).padStart(3, "0")}.png`) }).catch(() => {}); await page.waitForTimeout(250); } };
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const loop = snap();
  for (const s of steps) {
    if (s.scroll !== undefined) await page.mouse.wheel(0, s.scroll);
    if (s.hover) await page.hover(s.hover).catch((e) => errors.push("hover " + s.hover + ": " + e.message.split("\n")[0]));
    if (s.click) await page.click(s.click).catch((e) => errors.push("click " + s.click + ": " + e.message.split("\n")[0]));
    if (s.type) await page.fill(s.type[0], s.type[1]).catch(() => {});
    await page.waitForTimeout(s.wait ?? 500);
  }
  stop = true; await loop;
  const data = await page.evaluate(() => ({ anims: [...window.__motion.anims.values()], cls: window.__motion.cls }));
  const video = page.video();
  await ctx.close(); await browser.close();
  if (video) renameSync(await video.path(), join(out, "recording.webm"));
  return { ...data, errors, shots: shot };
}

const normal = await run(false, "normal");
const reduced = await run(true, "reduced");
const LAYOUT = /^(width|height|top|left|right|bottom|margin|padding|inset)/;
const findings = [];
for (const a of normal.anims) {
  const d = typeof a.duration === "number" ? a.duration : 0;
  if (a.props.some((p) => LAYOUT.test(p))) findings.push(`Ruckel-Risiko: ${a.target} animiert ${a.props.filter((p) => LAYOUT.test(p)).join(", ")} (Layout). Besser transform/opacity.`);
  if (a.iterations !== Infinity && d > 700) findings.push(`Lang: ${a.target} ${a.name || a.props.join(",")} dauert ${d} ms.`);
  const moves = a.props.some((p) => /transform|translate|scale|rotate/.test(p));
  if (a.easing === "linear" && a.iterations !== Infinity && d > 150) findings.push(`Linear: ${a.target} bewegt sich mit linearer Kurve (wirkt mechanisch).`);
  if (moves && /^(ease|ease-in-out|ease-in)$/.test(a.easing)) findings.push(`Kurve: ${a.target} nutzt "${a.easing}" für Bewegung; zaghaft. Eintritt cubic-bezier(.16,1,.3,1), Wechsel cubic-bezier(.2,0,0,1).`);
  if (a.props.some((p) => /box-shadow|filter|backdrop/i.test(p))) findings.push(`Teuer: ${a.target} animiert ${a.props.filter((p) => /box-shadow|filter|backdrop/i.test(p)).join(", ")}. Besser: Schatten-Ebene vorrendern und nur deren opacity animieren.`);
  if (a.kind === "CSSAnimation" && moves && a.iterations !== Infinity && /forwards|both/.test(a.fill || "")) findings.push(`Gesperrt: ${a.target} @keyframes ${a.name} mit fill-mode ${a.fill} hält transform nach dem Ende fest, Hover/Transitions auf transform wirken dann nicht. Für Eintritte "backwards" nutzen.`);
}
const moving = (list) => list.filter((a) => a.props.some((p) => /transform|translate|scale|rotate/.test(p)) && a.iterations !== Infinity);
if (moving(reduced.anims).length) findings.push(`Reduzierte Bewegung: ${moving(reduced.anims).length} Bewegungs-Animationen laufen trotz prefers-reduced-motion (${moving(reduced.anims).map((a) => a.target).slice(0, 5).join(", ")}).`);
if (normal.cls > 0.1) findings.push(`Layout springt: CLS ${normal.cls.toFixed(3)} (gut < 0.1).`);
const report = { url, viewport: `${vw}x${vh}`, animations: normal.anims, reducedMotionAnimations: reduced.anims, cls: +normal.cls.toFixed(4), errors: normal.errors, findings };
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(`Animationen: ${normal.anims.length} (mit reduzierter Bewegung: ${reduced.anims.length}) · CLS ${report.cls} · ${normal.shots} Screenshots`);
for (const a of normal.anims.slice(0, 40)) console.log(`  ${a.target.padEnd(28)} ${String(a.name || a.props.join(",")).padEnd(22)} ${a.duration} ms  ${a.easing}${a.iterations === Infinity ? "  (Schleife)" : ""}`);
console.log(findings.length ? "\nBefunde:\n- " + findings.join("\n- ") : "\nKeine Befunde.");
console.log(`\nVideo: ${join(out, "recording.webm")}\nScreenshots: ${out}/normal-*.png (alle 250 ms) · Bericht: ${join(out, "report.json")}`);
console.log(`Kontaktbogen: node ${new URL("./frames.mjs", import.meta.url).pathname} ${join(out, "recording.webm")} --every 0.5 --cols 6`);
