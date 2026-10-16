#!/usr/bin/env node
// Studies the motion of a live website so its craft can be learned and reproduced (not copied): which
// engines it uses, how long things take, which curves, how much stagger and travel, how scrolling behaves.
//   node study-site.mjs <url> [--out dir] [--width 1440 --height 900] [--mobile] [--scrolls 8]
// Works on any engine: it samples opacity / transform / clip-path of moving elements every frame and
// fits the curves, so GSAP, CSS, WAAPI, Motion and hand-written code are all measured the same way.
// Output: <out>/study.json (all numbers), screenshots, recording.webm. Read-only: it never logs in or
// submits anything; respect each site's terms and never reuse its code, assets or copy.
import { mkdirSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const url = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!url) { console.error("Aufruf: node study-site.mjs <url> [--out dir] [--mobile] [--scrolls 8]"); process.exit(2); }
const mobile = args.includes("--mobile");
const vw = Number(opt("width", mobile ? 390 : 1440)), vh = Number(opt("height", mobile ? 844 : 900));
const out = resolve(opt("out", "site-study")); mkdirSync(out, { recursive: true });
const scrolls = Number(opt("scrolls", 8));

let chromium;
for (const base of [process.cwd() + "/", import.meta.url, "/opt/node22/lib/node_modules/"]) {
  try { const m = await import(createRequire(base).resolve("playwright")); chromium = m.chromium ?? m.default?.chromium; if (chromium) break; } catch {}
}
if (!chromium) { console.error("Playwright fehlt: npm i -D playwright"); process.exit(1); }

