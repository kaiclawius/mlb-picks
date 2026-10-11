(() => {
  const S = window.SITE || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Konfiguration aus config.js ---
  $$('[data-app]').forEach((a) => { if (S.appUrl && S.appUrl !== '#') a.href = S.appUrl; });
  for (const [id, url] of [['lnk-x', S.x], ['lnk-tg', S.telegram]]) {
    const a = document.getElementById(id);
    if (a && url) { a.href = url; a.hidden = false; a.rel = 'noopener noreferrer'; a.target = '_blank'; }
  }
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  for (const id of ['today', 'stamp-date']) { const el = document.getElementById(id); if (el) el.textContent = today; }

  // --- Contract-Adresse kopieren ---
  if (S.token) {
    $('#ca-addr').textContent = S.token;
    const btn = $('#ca-copy');
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(S.token);
      } catch {
        const range = document.createRange();
        range.selectNodeContents($('#ca-addr'));
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      }
      btn.textContent = 'Kopiert';
      setTimeout(() => (btn.textContent = 'Kopieren'), 1600);
    });
  }

  // --- Einblend-Effekte: Elemente sind immer sichtbar, die Animation läuft nur zusätzlich ---
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { threshold: 0.6 });
    $$('[data-anim]').forEach((el) => io.observe(el));
  }

  // --- Hero: Der Titel liegt unter einem Film aus Hype-Floskeln. Man wischt ihn weg. ---
  const stage = $('#stage');
  const cv = $('#dirt');
  const hint = $('#hint');
  if (!stage || !cv || reduceMotion || !cv.getContext) return;

  const SLOP = [
    '100x garantiert', 'Revolutionäre Web3-KI-Synergie', 'Kein Risiko, nur Mond', 'Exklusiver Presale, nur heute',
    'Dieser Coin ist anders', 'Alpha-Call', 'Früh dabei sein', 'FOMO ist real', 'Nächster 1000x', 'Die Zukunft ist jetzt',
  ];
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, radius = 60, wiped = false, sweepFrame = 0;

  function size() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.round(r.width); h = Math.round(r.height);
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    radius = Math.max(34, Math.min(88, h * 0.12));
  }

  function paintDirt() {
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#0D2230';
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.3; // Film, durch den der Titel noch zu erahnen ist
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.5;
    const fs = Math.max(22, Math.min(44, w / 15));
    ctx.font = `800 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.save();
    ctx.rotate(-0.09);
    let i = 0;
    for (let y = -h * 0.25; y < h * 1.35; y += fs * 1.28, i++) {
      const text = SLOP[i % SLOP.length].toUpperCase();
      const tw = ctx.measureText(text).width + fs * 1.2;
      for (let x = -((i * 137) % Math.max(tw, 1)); x < w * 1.5; x += tw) ctx.fillText(text, x, y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function erase(x, y) {
    const g = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  function stroke(a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (radius * 0.35)));
    for (let i = 1; i <= n; i++) erase(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n);
  }

  // Einmal automatisch wischen, damit der Titel ohne Zutun lesbar wird. Am Rand bleibt Dreck zum Spielen.
  function sweep(duration = 1700) {
    cancelAnimationFrame(sweepFrame);
    const rows = h < 300 ? [0.3, 0.7] : [0.2, 0.5, 0.8];
    const path = [];
    rows.forEach((fy, i) => {
      const left = { x: w * 0.07, y: h * fy }, right = { x: w * 0.93, y: h * fy };
      path.push(...(i % 2 === 0 ? [left, right] : [right, left]));
    });
    const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y));
    const total = lengths.reduce((a, b) => a + b, 0);
    const t0 = performance.now();
    let prev = path[0];
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      let d = eased * total, p = path[path.length - 1];
      for (let i = 0; i < lengths.length; i++) {
        if (d <= lengths[i]) { const k = d / lengths[i]; p = { x: path[i].x + (path[i + 1].x - path[i].x) * k, y: path[i].y + (path[i + 1].y - path[i].y) * k }; break; }
        d -= lengths[i];
      }
      stroke(prev, p); prev = p;
      if (t < 1) sweepFrame = requestAnimationFrame(tick);
      else if (!wiped && hint && matchMedia('(pointer: fine)').matches) hint.hidden = false;
    };
    sweepFrame = requestAnimationFrame(tick);
  }

  function start() { size(); paintDirt(); setTimeout(sweep, 350); }

  let last = null;
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    stroke(last || p, p);
    last = p;
    if (!wiped) { wiped = true; if (hint) hint.hidden = true; }
  });
  stage.addEventListener('pointerleave', () => { last = null; });

  let lastW = 0;
  new ResizeObserver(() => {
    const nw = Math.round(stage.getBoundingClientRect().width);
    if (!lastW) { lastW = nw; return; }
    if (Math.abs(nw - lastW) < 3) return; // Höhenänderungen (Adressleiste am Handy) ignorieren
    lastW = nw; size(); paintDirt(); sweep(700);
  }).observe(stage);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { paintDirt(); sweep(700); });

  // Erst zeichnen, wenn die Schrift da ist, sonst stimmen die Textbreiten nicht
  const fontReady = document.fonts && document.fonts.load ? document.fonts.load('800 32px "Barlow Condensed"') : Promise.resolve();
  Promise.race([fontReady, new Promise((r) => setTimeout(r, 1500))]).then(start);
})();
