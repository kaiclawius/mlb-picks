// Sharp 2x stills of the rebuilt Payroll.exe site for the kinetic film (a smooth camera moves over them
// instead of replaying a ~25 fps screen recording). Site on PORT (default 4840): npx http-server -p 4840 coins/payroll
import { chromium } from "playwright";
const base = `http://127.0.0.1:${process.env.PORT || 4840}/?mode=recorded`, out = new URL("../public/payroll/stills/", import.meta.url).pathname;
import { mkdirSync } from "node:fs"; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => sessionStorage.setItem("m-intro", "1"));
await p.goto(base); await p.waitForTimeout(3500);
const shot = async (name) => { await p.screenshot({ path: out + name + ".jpg", type: "jpeg", quality: 90 }); console.log("saved", name); };
const to = async (y, wait = 1200) => { await p.evaluate((y) => window.Motion?.lenis ? window.Motion.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y), y); await p.waitForTimeout(wait); };
await shot("hero");
// the pinned work order, one still per step
const top = await p.evaluate(() => document.querySelector("#how").getBoundingClientRect().top + scrollY);
for (let i = 0; i < 5; i++) { await to(top + ((i + 0.55) / 5) * 5 * 0.7 * 1080, 1500); await shot("order-" + i); }
// the office after one recorded round
const office = await p.evaluate(() => document.querySelector("#office").getBoundingClientRect().top + scrollY);
await to(office - 60, 800); await p.click("#runBtn");
await p.waitForFunction(() => /Round closed/.test(document.querySelector("#status").textContent), null, { timeout: 90000 }); await p.waitForTimeout(800);
await to(office - 60, 600); await shot("office");
const roster = await p.evaluate(() => document.querySelector("#roster").getBoundingClientRect().top + scrollY);
await to(roster - 140, 600); await shot("roster");
const desk = await p.evaluate(() => document.querySelector(".desk").getBoundingClientRect().top + scrollY);
await to(desk - 80, 900); await shot("desk");
await b.close();
