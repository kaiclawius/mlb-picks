// The watch page: player, overview (read instead of watch), transcript, "ask the video", guide, editor, comments.
import { $, $$, api, live, time, ago, esc, toast, copy, store, icons } from "/js/lib.js";
import { createPlayer } from "/js/player.js";
import * as C from "/js/cuts.js";

const id = location.pathname.split("/").pop();
let meta = null, words = [], player = null, tab = store.get("tab", "overview");
const qa = [];
let undo = [];

/* ---------- load ---------- */
async function load() {
  try { const r = await api(`/api/recordings/${id}`); words = r.transcript || []; delete r.transcript; meta = r; }
  catch { document.body.innerHTML = '<div class="wrap" style="padding:80px 20px;text-align:center"><h1>Diese Aufnahme gibt es nicht (mehr).</h1><p style="margin-top:12px"><a class="btn" href="/">Zur Bibliothek</a></p></div>'; return; }
  document.title = `${meta.title || "Aufnahme"} · Klipp`;
  $("#title").value = meta.title || "";
  if (meta.status === "ready") mountPlayer();
  else $("#player").innerHTML = `<div class="player"><div class="frame" style="display:grid;place-items:center;color:#bbb"><div class="wait" style="color:#ccc"><span class="spin"></span>${meta.status === "error" ? "" : "Aufnahme wird fertiggestellt …"}</div></div></div>`;
  renderState(); renderTab(); renderComments();
  if (meta.status === "ready" && !sessionStorage.getItem("viewed:" + id)) { sessionStorage.setItem("viewed:" + id, "1"); api(`/api/recordings/${id}/view`, { method: "POST" }).catch(() => {}); }
  if (new URLSearchParams(location.search).has("new")) { history.replaceState(null, "", location.pathname); copy(location.href, "Fertig! Link ist kopiert."); }
}

function mountPlayer() {
  if (player) return;
  player = createPlayer($("#player"), meta);
  if (meta.ai.transcript === "done") player.loadCaptions(captionFile());
  player.setMarks({ chapters: meta.chapters, comments: meta.comments });
  player.on(onTime);
  addEventListener("keydown", (e) => player.keys(e));
  const t = Number(new URLSearchParams(location.search).get("t"));
  if (t) player.seek(t);
}
const captionFile = () => { const l = store.get("cclang:" + id, ""); return l && meta.translations?.[l]?.status === "done" ? meta.translations[l].file : "captions.vtt"; };

/* live updates from the server: processing, AI, exports, comments by others */
live(async (m) => {
  if (m.id !== id) return;
  if (m.deleted) { location.href = "/"; return; }
  const before = meta;
  meta = m;
  if (before.ai.transcript !== "done" && m.ai.transcript === "done") { const r = await api(`/api/recordings/${id}`); words = r.transcript || []; player?.loadCaptions(captionFile()); }
  if (m.status === "ready" && !player) { $("#player").innerHTML = ""; mountPlayer(); }
  if (document.activeElement !== $("#title") && m.title !== before.title) { $("#title").value = m.title; document.title = `${m.title} · Klipp`; }
  player?.setMarks({ chapters: m.chapters, comments: m.comments });
  renderState(); renderComments();
  const keep = document.activeElement?.closest?.("#pane input, #pane textarea");
  if (!keep) renderTab();
});

/* ---------- status line under the player ---------- */
function renderState() {
  const a = meta.ai, el = $("#state");
  const parts = [];
  if (meta.status === "processing" || meta.status === "recording") parts.push('<span class="badge run"><span class="spin"></span>Wird fertiggestellt: Dauert nur Sekunden</span>');
  if (meta.status === "error") parts.push(`<span class="badge bad">${esc(meta.error || "Fehler")}</span>`);
  if (meta.recovered) parts.push('<span class="badge ok">Nach Absturz wiederhergestellt</span>');
  if (a.transcript === "running") parts.push(`<span class="badge run"><span class="spin"></span>Transkript (lokal) ${Math.round((a.progress || 0) * 100)} %</span>`);
  if (a.summary === "running") parts.push('<span class="badge run"><span class="spin"></span>Claude schreibt Titel, Zusammenfassung und Kapitel</span>');
  el.innerHTML = parts.join(" ");
}