// ---------- runs in the page before its own scripts ----------
const INIT = () => {
  const S = (window.__study = { ctx: {}, raf: [], vt: 0, longTasks: 0, cls: 0, declared: new Map(), tracks: [], scroll: [] });
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) { S.ctx[type] = (S.ctx[type] || 0) + 1; return gc.call(this, type, ...a); };
  const raf = window.requestAnimationFrame.bind(window);
  let calls = 0; window.requestAnimationFrame = (cb) => { calls++; return raf(cb); };
  setInterval(() => { S.raf.push(calls); calls = 0; }, 1000);
  if (document.startViewTransition) { const v = document.startViewTransition.bind(document); document.startViewTransition = (...a) => { S.vt++; return v(...a); }; }
  try { new PerformanceObserver((l) => { S.longTasks += l.getEntries().length; }).observe({ type: "longtask", buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) S.cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}

  // ---- motion sampler: every frame, the moving elements' opacity / translate / scale / clip-path ----
  const T = S.tracks, ids = new WeakMap();
  const t0 = performance.now(); S.t0 = t0;
  const label = (el) => { const c = (el.className && typeof el.className === "string") ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""; return (el.tagName || "").toLowerCase() + (el.id ? "#" + el.id : "") + c; };
  const track = (el) => {
    if (!(el instanceof Element) || ids.has(el) || T.length >= 700) return;
    const r = el.getBoundingClientRect(); if (r.width * r.height < 16) return;
    ids.set(el, T.length); T.push({ el, label: label(el), parent: el.parentElement ? label(el.parentElement) : "", area: Math.round(r.width * r.height), s: [], last: "" });
  };
  const observe = () => new MutationObserver((ms) => { for (const m of ms) track(m.target); }).observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"], subtree: true });
  if (document.documentElement) observe(); else document.addEventListener("readystatechange", observe, { once: true });
  const parse = (cs) => {
    let tx = 0, ty = 0, sc = 1;
    const m = cs.transform; if (m && m !== "none") { const v = m.match(/-?[\d.e]+/g).map(Number); if (m.startsWith("matrix3d")) { sc = Math.hypot(v[0], v[1], v[2]); tx = v[12]; ty = v[13]; } else { sc = Math.hypot(v[0], v[1]); tx = v[4]; ty = v[5]; } }
    if (cs.translate && cs.translate !== "none") { const v = cs.translate.match(/-?[\d.]+/g)?.map(Number) || []; tx += v[0] || 0; ty += v[1] || 0; }
    if (cs.scale && cs.scale !== "none") sc *= Number(cs.scale.split(" ")[0]) || 1;
    return [+cs.opacity, Math.round(tx * 10) / 10, Math.round(ty * 10) / 10, Math.round(sc * 1000) / 1000, cs.clipPath !== "none" ? cs.clipPath.length + cs.clipPath.replace(/[^\d.]/g, "").slice(0, 24) : ""];
  };
  const loop = () => {
    const now = performance.now() - t0;
    S.scroll.push([Math.round(now), Math.round(window.scrollY)]);
    for (const a of document.getAnimations ? document.getAnimations() : []) if (a.effect?.target) track(a.effect.target);
    for (const tr of T) {
      if (!tr.el.isConnected) continue;
      const v = parse(getComputedStyle(tr.el)); const key = v.join("|");
      if (key !== tr.last) { tr.s.push([Math.round(now), ...v]); tr.last = key; if (tr.s.length > 4000) tr.s.splice(0, 1000); }
    }
    raf(loop);
  };
  const start = () => { document.querySelectorAll("h1,h2,h3,p,img,video,canvas,a,button,section > *").forEach((el, i) => i < 140 && track(el)); raf(loop); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  // CSS/WAAPI animations with their declared timing (the sampler measures everything else)
  setInterval(() => {
    for (const a of document.getAnimations ? document.getAnimations() : []) {
      const e = a.effect, t = e?.getTiming?.() || {}, kf = e?.getKeyframes?.() || [];
      const key = (e?.target ? label(e.target) : "?") + (a.animationName || a.transitionProperty || "");
      if (!S.declared.has(key)) S.declared.set(key, { target: e?.target ? label(e.target) : "?", kind: a.constructor.name, name: a.animationName || a.transitionProperty || "", duration: t.duration, delay: t.delay,
        easing: t.easing === "linear" && kf[0]?.easing ? kf[0].easing : t.easing, iterations: t.iterations, timeline: a.timeline?.constructor?.name || "" });
    }
  }, 150);
};

// ---------- detection after the run ----------
const DETECT = () => {
  const S = window.__study, html = document.documentElement, q = (s) => document.querySelector(s);
  const all = [...document.querySelectorAll("*")];
  const libs = {
    gsap: window.gsap?.version || (window.gsapVersions && window.gsapVersions.join(",")) || (all.some((el) => el._gsap) ? "bundled" : null),
    scrollTrigger: !!(window.ScrollTrigger || all.some((el) => el.classList.contains("pin-spacer"))),
    splitText: all.some((el) => /\b(split-?(line|word|char)s?|char|word|line)\b/.test(el.className && typeof el.className === "string" ? el.className : "") && el.closest("h1,h2,h3,p")) ? "likely" : null,
    lenis: !!(window.lenis || html.classList.contains("lenis") || html.classList.contains("lenis-smooth")),
    locomotive: !!(html.classList.contains("has-scroll-smooth") || q("[data-scroll-container]")),
    barba: !!q("[data-barba]"), swup: !!(q("#swup") || html.classList.contains("swup-enabled")), taxi: !!q("[data-taxi]"),
    three: window.__THREE__ || null, webgl: !!(S.ctx.webgl || S.ctx.webgl2 || S.ctx["experimental-webgl"]), webgpu: !!S.ctx.webgpu,
    lottie: !!(window.lottie || window.bodymovin || q("lottie-player,dotlottie-player,dotlottie-wc,[data-lottie]")),
    rive: !!(window.rive || q("canvas[data-rive],rive-canvas")), spline: !!q("spline-viewer"), unicorn: !!window.UnicornStudio,
    framer: !!(q("[data-framer-name]") || /framer/i.test(q('meta[name="generator"]')?.content || "")), webflow: !!html.dataset.wfPage, nextjs: !!q("#__next,[data-nextjs-scroll-focus-boundary]") || !!window.__NEXT_DATA__,
    viewTransitions: S.vt, scrollDrivenCss: [...S.declared.values()].filter((d) => /ScrollTimeline|ViewTimeline/.test(d.timeline)).length,
  };
  const canvases = [...document.querySelectorAll("canvas")].map((c) => { const r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), fixed: getComputedStyle(c).position === "fixed" }; }).filter((c) => c.w * c.h > 2000);
  const fonts = [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")))].slice(0, 10);
  const cursorNone = getComputedStyle(document.body).cursor === "none" || getComputedStyle(html).cursor === "none";
  const tracks = S.tracks.map((t) => ({ label: t.label, parent: t.parent, area: t.area, s: t.s }));
  return { libs, canvases, fonts, cursorNone, raf: S.raf, longTasks: S.longTasks, cls: +S.cls.toFixed(4), declared: [...S.declared.values()], tracks, scroll: S.scroll,
    title: document.title, generator: q('meta[name="generator"]')?.content || "", docHeight: document.documentElement.scrollHeight };
};

