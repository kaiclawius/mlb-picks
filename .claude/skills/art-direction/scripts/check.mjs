#!/usr/bin/env node
// Design check in a real browser: renders a page at three widths, scrolls it one screen at a time like a
// visitor, and measures what a reviewer would notice: headlines that wrap too often, fonts that never
// loaded, low contrast, text covered by other layers, empty screens, broken or missing pictures, overflow,
// tiny text, a page that never moves, motion that ignores reduced motion, filler copy. It writes contact
// sheets so the agent can look at its own work, and a report with PASS / WARN / FAIL per rule.
//   node check.mjs <folder|url> [--out .art-direction/check] [--profile default|strict] [--widths 1440,768,390]
//                  [--allow rule1,rule2] [--wait 2500] [--screens 12]
// Exit code 1 when any FAIL remains. Needs Playwright with Chromium (CHROME_PATH overrides the browser).
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const target = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true) || ".";
const OUT = path.resolve(opt("out", ".art-direction/check")), PROFILE = opt("profile", "default");
const WIDTHS = opt("widths", "1440,768,390").split(",").map(Number), WAIT = Number(opt("wait", 2500)), SCREENS = Number(opt("screens", 12));
const ALLOW = new Set((opt("allow", "") || "").split(",").filter(Boolean));
let playwright; for (const p of [process.cwd(), "/opt/node22/lib/node_modules/", path.dirname(new URL(import.meta.url).pathname)]) { try { playwright = createRequire(path.join(p, "x.js"))("playwright"); break; } catch {} }
if (!playwright) { console.error("Playwright not found. npm i -D playwright (or install it globally)."); process.exit(2); }

/* ---------- serve a local folder on 127.0.0.1 (read-only, no traversal) ---------- */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json" };
async function serve(dir) {
  const root = path.resolve(dir);
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
    const f = path.join(root, p); if (!f.startsWith(root)) { res.statusCode = 403; return res.end(); }
    fs.readFile(f, (e, d) => { if (e) { res.statusCode = 404; return res.end(); } res.setHeader("Content-Type", TYPES[path.extname(f).toLowerCase()] || "application/octet-stream"); res.end(d); });
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  return { url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() };
}

/* ---------- runs inside the page before its own scripts: who moves? ---------- */
const RECORDER = () => {
  const moved = new Set(), key = (el) => el && el.nodeType === 1 ? el : null;
  window.__moved = moved;
  for (const ev of ["animationstart", "transitionrun"]) addEventListener(ev, (e) => { const el = key(e.target); if (el) moved.add(el); }, true);
  new MutationObserver((list) => { for (const m of list) if (m.attributeName === "style") { const s = m.target.getAttribute("style") || ""; if (/transform|translate|opacity|clip-path|scale|rotate/.test(s)) moved.add(m.target); } })
    .observe(document, { attributes: true, subtree: true, attributeFilter: ["style"] });
  setInterval(() => { try { for (const a of document.getAnimations()) { const el = a.effect?.target; if (el && a.playState === "running") moved.add(el); } } catch {} }, 150);
};

