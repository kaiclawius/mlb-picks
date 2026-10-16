// Shared WebGL plumbing for the kit, renderer-agnostic: one canvas per element, sized to it, paused when it is
// not visible, with a static fallback that stays until the first frame is drawn and comes back when the device is
// too slow or the context is lost. Scroll progress and pointer are computed here, so scenes need no scroll library.

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

/**
 * mount(el, setup): setup({ canvas, el, width, height, dpr }) → { render(state), resize?(w, h, dpr), dispose?() } (may be async).
 * state = { t (s), dt, progress (0..1 while el crosses the viewport), velocity (progress/s), pointer {x,y} in -1..1, still (reduced motion: draw final states) }
 */
export async function mount(el, setup) {
  const fallback = el.querySelector("[data-gl-fallback]");
  if (!hasWebGL()) { el.classList.add("gl-fallback"); return null; }
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", opacity: "0", transition: "opacity 600ms cubic-bezier(0.165,0.84,0.44,1)", pointerEvents: "none" });
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.prepend(canvas);
  let cap = Number(el.dataset.glDpr || 2);
  const size = () => { const r = el.getBoundingClientRect(); return [Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height))]; };
  let [w, h] = size(), dpr = Math.min(devicePixelRatio || 1, cap);
  const scene = await setup({ canvas, el, width: w, height: h, dpr });
  if (!scene) { canvas.remove(); el.classList.add("gl-fallback"); return null; }
  const still = reducedMotion() || el.hasAttribute("data-gl-still");
  const state = { t: 0, dt: 0, progress: 0, velocity: 0, pointer: { x: 0, y: 0 }, still };
  // performance guard: judged per 1.5 s of visible running time, so even a 5 fps device is caught within seconds
  const minDpr = Number(el.dataset.glMinDpr || (el.dataset.gl === "gradient" ? 0.5 : 1));
  let visible = false, running = false, winFrames = 0, winTime = 0, shown = false, dead = false, lastP = null, last = 0;
  const progressOf = () => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height))); };

  const frame = (now) => {
    if (!running || dead) return;
    const real = last ? (now - last) / 1000 : 1 / 60, dt = Math.min(0.1, real); last = now; state.dt = dt; if (!still) state.t += dt;
    const p = progressOf(); state.velocity = lastP == null ? 0 : (p - lastP) / Math.max(dt, 1e-3); lastP = p; state.progress = p;
    scene.render(state);
    if (!shown) { shown = true; canvas.style.opacity = "1"; fallback?.style.setProperty("opacity", "0"); el.classList.add("gl-live"); }
    if (!still) { winFrames++; winTime += real; if (winTime > 1.5) { const fps = winFrames / winTime; winFrames = 0; winTime = 0; if (fps < 24) return degrade(fps); } }
    if (still) { running = false; return; }
    requestAnimationFrame(frame);
  };
  // first fewer pixels (down to minDpr), then the static fallback
  const degrade = (fps) => {
    if (dpr > minDpr) { dpr = Math.max(minDpr, dpr / 2); cap = dpr; scene.resize?.(w, h, dpr); el.dataset.glDegraded = `dpr ${dpr} at ${fps.toFixed(0)} fps`; requestAnimationFrame(frame); return; }
    stop(); el.dataset.glDegraded = `off at ${fps.toFixed(0)} fps`;
  };
  const startLoop = () => { if (running || dead) return; running = true; last = 0; winFrames = 0; winTime = 0; requestAnimationFrame(frame); };
  const stopLoop = () => { running = false; };
  const stop = () => { if (dead) return; dead = true; stopLoop(); canvas.style.opacity = "0"; fallback?.style.setProperty("opacity", "1"); el.classList.remove("gl-live"); el.classList.add("gl-fallback"); scene.dispose?.(); };

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible && !document.hidden ? startLoop() : stopLoop(); }, { rootMargin: "100px" }).observe(el);
  document.addEventListener("visibilitychange", () => (document.hidden ? stopLoop() : visible && startLoop()));
  new ResizeObserver(() => { const [nw, nh] = size(); if (nw === w && nh === h) return; w = nw; h = nh; scene.resize?.(w, h, dpr); if (still) startLoop(); }).observe(el);
  if (matchMedia("(pointer: fine)").matches) addEventListener("pointermove", (e) => { const r = el.getBoundingClientRect(); state.pointer.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)); state.pointer.y = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1))); }, { passive: true });
  if (still) addEventListener("scroll", () => { if (visible) startLoop(); }, { passive: true });
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stop(); });
  scene.resize?.(w, h, dpr);
  return { stop, state };
}

export const ease = { inOut: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2), out: (x) => 1 - (1 - x) ** 4 };
export const hex = (c) => { const v = c.trim().replace("#", ""); const n = parseInt(v.length === 3 ? v.split("").map((x) => x + x).join("") : v, 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }; // sRGB, mixed like CSS gradients

// ---------- tiny raw-WebGL helpers (no library) ----------
export function gl(canvas) {
  const g = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
  return g;
}
export function program(g, vs, fs) {
  const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s)); return s; };
  const p = g.createProgram(); g.attachShader(p, sh(g.VERTEX_SHADER, vs)); g.attachShader(p, sh(g.FRAGMENT_SHADER, fs)); g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
  const u = new Proxy({}, { get: (c, k) => (k in c ? c[k] : (c[k] = g.getUniformLocation(p, k))) });
  return { p, u };
}
export function sizeCanvas(g, canvas, w, h, dpr) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); g.viewport(0, 0, canvas.width, canvas.height); }
