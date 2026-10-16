// 3D product with a camera that travels while the section scrolls by (the Moto / Apple style). Loads a GLB
// (data-gl-src) or builds a simple object in code ("card", "device", "orb") when there is no model yet.
// Camera keys: data-gl-keys='[{"p":0,"zoom":0.8,"orbit":[-0.5,0.25]},{"p":1,"zoom":1.3,"orbit":[0.45,-0.05],"rot":[0,0,0.05]}]'
//   p = scroll progress 0..1 of the element; zoom 1 = the object just fits the frame (any size, any aspect);
//   orbit = [yaw, pitch] of the camera around the object (radians); rot = extra object rotation (optional)
import { WebGLRenderer, SRGBColorSpace, Scene, PerspectiveCamera, Group, Mesh, MeshPhysicalMaterial, Color, HemisphereLight, DirectionalLight, PMREMGenerator, SphereGeometry, ACESFilmicToneMapping, Box3, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mount, ease } from "./core.js";

const builtins = {
  card: (c) => { const g = new Group(); g.add(new Mesh(new RoundedBoxGeometry(3.4, 2.15, 0.06, 6, 0.14), new MeshPhysicalMaterial({ color: c, metalness: 0.9, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 }))); const chip = new Mesh(new RoundedBoxGeometry(0.5, 0.38, 0.02, 3, 0.05), new MeshPhysicalMaterial({ color: "#c9a85a", metalness: 1, roughness: 0.3 })); chip.position.set(-1.0, 0.25, 0.04); g.add(chip); return g; },
  device: (c) => { const g = new Group(); g.add(new Mesh(new RoundedBoxGeometry(1.6, 3.3, 0.18, 8, 0.24), new MeshPhysicalMaterial({ color: c, metalness: 0.7, roughness: 0.25, clearcoat: 0.8 }))); const screen = new Mesh(new RoundedBoxGeometry(1.46, 3.12, 0.01, 4, 0.2), new MeshPhysicalMaterial({ color: "#0b0d10", roughness: 0.1, metalness: 0.2, clearcoat: 1 })); screen.position.z = 0.095; g.add(screen); return g; },
  orb: (c) => new Mesh(new SphereGeometry(1.3, 96, 64), new MeshPhysicalMaterial({ color: c, metalness: 0.1, roughness: 0.05, transmission: 0.6, thickness: 1.2, clearcoat: 1 })),
};

const lerp = (a, b, t) => a + (b - a) * t;
const keyAt = (keys, p) => {
  let i = 0; while (i < keys.length - 2 && p > keys[i + 1].p) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], k = b.p === a.p ? 0 : ease.inOut(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));
  const v = (o, key, n) => o[key] ?? Array(n).fill(0);
  return { zoom: lerp(a.zoom ?? 1, b.zoom ?? 1, k), orbit: v(a, "orbit", 2).map((x, j) => lerp(x, v(b, "orbit", 2)[j], k)), rot: v(a, "rot", 3).map((x, j) => lerp(x, v(b, "rot", 3)[j], k)) };
};

export function product(el) {
  const keys = JSON.parse(el.dataset.glKeys || '[{"p":0,"zoom":0.75,"orbit":[-0.6,0.3],"rot":[0,0,0.06]},{"p":0.5,"zoom":0.95,"orbit":[0,0.06]},{"p":1,"zoom":1.2,"orbit":[0.55,-0.08],"rot":[0,0,-0.04]}]');
  const color = new Color(el.dataset.glColor || "#1b1f27");
  return mount(el, ({ canvas, width, height }) => {
    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = Number(el.dataset.glExposure ?? 1.05);
    const scene = new Scene(), cam = new PerspectiveCamera(30, width / height, 0.1, 100);
    const pm = new PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new HemisphereLight("#ffffff", "#334", 0.6)); const key = new DirectionalLight("#ffffff", 1.6); key.position.set(3, 4, 5); scene.add(key);
    const holder = new Group(); scene.add(holder);
    const place = (obj) => { const box = new Box3().setFromObject(obj), s = new Vector3(); box.getSize(s); const c = box.getCenter(new Vector3()); obj.position.sub(c); const f = 3.2 / Math.max(s.x, s.y, s.z); obj.scale.setScalar(f); holder.add(obj); };
    if (el.dataset.glSrc) new GLTFLoader().load(el.dataset.glSrc, (g) => place(g.scene), undefined, () => place(builtins.card(color)));
    else place((builtins[el.dataset.glShape] || builtins.card)(color));
    let px = 0, py = 0;
    return {
      render(s) {
        const k = keyAt(keys, s.progress);
        px = lerp(px, s.pointer.x * 0.12, 0.05); py = lerp(py, s.pointer.y * 0.08, 0.05);
        // distance at which a sphere of radius 1.6 (the placed object) fits the frame, then zoom and orbit
        const fov = (cam.fov * Math.PI) / 180, fit = (1.75 / Math.tan(fov / 2)) / Math.min(1, cam.aspect), d = fit / Math.max(0.2, k.zoom);
        const yaw = k.orbit[0] + px, pitch = k.orbit[1] - py;
        cam.position.set(d * Math.sin(yaw) * Math.cos(pitch), d * Math.sin(pitch), d * Math.cos(yaw) * Math.cos(pitch)); cam.lookAt(0, 0, 0);
        holder.rotation.set(k.rot[0], k.rot[1] + Math.sin(s.t * 0.6) * 0.03, k.rot[2]);
        holder.position.y = Math.sin(s.t * 0.9) * 0.04; // idle float, ±0.04 units
        renderer.render(scene, cam);
      },
      resize(w, h, dpr) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); },
      dispose() { renderer.dispose(); renderer.forceContextLoss(); },
    };
  });
}
