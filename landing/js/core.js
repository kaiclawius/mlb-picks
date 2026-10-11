// Core: settings, smooth scrolling, header, progress bar, cursor and magnetic buttons.
// Everything animated is an enhancement. Without GSAP/Lenis, or with reduced motion, the page is plain and complete.
(() => {
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasLibs = !!(window.gsap && window.ScrollTrigger && window.Lenis);
  const SM = (window.SM = { $, $$, root, S: window.SITE || {}, anim: !reduce && hasLibs, started: false, lenis: null });

  // --- Settings from config.js ---
  $$('[data-app]').forEach((a) => { if (SM.S.appUrl && SM.S.appUrl !== '#') a.href = SM.S.appUrl; });
  for (const [id, url] of [['lnk-x', SM.S.x], ['lnk-tg', SM.S.telegram]]) {
    const a = document.getElementById(id);
    if (a && url) { a.href = url; a.hidden = false; a.rel = 'noopener noreferrer'; a.target = '_blank'; }
  }
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  for (const id of ['today', 'stamp-date']) { const el = document.getElementById(id); if (el) el.textContent = today; }

  // --- Copy contract address ---
  if (SM.S.token) {
    $('#ca-addr').textContent = SM.S.token;
    const btn = $('#ca-copy');
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(SM.S.token); }
      catch {
        const range = document.createRange(); range.selectNodeContents($('#ca-addr'));
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      }
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = 'Copy'), 1600);
    });
  }

  const progress = $('.progress i');
  if (!SM.anim) {
    // Plain mode: native scrolling, progress bar from the scroll position
    let raf = 0;
    addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
      });
    }, { passive: true });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  root.classList.add('anim');
  document.body.classList.add('is-loading');

  // --- Smooth scrolling ---
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.stop();
  SM.lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const bar = $('#bar');
  const setProgress = gsap.quickSetter(progress, 'scaleX');
  lenis.on('scroll', ({ scroll, direction, progress: p }) => {
    setProgress(p || 0);
    bar.classList.toggle('is-hidden', direction === 1 && scroll > 240);
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 ? document.querySelector(id) : null;
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: id === '#top' ? 0 : -64, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
  });

  // --- Start and failsafe ---
  SM.start = () => {
    if (SM.started) return;
    SM.started = true;
    clearTimeout(failTimer);
    root.classList.add('is-started');
    document.body.classList.remove('is-loading');
    lenis.start();
    window.dispatchEvent(new Event('sm:start'));
  };
  // If the intro never finishes, show everything instead of leaving the page hidden
  SM.release = () => {
    root.classList.remove('anim');
    document.body.classList.remove('is-loading');
    lenis.destroy();
    ScrollTrigger.getAll().forEach((t) => t.kill());
    gsap.set($$('[style]'), { clearProps: 'transform,opacity,visibility' });
    const pre = $('#pre'); if (pre) pre.remove();
  };
  const failTimer = setTimeout(() => { if (!SM.started) SM.release(); }, 7000);

  // --- Cursor and magnetic buttons (mouse only) ---
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const cursor = $('.cursor');
    const label = $('.cursor__label');
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
    addEventListener('pointermove', (e) => {
      if (!cursor.classList.contains('is-live')) { gsap.set(cursor, { x: e.clientX, y: e.clientY }); cursor.classList.add('is-live'); }
      xTo(e.clientX); yTo(e.clientY);
    }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-live'));
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor], a, button, summary, [role="tab"]');
      const text = t && t.dataset.cursor;
      cursor.classList.toggle('is-label', !!text);
      cursor.classList.toggle('is-link', !!t && !text);
      if (text) label.textContent = text;
    });
    $$('.btn').forEach((btn) => {
      const x = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' });
      const y = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.22);
        y((e.clientY - (r.top + r.height / 2)) * 0.32);
      });
      btn.addEventListener('pointerleave', () => { x(0); y(0); });
    });
  }
})();
