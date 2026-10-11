// Scenes: ticker, manifesto, sequence diagram, live-check demo, counters, reveals, footer wordmark.
(() => {
  const SM = window.SM;
  if (!SM) return;
  const { $, $$, root } = SM;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // --- Live-check demo (works with and without animation) ---
  const ICONS = { pass: 'i-check', warn: 'i-warn', fail: 'i-x', info: 'i-info' };
  const TAGS = { pass: 'OK', warn: 'Warning', fail: 'Danger', info: 'Info' };
  const DEMO = {
    clean: {
      obj: '$CLEAN', verdict: ['Looks clean', 'ok', 1],
      rows: [
        ['pass', 'Mint authority revoked', 'No new tokens can be created.'],
        ['pass', 'Freeze authority revoked', 'Wallets cannot be frozen.'],
        ['pass', 'No dangerous extensions', 'No permanent delegate, transfer hook or pausing.'],
        ['info', 'Distribution', 'Excluding the bonding curve, the largest account holds 8.2% of circulating tokens and the top 10 hold 21.5%.'],
      ],
    },
    whale: {
      obj: '$WHALE', verdict: ['Proceed with care', 'warn', 2],
      rows: [
        ['pass', 'Mint authority revoked', 'No new tokens can be created.'],
        ['pass', 'Freeze authority revoked', 'Wallets cannot be frozen.'],
        ['pass', 'No dangerous extensions', 'No permanent delegate, transfer hook or pausing.'],
        ['warn', 'Heavily concentrated distribution', 'Excluding the bonding curve, the largest account holds 41.3% of circulating tokens and the top 10 hold 78.0%.'],
      ],
    },
    trap: {
      obj: '$TRAP', verdict: ['Walk away', 'bad', 4],
      rows: [
        ['fail', 'Mint authority active', 'A single wallet can create unlimited new tokens at any time.'],
        ['fail', 'Freeze authority active', 'A single wallet can freeze your tokens.'],
        ['fail', 'Dangerous token extension', 'permanentDelegate: a third party can pull tokens out of any wallet.'],
        ['warn', 'Heavily concentrated distribution', 'Excluding the bonding curve, the largest account holds 71.0% of circulating tokens.'],
      ],
    },
  };
  (function demo() {
    const tabs = $$('.demo__tabs [role="tab"]');
    const panel = $('#demo-panel'), rowsEl = $('#demo-rows'), verdict = $('#demo-verdict');
    if (!tabs.length || !rowsEl) return;
    function show(key, animate) {
      const d = DEMO[key];
      $('#demo-object').textContent = `Object: ${d.obj}`;
      rowsEl.innerHTML = d.rows.map(([s, title, text]) => `<li class="chk ${s}"><span class="ic"><svg aria-hidden="true"><use href="#${ICONS[s]}"/></svg></span><span class="st"><b>${title}</b><span class="tag">${TAGS[s]}</span></span><p>${text}</p></li>`).join('');
      const [label, tone, level] = d.verdict;
      verdict.className = `verdict tone-${tone}`;
      $('#demo-verdict-text').textContent = label;
      $$('.meter i', verdict).forEach((i, n) => i.classList.toggle('on', n < level));
      if (animate && SM.anim) {
        gsap.fromTo($$('.chk', rowsEl), { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.16, ease: 'power3.out', clearProps: 'transform' });
        gsap.fromTo(verdict, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.7, ease: 'power3.out', clearProps: 'transform' });
      }
    }
    function select(tab, focus) {
      tabs.forEach((t) => { const on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
      panel.setAttribute('aria-labelledby', tab.id);
      show(tab.dataset.demo, true);
      if (focus) tab.focus();
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t, false));
      t.addEventListener('keydown', (e) => {
        const move = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (move) { e.preventDefault(); select(tabs[(i + move + tabs.length) % tabs.length], true); }
        else if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
        else if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
  })();

  // --- Footer wordmark: size it so the whole word fits the container exactly ---
  (function fitWord() {
    const word = $('#word');
    if (!word) return;
    const text = word.textContent.trim().toUpperCase();
    const c = document.createElement('canvas').getContext('2d');
    function fit() {
      c.font = '800 100px "Barlow Condensed", "Arial Narrow", sans-serif';
      const em = c.measureText(text).width / 100;
      const available = word.parentElement.clientWidth - 2 * parseFloat(getComputedStyle(word.parentElement).paddingLeft);
      if (em > 0) word.style.fontSize = `${Math.floor((available / em) * 0.97)}px`;
    }
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    let lastW = innerWidth;
    addEventListener('resize', () => { if (innerWidth !== lastW) { lastW = innerWidth; fit(); } });
  })();

  if (!SM.anim) return;

  // --- Ticker: slop against receipts. Scroll speed pushes the rows and skews them. ---
  (function ticker() {
    const wrap = $('.ticker');
    const rows = $$('.ticker__row', wrap).map((row) => {
      const track = $('.ticker__track', row);
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const originals = [...track.children];
      const unit = track.scrollWidth + gap;
      for (let sets = 1; track.scrollWidth < innerWidth * 2 + unit && sets < 10; sets++) {
        originals.forEach((n) => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.append(c); });
      }
      const dir = Number(row.dataset.dir) || -1;
      return { track, dir, unit, x: dir < 0 ? 0 : -unit, skew: 0, setX: gsap.quickSetter(track, 'x', 'px'), setSkew: gsap.quickSetter(track, 'skewX', 'deg') };
    });
    let active = false;
    ScrollTrigger.create({ trigger: wrap, start: 'top bottom', end: 'bottom top', onToggle: (s) => { active = s.isActive; } });
    gsap.ticker.add((time, dt) => {
      if (!active) return;
      const v = SM.lenis ? SM.lenis.velocity : 0;
      const f = dt / 16.67;
      for (const r of rows) {
        r.x += r.dir * (0.7 + Math.min(Math.abs(v) * 0.6, 22)) * f;
        if (r.dir < 0 && r.x <= -r.unit) r.x += r.unit;
        if (r.dir > 0 && r.x >= 0) r.x -= r.unit;
        r.skew += (clamp(-v * 0.4, -9, 9) - r.skew) * 0.12 * f;
        r.setX(r.x); r.setSkew(r.skew);
      }
    });
  })();

  // --- Manifesto: words light up as you scroll ---
  (function manifesto() {
    const sec = $('#manifesto');
    if (!sec) return;
    const words = [];
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((tok) => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.append(tok); return; }
          const s = document.createElement('span'); s.className = 'w'; s.textContent = tok; frag.append(s); words.push(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk($('#manifesto-title')); walk($('#manifesto-body'));
    const n = words.length;
    words.forEach((w) => { w.style.opacity = 0.14; });
    ScrollTrigger.create({
      trigger: sec, start: 'top 72%', end: 'bottom 62%',
      onUpdate: (self) => { words.forEach((w, i) => { w.style.opacity = (0.14 + 0.86 * clamp(self.progress * (n + 4) - i, 0, 3) / 3).toFixed(3); }); },
    });
  })();

  // --- Sequence diagram: scrolling steps through the launch flow ---
  (function scene() {
    const sec = $('#process');
    if (!sec) return;
    const msgs = $$('.seq .msg', sec);
    const lis = $$('.steps li', sec);
    const n = lis.length;
    const steps = lis.map((li) => ({ title: $('b', li).textContent, desc: $('span', li).textContent, who: li.dataset.who }));
    const els = { idx: $('#step-idx'), title: $('#step-title'), desc: $('#step-desc'), who: $('#step-who'), now: $('.now', sec), ticks: $('#ticks') };
    let cur = -1, st = null;

    const tickBtns = steps.map((s, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.tabIndex = -1;
      b.setAttribute('aria-label', `Step ${i + 1}: ${s.title}`);
      b.addEventListener('click', () => goTo(i));
      els.ticks.append(b);
      return b;
    });
    function setStep(i) {
      if (i === cur) return;
      cur = i;
      msgs.forEach((m, j) => { m.classList.toggle('is-done', j < i); m.classList.toggle('is-active', j === i); });
      els.idx.textContent = String(i + 1).padStart(2, '0');
      els.title.textContent = steps[i].title; els.desc.textContent = steps[i].desc; els.who.textContent = steps[i].who;
      els.now.classList.remove('swap'); void els.now.offsetWidth; els.now.classList.add('swap');
      tickBtns.forEach((b, j) => { b.classList.toggle('done', j < i); b.classList.toggle('active', j === i); });
    }
    function goTo(i) {
      const top = scrollY + sec.getBoundingClientRect().top;
      SM.lenis.scrollTo(top + ((i + 0.5) / n) * (sec.offsetHeight - innerHeight), { duration: 1.1 });
    }
    function enable() {
      root.classList.add('scrolly');
      setStep(0);
      st = ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (s) => setStep(Math.min(n - 1, Math.floor(s.progress * n))) });
      ScrollTrigger.refresh();
    }
    function disable() {
      root.classList.remove('scrolly');
      if (st) st.kill();
      st = null; cur = -1;
      msgs.forEach((m) => m.classList.remove('is-done', 'is-active'));
    }
    const mq = matchMedia('(min-width: 960px)');
    const apply = () => (mq.matches ? enable() : disable());
    apply();
    mq.addEventListener('change', apply);
  })();

  // --- Counters, reveals, stamps, footer wordmark ---
  $$('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(o, { v: target, duration: 1.1, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v); } }),
    });
  });

  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%', once: true,
    onEnter: (batch) => gsap.fromTo(batch, { opacity: 0, y: 30 }, {
      opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', overwrite: true,
      onComplete: () => batch.forEach((el) => { el.classList.add('revealed'); gsap.set(el, { clearProps: 'all' }); }),
    }),
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { threshold: 0.6 });
    $$('[data-anim]').forEach((el) => io.observe(el));
  }

  const word = $('#word');
  if (word) {
    ScrollTrigger.create({
      trigger: word, start: 'top 88%', once: true,
      onEnter: () => { word.classList.add('is-in'); setTimeout(() => word.classList.remove('is-in'), 1900); },
    });
  }

  // Anything above the viewport on load (reload in the middle of the page) must not stay hidden
  addEventListener('sm:start', () => {
    ScrollTrigger.refresh();
    $$('[data-reveal]').forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight * 0.9 && getComputedStyle(el).opacity === '0') { el.classList.add('revealed'); gsap.set(el, { clearProps: 'all' }); }
    });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
