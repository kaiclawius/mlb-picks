// motion kit WebGL layer · three.js r186 (MIT, © three.js authors) · built from src/ with build.mjs
import{b as P,e as C,f as F,g as y}from"./chunk-WASSK4JC.js";var N=`
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
}`,O=`
precision mediump float;
uniform sampler2D uTex; uniform vec2 uCover; uniform float uFade;
varying vec2 vUv; varying float vShade;
void main(){
  vec2 uv = (vUv - 0.5) * uCover + 0.5;
  vec4 c = texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
  gl_FragColor = vec4(c.rgb * mix(0.5, 1.0, vShade) * uFade, uFade);
}`,h=(a,l,i,s)=>{let c=1/Math.tan(a*Math.PI/360),n=1/(i-s);return new Float32Array([c/l,0,0,0,0,c,0,0,0,0,(s+i)*n,-1,0,0,2*s*i*n,0])};function M(a){let l=[...a.querySelectorAll("img")];if(!l.length)return null;let i=Number(a.dataset.glCurve??.35),s=Number(a.dataset.glTravel??1),c=Number(a.dataset.glGap??.12),n=Number(a.dataset.glAspect??1.5);return a.classList.add("gl-gallery"),P(a,async({canvas:T})=>{let e=C(T);if(!e)return null;let{p:m,u}=F(e,N,O),b=48,d=[],g=[];for(let t=0;t<b;t++)for(let[o,r]of[[0,0],[1,0],[0,1],[1,0],[1,1],[0,1]]){let f=(t+o)/b;d.push((f-.5)*n,r-.5),g.push(f,r)}let _=t=>{let o=e.createBuffer();return e.bindBuffer(e.ARRAY_BUFFER,o),e.bufferData(e.ARRAY_BUFFER,new Float32Array(t),e.STATIC_DRAW),o},L=_(d),B=_(g),x=e.getAttribLocation(m,"aPos"),p=e.getAttribLocation(m,"aUv"),D=d.length/2,E=await Promise.all(l.map(async(t,o)=>{try{await t.decode()}catch{}let r=e.createTexture();e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let f=!1;try{e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t),f=!0}catch{console.warn("motion-webgl: image not usable as texture (CORS?)",t.src)}let A=(t.naturalWidth||1)/(t.naturalHeight||1);return{t:r,ok:f,x:o*(n+c),cover:A>n?[n/A,1]:[1,A/n],fade:0}}));if(!E.some(t=>t.ok))return null;let S=E.length*(n+c),v=0,R=0,U=h(35,1,.1,100);return a.addEventListener("pointerenter",()=>R=1),a.addEventListener("pointerleave",()=>R=0),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),{resize(t,o,r){y(e,T,t,o,r),U=h(35,t/o,.1,100)},render(t){v=t.still?0:v+(Math.min(.6,Math.abs(t.velocity)*.35)-v)*.08;let o=-t.progress*S*s+n*.5;e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(m),e.bindBuffer(e.ARRAY_BUFFER,L),e.enableVertexAttribArray(x),e.vertexAttribPointer(x,2,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,B),e.enableVertexAttribArray(p),e.vertexAttribPointer(p,2,e.FLOAT,!1,0,0),e.uniformMatrix4fv(u.uProj,!1,U),e.uniform1f(u.uCurve,i+v),e.uniform1f(u.uCamZ,3.2),e.uniform1f(u.uScale,1+R*.02);for(let r of E)r.ok&&(r.fade=t.still?1:r.fade+(1-r.fade)*.08,e.bindTexture(e.TEXTURE_2D,r.t),e.uniform1f(u.uOffset,r.x+o),e.uniform2f(u.uCover,r.cover[0],r.cover[1]),e.uniform1f(u.uFade,r.fade),e.drawArrays(e.TRIANGLES,0,D))},dispose(){e.isContextLost()||e.getExtension("WEBGL_lose_context")?.loseContext()}}})}export{M as gallery};
