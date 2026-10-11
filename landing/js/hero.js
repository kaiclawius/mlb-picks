// Hero: preloader, intro sequence and the wipe-away slop film over the title.
(() => {
  const SM = window.SM;
  if (!SM || !SM.anim) return;
  const { $, $$ } = SM;

  // --- The slop film: a canvas over the title that the visitor wipes away ---
  const stage = $('#stage'), cv = $('#dirt'), hint = $('#hint');
  const SLOP = [
    '100x guaranteed', 'Revolutionary Web3 AI synergy', 'No risk, only moon', 'Exclusive presale, today only',
    'This coin is different', 'Alpha call', 'Get in early', 'FOMO is real', 'Next 1000x', 'The future is now',
  ];
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, radius = 60, wiped = false, sweepFrame = 0, last = null;

  function size() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.round(r.width); h = Math.round(r.height);
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    radius = Math.max(34, Math.min(88, h * 0.12));
  }
  function paint() {
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#0D2230';
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.3; // film that still lets the title show through
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.5;
    const fs = Math.max(22, Math.min(44, w / 15));
    ctx.font = `800 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
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
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  function stroke(a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (radius * 0.35)));
    for (let i = 1; i <= n; i++) erase(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n);
  }
  // Wipe once on its own so the title is readable without interaction. Some slop stays at the edges to play with.
  function sweep(duration = 1700) {
    cancelAnimationFrame(sweepFrame);
    const rows = h < 300 ? [0.3, 0.7] : [0.2, 0.5, 0.8];
    const path = [];
    rows.forEach((fy, i) => {
      const l = { x: w * 0.07, y: h * fy }, r = { x: w * 0.93, y: h * fy };
      path.push(...(i % 2 === 0 ? [l, r] : [r, l]));
    });
    const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y));
    const total = lengths.reduce((a, b) => a + b, 0);
    const t0 = performance.now();
    let prev = path[0];
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      let d = e * total, p = path[path.length - 1];
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

  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    stroke(last || p, p); last = p;
    if (!wiped) { wiped = true; if (hint) hint.hidden = true; }
  });
  stage.addEventListener('pointerleave', () => { last = null; });

  let lastW = 0;
  new ResizeObserver(() => {
    const nw = Math.round(stage.getBoundingClientRect().width);
    if (!lastW) { lastW = nw; return; }
    if (Math.abs(nw - lastW) < 3 || !SM.started) return; // ignore height-only changes (phone address bar)
    lastW = nw; size(); paint(); sweep(700);
  }).observe(stage);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (SM.started) { paint(); sweep(700); } });

  // --- Preloader: an inspection log counts to 100, then the tiles drop away ---
  function preloader() {
    return new Promise((resolve) => {
      const pre = $('#pre');
      let seen = false;
      try { seen = sessionStorage.getItem('sm-seen') === '1'; } catch (e) { /* storage blocked */ }
      if (!pre || seen) { if (pre) pre.remove(); return resolve(); }

      const cell = 72;
      const cols = Math.ceil(innerWidth / cell), rows = Math.ceil(innerHeight / cell);
      const grid = document.createElement('div');
      grid.className = 'pre__grid';
      grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      const cells = [];
      for (let i = 0; i < cols * rows; i++) { const c = document.createElement('i'); grid.append(c); cells.push(c); }
      pre.prepend(grid);
      pre.style.background = 'transparent';

      const count = $('#pre-count');
      const o = { v: 0 };
      const tl = gsap.timeline({
        onComplete: () => { try { sessionStorage.setItem('sm-seen', '1'); } catch (e) { /* ignore */ } pre.remove(); resolve(); },
      });
      tl.to('.pre__log span', { opacity: 1, y: 0, duration: 0.3, stagger: 0.32, ease: 'power2.out' }, 0.1)
        .to(o, { v: 100, duration: 1.5, ease: 'power2.inOut', onUpdate: () => { count.textContent = String(Math.round(o.v)).padStart(3, '0'); } }, 0)
        .to('.pre__ui', { opacity: 0, duration: 0.3 }, 1.65)
        .to(cells, { scale: 0, duration: 0.5, ease: 'power3.inOut', stagger: { grid: [rows, cols], from: 'center', amount: 0.7 } }, 1.7);
      const skip = () => tl.timeScale(5);
      addEventListener('keydown', skip, { once: true });
      pre.addEventListener('pointerdown', skip, { once: true });
    });
  }

  function intro() {
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    // Explicit y on both ends: GSAP would otherwise read the CSS start offset as pixels and keep it
    tl.fromTo('.line > span', { yPercent: 112, y: 0 }, { yPercent: 0, y: 0, duration: 1.1, stagger: 0.1 }, 0)
      .fromTo('[data-intro]', { opacity: 0, y: 22 }, {
        opacity: 1, y: 0, duration: 0.9, stagger: 0.12,
        // Mark as revealed before dropping the inline values, otherwise the CSS start state would apply again
        onComplete: function () { this.targets().forEach((el) => { el.classList.add('revealed'); gsap.set(el, { clearProps: 'all' }); }); },
      }, 0.35)
      .add(() => sweep(), 0.7);
  }

  const fontsReady = document.fonts && document.fonts.load ? document.fonts.load('800 32px "Barlow Condensed"') : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(async () => {
    size(); paint();
    await preloader();
    SM.start();
    intro();
  });
})();
