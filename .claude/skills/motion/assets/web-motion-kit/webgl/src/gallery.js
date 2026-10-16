// Curved gallery: the images of a row are bent onto a cylinder and slide sideways while the section scrolls by;
// the bend deepens with scroll speed (the Landberg effect). Raw WebGL. The <img> elements stay in the HTML as
// the fallback, for accessibility and as the texture source (same-origin or CORS-enabled images only).
//   <div data-gl="gallery" data-gl-curve="0.35" data-gl-travel="1" data-gl-aspect="1.5"> <img src=… alt=…> … </div>
import { mount, gl as getGL, program, sizeCanvas } from "./core.js";

const vert = `
attribute vec2 aPos; attribute vec2 aUv;
uniform mat4 uProj; uniform float uCurve; uniform float uOffset; uniform float uScale; uniform float uCamZ;
varying vec2 vUv; varying float vShade;
void main(){
  vUv = aUv;
  vec2 p = aPos * uScale; p.x += uOffset;
  float R = 1.0 / max(uCurve, 0.0001);
  float a = p.x / R;
  vec3 q = vec3(R * sin(a), p.y, R * cos(a) - R - uCamZ);
  vShade = clamp(cos(a), 0.0, 1.0);
  gl_Position = uProj * vec4(q, 1.0);
}`;
const frag = `
precision mediump float;
uniform sampler2D uTex; uniform vec2 uCover; uniform float uFade;
varying vec2 vUv; varying float vShade;
void main(){
  vec2 uv = (vUv - 0.5) * uCover + 0.5;
  vec4 c = texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
  gl_FragColor = vec4(c.rgb * mix(0.5, 1.0, vShade) * uFade, uFade);
}`;
const perspective = (fovDeg, aspect, near, far) => { const f = 1 / Math.tan((fovDeg * Math.PI) / 360), nf = 1 / (near - far); return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]); };

export function gallery(el) {
  const imgs = [...el.querySelectorAll("img")];
  if (!imgs.length) return null;
  const curve = Number(el.dataset.glCurve ?? 0.35), travel = Number(el.dataset.glTravel ?? 1), gap = Number(el.dataset.glGap ?? 0.12), aspect = Number(el.dataset.glAspect ?? 1.5);
  el.classList.add("gl-gallery");
  return mount(el, async ({ canvas }) => {
    const g = getGL(canvas); if (!g) return null;
    const { p, u } = program(g, vert, frag);
    // plane of aspect × 1 with 48 columns so it can bend smoothly
    const cols = 48, pos = [], uv = [];
    for (let i = 0; i < cols; i++) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) { const x = (i + a) / cols; pos.push((x - 0.5) * aspect, b - 0.5); uv.push(x, b); }
    const mk = (data) => { const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, new Float32Array(data), g.STATIC_DRAW); return b; };
    const bPos = mk(pos), bUv = mk(uv), lPos = g.getAttribLocation(p, "aPos"), lUv = g.getAttribLocation(p, "aUv"), count = pos.length / 2;
    const items = await Promise.all(imgs.map(async (img, i) => {
      try { await img.decode(); } catch {}
      const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      let ok = false; try { g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img); ok = true; } catch (e) { console.warn("motion-webgl: image not usable as texture (CORS?)", img.src); }
      const ia = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      return { t, ok, x: i * (aspect + gap), cover: ia > aspect ? [aspect / ia, 1] : [1, ia / aspect], fade: 0 };
    }));
    if (!items.some((it) => it.ok)) return null;
    const total = items.length * (aspect + gap);
    let bend = 0, hover = 0, proj = perspective(35, 1, 0.1, 100);
    el.addEventListener("pointerenter", () => (hover = 1)); el.addEventListener("pointerleave", () => (hover = 0));
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    return {
      resize(w, h, dpr) { sizeCanvas(g, canvas, w, h, dpr); proj = perspective(35, w / h, 0.1, 100); },
      render(s) {
        bend = s.still ? 0 : bend + (Math.min(0.6, Math.abs(s.velocity) * 0.35) - bend) * 0.08;
        const shift = -s.progress * total * travel + aspect * 0.5;
        g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
        g.useProgram(p);
        g.bindBuffer(g.ARRAY_BUFFER, bPos); g.enableVertexAttribArray(lPos); g.vertexAttribPointer(lPos, 2, g.FLOAT, false, 0, 0);
        g.bindBuffer(g.ARRAY_BUFFER, bUv); g.enableVertexAttribArray(lUv); g.vertexAttribPointer(lUv, 2, g.FLOAT, false, 0, 0);
        g.uniformMatrix4fv(u.uProj, false, proj); g.uniform1f(u.uCurve, curve + bend); g.uniform1f(u.uCamZ, 3.2); g.uniform1f(u.uScale, 1 + hover * 0.02);
        for (const it of items) {
          if (!it.ok) continue;
          it.fade = s.still ? 1 : it.fade + (1 - it.fade) * 0.08;
          g.bindTexture(g.TEXTURE_2D, it.t); g.uniform1f(u.uOffset, it.x + shift); g.uniform2f(u.uCover, it.cover[0], it.cover[1]); g.uniform1f(u.uFade, it.fade);
          g.drawArrays(g.TRIANGLES, 0, count);
        }
      },
      dispose() { if (!g.isContextLost()) g.getExtension("WEBGL_lose_context")?.loseContext(); },
    };
  });
}
