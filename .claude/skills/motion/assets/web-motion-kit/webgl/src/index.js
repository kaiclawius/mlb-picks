// Entry of the kit's WebGL layer: <script type="module" src="webgl/dist/motion-webgl.js"> finds every [data-gl]
// element and mounts its scene when it comes near the viewport. Scenes load on demand: the gradient and gallery
// are raw WebGL (a few KB); three.js is only fetched when a page shows a 3D product.
import { hasWebGL } from "./core.js";

const SCENES = { gradient: () => import("./gradient.js"), gallery: () => import("./gallery.js"), product: () => import("./product.js") };
const mounted = new WeakSet();
function init() {
  const els = [...document.querySelectorAll("[data-gl]")];
  if (!els.length) return;
  if (!hasWebGL()) { els.forEach((el) => el.classList.add("gl-fallback")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting || mounted.has(e.target)) continue;
      const el = e.target; mounted.add(el); io.unobserve(el);
      const load = SCENES[el.dataset.gl];
      if (!load) { console.warn("motion-webgl: unknown scene", el.dataset.gl); continue; }
      load().then((m) => m[el.dataset.gl](el)).catch((err) => { console.warn("motion-webgl:", err); el.classList.add("gl-fallback"); });
    }
  }, { rootMargin: "300px" });
  els.forEach((el) => io.observe(el));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
