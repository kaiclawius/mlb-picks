import type { SiteSpec } from './spec.js';

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface RenderOptions {
  /** Relative oder absolute URLs der hochgeladenen Bilder, das erste ist das Hauptbild */
  images: string[];
  /** Token-Adresse, sobald der Coin existiert */
  mint?: string | null;
  /** Basis-URL der API für den Transparenz-Check, leer = gleiche Domain */
  apiBase?: string;
}

const PALETTE = {
  light: { bg: '#fffdf7', fg: '#1c1a14', card: '#ffffff', muted: '#6b6556' },
  dark: { bg: '#14120d', fg: '#f4efe2', card: '#1f1c14', muted: '#a8a08a' },
};

// Text auf Akzentfarbe: schwarz oder weiß je nach Helligkeit
function onAccent(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111111' : '#ffffff';
}

const WIDGET = `
(() => {
  const root = document.getElementById('check');
  const mint = root.dataset.mint;
  const list = root.querySelector('ul');
  const icons = { pass: '✓', fail: '✗', warn: '!', info: 'i' };
  const li = (status, label, detail) => {
    const el = document.createElement('li');
    el.className = status;
    const b = document.createElement('b'); b.textContent = icons[status] + ' ' + label;
    const p = document.createElement('p'); p.textContent = detail;
    el.append(b, p); list.append(el);
  };
  if (!mint) { li('info', 'Token noch nicht gestartet', 'Sobald der Coin existiert, erscheinen hier die Live-Kennzahlen.'); return; }
  fetch(root.dataset.api + '/api/check/' + encodeURIComponent(mint))
    .then((r) => r.json().then((j) => (r.ok ? j : Promise.reject(new Error(j.error || 'Fehler')))))
    .then((j) => j.checks.forEach((c) => li(c.status, c.label, c.detail)))
    .catch((e) => li('warn', 'Check nicht verfügbar', e.message));
})();`;

export function renderSite(spec: SiteSpec, opts: RenderOptions): string {
  const p = PALETTE[spec.mode];
  const [hero, ...gallery] = opts.images;
  const mint = opts.mint ?? '';
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.name)} ($${esc(spec.symbol)})</title>
<meta name="description" content="${esc(spec.tagline)}">
<style>
:root{--bg:${p.bg};--fg:${p.fg};--card:${p.card};--muted:${p.muted};--accent:${spec.accent};--on-accent:${onAccent(spec.accent)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.55 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:48px 16px}
.hero{text-align:center}
.hero img{width:200px;height:200px;object-fit:cover;border-radius:50%;border:4px solid var(--accent)}
h1{font-size:clamp(2rem,8vw,3.6rem);line-height:1.1;margin:18px 0 4px}
.sym{color:var(--accent);font-weight:800;font-size:1.3rem}
.tag{color:var(--muted);font-size:1.15rem;margin:8px 0 0}
section{margin-top:40px}
h2{font-size:1.2rem;margin:0 0 12px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.card{background:var(--card);border-radius:14px;padding:16px}
.card b{display:block;margin-bottom:4px}.card span{color:var(--muted);font-size:.95rem}
.ca{background:var(--card);border-radius:14px;padding:14px;word-break:break-all;font-family:ui-monospace,monospace;font-size:.9rem;text-align:center}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
.gallery img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}
#check ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
#check li{background:var(--card);border-radius:12px;padding:12px 14px;border-left:5px solid var(--muted)}
#check li p{margin:2px 0 0;color:var(--muted);font-size:.9rem}
#check li.pass{border-color:#2f9e44}#check li.fail{border-color:#e03131}#check li.warn{border-color:var(--accent)}
footer{margin-top:48px;color:var(--muted);font-size:.8rem;text-align:center}
</style>
</head>
<body>
<main>
<div class="hero">
${hero ? `<img src="${esc(hero)}" alt="">` : ''}
<h1>${esc(spec.name)}</h1>
<div class="sym">$${esc(spec.symbol)}</div>
<p class="tag">${esc(spec.tagline)}</p>
</div>
<section><p>${esc(spec.about)}</p></section>
<section><div class="cards">${spec.features.map((f) => `<div class="card"><b>${esc(f.title)}</b><span>${esc(f.text)}</span></div>`).join('')}</div></section>
${gallery.length ? `<section><div class="gallery">${gallery.map((g) => `<img src="${esc(g)}" alt="">`).join('')}</div></section>` : ''}
<section><h2>Contract-Adresse</h2><div class="ca">${mint ? esc(mint) : 'Noch nicht gestartet'}</div></section>
<section id="check" data-mint="${esc(mint)}" data-api="${esc(opts.apiBase ?? '')}"><h2>Live-Check aus der Blockchain</h2><ul></ul></section>
<footer>Memecoins sind reine Spekulation ohne inneren Wert. Keine Finanzberatung. Setze nur Geld ein, dessen Verlust du verkraftest.</footer>
</main>
<script>${WIDGET}</script>
</body>
</html>`;
}
