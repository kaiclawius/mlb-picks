// Web motion kit: award-level website motion from HTML attributes. No build step.
// Load after vendor/gsap.min.js, vendor/ScrollTrigger.min.js, vendor/SplitText.min.js (and vendor/lenis.min.js
// for smooth scroll), as <script type="module" src="motion.js">. Options on <html>:
//   data-m-smooth          smooth scroll with Lenis (desktop pointers only; never with reduced motion)
//   data-m-cursor          a cursor follower that grows over [data-cursor] (fine pointers only)
// Modules (data-m="…" on any element), see references/web-kit.md for every option:
//   reveal, reveal-children, lines, words, chars, wordmark, blur-in, type, highlight, image, parallax, pin,
//   counter, marquee, stamp, draw, magnetic, scrub-video, loader
// Everything is progressive: start states only exist under html.m-ready, which is set here once GSAP has loaded
// and the visitor has not asked for reduced motion. Otherwise the page is complete and still.
const { gsap, ScrollTrigger, SplitText } = window;
const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const num = (el, k, d) => (el.dataset[k] !== undefined && el.dataset[k] !== "" ? Number(el.dataset[k]) : d);
const EASE = { enter: "power4.out", quart: "power3.out", move: "power3.inOut", lux: "expo.out", pop: "back.out(2.2)" };
// power3 in GSAP = quart curve (cubic-bezier(0.165,0.84,0.44,1) family); power4 = quint, expo for luxury settles
const api = (window.Motion = { ready: false, reduced, lenis: null, refresh: () => ScrollTrigger?.refresh(), destroy: () => ctx?.revert() });
let ctx;

function staticFallback() {
  // reduced motion or missing GSAP: show final values, keep everything in place
  root.classList.remove("m-ready");
  document.querySelectorAll('[data-m="counter"]').forEach((el) => (el.textContent = format(el, num(el, "mTo", 0))));
  document.querySelectorAll('[data-m="loader"]').forEach((el) => el.remove());
  root.classList.add("m-static");
  document.dispatchEvent(new CustomEvent("motion:intro-done"));
}
const format = (el, v) => { const d = num(el, "mDecimals", 0); return (el.dataset.mPrefix || "") + v.toLocaleString(el.dataset.mLocale || undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + (el.dataset.mSuffix || ""); };

if (!gsap || !ScrollTrigger || reduced) staticFallback();
else start();

async function start() {
  gsap.registerPlugin(ScrollTrigger, ...(SplitText ? [SplitText] : []));
  root.classList.add("m-ready");
  api.ready = true;
  // smooth scroll: Lenis drives the scroll, ScrollTrigger listens, one ticker for both
  if (root.hasAttribute("data-m-smooth") && window.Lenis && fine) {
    const lenis = (api.lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true }));
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => { const t = document.querySelector(a.getAttribute("href")); if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -num(a, "mOffset", 0) }); } }));
  }
  // split text only with the final font, or lines break differently later (but never wait more than 1.5 s)
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
  ctx = gsap.context(() => {
    const loader = document.querySelector('[data-m="loader"]');
    const go = () => { MODULES.forEach(([sel, fn]) => document.querySelectorAll(sel).forEach((el) => { try { fn(el); } catch (e) { console.warn("motion:", sel, e); gsap.set(el, { clearProps: "all", visibility: "visible", opacity: 1 }); } })); ScrollTrigger.refresh(); };
    if (loader) intro(loader, go); else { go(); document.dispatchEvent(new CustomEvent("motion:intro-done")); }
    if (root.hasAttribute("data-m-cursor") && fine) cursor();
  });
}

// on enter: play once when the element's top passes 85 % of the viewport (or immediately if already visible)
const enter = (el, start = "top 85%") => ({ trigger: el, start: el.dataset.mStart || start, once: true });

