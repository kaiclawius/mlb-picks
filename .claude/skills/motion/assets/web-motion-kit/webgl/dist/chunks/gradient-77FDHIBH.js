// motion kit WebGL layer · three.js r186 (MIT, © three.js authors) · built from src/ with build.mjs
import{b as p,d as g,e as x,f as b,g as C}from"./chunk-WASSK4JC.js";var d="attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }",P=`
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
}`;function F(i){let r=(i.dataset.glColors||"#0b1020,#4f46e5,#22d3ee,#f5f5f4").split(",").map(g);for(;r.length<4;)r.push(r[r.length-1]);let h=Number(i.dataset.glSpeed??1),A=Number(i.dataset.glGrain??.035);return p(i,({canvas:u})=>{let e=x(u);if(!e)return null;let{p:a,u:o}=b(e,d,P),c=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,c),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW);let s=e.getAttribLocation(a,"aPos"),f=0,n=0,v=1,m=1;return{resize(t,l,R){v=t,m=l,C(e,u,t,l,R)},render(t){f+=(t.pointer.x-f)*.04,n+=(t.pointer.y-n)*.04,e.useProgram(a),e.bindBuffer(e.ARRAY_BUFFER,c),e.enableVertexAttribArray(s),e.vertexAttribPointer(s,2,e.FLOAT,!1,0,0),e.uniform1f(o.uTime,t.t*h),e.uniform2f(o.uRes,v,m),e.uniform2f(o.uPointer,f,n),e.uniform1f(o.uProgress,t.progress),e.uniform1f(o.uGrain,A),e.uniform3fv(o.uC0,r[0]),e.uniform3fv(o.uC1,r[1]),e.uniform3fv(o.uC2,r[2]),e.uniform3fv(o.uC3,r[3]),e.drawArrays(e.TRIANGLES,0,3)},dispose(){e.isContextLost()||e.getExtension("WEBGL_lose_context")?.loseContext()}}})}export{F as gradient};
