// The cat graph: a force-directed network in the spirit of Obsidian's graph view, on a 2D canvas.
// Two cores ($BRINGACAT and catonboard), referrers as hubs, every buyer as a small node on its referrer;
// paired buyers also hang off catonboard. Nodes repel, links pull, new cats fly in with a pulse.
// mode "full": drag nodes, pan, zoom (ctrl/cmd + wheel, pinch on trackpads, or the buttons), hover to light up
// a node's neighbourhood, click to select. mode "ambient": the same view for the hero, hover only.
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const INK = "10,15,12", GREEN = "0,184,108", MINT = "#00d47e";
export const CORE = "$BRINGACAT", PAIR = "catonboard";

export function createGraph(canvas, { mode = "full", max = 700, onSelect = () => {}, onHover = () => {} } = {}) {
  const g = canvas.getContext("2d"), full = mode === "full";
  let W = 0, H = 0, dpr = 1, visible = true, alpha = 1, raf = 0, me = "";
  const view = { s: full ? 1 : 0.85, x: 0, y: 0 }, target = { ...view };
  const nodes = new Map(), list = [], edges = [], adj = new Map(), seen = new Set();
  let hover = null, selected = null, drag = null, now = performance.now(), autoFit = true;

  /* ---------- graph data ---------- */
  function node(id, kind, near) {
    let n = nodes.get(id);
    if (n) return n;
    const a = Math.random() * 6.283, r = kind === "cat" ? 30 : 120;
    n = { id, kind, x: (near?.x ?? 0) + Math.cos(a) * r, y: (near?.y ?? 0) + Math.sin(a) * r, vx: 0, vy: 0, deg: 0, cats: 0, sol: 0, born: now, fixed: false, recent: [] };
    if (kind === "core") { n.fixed = true; n.x = id === CORE ? -90 : 250; n.y = id === CORE ? 0 : 30; }
    nodes.set(id, n); list.push(n); adj.set(id, new Set());
    return n;
  }
  function link(a, b, kind) {
    if (adj.get(a.id).has(b.id)) return;
    adj.get(a.id).add(b.id); adj.get(b.id).add(a.id); a.deg++; b.deg++;
    edges.push({ a, b, kind, born: now });
  }
  // one referral: { ref, buyer, sol, pair, t }
  function add(e, animate = true) {
    const key = e.ref + "|" + e.buyer + "|" + e.t; if (seen.has(key)) return; seen.add(key);
    now = performance.now();
    const core = node(CORE, "core"), hub = node(e.ref, "hub", core);
    link(core, hub, "core");
    const cat = node("cat:" + e.buyer, "cat", hub); cat.label = e.buyer;
    if (!animate || RM) { cat.born = hub.born = now - 5000; }
    link(hub, cat, "ref");
    if (e.pair) link(cat, node(PAIR, "core"), "pair");
    hub.sol += Number(e.sol) || 0; if (!hub.recent.includes(e.buyer)) { hub.cats++; hub.recent.unshift(e.buyer); hub.recent.length = Math.min(hub.recent.length, 8); }
    if (list.length > max) prune();
    alpha = Math.max(alpha, animate ? 0.5 : 1);
    if (RM) settle();
  }
  function prune() {
    const cats = list.filter((n) => n.kind === "cat").sort((a, b) => a.born - b.born);
    for (const c of cats.slice(0, list.length - max)) {
      for (const o of adj.get(c.id)) { adj.get(o).delete(c.id); nodes.get(o).deg--; }
      nodes.delete(c.id); adj.delete(c.id); list.splice(list.indexOf(c), 1);
    }
    for (let i = edges.length - 1; i >= 0; i--) if (!nodes.has(edges[i].a.id) || !nodes.has(edges[i].b.id)) edges.splice(i, 1);
  }

  /* ---------- physics ---------- */
  const charge = (n) => (n.kind === "core" ? 9 : n.kind === "hub" ? 3 + Math.min(6, Math.sqrt(n.deg)) : 1);
  const rest = { core: 150, ref: 26, pair: 260 }, k = { core: 0.035, ref: 0.09, pair: 0.004 };
  function tick() {
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i], ca = charge(a);
      for (let j = i + 1; j < n; j++) {
        const b = list[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > 160000) continue; if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        const f = (ca * charge(b) * 38 * alpha) / d2, d = Math.sqrt(d2), fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    for (const e of edges) {
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.hypot(dx, dy) || 1;
      const len = e.kind === "ref" ? rest.ref + Math.sqrt(e.a.deg) * 6 : rest[e.kind];
      const f = (d - len) * k[e.kind] * alpha, fx = (dx / d) * f, fy = (dy / d) * f;
      e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
    }
    for (const p of list) {
      if (p.fixed || p === drag?.n) { p.vx = p.vy = 0; continue; }
      p.vx -= (p.x - 60) * 0.0012 * alpha; p.vy -= p.y * 0.0016 * alpha;
      p.vx *= 0.78; p.vy *= 0.78; p.x += p.vx; p.y += p.vy;
    }
    alpha = Math.max(drag ? 0.3 : 0, alpha * 0.985);
  }
  function settle() { alpha = 1; for (let i = 0; i < 260; i++) tick(); alpha = 0; if (autoFit) { autoFit = false; fit(); } draw(); }

  /* ---------- drawing ---------- */
  const sx = (x) => W / 2 + (x - 60) * view.s + view.x, sy = (y) => H / 2 + y * view.s + view.y;
  const wx = (x) => (x - W / 2 - view.x) / view.s + 60, wy = (y) => (y - H / 2 - view.y) / view.s;
  const radius = (n) => (n.kind === "core" ? 13 : n.kind === "hub" ? 4 + Math.min(9, Math.sqrt(n.deg) * 1.5) : 2.6);
  function lit() { const f = hover || selected; if (!f) return null; const s = new Set([f.id, ...adj.get(f.id)]); return s; }
  function draw() {
    now = performance.now();
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const L = lit(), sc = Math.max(0.6, Math.min(1.6, view.s));
    // links
    for (const e of edges) {
      const on = L && L.has(e.a.id) && L.has(e.b.id), age = Math.min(1, (now - e.born) / 900), ease = 1 - Math.pow(1 - age, 3);
      const x1 = sx(e.a.x), y1 = sy(e.a.y), x2 = sx(e.a.x + (e.b.x - e.a.x) * ease), y2 = sy(e.a.y + (e.b.y - e.a.y) * ease);
      if (e.kind === "pair") { g.setLineDash([3, 5]); g.strokeStyle = on ? `rgba(${GREEN},.7)` : `rgba(${GREEN},${L ? 0.05 : 0.18})`; }
      else g.strokeStyle = on ? `rgba(${GREEN},.9)` : age < 1 ? `rgba(${GREEN},${0.9 - 0.6 * ease})` : `rgba(${INK},${L ? 0.04 : e.kind === "core" ? 0.16 : 0.11})`;
      g.lineWidth = (on ? 1.6 : e.kind === "core" ? 1.1 : 0.9) * Math.min(1.3, sc);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]);
    }
    // nodes
    for (const n of list) {
      const x = sx(n.x), y = sy(n.y), r = radius(n) * sc, dim = L && !L.has(n.id), age = (now - n.born) / 1000;
      if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
      g.globalAlpha = dim ? 0.18 : 1;
      if (n.kind === "core") {
        g.fillStyle = n.id === CORE ? MINT : "#0a0f0c"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        g.strokeStyle = n.id === CORE ? "rgba(0,212,126,.28)" : "rgba(10,15,12,.12)"; g.lineWidth = 7 * sc; g.beginPath(); g.arc(x, y, r + 6 * sc, 0, 7); g.stroke();
      } else if (n.kind === "hub") {
        g.fillStyle = n === selected || n === hover ? "#00a862" : "#0a0f0c"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        if (n.id === me) { g.strokeStyle = MINT; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r + 5, 0, 7); g.stroke(); }
      } else {
        g.fillStyle = age < 1.2 ? MINT : n === hover ? "#00a862" : "#7fd8b0"; g.beginPath(); g.arc(x, y, age < 1.2 ? r * 1.6 : r, 0, 7); g.fill();
      }
      if (age < 1.4 && !RM) { const p = age / 1.4; g.strokeStyle = `rgba(0,212,126,${1 - p})`; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r + 22 * p, 0, 7); g.stroke(); }
      g.globalAlpha = 1;
    }
    // labels: cores always, hubs when zoomed in enough or lit, cats on hover
    g.font = `500 ${Math.round(11 * Math.min(1.2, sc))}px 'JetBrains Mono', monospace`; g.textBaseline = "middle";
    for (const n of list) {
      const show = n.kind === "core" || (n.kind === "hub" && ((view.s > 0.75 && n.deg > (full ? 2 : 4)) || L?.has(n.id) || n.id === me)) || n === hover;
      if (!show || (L && !L.has(n.id) && n.kind !== "core")) continue;
      const x = sx(n.x) + radius(n) * sc + 6, y = sy(n.y), t = n.kind === "cat" ? n.label : n.id;
      g.fillStyle = "rgba(255,255,255,.85)"; const w = g.measureText(t).width; g.fillRect(x - 3, y - 8, w + 6, 16);
      g.fillStyle = n.kind === "core" ? "#0a0f0c" : n.id === me ? "#007a47" : "#3d4943"; g.fillText(t, x, y);
    }
  }

  /* ---------- loop ---------- */
  function frame(t) {
    raf = 0; now = t;
    const moving = alpha > 0.004 || drag || Math.abs(target.s - view.s) > 0.001 || Math.abs(target.x - view.x) > 0.3 || Math.abs(target.y - view.y) > 0.3;
    const fresh = edges.length && now - edges[edges.length - 1].born < 1500 || list.some((n) => now - n.born < 1500);
    if (!RM) { view.s += (target.s - view.s) * 0.18; view.x += (target.x - view.x) * 0.18; view.y += (target.y - view.y) * 0.18; }
    else Object.assign(view, target);
    if (alpha > 0.004 || drag) tick();
    if (autoFit && alpha < 0.12 && list.length > 3) { autoFit = false; fit(); }
    draw();
    if (visible && !document.hidden && (moving || fresh || hover)) raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };

  /* ---------- interaction ---------- */
  function hit(px, py) {
    let best = null, bd = 1e9;
    for (const n of list) { const d = Math.hypot(sx(n.x) - px, sy(n.y) - py), r = Math.max(8, radius(n) * view.s + 4); if (d < r && d < bd) { bd = d; best = n; } }
    return best;
  }
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener("pointermove", (e) => {
    const [x, y] = pos(e);
    if (drag) {
      if (drag.n) { drag.n.x = wx(x); drag.n.y = wy(y); alpha = Math.max(alpha, 0.3); }
      else if (full) { target.x = view.x = drag.vx + (x - drag.x); target.y = view.y = drag.vy + (y - drag.y); }
      drag.moved = drag.moved || Math.hypot(x - drag.x, y - drag.y) > 4; wake(); return;
    }
    const h = hit(x, y); if (h !== hover) { hover = h; canvas.style.cursor = h ? "pointer" : full ? "grab" : "default"; onHover(h); wake(); }
  });
  canvas.addEventListener("pointerleave", () => { if (!drag) { hover = null; onHover(null); wake(); } });
  canvas.addEventListener("pointerdown", (e) => {
    const [x, y] = pos(e), n = hit(x, y);
    if (!full && !n) return;
    if (e.pointerType === "touch" && !n) return; // let the page scroll on phones
    drag = { n: full && n && n.kind !== "core" ? n : null, hitNode: n, x, y, vx: view.x, vy: view.y, moved: false };
    autoFit = false; canvas.setPointerCapture(e.pointerId); if (!drag.n && full) canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!drag) return; const d = drag; drag = null; canvas.style.cursor = hover ? "pointer" : full ? "grab" : "default";
    if (!d.moved) { selected = d.hitNode && d.hitNode !== selected ? d.hitNode : null; onSelect(selected); }
    wake();
  });
  if (full) canvas.addEventListener("wheel", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return; // plain scrolling keeps scrolling the page
    e.preventDefault(); autoFit = false; const [x, y] = pos(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.004));
  }, { passive: false });
  function zoomAt(x, y, f) {
    const s = Math.max(0.25, Math.min(4, target.s * f)), k2 = s / target.s;
    target.x = (target.x - (x - W / 2)) * k2 + (x - W / 2); target.y = (target.y - (y - H / 2)) * k2 + (y - H / 2); target.s = s; wake();
  }
  function fit() {
    if (!list.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const n of list) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
    const s = Math.max(0.3, Math.min(1.6, Math.min(W / (x1 - x0 + 240), H / (y1 - y0 + 110))));
    target.s = s; target.x = -((x0 + x1) / 2 + 30 - 60) * s; target.y = -((y0 + y1) / 2) * s; wake();
  }
  function focus(id) {
    const n = nodes.get(id); if (!n) return false;
    selected = n; onSelect(n); target.s = Math.max(target.s, 1.4); target.x = -(n.x - 60) * target.s; target.y = -n.y * target.s; wake(); return true;
  }

  /* ---------- size, visibility ---------- */
  function resize() { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); draw(); }
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(canvas);
  document.addEventListener("visibilitychange", wake);
  resize();
  node(CORE, "core"); node(PAIR, "core");

  return {
    add(e, animate) { add(e, animate); wake(); },
    setMe(id) { me = id; wake(); }, focus, fit, zoom: (f) => zoomAt(W / 2, H / 2, f),
    select(id) { selected = id ? nodes.get(id) || null : null; onSelect(selected); wake(); },
    find: (q) => { q = q.toLowerCase().replace(/^@?/, "@"); return list.find((n) => n.kind === "hub" && n.id.toLowerCase().startsWith(q))?.id; },
    get size() { return { nodes: list.length, links: edges.length, hubs: list.filter((n) => n.kind === "hub").length }; },
    neighbours: (id) => [...(adj.get(id) || [])],
  };
}