// local pages never go through an outbound proxy (Playwright would otherwise force loopback through it)
const isLocal = /^https?:\/\/(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(url);
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", proxy: process.env.HTTPS_PROXY && !isLocal ? { server: process.env.HTTPS_PROXY } : undefined, args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: "no-preference", recordVideo: { dir: out, size: { width: Math.round(vw / 2), height: Math.round(vh / 2) } }, locale: "en-US" });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
// marks use the page's own clock, so they line up with the sampled motion
const marks = []; const mark = async (name) => marks.push([name, await page.evaluate(() => performance.now() - window.__study.t0).catch(() => null)]);
let t0 = Date.now();
const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => ({ status: () => "error: " + e.message.split("\n")[0] }));
const status = resp.status();
const shot = (n) => page.screenshot({ path: join(out, `${n}.jpg`), type: "jpeg", quality: 70 }).catch(() => {});
for (const ms of [500, 1500, 3000, 6000]) { await page.waitForTimeout(ms - (Date.now() - t0)); await shot(`intro-${String(ms).padStart(4, "0")}`); }
// dismiss a cookie banner if one blocks the page (only buttons that clearly accept/close)
await page.evaluate(() => { const b = [...document.querySelectorAll("button,a")].find((x) => /^(accept( all)?|allow all|agree|ok|got it|alle akzeptieren|akzeptieren|i agree)$/i.test((x.textContent || "").trim())); b?.click(); }).catch(() => {});
await mark("mouse"); for (let i = 0; i <= 12; i++) { await page.mouse.move(vw * (0.2 + 0.05 * i), vh * (0.4 + 0.02 * i)); await page.waitForTimeout(40); }
await page.waitForTimeout(600);
await mark("hover");
const hovered = await page.evaluate(() => { const el = [...document.querySelectorAll("nav a, header a, a, button")].find((a) => { const r = a.getBoundingClientRect(); return r.width > 20 && r.height > 10 && r.top > 0 && r.top < innerHeight * 0.9 && getComputedStyle(a).visibility !== "hidden"; }); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }).catch(() => null);
if (hovered) { await page.mouse.move(hovered.x, hovered.y, { steps: 6 }); await page.waitForTimeout(900); await page.mouse.move(hovered.x, hovered.y + 160, { steps: 4 }); await page.waitForTimeout(700); }
// smooth-scroll probe: one wheel notch, then watch scrollY settle
await mark("wheel"); await page.mouse.move(vw / 2, vh / 2); await page.mouse.wheel(0, 300); await page.waitForTimeout(1600);
for (let i = 0; i < scrolls; i++) { await mark(`scroll-${i}`); await page.mouse.wheel(0, Math.round(vh * 0.7)); await page.waitForTimeout(1100); await shot(`scroll-${i}`); }
await mark("end");
const data = await page.evaluate(DETECT).catch((e) => ({ error: e.message }));
if (data.error) console.error("Messung im Browser fehlgeschlagen:", data.error);
await ctx.close(); await browser.close();
const vids = readdirSync(out).filter((f) => f.endsWith(".webm") && f !== "recording.webm"); if (vids[0]) renameSync(join(out, vids[0]), join(out, "recording.webm"));