/* ---------- per screen: covered text and how full the screen is ---------- */
const SCREEN_PROBE = () => {
  const W = innerWidth, H = innerHeight, bodyBg = getComputedStyle(document.body).backgroundColor;
  const visible = (el) => { const cs = getComputedStyle(el); return cs.visibility !== "hidden" && +cs.opacity > 0.05; };
  // fullness: sample a grid; a point is "filled" when it hits text, media or a surface that differs from the page
  let filled = 0, n = 0;
  for (let y = 0.06; y < 1; y += 0.11) for (let x = 0.04; x < 1; x += 0.08) {
    n++; const el = document.elementFromPoint(x * W, y * H); if (!el || el === document.body || el === document.documentElement) continue;
    const tag = el.tagName, cs = getComputedStyle(el);
    if (/^(IMG|VIDEO|CANVAS|SVG|PICTURE|IFRAME|INPUT|TEXTAREA|BUTTON)$/i.test(tag) || el.closest("svg")) { filled++; continue; }
    const hasText = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1);
    if (hasText && visible(el)) { filled++; continue; }
    if ((cs.backgroundColor !== bodyBg && cs.backgroundColor !== "rgba(0, 0, 0, 0)") || cs.backgroundImage !== "none") filled++;
  }
  // covered text: the middle of a visible text line should hit that text's own element (or a child of it)
  const covered = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node, checked = 0;
  while ((node = walker.nextNode()) && checked < 400) {
    const t = node.textContent.trim(); if (t.length < 3) continue;
    const el = node.parentElement; if (!el || !visible(el) || el.closest("[aria-hidden=true]")) continue;
    const r = document.createRange(); r.selectNodeContents(node); const box = r.getBoundingClientRect();
    if (box.width < 8 || box.height < 6 || box.bottom < 0 || box.top > H || box.right < 0 || box.left > W) continue;
    if (getComputedStyle(el).pointerEvents === "none") continue; // the browser's hit test skips it, so it can't be judged this way
    // the part of the text that is actually painted: inside every clipping ancestor (ellipsis, scroll boxes)
    let L = Math.max(box.left, 0), T = Math.max(box.top, 0), Rr = Math.min(box.right, W), B = Math.min(box.bottom, H);
    for (let e = el; e && e !== document.body; e = e.parentElement) { const cs2 = getComputedStyle(e); if (cs2.overflowX !== "visible" || cs2.overflowY !== "visible") { const c = e.getBoundingClientRect(); L = Math.max(L, c.left); T = Math.max(T, c.top); Rr = Math.min(Rr, c.right); B = Math.min(B, c.bottom); } }
    if (Rr - L < 4 || B - T < 4) continue;
    checked++;
    const cx = (L + Rr) / 2, cy = (T + B) / 2;
    const hit = document.elementFromPoint(cx, cy);
    // text under a sticky header, a pinned stage or a curtain footer is scrolling past by design: only report
    // overlaps between two layers in the normal flow (a real layout collision)
    const pinned = (x) => { for (let e = x; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === "sticky" || p === "fixed") return true; } return false; };
    if (!hit || pinned(el) || pinned(hit)) continue;
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
      const hs = getComputedStyle(hit); if (+hs.opacity < 0.3 || hs.pointerEvents === "none" && hs.backgroundColor === "rgba(0, 0, 0, 0)") continue;
      covered.push({ text: t.slice(0, 40), by: hit.tagName.toLowerCase() + (hit.className && typeof hit.className === "string" ? "." + hit.className.split(" ")[0] : "") });
    }
  }
  return { fill: filled / n, covered: covered.slice(0, 8), scrollY: Math.round(scrollY) };
};