/* ---------- tabs ---------- */
$$("#tabs button").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; store.set("tab", tab); renderTab(); }));
function renderTab() {
  $$("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  ({ overview, transcript, ask, guide, edit })[tab]?.();
}
const pane = () => $("#pane");
const needTranscript = () => {
  const a = meta.ai;
  if (a.transcript === "done") return null;
  if (a.transcript === "off") return '<p class="muted">Diese Aufnahme hat keinen Ton, daher gibt es kein Transkript.</p>';
  if (a.transcript === "empty") return '<p class="muted">Im Ton wurde keine Sprache erkannt.</p>';
  if (a.transcript === "error") return `<p class="err">Transkript fehlgeschlagen: ${esc(a.error || "")}</p><p style="margin-top:10px"><button class="btn small" id="retx">Nochmal versuchen</button></p>`;
  return `<div class="wait"><span class="spin"></span>Das Transkript wird auf diesem Rechner erstellt (${Math.round((a.progress || 0) * 100)} %). Dein Ton verlässt den Computer nicht.</div>`;
};
function bindRetx() { $("#retx")?.addEventListener("click", () => api(`/api/recordings/${id}/transcribe`, { method: "POST", body: {} })); }

function aiNote() {
  const s = meta.ai.summary;
  if (s === "nokey") return '<div class="note"><b>KI ist aus.</b> Trag einen Anthropic API-Key in <code>klipp/.env</code> ein, dann schreibt Claude Titel, Zusammenfassung und Kapitel.</div>';
  if (s === "error") return `<div class="note"><b>Zusammenfassung fehlgeschlagen.</b> ${esc(meta.ai.error || "")} <button class="btn small" id="redo">Nochmal</button></div>`;
  if (s === "running") return '<div class="wait"><span class="spin"></span>Claude liest das Transkript …</div>';
  return "";
}

function overview() {
  const n = needTranscript();
  const ch = meta.chapters || [];
  pane().innerHTML = `
    ${meta.summary ? `<p class="sum">${esc(meta.summary)}</p>` : n || aiNote()}
    ${meta.summary ? aiNote() : ""}
    ${meta.tldr?.length ? `<h3>Kernpunkte</h3><ul class="pts">${meta.tldr.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    ${meta.actions?.length ? `<h3>To-dos aus dem Video</h3><ul class="pts">${meta.actions.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    ${ch.length ? `<h3>Kapitel</h3><div class="chapters" id="chaps">${ch.map((c) => `<button data-t="${c.t}"><span>${time(c.t)}</span>${esc(c.title)}</button>`).join("")}</div>` : ""}
    ${meta.ai.transcript === "done" ? `<h3>Untertitel</h3><div class="row" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      <select id="cclang"><option value="">Original</option>${Object.entries(meta.translations || {}).map(([k, v]) => `<option value="${k}" ${v.status !== "done" ? "disabled" : ""}>${esc(v.language)}${v.status === "running" ? " (wird übersetzt …)" : v.status === "error" ? " (Fehler)" : ""}</option>`).join("")}</select>
      <input type="text" id="tlang" placeholder="Übersetzen in … (z. B. Englisch)"><button class="btn small" id="tgo">Übersetzen</button>
      <a class="btn small ghost" href="/media/${id}/captions.vtt?download=1">VTT laden</a></div>` : ""}
    <div class="facts"><span>${time(meta.duration)}</span><span>aufgenommen ${ago(meta.createdAt)}</span><span>${meta.views || 0} Aufrufe</span>${meta.media?.cam ? "<span>Bildschirm + Kamera</span>" : ""}${meta.media?.width ? `<span>${meta.media.width}×${meta.media.height}</span>` : ""}</div>`;
  $$("#chaps button").forEach((b) => b.addEventListener("click", () => { player?.seek(+b.dataset.t); player?.play(); }));
  $("#redo")?.addEventListener("click", () => api(`/api/recordings/${id}/describe`, { method: "POST" }).catch((e) => toast(e.message)));
  const sel = $("#cclang");
  if (sel) { sel.value = store.get("cclang:" + id, ""); sel.onchange = () => { store.set("cclang:" + id, sel.value); player?.loadCaptions(captionFile()); }; }
  $("#tgo")?.addEventListener("click", () => { const l = $("#tlang").value.trim(); if (l) api(`/api/recordings/${id}/translate`, { method: "POST", body: { language: l } }).then(() => toast("Übersetzung läuft …")).catch((e) => toast(e.message, 4000)); });
  bindRetx();
}

function transcript() {
  const n = needTranscript();
  if (n) { pane().innerHTML = n; bindRetx(); return; }
  pane().innerHTML = `<div class="tools"><input type="search" id="tq" placeholder="Im Transkript suchen …"><button class="btn small" id="tcopy">Text kopieren</button>
    <select id="relang" title="Sprache neu erkennen"><option value="">Neu transkribieren …</option><option value="german">auf Deutsch</option><option value="english">auf Englisch</option><option value="french">auf Französisch</option><option value="spanish">auf Spanisch</option></select></div>
    <div class="transcript" id="tx">${paragraphs(false)}</div>`;
  bindWords($("#tx"));
  $("#tq").addEventListener("input", (e) => { const q = e.target.value.toLowerCase().trim(); $$("#tx .w").forEach((w) => w.classList.toggle("hit", q.length > 1 && w.textContent.toLowerCase().includes(q))); $("#tx .hit")?.scrollIntoView({ block: "center" }); });
  $("#tcopy").addEventListener("click", () => copy(words.map((w) => w.w).join(" ")));
  $("#relang").addEventListener("change", (e) => { if (e.target.value) api(`/api/recordings/${id}/transcribe`, { method: "POST", body: { language: e.target.value } }).then(() => toast("Wird neu transkribiert …")); });
}
function paragraphs(editing) {
  let html = "", lastS = -99;
  words.forEach((w, i) => {
    if (i === 0 || w.s - words[i - 1].e > 1.6 || (w.s - lastS > 30 && /[.!?]$/.test(words[i - 1]?.w || ""))) { html += `${i ? "</p>" : ""}<p><span class="ts" data-t="${w.s}">${time(w.s)}</span>`; lastS = w.s; }
    const cls = ["w", C.wordCut(meta.edits.cuts, w) ? "cut" : "", editing && C.isFiller(w) ? "filler" : ""].join(" ");
    html += `<span class="${cls}" data-i="${i}">${esc(w.w)}</span> `;
  });
  return html + "</p>";
}
function bindWords(el, editing) {
  el.addEventListener("click", (e) => {
    const w = e.target.closest(".w"), ts = e.target.closest(".ts");
    if (ts) { player?.seek(+ts.dataset.t); return; }
    if (!w) return;
    const i = +w.dataset.i;
    if (editing && w.classList.contains("cut")) { setCuts(C.subtract(meta.edits.cuts, C.wordsRange(words, i, i), meta.duration)); return; }
    if (!editing || !getSelection().toString()) player?.seek(words[i].s);
  });
}

let lastWord = -1, lastCh = -1;
function onTime(t) {
  // highlight the spoken word and the current chapter
  let i = -1;
  for (let k = 0; k < words.length; k++) { if (words[k].s > t) break; i = k; }
  if (i !== lastWord) {
    $$("#pane .w.now").forEach((x) => x.classList.remove("now"));
    const el = $(`#pane .w[data-i="${i}"]`);
    if (el) { el.classList.add("now"); const box = el.closest(".transcript"); if (box && !box.matches(":hover")) { const r = el.offsetTop - box.offsetTop; if (r < box.scrollTop + 40 || r > box.scrollTop + box.clientHeight - 60) box.scrollTop = r - box.clientHeight / 3; } }
    lastWord = i;
  }
  const ch = (meta.chapters || []).reduce((n, c, k) => (c.t <= t ? k : n), -1);
  if (ch !== lastCh) { $$("#chaps button").forEach((b, k) => b.classList.toggle("now", k === ch)); lastCh = ch; }
  const ph = $("#ph"); if (ph) ph.style.left = `${(t / meta.duration) * 100}%`;
  const ct = $("#ctext"); if (ct && !ct.value) ct.placeholder = `Kommentar bei ${time(t)} …`;
}

/* ---------- ask the video ---------- */
function ask() {
  const n = needTranscript();
  if (n) { pane().innerHTML = n; bindRetx(); return; }
  pane().innerHTML = `<div class="chat">
    <p class="muted">Frag, was im Video gesagt wird. Claude antwortet aus dem Transkript und zeigt dir die Stellen, an denen es passiert.</p>
    <div id="qas">${qa.map(renderQa).join("")}</div>
    <form class="ask" id="askf"><input type="text" id="askq" placeholder="z. B. Welche Schritte muss ich machen? Was kostet das?" maxlength="500"><button class="btn primary">Fragen</button></form>
    <div class="chips">${["Fass das in drei Sätzen zusammen", "Was soll ich als Nächstes tun?", "Welche Zahlen werden genannt?"].map((s) => `<button class="chip" type="button" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`;
  $$(".chip[data-s]").forEach((c) => c.addEventListener("click", () => { $("#askq").value = c.dataset.s; $("#askf").requestSubmit(); }));
  bindMoments();
  $("#askf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#askq").value.trim(); if (q.length < 3) return;
    const item = { q, a: null }; qa.push(item); $("#askq").value = "";
    $("#qas").innerHTML = qa.map(renderQa).join("");
    try { item.a = await api(`/api/recordings/${id}/ask`, { method: "POST", body: { question: q } }); }
    catch (err) { item.a = { answer: err.message, moments: [], error: true }; }
    if (tab === "ask") { $("#qas").innerHTML = qa.map(renderQa).join(""); bindMoments(); }
  });
}
const renderQa = (x) => `<div class="qa"><div class="q">${esc(x.q)}</div><div class="a">${x.a ? `<div class="${x.a.error ? "err" : ""}">${esc(x.a.answer)}</div>${x.a.moments?.length ? `<div class="chips">${x.a.moments.map((m) => `<button class="chip" data-t="${m.t}"><b>${time(m.t)}</b>${esc(m.label)}</button>`).join("")}</div>` : ""}` : '<span class="spin"></span>'}</div></div>`;
const bindMoments = () => $$("#pane .chip[data-t]").forEach((c) => c.addEventListener("click", () => { player?.seek(+c.dataset.t); player?.play(); }));

/* ---------- guide ---------- */
function guide() {
  const n = needTranscript();
  if (n) { pane().innerHTML = n; bindRetx(); return; }
  const g = meta.guide;
  if (!g || g.status === "error") {
    pane().innerHTML = `<p class="sum" style="font-size:15.5px">Mach aus dieser Aufnahme eine <b>schriftliche Schritt-für-Schritt-Anleitung</b> mit Screenshots. Zum Nachlesen, Drucken oder für dein Wiki: für alle, die kein Video schauen wollen.</p>
      ${g?.error ? `<p class="err" style="margin-top:10px">${esc(g.error)}</p>` : ""}
      <p style="margin-top:14px"><button class="btn primary" id="mkguide">${icons.spark} Anleitung erstellen</button></p>`;
    $("#mkguide").addEventListener("click", () => api(`/api/recordings/${id}/guide`, { method: "POST" }).catch((e) => toast(e.message, 4000)));
    return;
  }
  if (g.status === "running") { pane().innerHTML = '<div class="wait"><span class="spin"></span>Claude schreibt die Anleitung und Klipp macht die Screenshots …</div>'; return; }
  pane().innerHTML = `<div class="guide"><div class="tools"><a class="btn small" href="/g/${id}" target="_blank">Als Seite öffnen</a><button class="btn small" id="gcopy">Link kopieren</button><a class="btn small" href="/api/recordings/${id}/guide.html">HTML laden</a><a class="btn small" href="/api/recordings/${id}/guide.md">Markdown</a><button class="btn small ghost" id="regen">Neu erstellen</button></div>
    <h2 style="font-size:21px;letter-spacing:-.01em">${esc(g.title)}</h2><p class="muted" style="margin:6px 0 8px">${esc(g.intro)}</p>
    ${g.steps.map((s, i) => `<div class="step"><span class="n">${i + 1}</span><div><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p>${s.shot ? `<img src="/media/${id}/${s.shot}" alt="" data-t="${s.t}" loading="lazy">` : ""}</div></div>`).join("")}
    ${g.tips?.length ? `<h3>Tipps</h3><ul class="pts">${g.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}</div>`;
  $$(".guide img").forEach((im) => im.addEventListener("click", () => { player?.seek(+im.dataset.t); scrollTo({ top: 0, behavior: "smooth" }); }));
  $("#gcopy").addEventListener("click", () => copy(location.origin + "/g/" + id));
  $("#regen").addEventListener("click", () => api(`/api/recordings/${id}/guide`, { method: "POST" }));
}

/* ---------- editor ---------- */
let peaks = null;
async function edit() {
  if (meta.status !== "ready") { pane().innerHTML = '<div class="wait"><span class="spin"></span>Gleich fertig …</div>'; return; }
  peaks ??= await fetch(`/media/${id}/peaks.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const cuts = meta.edits.cuts, d = meta.duration;
  const fill = C.fillerCuts(words).filter((r) => !cuts.some(([a, b]) => r[0] >= a && r[1] <= b));
  const pz = C.pauseCuts(words, d).filter((r) => !cuts.some(([a, b]) => r[0] >= a && r[1] <= b));
  const pzSave = C.removed(C.normalize(pz));
  const b = meta.bubble;
  pane().innerHTML = `<div class="edit">
    <div class="group">
      <div class="row" style="justify-content:space-between"><b>Zeitleiste</b><span class="stat">Länge ${time(d - C.removed(cuts))} von ${time(d)}${cuts.length ? ` · ${cuts.length} Schnitt${cuts.length > 1 ? "e" : ""}` : ""}</span></div>
      <div class="strip" id="strip"><div class="wave">${(peaks.length ? peaks : Array(120).fill(0.05)).map((p) => `<i style="height:${Math.max(4, p * 100)}%"></i>`).join("")}</div>
        ${cuts.map(([a, z]) => `<div class="cz" style="left:${(a / d) * 100}%;width:${((z - a) / d) * 100}%"></div>`).join("")}<div class="ph" id="ph"></div>
        <div class="h" id="hs" title="Anfang" style="left:${(startTrim() / d) * 100}%"></div><div class="h" id="he" title="Ende" style="left:calc(${(endTrim() / d) * 100}% - 12px)"></div></div>
      <div class="row"><button class="btn small" id="cutHere" title="Schneidet 2 Sekunden ab der aktuellen Stelle">✂ Hier schneiden</button>
        <button class="btn small" id="fillers" ${fill.length ? "" : "disabled"}>Füllwörter entfernen${fill.length ? ` (${fill.length})` : ""}</button>
        <button class="btn small" id="pauses" ${pz.length ? "" : "disabled"}>Pausen kürzen${pz.length ? ` (spart ${Math.round(pzSave)} s)` : ""}</button>
        <span class="grow" style="flex:1"></span>
        <button class="btn small ghost" id="undo" ${undo.length ? "" : "disabled"}>${icons.undo} Rückgängig</button>
        <button class="btn small ghost" id="reset" ${cuts.length ? "" : "disabled"}>Alles zurücksetzen</button></div>
    </div>
    ${words.length ? `<div class="group"><div class="row" style="justify-content:space-between"><b>Schneiden wie in einem Textdokument</b><span class="stat">Wörter markieren, dann <kbd>Entf</kbd> oder „Ausschneiden“. Durchgestrichenes anklicken holt es zurück.</span></div>
      <div class="row" style="margin:8px 0"><button class="btn small" id="cutSel">Markierung ausschneiden</button></div>
      <div class="transcript" id="etx" style="max-height:340px">${paragraphs(true)}</div></div>` : ""}
    ${meta.media.cam ? `<div class="group"><b>Kamera-Bubble</b><div class="row" style="margin-top:10px;gap:18px">
      <div class="corners" id="corners">${["tl", "tr", "bl", "br"].map((c) => `<button aria-pressed="${b.corner === c}" data-c="${c}" title="${{ tl: "oben links", tr: "oben rechts", bl: "unten links", br: "unten rechts" }[c]}"></button>`).join("")}</div>
      <label class="row">Größe <input type="range" id="bsize" min="0.1" max="0.4" step="0.01" value="${b.size}"></label>
      <label class="row"><select id="bshape"><option value="circle">Kreis</option><option value="rounded" ${b.shape === "rounded" ? "selected" : ""}>Abgerundet</option></select></label>
      <label class="row"><input type="checkbox" id="bhide" ${b.hidden ? "checked" : ""}> Ausblenden</label></div></div>` : ""}
    <div class="group"><b>Exportieren</b>${exportRow("mp4", "MP4", "Mit Schnitten und Bubble, H.264: läuft überall.")}${exportRow("mp4-captions", "MP4 mit Untertiteln", "Untertitel fest im Bild.")}${exportRow("demo", "Demo-Film", "Intro, Kapitel-Titel, Untertitel und Outro, wie ein Produktvideo (Remotion).")}</div>
  </div>`;
  bindEditor(fill, pz);
}
const startTrim = () => { const c = meta.edits.cuts[0]; return c && c[0] <= 0.01 ? c[1] : 0; };
const endTrim = () => { const c = meta.edits.cuts[meta.edits.cuts.length - 1]; return c && c[1] >= meta.duration - 0.01 ? c[0] : meta.duration; };
function exportRow(kind, label, hint) {
  const e = meta.exports?.[kind];
  const old = e?.status === "done" && meta.editsAt && e.at < meta.editsAt;
  const right = !e || e.status === "error" || old ? `<button class="btn small" data-ex="${kind}">${old ? "Neu erstellen" : "Erstellen"}</button>`
    : e.status === "running" ? `<span class="badge run"><span class="spin"></span>${Math.round((e.progress || 0) * 100)} %</span>`
    : `<a class="btn small primary" href="/media/${id}/${e.file}?download=1">${icons.down} Laden</a>`;
  return `<div class="ex"><div><b>${label}</b><small>${hint}${e?.status === "error" ? ` <span class="err">Fehler: ${esc(e.error)}</span>` : ""}${old ? " Seit dem Export wurde bearbeitet." : ""}</small></div>${right}${e?.status === "running" ? `<div class="progress"><i style="width:${(e.progress || 0) * 100}%"></i></div>` : ""}</div>`;
}

function setCuts(next, push = true) {
  if (push) undo.push(meta.edits.cuts); if (undo.length > 50) undo.shift();
  meta.edits.cuts = C.normalize(next, meta.duration);
  player?.setCuts(meta.edits.cuts);
  save({ cuts: meta.edits.cuts });
  edit(); if (tab === "transcript") transcript();
}
let saveT;
function save(patch) { clearTimeout(saveT); saveT = setTimeout(() => api(`/api/recordings/${id}`, { method: "PATCH", body: patch }).catch((e) => toast("Speichern fehlgeschlagen: " + e.message)), 300); }

function bindEditor(fill, pz) {
  const d = meta.duration, strip = $("#strip");
  const tAt = (x) => { const r = strip.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * d; };
  strip.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".h");
    if (!h) { player?.seek(tAt(e.clientX)); return; }
    strip.setPointerCapture(e.pointerId);
    const mv = (ev) => { const t = tAt(ev.clientX); h.style.left = h.id === "hs" ? `${(t / d) * 100}%` : `calc(${(t / d) * 100}% - 12px)`; player?.seek(t); };
    strip.addEventListener("pointermove", mv);
    strip.addEventListener("pointerup", (ev) => {
      strip.removeEventListener("pointermove", mv);
      const t = tAt(ev.clientX);
      let cs = meta.edits.cuts;
      if (h.id === "hs") { cs = C.subtract(cs, [0, startTrim()], d); if (t > 0.05) cs = C.add(cs, [0, t], d); }
      else { cs = C.subtract(cs, [endTrim(), d], d); if (t < d - 0.05) cs = C.add(cs, [t, d], d); }
      setCuts(cs);
    }, { once: true });
  });
  $("#cutHere").onclick = () => { const t = player.time(); setCuts(C.add(meta.edits.cuts, [t, Math.min(d, t + 2)], d)); };
  $("#fillers").onclick = () => setCuts(C.normalize([...meta.edits.cuts, ...fill], d));
  $("#pauses").onclick = () => setCuts(C.normalize([...meta.edits.cuts, ...pz], d));
  $("#undo").onclick = () => { if (undo.length) setCuts(undo.pop(), false); };
  $("#reset").onclick = () => setCuts([]);
  const etx = $("#etx");
  if (etx) {
    bindWords(etx, true);
    const cutSel = () => {
      const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) return false;
      const ws = $$(".w", etx).filter((w) => sel.containsNode(w, true));
      if (!ws.length) return false;
      const i = +ws[0].dataset.i, j = +ws[ws.length - 1].dataset.i;
      sel.removeAllRanges();
      setCuts(C.add(meta.edits.cuts, C.wordsRange(words, i, j), d));
      return true;
    };
    $("#cutSel").onclick = cutSel;
    etx.tabIndex = 0;
    etx.addEventListener("keydown", (e) => { if ((e.key === "Delete" || e.key === "Backspace") && cutSel()) e.preventDefault(); });
  }
  $$("#corners button").forEach((bt) => bt.addEventListener("click", () => bubble({ corner: bt.dataset.c })));
  $("#bsize")?.addEventListener("input", (e) => bubble({ size: +e.target.value }, false));
  $("#bsize")?.addEventListener("change", () => edit());
  $("#bshape")?.addEventListener("change", (e) => bubble({ shape: e.target.value }));
  $("#bhide")?.addEventListener("change", (e) => bubble({ hidden: e.target.checked }));
  $$("[data-ex]", pane()).forEach((bt) => bt.addEventListener("click", () => exportStart(bt.dataset.ex)));
}
function bubble(p, rerender = true) {
  meta.bubble = { ...meta.bubble, ...p };
  player?.setBubble(meta.bubble);
  save({ bubble: meta.bubble });
  if (rerender) edit();
}
function exportStart(kind) {
  api(`/api/recordings/${id}/export`, { method: "POST", body: { kind } }).then(() => toast("Export läuft. Du kannst weiterarbeiten.")).catch((e) => toast(e.message, 4000));
}

/* ---------- comments ---------- */
const EMO = ["👍", "❤️", "😂", "🎉", "👀", "🔥", "🤔"];
$("#emo").innerHTML = EMO.map((e) => `<button type="button" title="Reaktion bei der aktuellen Stelle">${e}</button>`).join("");
$$("#emo button").forEach((b) => b.addEventListener("click", () => send({ emoji: b.textContent })));
$("#csend").addEventListener("click", () => send({ text: $("#ctext").value }));
$("#ctext").addEventListener("keydown", (e) => { if (e.key === "Enter") send({ text: $("#ctext").value }); });
function name() {
  let n = store.get("name", "");
  if (!n) { n = (prompt("Wie heißt du? (wird bei deinen Kommentaren angezeigt)") || "").trim().slice(0, 40); if (n) store.set("name", n); }
  return n || "Gast";
}
async function send(c) {
  if (!c.emoji && !c.text?.trim()) return;
  try { await api(`/api/recordings/${id}/comments`, { method: "POST", body: { ...c, t: player?.time() || 0, name: name() } }); $("#ctext").value = ""; }
  catch (e) { toast(e.message); }
}
const color = (s) => `hsl(${[...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7)} 55% 48%)`;
function renderComments() {
  const cs = meta.comments || [];
  $("#views").textContent = `${meta.views || 0} Aufrufe`;
  $("#cname").textContent = store.get("name", "") ? `Du kommentierst als ${store.get("name")}.` : "Kommentare hängen an der Stelle im Video, an der du gerade bist.";
  $("#clist").innerHTML = cs.length ? cs.map((c) => `<div class="c"><span class="av" style="background:${color(c.name)}">${esc(c.emoji || c.name[0].toUpperCase())}</span><div>
      <div class="who">${esc(c.name)}<button data-t="${c.t}">${time(c.t)}</button><span class="muted" style="font-weight:400;font-size:12px">${ago(c.at)}</span><button class="x" data-del="${c.id}" title="Löschen">✕</button></div>
      ${c.text ? `<p>${esc(c.text)}</p>` : `<p style="font-size:20px">${esc(c.emoji)}</p>`}</div></div>`).join("")
    : '<p class="muted" style="padding:14px 8px;font-size:14px">Noch keine Kommentare. Fragen und Reaktionen landen genau an der Stelle im Video.</p>';
  $$("#clist [data-t]").forEach((b) => b.addEventListener("click", () => player?.seek(+b.dataset.t)));
  $$("#clist [data-del]").forEach((b) => b.addEventListener("click", () => api(`/api/recordings/${id}/comments/${b.dataset.del}`, { method: "DELETE" })));
}

/* ---------- header ---------- */
$("#title").addEventListener("change", (e) => { const t = e.target.value.trim(); if (t) api(`/api/recordings/${id}`, { method: "PATCH", body: { title: t } }).then(() => toast("Titel gespeichert")); });
$("#title").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
$("#share").addEventListener("click", () => copy(location.origin + location.pathname + (player?.time() > 2 && confirm(`Ab ${time(player.time())} teilen?`) ? `?t=${Math.floor(player.time())}` : ""), "Link kopiert"));
$("#dlBtn").addEventListener("click", (e) => { e.stopPropagation(); $("#dlMenu").classList.toggle("hidden"); $("#dlOrig").href = `/media/${id}/${meta.media?.main}?download=1`; });
addEventListener("click", () => $("#dlMenu").classList.add("hidden"));
$$("#dlMenu [data-ex]").forEach((b) => b.addEventListener("click", () => {
  const e = meta.exports?.[b.dataset.ex];
  if (e?.status === "done" && !(meta.editsAt && e.at < meta.editsAt)) location.href = `/media/${id}/${e.file}?download=1`;
  else { exportStart(b.dataset.ex); tab = "edit"; renderTab(); }
}));
$("#copyText").addEventListener("click", () => copy([`🎬 ${meta.title} (${time(meta.duration)})`, meta.summary, ...(meta.tldr || []).map((t) => `• ${t}`), location.origin + location.pathname].filter(Boolean).join("\n"), "Text kopiert"));
$("#del").addEventListener("click", async () => { if (confirm("Diese Aufnahme endgültig löschen?")) { await api(`/api/recordings/${id}`, { method: "DELETE" }); location.href = "/"; } });

load();
