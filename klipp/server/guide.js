// A finished guide as Markdown (images next to it) or as one self-contained HTML file (images inlined).
import { readFile } from "node:fs/promises";
import * as store from "./store.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function guideMarkdown(meta) {
  const g = meta.guide;
  return [`# ${g.title}`, "", g.intro, "",
    ...g.steps.flatMap((s, i) => [`## ${i + 1}. ${s.title}`, "", s.text, "", s.shot ? `![Schritt ${i + 1}](${s.shot})` : "", ""]),
    ...(g.tips?.length ? ["## Tipps", "", ...g.tips.map((t) => `- ${t}`), ""] : []),
    `_Aus der Aufnahme „${meta.title}“ erstellt mit Klipp._`, ""].join("\n");
}

export async function guideHtml(meta) {
  const g = meta.guide;
  const img = async (s) => s.shot ? `data:image/jpeg;base64,${(await readFile(store.file(meta.id, s.shot))).toString("base64")}` : "";
  const steps = await Promise.all(g.steps.map(async (s, i) => `<section><h2><span>${i + 1}</span>${esc(s.title)}</h2><p>${esc(s.text)}</p>${s.shot ? `<img src="${await img(s)}" alt="Schritt ${i + 1}">` : ""}<small>Im Video bei ${mmss(s.t)}</small></section>`));
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(g.title)}</title>
<style>body{font:17px/1.6 system-ui,sans-serif;max-width:860px;margin:0 auto;padding:40px 20px;color:#1b1d22;background:#fbfaf7}h1{font-size:34px;line-height:1.15}h2{display:flex;gap:12px;align-items:center;font-size:21px;margin:0 0 6px}h2 span{flex:none;width:30px;height:30px;border-radius:50%;background:#1b1d22;color:#fff;font-size:15px;display:grid;place-items:center}section{padding:26px 0;border-top:1px solid #e4e1da}img{width:100%;border:1px solid #e4e1da;border-radius:10px;margin-top:10px}small{color:#6b6f78}.tips{background:#fff;border:1px solid #e4e1da;border-radius:10px;padding:14px 20px}@media(prefers-color-scheme:dark){body{background:#15161a;color:#e8e6e1}h2 span{background:#e8e6e1;color:#15161a}section{border-color:#2c2e34}img,.tips{border-color:#2c2e34}.tips{background:#1d1f24}}</style></head>
<body><h1>${esc(g.title)}</h1><p>${esc(g.intro)}</p>${steps.join("")}${g.tips?.length ? `<div class="tips"><h3>Tipps</h3><ul>${g.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}<p><small>Aus der Aufnahme „${esc(meta.title)}“ erstellt mit Klipp.</small></p></body></html>`;
}