/* ---------- whole page, after a full scroll ---------- */
const PAGE_PROBE = () => {
  const out = {}; const W = innerWidth;
  const rgb = (s) => { const c = document.createElement("canvas").getContext("2d"); c.fillStyle = s; c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== "none" && !/gradient/.test(cs.backgroundImage)) return null; const c = rgb(cs.backgroundColor); if (c[3] > 0.9) return c; } return rgb(getComputedStyle(document.documentElement).backgroundColor || "#fff"); };
  const vis = (el) => { const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05 && r.width > 0 && r.height > 0; };
  // headlines: lines from the distinct tops of their text rects
  out.headlines = [...document.querySelectorAll("h1,h2,h3")].filter(vis).map((h) => {
    const fs0 = parseFloat(getComputedStyle(h).fontSize) || 16, tops = [];
    const tw = document.createTreeWalker(h, NodeFilter.SHOW_TEXT); let tn;
    while ((tn = tw.nextNode())) { if (!tn.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(tn); for (const x of r.getClientRects()) if (x.width > 2) tops.push(x.top + x.height / 2); }
    tops.sort((a, b) => a - b); const lines = tops.reduce((n, t, i) => (i && t - tops[i - 1] < fs0 * 0.5 ? n : n + 1), 0);
    return { tag: h.tagName.toLowerCase(), text: h.textContent.trim().replace(/\s+/g, " ").slice(0, 60), lines, size: parseFloat(getComputedStyle(h).fontSize) };
  });
  // text: families, sizes, contrast, tiny text, long measures
  const fam = new Map(), sizes = new Map(), lowContrast = [], tiny = [], longLines = []; let bodySizes = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!vis(el)) continue; const own = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join("").trim(); if (own.length < 2) continue;
    const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), f = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    fam.set(f, (fam.get(f) || 0) + own.length); sizes.set(Math.round(fs), (sizes.get(Math.round(fs)) || 0) + 1);
    if (/^(P|LI|DD|BLOCKQUOTE)$/.test(el.tagName) && own.length > 60) { bodySizes.push(fs); const ch = el.getBoundingClientRect().width / (fs * 0.5); if (ch > 95) longLines.push({ text: own.slice(0, 40), ch: Math.round(ch) }); }
    if (fs < 12 && own.length > 3 && !el.closest("sup,sub,small,figcaption,[aria-hidden=true]")) tiny.push({ text: own.slice(0, 30), px: fs });
    let blended = false, op = 1; for (let e = el; e; e = e.parentElement) { const s2 = getComputedStyle(e); if (s2.mixBlendMode !== "normal") blended = true; op *= +s2.opacity; }
    if (blended || op < 0.5) continue;
    if (rgb(cs.color)[3] < 0.1 || parseFloat(cs.webkitTextStrokeWidth) > 0) continue; // outlined or transparent text
    const bg = bgOf(el); if (!bg) continue; const fg = rgb(cs.color); const a = fg[3];
    const fgMix = [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); const L1 = lum(fgMix), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const large = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700); if (ratio < (large ? 3 : 4.5)) lowContrast.push({ text: own.slice(0, 30), ratio: +ratio.toFixed(2), px: fs });
  }
  const total = [...fam.values()].reduce((a, b) => a + b, 0) || 1;
  out.families = [...fam].sort((a, b) => b[1] - a[1]).map(([f, n]) => ({ family: f, share: +(n / total).toFixed(2) }));
  out.sizes = [...sizes.keys()].sort((a, b) => a - b);
  out.bodyPx = bodySizes.length ? bodySizes.sort((a, b) => a - b)[Math.floor(bodySizes.length / 2)] : null;
  out.lowContrast = lowContrast.slice(0, 12); out.lowContrastCount = lowContrast.length; out.tiny = tiny.slice(0, 8); out.tinyCount = tiny.length; out.longLines = longLines.slice(0, 5);
  // fonts: declared web fonts that never loaded
  const generic = /^(serif|sans-serif|monospace|system-ui|ui-[a-z-]+|-apple-system|BlinkMacSystemFont|cursive|fantasy|emoji|math|Arial|Helvetica|Georgia|Times New Roman|Menlo|Courier New|Segoe UI|Roboto)$/i;
  const loaded = new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "").toLowerCase()));
  out.fontsMissing = out.families.filter((x) => x.share > 0.02 && !generic.test(x.family) && !loaded.has(x.family.toLowerCase())).map((x) => x.family);
  // pictures: real media that is big enough to count, and broken ones
  const media = [...document.querySelectorAll("img,video,canvas,picture>img,svg")].filter(vis);
  out.pictures = media.filter((m) => { const r = m.getBoundingClientRect(); if (r.width < 160 || r.height < 120) return false; if (m.tagName === "IMG") return m.naturalWidth >= 300; if (m.tagName === "svg") return r.width * r.height > 60000; return true; }).length;
  out.broken = [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && vis(i)).map((i) => i.getAttribute("src")).slice(0, 8);
  out.missingAlt = [...document.querySelectorAll("img:not([alt])")].length;
  out.overflowX = document.documentElement.scrollWidth > W + 1 ? document.documentElement.scrollWidth - W : 0;
  out.moving = window.__moved ? [...window.__moved].filter((e) => e.isConnected).length : 0;
  out.text = document.body.innerText.slice(0, 20000);
  out.ctas = [...document.querySelectorAll("a,button")].filter(vis).map((b) => b.textContent.trim().replace(/\s+/g, " ")).filter((t) => t && t.length < 40);
  out.docHeight = document.documentElement.scrollHeight;
  return out;
};