// ---------- analysis ----------
const tOf = (name) => { const m = marks.find((x) => x[0] === name); return m ? m[1] : null; };
const CURVES = {
  linear: (x) => x, "sine.out": (x) => Math.sin((x * Math.PI) / 2), "power1.out (quad)": (x) => 1 - (1 - x) ** 2, "power2.out (cubic)": (x) => 1 - (1 - x) ** 3,
  "power3.out (quart)": (x) => 1 - (1 - x) ** 4, "power4.out (quint)": (x) => 1 - (1 - x) ** 5, "expo.out": (x) => (x === 1 ? 1 : 1 - 2 ** (-10 * x)),
  "inOut (cubic)": (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2), "inOut (quart)": (x) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2), "in (cubic)": (x) => x ** 3,
  "back.out": (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; },
};
const fit = (pts) => { // pts: [[u 0..1, p 0..1]]
  let best = null; for (const [n, f] of Object.entries(CURVES)) { let e = 0; for (const [u, p] of pts) e += (f(u) - p) ** 2; e /= pts.length; if (!best || e < best.e) best = { n, e }; }
  return best;
};
const scrollAt = (t) => { const s = data.scroll || []; let lo = 0, hi = s.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m][0] < t) lo = m + 1; else hi = m; } return s[lo]?.[1] ?? 0; };
const scrolling = (t0_, t1_) => Math.abs(scrollAt(t1_) - scrollAt(t0_)) > 2;
// which phase of the scenario a motion starts in, and whether it tracks the scroll position (scrub)
const phaseOf = (t) => { let p = "intro"; for (const [n, mt] of marks) if (mt != null && t >= mt) p = n.startsWith("scroll") || n === "wheel" ? "scroll" : n; return p; };
const followsScroll = (run) => { const a = run[0][0], b = run[run.length - 1][0]; const dy = Math.abs(scrollAt(b) - scrollAt(a)); return dy > 20 && Math.abs(scrollAt(b + 300) - scrollAt(b)) < 3; };
const segs = [];
const PROPS = ["opacity", "x", "y", "scale"];
// a run of change ends after a rest of 3 frames (slow, software-rendered pages sample at < 60 fps)
const frameMs = (() => { const s = data.scroll || []; const d = []; for (let i = 1; i < s.length; i++) d.push(s[i][0] - s[i - 1][0]); d.sort((x, y) => x - y); return d[d.length >> 1] || 16; })();
const GAP = Math.max(120, frameMs * 3);
for (const tr of data.tracks || []) {
  const s = tr.s; if (s.length < 4) continue;
  for (let pi = 0; pi < 4; pi++) {
    // split the series into runs of change separated by ≥ 120 ms of rest
    let run = [s[0]];
    const flush = () => {
      if (run.length < 4) return;
      const v0 = run[0][pi + 1], v1 = run[run.length - 1][pi + 1], d = v1 - v0, dur = run[run.length - 1][0] - run[0][0];
      const mag = pi === 0 ? Math.abs(d) : pi === 3 ? Math.abs(d) : Math.abs(d);
      if (dur < 60 || (pi === 0 && mag < 0.15) || ((pi === 1 || pi === 2) && mag < 4) || (pi === 3 && mag < 0.02)) return;
      const pts = run.map((r) => [(r[0] - run[0][0]) / dur, d ? (r[pi + 1] - v0) / d : 1]);
      const over = Math.max(...pts.map((p) => p[1])) - 1;
      const f = fit(pts);
            segs.push({ el: tr.label, parent: tr.parent, area: tr.area, prop: PROPS[pi], from: v0, to: v1, start: run[0][0], dur, ease: f.n, err: +f.e.toFixed(4), overshoot: +Math.max(0, over).toFixed(3),
        scroll: phaseOf(run[0][0]), follows: followsScroll(run) });
    };
    for (let i = 1; i < s.length; i++) {
      if (s[i][pi + 1] === s[i - 1][pi + 1]) continue;
      if (s[i][0] - run[run.length - 1][0] > GAP) { flush(); run = [s[i - 1]]; }
      run.push(s[i]);
    }
    flush();
  }
}
// infinite loops (marquees, spinners) look like very long runs: separate them
const loops = segs.filter((g) => g.dur > 4000);
// designed tweens: clean curves of 120–2500 ms that do not just follow the scroll position
const anims = segs.filter((g) => g.dur >= 120 && g.dur <= 2500 && g.err < 0.012 && !g.follows);
const scrubs = segs.filter((g) => g.follows);
const med = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const pct = (xs, p) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null; };
const count = (xs) => xs.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
// stagger: same parent, same property, starts within 600 ms of each other
const staggers = [];
const byParent = {}; for (const g of anims) (byParent[g.parent + g.prop] ||= []).push(g);
for (const list of Object.values(byParent)) { list.sort((a, b) => a.start - b.start); for (let i = 1; i < list.length; i++) { const d = list[i].start - list[i - 1].start; if (d > 8 && d < 600) staggers.push(d); } }
// smooth scroll: after the single wheel notch, how long until scrollY settles
const wt = tOf("wheel"), sc = data.scroll || [];
let inertia = null;
if (wt != null && sc.length) {
  const after = sc.filter(([t]) => t >= wt - 50 && t <= wt + 1600);
  if (after.length > 3) { const y0 = after[0][1], y1 = after[after.length - 1][1]; const moved = after.filter(([, y]) => Math.abs(y - y1) > 1); inertia = { distance: y1 - y0, settleMs: moved.length ? moved[moved.length - 1][0] - after[0][0] : 0 }; }
}
const triggered = anims;
const summary = {
  url, status, title: data.title, generator: data.generator, libs: data.libs, canvases: data.canvases, fonts: data.fonts, customCursor: data.cursorNone,
  rafPerSecondIdle: med((data.raf || []).slice(-6)), sampledFps: Math.round(1000 / frameMs), longTasks: data.longTasks, cls: data.cls, docHeight: data.docHeight,
  smoothScroll: inertia ? { ...inertia, smooth: inertia.settleMs > 250 } : null,
  measured: { segments: anims.length, loops: loops.length,
    durationMs: { p25: pct(triggered.map((g) => g.dur), 0.25), median: med(triggered.map((g) => g.dur)), p75: pct(triggered.map((g) => g.dur), 0.75), max: pct(triggered.map((g) => g.dur), 0.98) },
    byProp: Object.fromEntries(PROPS.map((p) => [p, triggered.filter((g) => g.prop === p).length])),
    easing: count(triggered.map((g) => g.ease)),
    scrubLike: scrubs.length, byPhase: count(anims.map((g) => g.scroll)),
    travelY: { median: med(triggered.filter((g) => g.prop === "y").map((g) => Math.abs(g.to - g.from))), p75: pct(triggered.filter((g) => g.prop === "y").map((g) => Math.abs(g.to - g.from)), 0.75) },
    scaleFrom: med(triggered.filter((g) => g.prop === "scale").map((g) => g.from)),
    opacityFrom: med(triggered.filter((g) => g.prop === "opacity" && g.to > g.from).map((g) => g.from)),
    overshootShare: triggered.length ? +(triggered.filter((g) => g.overshoot > 0.02).length / triggered.length).toFixed(2) : 0,
    staggerMs: { median: med(staggers), p25: pct(staggers, 0.25), p75: pct(staggers, 0.75), n: staggers.length },
    introMs: (() => { const early = triggered.filter((g) => g.start < 6000); return early.length ? Math.max(...early.map((g) => g.start + g.dur)) : null; })(),
  },
  declared: (data.declared || []).slice(0, 60),
  examples: triggered.sort((a, b) => b.area - a.area).slice(0, 25),
};
writeFileSync(join(out, "study.json"), JSON.stringify({ summary, marks, segments: segs.slice(0, 4000) }, null, 1));
const L = summary.libs || {};
console.log(`${url} → ${status} · ${summary.title}`);
console.log(`Engines: ${Object.entries(L).filter(([, v]) => v && v !== 0).map(([k, v]) => (v === true ? k : `${k}=${v}`)).join(", ") || "nur CSS/keine erkannt"} · Canvas ${summary.canvases?.length || 0} · rAF/s im Leerlauf ${summary.rafPerSecondIdle} · Messrate ${summary.sampledFps} fps`);
console.log(`Gemessen: ${anims.length} Bewegungen (${summary.measured.scrubLike} scroll-gekoppelt), ${loops.length} Loops · Dauer Median ${summary.measured.durationMs.median} ms (P25 ${summary.measured.durationMs.p25}, P75 ${summary.measured.durationMs.p75}) · Weg Y Median ${summary.measured.travelY.median} px · Stagger Median ${summary.measured.staggerMs.median} ms`);
console.log(`Kurven: ${Object.entries(summary.measured.easing).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`Smooth Scroll: ${summary.smoothScroll ? `${summary.smoothScroll.smooth ? "ja" : "nein"}, ${summary.smoothScroll.settleMs} ms Nachlauf` : "?"} · Intro bis ${summary.measured.introMs} ms · CLS ${summary.cls} · Long Tasks ${summary.longTasks}`);
