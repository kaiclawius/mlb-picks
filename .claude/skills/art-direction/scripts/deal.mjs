#!/usr/bin/env node
// Deal an art direction instead of letting the model pick its favourite default. Seeded, so a deal can be
// repeated, and history-aware, so the same project does not get the same look twice in a row.
//   node deal.mjs --options 3 [--sector memecoin] [--tone bold] [--seed 42]      three directions to choose from
//   node deal.mjs --direction the-printout [--seed 42]                          the full sheet: palette, type, motion
//   node deal.mjs --redraw palette|type|motion --why "contrast too low"         redraw one part (needs a reason)
// Writes .art-direction/direction.json and .art-direction/history.json in the current folder (nothing global).
import fs from "node:fs"; import path from "node:path";

const LIB = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "library");
const load = (f) => JSON.parse(fs.readFileSync(path.join(LIB, f), "utf8"));
const directions = load("directions.json"), palettes = load("palettes.json"), types = load("type.json"), motions = load("motions.json");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const DIR = path.resolve(".art-direction"); fs.mkdirSync(DIR, { recursive: true });
const histFile = path.join(DIR, "history.json"), sheetFile = path.join(DIR, "direction.json");
const history = fs.existsSync(histFile) ? JSON.parse(fs.readFileSync(histFile, "utf8")) : [];
const seed = Number(opt("seed", Math.floor(Math.random() * 1e9)));
let s = seed >>> 0 || 1; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const recent = new Set(history.slice(-12).flatMap((h) => [h.direction, h.palette, h.type]));

// WCAG contrast of two hex colours
const lum = (hex) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };

function pickPalette(d) { const pool = palettes.filter((p) => p.tags.some((t) => d.palette.includes(t))); const fresh = pool.filter((p) => !recent.has(p.id)); return shuffle(fresh.length ? fresh : pool)[0]; }
function pickType(d) { const pool = types.filter((t) => d.type.includes(t.class)); const fresh = pool.filter((t) => !recent.has(t.id)); return shuffle(fresh.length ? fresh : pool)[0]; }
function pickMotion(d) { const sig = d.motion[0], rest = shuffle(d.motion.slice(1)).slice(0, 2); return [sig, ...rest].map((id) => motions.find((m) => m.id === id)).filter(Boolean); }
const fontsLink = (t) => { const fam = [[t.display, t.displayAxes], [t.text, "wght@400;500;600"], ...(t.mono ? [[t.mono, "wght@400;500"]] : []), ...(t.ui ? [[t.ui, "wght@400;500;600"]] : [])];
  const m = new Map(); for (const [f, a] of fam) if (!m.has(f)) m.set(f, a); const uniq = [...m.entries()]; /* the display axes win for a shared family */ return `https://fonts.googleapis.com/css2?${uniq.map(([f, a]) => `family=${f.replace(/ /g, "+")}${a ? ":" + a : ""}`).join("&")}&display=swap`; };

function sheet(d, palette, type, motion) {
  const checks = { "ink/bg": contrast(palette.ink, palette.bg), "muted/bg": contrast(palette.muted, palette.bg), "accentInk/accent": contrast(palette.accentInk, palette.accent), "accent/bg": contrast(palette.accent, palette.bg) };
  return { seed, at: new Date().toISOString(), direction: d, palette, type, motion, fontsLink: fontsLink(type), contrast: checks,
    css: `:root{--bg:${palette.bg};--surface:${palette.surface};--ink:${palette.ink};--muted:${palette.muted};--accent:${palette.accent};--accent-ink:${palette.accentInk};--display:'${type.display}',system-ui,sans-serif;--text:'${type.text}',system-ui,sans-serif;${type.mono ? `--mono:'${type.mono}',ui-monospace,monospace;` : ""}}` };
}
function print(sh) {
  const d = sh.direction;
  console.log(`\nDIRECTION  ${d.name}  (${d.id})  seed ${sh.seed}\n  idea: ${d.idea}\n  composition: ${d.composition}\n  imagery: ${d.imagery}\n  pitfall: ${d.pitfalls}`);
  console.log(`PALETTE    ${sh.palette.id}: bg ${sh.palette.bg} · ink ${sh.palette.ink} · muted ${sh.palette.muted} · accent ${sh.palette.accent}  (${sh.palette.note})`);
  console.log(`  contrast ${Object.entries(sh.contrast).map(([k, v]) => `${k} ${v}${(k === "accent/bg" ? v < 3 : v < 4.5) ? " ⚠" : ""}`).join(" · ")}`);
  console.log(`TYPE       ${sh.type.display} / ${sh.type.text}${sh.type.mono ? " / " + sh.type.mono : ""}  (${sh.type.note})\n  ${sh.fontsLink}`);
  console.log(`MOTION     signature: ${sh.motion[0]?.id} (${sh.motion[0]?.kit}); also ${sh.motion.slice(1).map((m) => m.id).join(", ")}`);
  console.log(`CSS        ${sh.css}\nsaved ${path.relative(process.cwd(), sheetFile)}`);
}
const save = (sh, extra = {}) => { fs.writeFileSync(sheetFile, JSON.stringify(sh, null, 2)); history.push({ at: sh.at, seed: sh.seed, direction: sh.direction.id, palette: sh.palette.id, type: sh.type.id, ...extra }); fs.writeFileSync(histFile, JSON.stringify(history.slice(-50), null, 2)); };

if (args.includes("--options")) {
  const n = Number(opt("options", 3)), sector = opt("sector"), tone = opt("tone");
  let pool = directions.filter((d) => (!sector || d.sectors.includes(sector)) && (!tone || d.tone.includes(tone)));
  if (pool.length < n) pool = directions; // too narrow: deal from everything
  const fresh = pool.filter((d) => !recent.has(d.id)), deck = shuffle(fresh.length >= n ? fresh : pool).slice(0, n);
  console.log(`Three directions (seed ${seed}${sector ? ", sector " + sector : ""}${tone ? ", tone " + tone : ""}). Pick one and write down why it fits THIS brief:`);
  deck.forEach((d, i) => console.log(`\n${i + 1}. ${d.name}  →  node deal.mjs --direction ${d.id} --seed ${seed}\n   ${d.idea}\n   best for: ${d.sectors.join(", ")} · tone: ${d.tone.join(", ")}`));
} else if (opt("direction")) {
  const d = directions.find((x) => x.id === opt("direction")); if (!d) { console.error("unknown direction; ids: " + directions.map((x) => x.id).join(", ")); process.exit(2); }
  const sh = sheet(d, pickPalette(d), pickType(d), pickMotion(d)); save(sh); print(sh);
} else if (opt("redraw")) {
  if (!fs.existsSync(sheetFile)) { console.error("deal a direction first"); process.exit(2); }
  const why = opt("why"); if (!why) { console.error('a redraw needs a reason: --why "..." (it is written to the history)'); process.exit(2); }
  const old = JSON.parse(fs.readFileSync(sheetFile, "utf8")), part = opt("redraw"); recent.add(old.palette.id); recent.add(old.type.id);
  const sh = sheet(old.direction, part === "palette" ? pickPalette(old.direction) : old.palette, part === "type" ? pickType(old.direction) : old.type, part === "motion" ? pickMotion(old.direction) : old.motion);
  save(sh, { redraw: part, why }); print(sh);
} else {
  console.log("usage: deal.mjs --options 3 [--sector x] [--tone y] | --direction <id> | --redraw palette|type|motion --why \"...\"");
  console.log("directions: " + directions.map((d) => d.id).join(", "));
}
