#!/usr/bin/env node
// Finds the mistakes that make motion flicker, differ between renders, or hurt people, before you render.
//   node lint-motion.mjs <dir-or-files...>
// Remotion files (anything importing "remotion"): non-determinism, CSS-driven animation, deprecated APIs, network fonts.
// Web files (.css/.scss/.html/.jsx/.tsx/.vue/.svelte): layout-thrashing properties, missing reduced-motion support, slow UI timings.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const targets = process.argv.slice(2);
if (!targets.length) { console.error("Benutzung: node lint-motion.mjs <ordner|dateien…>"); process.exit(1); }
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".scss", ".html", ".vue", ".svelte"]);
const files = [];
const walk = (p) => {
  const st = statSync(p);
  if (st.isDirectory()) { for (const n of readdirSync(p)) if (!/^(node_modules|\.git|dist|build|out|\.next)$/.test(n)) walk(join(p, n)); }
  else if (EXT.has(extname(p))) files.push(p);
};
targets.forEach(walk);

const issues = [];
const add = (file, line, level, msg) => issues.push({ file: relative(process.cwd(), file), line, level, msg });
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;
const each = (src, re, fn) => { for (const m of src.matchAll(re)) fn(m, lineOf(src, m.index)); };

let usesReducedMotion = false, hasUiMotion = false;
// comments are blanked (newlines kept, so line numbers stay right): explaining <video> in a comment is not using it
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (c, p) => p + " ".repeat(c.length - p.length));

for (const f of files) {
  const raw = readFileSync(f, "utf8");
  const src = /\.(css|scss|html|vue|svelte)$/.test(f) ? raw.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " ")) : stripComments(raw);
  const remotion = /from\s+["'](remotion|@remotion\/[^"']+)["']/.test(src);
  if (/prefers-reduced-motion|useReducedMotion|reducedMotion/.test(raw)) usesReducedMotion = true;

  if (remotion) {
    each(src, /Math\.random\(/g, (m, l) => add(f, l, "Fehler", "Math.random() macht jeden Render anders. Nimm random('seed') aus 'remotion'."));
    each(src, /Date\.now\(|new Date\(\)|performance\.now\(/g, (m, l) => add(f, l, "Fehler", "Echtzeit in einer Komposition: Animationen müssen nur von useCurrentFrame() abhängen."));
    each(src, /set(Timeout|Interval)\(|requestAnimationFrame\(/g, (m, l) => add(f, l, "Fehler", "Timer/rAF laufen beim Rendern nicht synchron zu den Frames. Leite alles aus dem Frame ab."));
    each(src, /\btransition\s*:\s*["'`][^"'`]*\d+m?s|animation\s*:\s*["'`][^"'`]*\d+m?s|\btransition:\s*[\w-]+\s+\d|@keyframes/g, (m, l) => add(f, l, "Fehler", "CSS-Transition/Animation in Remotion: wird pro Frame nicht korrekt abgebildet. Mit interpolate()/spring() animieren."));
    each(src, /\bstartFrom=|\bendAt=/g, (m, l) => add(f, l, "Hinweis", "startFrom/endAt sind veraltet: trimBefore/trimAfter verwenden."));
    each(src, /fonts\.googleapis\.com|@import\s+url\(\s*["']?https?:/g, (m, l) => add(f, l, "Warnung", "Schrift aus dem Netz: Render hängt am Internet. Lokal einbinden (public/fonts + FontFace, delayRender)."));
    each(src, /<video\b|<img\b/g, (m, l) => add(f, l, "Warnung", "Natives <video>/<img>: nimm <OffthreadVideo>/<Img> aus 'remotion', damit Frames vor dem Screenshot geladen sind."));
    each(src, /interpolate\(([^()]|\([^()]*\))*\)/g, (m, l) => {
      if (!/extrapolate(Left|Right)/.test(m[0]) && /\[\s*0\s*,\s*1\s*\]\s*\)?\s*$|,\s*\[[^\]]+\]\s*\)$/.test(m[0])) add(f, l, "Hinweis", "interpolate() ohne extrapolateLeft/Right: 'clamp' prüfen, sonst läuft der Wert über das Ziel hinaus.");
    });
  } else {
    // web / UI motion
    each(src, /transition(-property)?\s*:\s*[^;"'}]*\b(width|height|top|left|right|bottom|margin[\w-]*|padding[\w-]*)\b/g, (m, l) => { hasUiMotion = true; add(f, l, "Warnung", `Übergang auf Layout-Eigenschaft (${m[2]}): ruckelt. transform/opacity verwenden (z. B. scale, translate).`); });
    each(src, /transition\s*:\s*all\b/g, (m, l) => { hasUiMotion = true; add(f, l, "Hinweis", "transition: all animiert auch Farben/Layout ungewollt. Eigenschaften einzeln nennen."); });
    each(src, /\b(transition|animation)(-duration)?\s*:\s*([^;"'}{]+)/g, (m, l) => {
      hasUiMotion = true;
      const decl = m[3];
      if (/infinite|shimmer|spin|pulse|loading|skeleton/i.test(decl)) return; // loops are allowed to be slow
      // the first time value of each comma-separated part is the duration
      const durs = decl.split(",").map((part) => part.match(/(^|\s)(\d*\.?\d+)(ms|s)\b/)).filter(Boolean).map((x) => (x[3] === "s" ? parseFloat(x[2]) * 1000 : parseFloat(x[2])));
      const ms = Math.max(0, ...durs);
      if (ms > 700) add(f, l, "Hinweis", `${ms} ms ist für UI lang (Richtwert 150–400 ms, große Flächen bis 500 ms).`);
    });
    if (/@keyframes|\.animate\(|motion\.|gsap\.|animate=\{/.test(src)) hasUiMotion = true;
    each(src, /will-change\s*:\s*[^;]+/g, (m, l) => { if ((src.match(/will-change/g) || []).length > 6) add(f, l, "Hinweis", "Viele will-change-Angaben kosten Speicher. Nur während der Animation setzen."); });
  }
}
if (hasUiMotion && !usesReducedMotion) issues.push({ file: "(Projekt)", line: 0, level: "Fehler", msg: "UI-Animationen ohne prefers-reduced-motion: Für Menschen mit Bewegungsempfindlichkeit eine ruhige Variante anbieten." });

const order = { Fehler: 0, Warnung: 1, Hinweis: 2 };
issues.sort((a, b) => order[a.level] - order[b.level] || a.file.localeCompare(b.file) || a.line - b.line);
for (const i of issues) console.log(`${i.level.padEnd(7)} ${i.file}${i.line ? ":" + i.line : ""}  ${i.msg}`);
const errors = issues.filter((i) => i.level === "Fehler").length;
console.log(`\n${files.length} Dateien geprüft · ${errors} Fehler · ${issues.length - errors} Warnungen/Hinweise`);
process.exit(errors ? 1 : 0);
