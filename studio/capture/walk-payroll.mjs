// Panels of the Payroll.exe office for the walkthrough film (products/payroll.ts → walk).
// Each panel is captured on its own, sharp at 3x, once per state, plus where its parts sit (marks, 0-1 of the
// panel), so the camera, the cursor and the typed text land exactly on the real UI. Like the Claude product
// films: the windows float on a canvas instead of showing a whole page.
// Site on PORT (default 4840): npx http-server -p 4840 coins/payroll
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const base = `http://127.0.0.1:${process.env.PORT || 4840}/?mode=recorded`, out = new URL("../public/payroll/walk/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
// tall enough that the whole office is on screen at once, so nothing reveals or scrolls between states
const p = await (await b.newContext({ viewport: { width: 1600, height: 2200 }, deviceScaleFactor: 3 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("m-intro", "1"));
await p.goto(base); await p.waitForTimeout(3500);
await p.addStyleTag({ content: "nav{display:none!important} .log{scrollbar-width:none}" });

const PANELS = { mission: ".office .panel.mission", roster: ".office .panel:nth-child(2)", log: ".office .panel:nth-child(3)", desk: ".office .panel.desk", order: "#how .order" };
const MARKS = { mission: { input: "#missionInput", run: "#runBtn", status: "#status" }, roster: { boss: "#roster > *:first-child" },
  log: { count: "#txCount" }, desk: { totals: "#totals" }, order: { stamp: ".stamp", total: ".total" } };
const panels = {};
const shot = async (panel, state, extra = {}) => {
  const el = await p.$(PANELS[panel]);
  await el.screenshot({ path: `${out}${panel}-${state}.jpg`, type: "jpeg", quality: 92 });
  const box = await el.boundingBox();
  const marks = await p.evaluate(([sel, M, box]) => {
    const root = document.querySelector(sel), r = {};
    for (const [k, s] of Object.entries(M)) {
      const e = root.querySelector(s); if (!e) continue; const b = e.getBoundingClientRect();
      r[k] = [(b.left - box.x) / box.width, (b.top - box.y) / box.height, b.width / box.width, b.height / box.height].map((v) => +v.toFixed(4));
    }
    return r;
  }, [PANELS[panel], MARKS[panel], box]);
  (panels[panel] ??= { states: {} }).states[state] = { size: [Math.round(box.width), Math.round(box.height)], marks, ...extra };
  console.log("saved", panel, state);
};
const to = async (sel, off = 0, wait = 900) => { await p.evaluate(([s, off]) => { const y = document.querySelector(s).getBoundingClientRect().top + scrollY + off; window.Motion?.lenis ? window.Motion.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y); }, [sel, off]); await p.waitForTimeout(wait); };
const all = async (state, extra) => { for (const k of ["mission", "roster", "log", "desk"]) await shot(k, state, extra); };

await to("#office", -20, 1500);
// the input's type, so the film can type in the same face at the same place
const inputFont = await p.evaluate(() => { const s = getComputedStyle(document.querySelector("#missionInput")); return { family: s.fontFamily, size: parseFloat(s.fontSize), color: s.color, padLeft: parseFloat(s.paddingLeft) }; });
await all("idle");
panels.mission.inputFont = inputFont;

// one recorded round; the mission is typed in the film, the stills only need the run itself
// an empty, focused input without its placeholder: the film types over this one
await p.$eval("#missionInput", (e) => { e.placeholder = ""; e.focus(); }); await p.waitForTimeout(200);
await shot("mission", "blank");
await p.fill("#missionInput", "launch a coffee brand for night-shift nurses");
await shot("mission", "typed");
await p.click("#runBtn");
const t0 = Date.now();
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(400);
  const t = +((Date.now() - t0) / 1000).toFixed(2), status = await p.textContent("#status");
  await all("run-" + String(i).padStart(2, "0"), { t, status });
  if (/Round closed/.test(status)) break;
}
// the work order, one state per step (the site pins it and shows one step per 70% of a screen)
await p.setViewportSize({ width: 1600, height: 1000 }); await p.waitForTimeout(500);
for (let i = 0; i < 5; i++) { await to("#how", (i + 0.55) * 0.7 * 1000, 1500); await shot("order", String(i)); }
writeFileSync(out + "panels.json", JSON.stringify(panels, null, 1));
await b.close();
