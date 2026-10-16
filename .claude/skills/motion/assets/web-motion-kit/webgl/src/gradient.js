// Mesh-gradient hero (the Stripe-style moving colour field): four brand colours flowing through domain-warped
// noise, a little pointer influence, fine grain. Raw WebGL, one fragment shader, a few KB.
//   <div data-gl="gradient" data-gl-colors="#0f1517,#2447c4,#4fd28a,#f6f9f5" data-gl-speed="1"> <img data-gl-fallback …> </div>
import { mount, gl as getGL, program, sizeCanvas, hex } from "./core.js";

const vert = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
const frag = `
precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec2 uPointer; uniform float uProgress; uniform float uGrain;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
void main(){
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.05;
  vec2 q = vec2(fbm(p * 1.3 + t), fbm(p * 1.3 - t + 3.1));
  vec2 r = vec2(fbm(p * 1.5 + 2.0 * q + vec2(1.7, 9.2) + t * 1.3), fbm(p * 1.5 + 2.0 * q + vec2(8.3, 2.8) - t));
  r += uPointer * 0.05 + vec2(0.0, uProgress * 0.3);
  float f = fbm(p * 1.1 + r * 1.8);
  vec3 col = mix(uC0, uC1, smoothstep(0.2, 0.7, f));
  col = mix(col, uC2, smoothstep(0.45, 1.0, length(q)) * 0.8);
  col = mix(col, uC3, smoothstep(0.6, 1.0, r.x) * 0.6);
  col += (h(vUv * uRes + fract(uTime)) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;

export function gradient(el) {
  const cols = (el.dataset.glColors || "#0b1020,#4f46e5,#22d3ee,#f5f5f4").split(",").map(hex);
  while (cols.length < 4) cols.push(cols[cols.length - 1]);
  const speed = Number(el.dataset.glSpeed ?? 1), grain = Number(el.dataset.glGrain ?? 0.035);
  return mount(el, ({ canvas }) => {
    const g = getGL(canvas); if (!g) return null;
    const { p, u } = program(g, vert, frag);
    const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    const loc = g.getAttribLocation(p, "aPos");
    let px = 0, py = 0, W = 1, H = 1;
    return {
      resize(w, h, dpr) { W = w; H = h; sizeCanvas(g, canvas, w, h, dpr); },
      render(s) {
        px += (s.pointer.x - px) * 0.04; py += (s.pointer.y - py) * 0.04;
        g.useProgram(p); g.bindBuffer(g.ARRAY_BUFFER, buf); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
        g.uniform1f(u.uTime, s.t * speed); g.uniform2f(u.uRes, W, H); g.uniform2f(u.uPointer, px, py); g.uniform1f(u.uProgress, s.progress); g.uniform1f(u.uGrain, grain);
        g.uniform3fv(u.uC0, cols[0]); g.uniform3fv(u.uC1, cols[1]); g.uniform3fv(u.uC2, cols[2]); g.uniform3fv(u.uC3, cols[3]);
        g.drawArrays(g.TRIANGLES, 0, 3);
      },
      dispose() { if (!g.isContextLost()) g.getExtension("WEBGL_lose_context")?.loseContext(); },
    };
  });
}