const MODULES = [
  ['[data-m="reveal"]', (el) => gsap.fromTo(el, { autoAlpha: 0, y: num(el, "mY", 24) }, { autoAlpha: 1, y: 0, duration: num(el, "mDur", 0.9), delay: num(el, "mDelay", 0), ease: EASE.quart, scrollTrigger: enter(el), clearProps: "transform" })],
  ['[data-m="reveal-children"]', (el) => gsap.fromTo(el.children, { autoAlpha: 0, y: num(el, "mY", 24) }, { autoAlpha: 1, y: 0, duration: num(el, "mDur", 0.8), stagger: num(el, "mStagger", 0.08), delay: num(el, "mDelay", 0), ease: EASE.quart, scrollTrigger: enter(el), clearProps: "transform" })],
  ['[data-m="lines"],[data-m="words"],[data-m="chars"]', (el) => split(el, el.dataset.m)],
  ['[data-m="wordmark"]', (el) => split(el, "chars", { dur: num(el, "mDur", 1.1), stagger: num(el, "mStagger", 0.045), yPercent: el.dataset.mFrom === "top" ? -110 : 110, ease: EASE.enter })],
  ['[data-m="blur-in"]', (el) => gsap.fromTo(el, { autoAlpha: 0, filter: "blur(10px)", y: 8 }, { autoAlpha: 1, filter: "blur(0px)", y: 0, duration: num(el, "mDur", 0.8), delay: num(el, "mDelay", 0), ease: EASE.quart, scrollTrigger: enter(el), clearProps: "filter,transform" })],
  ['[data-m="type"]', typeIn],
  ['[data-m="highlight"]', highlight],
  ['[data-m="image"]', (el) => {
    const media = el.querySelector("img,video,picture,canvas") || el;
    const tl = gsap.timeline({ scrollTrigger: enter(el, "top 90%") });
    tl.fromTo(el, { clipPath: el.dataset.mFrom === "left" ? "inset(0 100% 0 0)" : "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: num(el, "mDur", 1.2), ease: EASE.move })
      .fromTo(media, { scale: num(el, "mScale", 1.18) }, { scale: 1, duration: num(el, "mDur", 1.2) + 0.4, ease: EASE.lux }, 0);
  }],
  ['[data-m="parallax"]', (el) => gsap.fromTo(el, { yPercent: -num(el, "mSpeed", 0.15) * 100 }, { yPercent: num(el, "mSpeed", 0.15) * 100, ease: "none", scrollTrigger: { trigger: el.parentElement || el, start: "top bottom", end: "bottom top", scrub: true } })],
  ['[data-m="pin"]', pin],
  ['[data-m="counter"]', (el) => { const o = { v: num(el, "mFrom", 0) }; el.style.fontVariantNumeric = "tabular-nums"; el.textContent = format(el, o.v); gsap.to(o, { v: num(el, "mTo", 0), duration: num(el, "mDur", 1.6), ease: "power2.out", scrollTrigger: enter(el), onUpdate: () => (el.textContent = format(el, o.v)) }); }],
  ['[data-m="marquee"]', (el) => { const t = el.querySelector(".m-track"); if (t && !el.dataset.mCloned) { el.dataset.mCloned = "1"; const c = t.cloneNode(true); c.setAttribute("aria-hidden", "true"); el.appendChild(c); } }],
  ['[data-m="stamp"]:not([data-m-on-step])', (el) => gsap.fromTo(el, { autoAlpha: 0, scale: num(el, "mScale", 1.8), rotate: num(el, "mRotate", -14) }, { autoAlpha: 1, scale: 1, rotate: num(el, "mRotateTo", -6), duration: 0.45, delay: num(el, "mDelay", 0), ease: EASE.pop, scrollTrigger: enter(el, "top 75%") })],
  ['[data-m="draw"]', (el) => {
    const paths = el.matches("path,line,polyline,circle,rect,ellipse") ? [el] : [...el.querySelectorAll("path,line,polyline,circle,rect,ellipse")];
    paths.forEach((p) => { const len = p.getTotalLength?.() || 1000; p.style.strokeDasharray = len; p.style.strokeDashoffset = len; });
    const scrub = el.hasAttribute("data-m-scrub");
    gsap.to(paths, { strokeDashoffset: 0, duration: num(el, "mDur", 1.6), stagger: num(el, "mStagger", 0.08), ease: scrub ? "none" : EASE.move, scrollTrigger: scrub ? { trigger: el, start: "top 80%", end: "bottom 40%", scrub: true } : enter(el) });
  }],
  ['[data-m="magnetic"]', (el) => {
    if (!fine) return;
    const s = num(el, "mStrength", 0.3), x = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" }), y = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
    el.addEventListener("pointermove", (e) => { const r = el.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * s); y((e.clientY - r.top - r.height / 2) * s); });
    el.addEventListener("pointerleave", () => { x(0); y(0); });
  }],
  ['[data-m="scrub-video"]', (el) => {
    const v = el.querySelector("video"); if (!v) return;
    v.pause(); v.muted = true; v.playsInline = true;
    const st = () => ScrollTrigger.create({ trigger: el, start: "top top", end: `+=${num(el, "mLength", 2) * 100}%`, pin: true, scrub: true, onUpdate: (s) => { if (v.duration) v.currentTime = s.progress * v.duration; } });
    if (v.readyState >= 1) st(); else v.addEventListener("loadedmetadata", st, { once: true });
  }],
];

// split text: lines (paragraphs), words, chars (display words only). Masked so pieces rise out of a clip.
function split(el, type, o = {}) {
  if (!SplitText) { gsap.set(el, { visibility: "visible" }); return; }
  const unit = type === "lines" ? "lines" : type === "words" ? "words" : "chars";
  const conf = { lines: { stagger: 0.08, dur: 1.0 }, words: { stagger: 0.04, dur: 0.9 }, chars: { stagger: 0.025, dur: 0.8 } }[unit];
  SplitText.create(el, {
    type: unit === "lines" ? "lines" : `${unit === "chars" ? "words,chars" : "words"}`, mask: unit, autoSplit: unit === "lines", aria: "auto",
    onSplit(self) {
      gsap.set(el, { visibility: "visible" });
      return gsap.fromTo(self[unit], { yPercent: o.yPercent ?? 110 }, { yPercent: 0, duration: o.dur ?? num(el, "mDur", conf.dur), stagger: o.stagger ?? num(el, "mStagger", conf.stagger), delay: num(el, "mDelay", 0), ease: o.ease ?? EASE.quart, scrollTrigger: enter(el) });
    },
  });
}

// words light up as the paragraph crosses the viewport (scrubbed); for one statement per page, not body text
function highlight(el) {
  if (!SplitText) return;
  const s = SplitText.create(el, { type: "words", aria: "auto" });
  gsap.fromTo(s.words, { opacity: num(el, "mDim", 0.16) }, { opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: el, start: el.dataset.mStart || "top 80%", end: el.dataset.mEnd || "bottom 45%", scrub: 0.4 } });
}