/* ---------- rules ---------- */
const SLOP = /\b(unlock|unleash|seamless(ly)?|elevate|supercharge|revolutioni[sz]e|game[- ]chang(er|ing)|cutting[- ]edge|next[- ]level|delve|empower|effortless(ly)?|leverage|synerg\w*|world[- ]class|best[- ]in[- ]class|reimagine[ds]?|harness the power|in today's fast[- ]paced)\b/gi;
const FILLER = /\b(lorem ipsum|dolor sit amet|placeholder|your (company|brand) name|coming soon\.{0,3}$|TODO|TBD)\b/gi;
const GENERIC_CTA = /^(get started|learn more|click here|read more|submit|sign up now|discover more|find out more)$/i;
const DEFAULT_FONTS = /^(Inter|Roboto|Open Sans|Poppins|Montserrat|Lato|Arial|Helvetica)$/i;
function rules(w, page, screens, reduced) {
  const strict = PROFILE === "strict", R = [];
  const add = (id, level, msg, detail) => { if (!ALLOW.has(id)) R.push({ id, level, width: w, msg, detail }); };
  const maxLines = strict ? 2 : 3;
  for (const h of page.headlines.filter((h) => h.tag !== "h3" && h.size >= 28)) if (h.lines > maxLines) add("headline-lines", "FAIL", `"${h.text}" wraps to ${h.lines} lines (max ${maxLines})`);
  if (page.overflowX) add("overflow-x", "FAIL", `page is ${page.overflowX}px wider than the screen`);
  if (page.fontsMissing.length) add("fonts-missing", "FAIL", `declared but not loaded: ${page.fontsMissing.join(", ")}`);
  if (page.lowContrastCount > (strict ? 0 : 2)) add("contrast", "FAIL", `${page.lowContrastCount} text elements under WCAG contrast`, page.lowContrast.slice(0, 5));
  if (page.broken.length) add("broken-images", "FAIL", `${page.broken.length} images failed to load`, page.broken);
  const cov = screens.flatMap((s) => s.covered.map((c) => ({ ...c, y: s.scrollY })));
  if (cov.length) add("covered-text", "FAIL", `${cov.length} text lines are covered by another layer`, cov.slice(0, 5));
  const empty = screens.filter((s) => s.fill < 0.18).length;
  if (empty > (strict ? 0 : 1)) add("empty-screens", strict ? "FAIL" : "WARN", `${empty} screens are nearly empty while scrolling`, screens.filter((s) => s.fill < 0.18).map((s) => s.scrollY));
  if (page.tinyCount > 3) add("tiny-text", "WARN", `${page.tinyCount} text elements under 12px`, page.tiny.slice(0, 4));
  if (page.bodyPx && page.bodyPx < 15) add("body-size", "WARN", `body text is ${page.bodyPx}px (16px or more reads better)`);
  if (page.longLines.length) add("measure", "WARN", `paragraphs run to ~${page.longLines[0].ch} characters per line (aim for 45–80)`);
  const fams = page.families.filter((f) => f.share > 0.03); if (fams.length > 3) add("typefaces", "WARN", `${fams.length} typefaces in use`, fams.map((f) => f.family));
  if (page.sizes.length > (strict ? 7 : 12)) add("type-sizes", "WARN", `${page.sizes.length} different font sizes`, page.sizes);
  const minPics = strict ? 4 : 2; if (page.pictures < minPics) add("few-pictures", strict ? "FAIL" : "WARN", `${page.pictures} real pictures (want ${minPics}+)`);
  if (page.missingAlt) add("alt-text", "WARN", `${page.missingAlt} images without alt`);
  if (page.moving < (strict ? 8 : 3)) add("still-page", "WARN", `only ${page.moving} elements move`);
  if (reduced != null && reduced > 2) add("reduced-motion", "FAIL", `${reduced} elements still move with prefers-reduced-motion`);
  const slop = [...new Set((page.text.match(SLOP) || []).map((s) => s.toLowerCase()))]; if (slop.length) add("slop-words", strict ? "FAIL" : "WARN", `generic marketing words: ${slop.join(", ")}`);
  const filler = [...new Set(page.text.match(FILLER) || [])]; if (filler.length) add("filler", "FAIL", `placeholder copy: ${filler.join(", ")}`);
  const gen = [...new Set(page.ctas.filter((t) => GENERIC_CTA.test(t)))]; if (gen.length) add("generic-cta", strict ? "FAIL" : "WARN", `generic button labels: ${gen.join(", ")}`);
  if (strict && fams[0] && DEFAULT_FONTS.test(fams[0].family)) add("default-font", "WARN", `main typeface is a default choice: ${fams[0].family}`);
  if ((page.text.match(/—/g) || []).length > 6) add("em-dashes", "WARN", `${(page.text.match(/—/g) || []).length} em dashes (reads machine-written)`);
  return R;
}

/* ---------- contact sheet: stitch screenshots with the browser itself ---------- */
async function sheet(browser, files, out, cols) {
  const p = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const imgs = files.map((f) => `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(f).toString("base64")}"><figcaption>${path.basename(f)}</figcaption></figure>`).join("");
  await p.setContent(`<style>body{margin:0;background:#111;font:12px monospace;color:#bbb}main{display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px}img{width:100%;display:block}figure{margin:0}</style><main>${imgs}</main>`);
  await p.waitForTimeout(200); await p.screenshot({ path: out, fullPage: true, type: "jpeg", quality: 72 }); await p.close();
}

/* ---------- run ---------- */
fs.mkdirSync(OUT, { recursive: true });
const local = !/^https?:\/\//.test(target), server = local ? await serve(target) : null, url = local ? server.url : target;
const browser = await playwright.chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const report = { target, url, profile: PROFILE, at: new Date().toISOString(), widths: {}, results: [] };
for (const w of WIDTHS) {
  const mobile = w < 600, vh = mobile ? 844 : w < 1000 ? 1024 : 900;
  const ctx = await browser.newContext({ viewport: { width: w, height: vh }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(RECORDER);
  const p = await ctx.newPage(); const errors = []; p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url, { waitUntil: "load", timeout: 45000 }); await p.waitForTimeout(WAIT);
  const shots = [], screens = [];
  for (let i = 0; i < SCREENS; i++) {
    const f = path.join(OUT, `w${w}-${String(i).padStart(2, "0")}.jpg`); await p.screenshot({ path: f, type: "jpeg", quality: 60 }); shots.push(f);
    screens.push(await p.evaluate(SCREEN_PROBE));
    const before = await p.evaluate(() => scrollY);
    if (mobile) await p.evaluate((h) => scrollBy(0, h * 0.9), vh); else { await p.mouse.move(w / 2, vh / 2); for (let k = 0; k < 6; k++) { await p.mouse.wheel(0, vh * 0.15); await p.waitForTimeout(40); } }
    await p.waitForTimeout(900);
    if ((await p.evaluate(() => scrollY)) <= before + 2) break; // reached the end
  }
  const page = await p.evaluate(PAGE_PROBE);
  // reduced motion: same page, count elements that still move
  let reduced = null;
  if (w === WIDTHS[0]) {
    const rc = await browser.newContext({ viewport: { width: w, height: vh }, reducedMotion: "reduce" }); await rc.addInitScript(RECORDER);
    const rp = await rc.newPage(); await rp.goto(url, { waitUntil: "load", timeout: 45000 }); await rp.waitForTimeout(WAIT);
    for (let i = 0; i < 4; i++) { await rp.evaluate((h) => scrollBy(0, h), vh); await rp.waitForTimeout(500); }
    reduced = await rp.evaluate(() => [...window.__moved].filter((e) => { if (!e.isConnected) return false; const cs = getComputedStyle(e); return !/m-marquee|blink|spin|ping/.test(cs.animationName); }).length); await rc.close();
  }
  const sheetFile = path.join(OUT, `sheet-${w}.jpg`); await sheet(browser, shots, sheetFile, mobile ? 6 : 4);
  const res = rules(w, page, screens, reduced);
  if (errors.length) res.push({ id: "js-errors", level: "FAIL", width: w, msg: `${errors.length} JavaScript errors`, detail: errors.slice(0, 3) });
  report.results.push(...res);
  const { text, ctas, ...keep } = page;
  report.widths[w] = { ...keep, screens: screens.map((s) => ({ y: s.scrollY, fill: +s.fill.toFixed(2), covered: s.covered.length })), reducedMoving: reduced, sheet: sheetFile };
  await ctx.close();
}
await browser.close(); server?.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
const fails = report.results.filter((r) => r.level === "FAIL"), warns = report.results.filter((r) => r.level === "WARN");
console.log(`${target} · profile ${PROFILE} · ${fails.length} FAIL · ${warns.length} WARN`);
for (const r of [...fails, ...warns]) console.log(`  ${r.level.padEnd(4)} ${r.id.padEnd(15)} @${r.width}  ${r.msg}`);
for (const w of WIDTHS) { const x = report.widths[w]; console.log(`  ${w}px: ${x.headlines.length} headlines, ${x.pictures} pictures, ${x.moving} moving, fonts ${x.families.slice(0, 3).map((f) => f.family).join("/")}, sheet ${path.relative(process.cwd(), x.sheet)}`); }
console.log(`report: ${path.relative(process.cwd(), path.join(OUT, "report.json"))}  (look at the sheets before you call it done)`);
process.exit(fails.length ? 1 : 0);
