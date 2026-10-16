// Stimme UI: speak text, browse voices, clone a voice, history.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const save = (k, v) => { try { localStorage.setItem("stimme:" + k, JSON.stringify(v)); } catch {} };
const load = (k, d) => { try { const v = localStorage.getItem("stimme:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const toast = (m, ms = 2400) => { const d = document.createElement("div"); d.className = "toast"; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), ms); };
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: opts.json ? { "Content-Type": "application/json" } : {}, body: opts.json ? JSON.stringify(opts.json) : opts.body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Fehler ${r.status}`);
  return j;
}
const color = (s) => `hsl(${[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11)} 55% 52%)`;
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

let voices = [], status = null, filter = load("filter", "all"), selected = load("voice", "thorsten");

/* ---------- tabs ---------- */
$$("nav.tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
function showTab(t) {
  $$("nav.tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
  for (const s of ["studio", "clone", "api"]) $("#tab-" + s).classList.toggle("hidden", s !== t);
  if (t === "clone") renderClone();
  if (t === "api") renderApi();
}

/* ---------- voices ---------- */
async function refresh() {
  [voices, status] = await Promise.all([api("/api/voices"), api("/api/status")]);
  if (!voices.some((v) => v.id === selected)) selected = "thorsten";
  renderVoices(); renderSettings(); renderEngine();
  if (!$("#tab-clone").classList.contains("hidden")) renderClone();
}
function renderVoices() {
  $$("#filters button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.l === filter)));
  const list = voices.filter((v) => filter === "all" || (filter === "clone" ? v.kind === "clone" : v.lang === filter));
  $("#voices").innerHTML = list.length ? list.map((v) => `<button class="voice" data-id="${v.id}" aria-pressed="${v.id === selected}">
      <span class="av" style="background:${color(v.name)}">${esc(v.name[0])}</span>
      <span><span class="nm">${esc(v.name)} ${v.kind === "clone" ? '<span class="tag clone">Klon</span>' : ""}<span class="tag">${v.lang.toUpperCase()}${v.accent ? " " + v.accent : ""}</span></span>
      <span class="sub">${v.kind === "clone" ? (v.status === "ready" ? `${v.seconds} s Probe` : v.status === "error" ? "Fehler beim Vorbereiten" : "wird vorbereitet …") : esc(v.note || (v.gender === "f" ? "weiblich" : "männlich"))}${v.kind === "builtin" && !v.downloaded ? ` · ${v.downloading != null ? `lädt ${Math.round(v.downloading * 100)} %` : `${v.size} MB, lädt beim ersten Mal`}` : ""}</span></span>
      <span>${v.kind === "clone" && v.status === "preparing" ? '<span class="spin"></span>' : ""}</span></button>`).join("")
    : `<p style="color:var(--muted);font-size:14px;padding:8px">${filter === "clone" ? 'Noch keine eigenen Stimmen. <a href="#" id="toClone">Jetzt eine klonen</a>.' : "Keine Stimmen."}</p>`;
  $$("#voices .voice").forEach((b) => b.addEventListener("click", () => { selected = b.dataset.id; save("voice", selected); renderVoices(); renderSettings(); }));
  $("#toClone")?.addEventListener("click", (e) => { e.preventDefault(); showTab("clone"); });
}
$$("#filters button").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.l; save("filter", filter); renderVoices(); }));
function renderSettings() {
  const v = voices.find((x) => x.id === selected);
  $("#expRow").classList.toggle("hidden", v?.kind !== "clone");
  $("#langRow").classList.toggle("hidden", v?.kind !== "clone");
  if (v?.kind === "clone") $("#lang").value = load("lang:" + v.id, v.lang);
}
function renderEngine() {
  const c = status.clone;
  $("#engine").textContent = c.ready ? `Klonen bereit (${c.device})` : c.running ? "Klon-Engine startet …" : "";
}
$("#speed").addEventListener("input", (e) => ($("#speedV").textContent = (+e.target.value).toFixed(2).replace(/0$/, "") + "×"));
$("#exp").addEventListener("input", (e) => ($("#expV").textContent = (+e.target.value).toFixed(2)));
$("#lang").addEventListener("change", (e) => save("lang:" + selected, e.target.value));

/* ---------- speak ---------- */
const text = $("#text");
const count = () => ($("#count").textContent = `${text.value.length.toLocaleString("de-DE")} / 20 000 Zeichen`);
text.addEventListener("input", count); count();
text.value = load("text", text.value); count();
text.addEventListener("change", () => save("text", text.value));
text.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") $("#go").click(); });
$("#go").addEventListener("click", async () => {
  const v = voices.find((x) => x.id === selected);
  if (!text.value.trim()) return;
  const btn = $("#go"); btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span> ${v?.kind === "clone" ? "Klon spricht …" : v && !v.downloaded ? "Stimme wird geladen …" : "Spricht …"}`;
  const t0 = performance.now();
  try {
    const r = await api("/api/speak", { method: "POST", json: { text: text.value, voice: selected, speed: +$("#speed").value, exaggeration: +$("#exp").value, lang: $("#lang").value } });
    showResult(r, (performance.now() - t0) / 1000);
    loadHistory(); refresh();
  } catch (e) { toast(e.message, 4000); }
  btn.disabled = false; btn.textContent = "Sprechen";
});
function showResult(r, took) {
  const el = $("#result"); el.classList.remove("hidden");
  el.innerHTML = `<div class="row"><audio controls autoplay src="${r.url}"></audio><a class="btn small" href="${r.url}?download=1">MP3 laden</a></div>
    <p style="font-size:12.5px;color:var(--muted);margin-top:8px">${esc(r.voiceName)} · ${mmss(r.duration)} · ${r.cached ? "aus dem Verlauf" : `erzeugt in ${took.toFixed(1)} s`}</p>
    ${r.sentences.length > 1 ? `<div class="sents">${r.sentences.map((s) => `<span data-t="${s.start}"><b>${mmss(s.start)}</b>${esc(s.text)}</span>`).join("")}</div>` : ""}`;
  const au = $("audio", el);
  $$(".sents span", el).forEach((s) => s.addEventListener("click", () => { au.currentTime = +s.dataset.t; au.play(); }));
  au.addEventListener("timeupdate", () => { let cur = null; $$(".sents span", el).forEach((s) => { if (+s.dataset.t <= au.currentTime) cur = s; s.classList.remove("now"); }); cur?.classList.add("now"); });
}
async function loadHistory() {
  const h = await api("/api/history?limit=30");
  $("#hist").innerHTML = h.length ? h.map((x) => `<div class="h"><p>${esc(x.text)}</p><small>${esc(x.voiceName)} · ${mmss(x.duration)} · ${new Date(x.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</small>
    <span class="acts"><button class="btn small ghost" data-play="${x.url}">▶</button><a class="btn small ghost" href="${x.url}?download=1">⤓</a><button class="btn small ghost" data-del="${x.id}">✕</button></span></div>`).join("")
    : '<p style="color:var(--muted);font-size:14px;padding:12px 4px">Hier landet alles, was du sprechen lässt.</p>';
  let au;
  $$("#hist [data-play]").forEach((b) => b.addEventListener("click", () => { au?.pause(); au = new Audio(b.dataset.play); au.play(); }));
  $$("#hist [data-del]").forEach((b) => b.addEventListener("click", async () => { await api("/api/history/" + b.dataset.del, { method: "DELETE" }); loadHistory(); }));
}

/* ---------- clone ---------- */
const SCRIPTS = {
  de: "Hallo, das ist meine Stimme. Ich spreche ganz normal, so wie ich auch im Alltag rede. Heute ist ein guter Tag, um etwas Neues auszuprobieren. Kaffee am Morgen, ein kurzer Spaziergang, und dann geht es los mit der Arbeit.",
  en: "Hi, this is my voice. I'm speaking normally, the way I talk every day. Today is a good day to try something new. Coffee in the morning, a short walk, and then it's time to get to work.",
};
let blob = null, rec = null, recStart = 0, recTimer = 0, recStream = null;
$("#vlang").addEventListener("change", () => ($("#script").textContent = SCRIPTS[$("#vlang").value]));
$("#script").textContent = SCRIPTS.de;
const canCreate = () => ($("#mk").disabled = !(blob && $("#consent").checked && $("#person").value.trim().length > 1));
["#consent", "#person"].forEach((s) => $(s).addEventListener("input", canCreate));
$("#recBtn").addEventListener("click", async () => {
  if (rec) { rec.stop(); return; }
  try { recStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }); }
  catch (e) { toast("Kein Mikrofon: " + e.message, 4000); return; }
  const parts = []; rec = new MediaRecorder(recStream);
  rec.ondataavailable = (e) => parts.push(e.data);
  rec.onstop = () => { recStream.getTracks().forEach((t) => t.stop()); clearInterval(recTimer); rec = null; setBlob(new Blob(parts, { type: parts[0]?.type || "audio/webm" })); $("#recBtn").textContent = "● Neu aufnehmen"; $("#lvl").style.width = "0"; };
  rec.start(); recStart = Date.now();
  $("#recBtn").textContent = "■ Stopp";
  const ac = new AudioContext(), an = ac.createAnalyser(); ac.createMediaStreamSource(recStream).connect(an);
  const buf = new Uint8Array(512);
  recTimer = setInterval(() => { an.getByteTimeDomainData(buf); let p = 0; for (const v of buf) p = Math.max(p, Math.abs(v - 128)); $("#lvl").style.width = Math.min(100, p) + "%"; const s = (Date.now() - recStart) / 1000; $("#recT").textContent = mmss(s); if (s > 45) rec?.stop(); }, 80);
});
$("#file").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) setBlob(f); });
function setBlob(b) { blob = b; $("#preview").src = URL.createObjectURL(b); $("#preview").classList.remove("hidden"); canCreate(); }
$("#mk").addEventListener("click", async () => {
  $("#mk").disabled = true; $("#cmsg").textContent = "Wird hochgeladen …";
  try {
    const q = new URLSearchParams({ name: $("#vname").value || "Meine Stimme", lang: $("#vlang").value, consent: $("#consent").checked ? "1" : "0", person: $("#person").value });
    const v = await api("/api/voices/clone?" + q, { method: "POST", body: blob });
    $("#cmsg").textContent = "Fertig hochgeladen. Die Stimme wird jetzt vorbereitet (beim allerersten Mal lädt Stimme das Klon-Modell, ~3 GB).";
    selected = v.id; save("voice", selected); filter = "clone"; save("filter", filter);
    blob = null; $("#preview").classList.add("hidden"); $("#consent").checked = false;
    refresh(); poll();
  } catch (e) { $("#cmsg").innerHTML = `<span class="err">${esc(e.message)}</span>`; canCreate(); }
});
let pollT;
function poll() { clearTimeout(pollT); pollT = setTimeout(async () => { await refresh(); if (voices.some((v) => v.kind === "clone" && v.status === "preparing") || status.clone.running && !status.clone.ready) poll(); }, 2500); }
function renderClone() {
  const mine = voices.filter((v) => v.kind === "clone");
  $("#mine").innerHTML = mine.length ? mine.map((v) => `<div class="v"><b>${esc(v.name)}</b><span><button class="btn small ghost" data-use="${v.id}">Benutzen</button><button class="btn small ghost" data-del="${v.id}">Löschen</button></span>
    <small>${v.lang.toUpperCase()} · ${v.seconds} s Probe · Einwilligung: ${esc(v.consent?.person || "?")} · ${v.status === "ready" ? "bereit" : v.status === "error" ? `<span class="err">${esc(v.error)}</span>` : "wird vorbereitet …"}</small>
    <audio controls preload="none" src="/api/voices/${v.id}/sample" style="grid-column:1/-1;width:100%;height:32px;margin-top:4px"></audio></div>`).join("")
    : '<p style="color:var(--muted);font-size:14px">Noch keine geklonten Stimmen.</p>';
  $$("#mine [data-use]").forEach((b) => b.addEventListener("click", () => { selected = b.dataset.use; save("voice", selected); showTab("studio"); renderVoices(); renderSettings(); }));
  $$("#mine [data-del]").forEach((b) => b.addEventListener("click", async () => { if (confirm("Diese Stimme löschen?")) { await api("/api/voices/" + b.dataset.del, { method: "DELETE" }); refresh(); } }));
  const c = status.clone;
  $("#cstate").innerHTML = !c.installed ? "<b>Klonen ist noch nicht installiert.</b> Einmal im Terminal ausführen: <code>npm run setup-clone</code> (Python, ~2 GB). Fertige Stimmen funktionieren auch ohne."
    : c.ready ? `<b>Klon-Engine läuft</b> auf ${c.device === "cuda" ? "der NVIDIA-Grafikkarte" : c.device === "mps" ? "dem Apple-Chip" : "der CPU (langsamer, ca. 3–4× Echtzeit)"}.`
    : c.error ? `<b>Klon-Engine:</b> <span class="err">${esc(c.error)}</span>` : c.running ? '<span class="spin"></span> Klon-Engine startet … (beim ersten Mal wird das Modell geladen)' : "Die Klon-Engine startet automatisch, wenn du sie brauchst.";
}

/* ---------- api docs ---------- */
function renderApi() {
  const o = location.origin;
  $("#curl1").textContent = `curl -X POST ${o}/api/speak \\\n  -H 'Content-Type: application/json' \\\n  -d '{"text":"Hallo Welt","voice":"thorsten","speed":1}'\n\n# → { "url": "/audio/….mp3", "duration": 1.2, "sentences": [{ "text", "start", "end" }] }`;
  $("#curl2").textContent = `curl -X POST '${o}/api/speak?raw=1' -H 'Content-Type: application/json' \\\n  -d '{"text":"Hello world","voice":"heart","format":"wav"}' -o hallo.wav`;
  $("#curl3").textContent = `curl ${o}/api/voices`;
}

refresh().then(() => { loadHistory(); if (status.clone.running && !status.clone.ready) poll(); });