// typing: characters appear at a typist's pace with a caret (terminals, boot screens, chat)
function typeIn(el) {
  const text = el.textContent; const speed = num(el, "mSpeed", 0.035);
  el.setAttribute("aria-label", text); el.textContent = "";
  const span = document.createElement("span"); span.setAttribute("aria-hidden", "true"); const caret = document.createElement("i"); caret.className = "m-caret";
  el.append(span, caret); gsap.set(el, { visibility: "visible" });
  const o = { n: 0 };
  return gsap.to(o, { n: text.length, duration: text.length * speed, ease: "none", delay: num(el, "mDelay", 0), scrollTrigger: el.closest('[data-m="loader"]') ? undefined : enter(el), onUpdate: () => (span.textContent = text.slice(0, Math.round(o.n))), onComplete: () => { if (!el.hasAttribute("data-m-keep-caret")) caret.remove(); } });
}

// pinned story: the section stays while its steps take turns; --m-progress (0..1) is available to CSS
function pin(el) {
  const steps = [...el.querySelectorAll("[data-m-step]")];
  const stage = el.querySelector("[data-m-stage]") || el;
  el.classList.add("m-pinned");
  // elements that wait for a step: <span data-m="stamp" data-m-on-step="3"> appears when step 3 (0-based) is reached
  const waiting = [...el.querySelectorAll("[data-m-on-step]")].map((w) => ({ n: num(w, "mOnStep", steps.length - 1), on: false,
    tl: w.dataset.m === "stamp"
      ? gsap.fromTo(w, { autoAlpha: 0, scale: num(w, "mScale", 1.8), rotate: num(w, "mRotate", -14) }, { autoAlpha: 1, scale: 1, rotate: num(w, "mRotateTo", -6), duration: 0.45, ease: EASE.pop, paused: true })
      : gsap.fromTo(w, { autoAlpha: 0, y: num(w, "mY", 16) }, { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE.quart, paused: true }) }));
  let current = -1;
  const set = (i) => {
    if (i === current) return; current = i;
    steps.forEach((s, k) => (k === i ? s.setAttribute("data-active", "") : s.removeAttribute("data-active")));
    for (const w of waiting) { const on = i >= w.n; if (on !== w.on) { w.on = on; on ? w.tl.play() : w.tl.reverse(); } }
  };
  set(0);
  ScrollTrigger.create({
    trigger: el, pin: stage, start: "top top", end: `+=${Math.max(1, steps.length) * num(el, "mStepLength", 80)}%`, scrub: true, anticipatePin: 1,
    onUpdate: (s) => { el.style.setProperty("--m-progress", s.progress.toFixed(4)); if (steps.length) set(Math.min(steps.length - 1, Math.floor(s.progress * steps.length))); el.dispatchEvent(new CustomEvent("motion:progress", { detail: s.progress })); },
  });
}

// loader: counter 0 → 100 while assets load, then a curtain wipes up. Once per session, max ~2.5 s.
function intro(el, done) {
  const seen = (() => { try { return sessionStorage.getItem("m-intro") === "1"; } catch { return false; } })();
  const finish = () => { root.classList.add("m-intro-done"); el.remove(); done(); document.dispatchEvent(new CustomEvent("motion:intro-done")); };
  if (seen || el.hasAttribute("data-m-skip")) { finish(); return; }
  try { sessionStorage.setItem("m-intro", "1"); } catch {}
  const count = el.querySelector("[data-m-count]"), o = { v: 0 };
  const tl = gsap.timeline({ onComplete: finish });
  el.querySelectorAll('[data-m="type"]').forEach((t) => tl.add(typeIn(t), 0));
  if (count) tl.to(o, { v: 100, duration: num(el, "mDur", 1.3), ease: "power2.inOut", onUpdate: () => (count.textContent = String(Math.round(o.v)).padStart(3, "0")) }, 0);
  tl.to(el, { clipPath: "inset(0 0 100% 0)", duration: 0.8, ease: EASE.move }, ">0.15");
}

function cursor() {
  const c = document.createElement("div"); c.className = "m-cursor"; c.setAttribute("aria-hidden", "true"); c.appendChild(document.createElement("i")); document.body.appendChild(c);
  const x = gsap.quickTo(c, "x", { duration: 0.35, ease: "power3.out" }), y = gsap.quickTo(c, "y", { duration: 0.35, ease: "power3.out" });
  addEventListener("pointermove", (e) => { x(e.clientX); y(e.clientY); });
  document.addEventListener("pointerover", (e) => c.classList.toggle("m-cursor-big", !!e.target.closest("[data-cursor],a,button")));
}
