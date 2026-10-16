// The recorder: screen, camera and mic as three separate recordings, uploaded second by second.
import { $, $$, api, time, store, toast } from "/js/lib.js";

const S = {
  mode: store.get("mode", "both"), corner: store.get("corner", "bl"),
  cam: null, mic: null, screen: null, // MediaStreams
  recs: [], rec: null, started: 0, pausedAt: 0, pausedTotal: 0, paused: false, pip: null, tick: null,
};
const needsCam = () => S.mode !== "screen";
const needsScreen = () => S.mode !== "cam";

/* ---------- devices ---------- */
async function devices() {
  const list = await navigator.mediaDevices.enumerateDevices();
  const fill = (sel, kind, saved) => {
    const ds = list.filter((d) => d.kind === kind);
    sel.innerHTML = (kind === "videoinput" && !ds.length ? '<option value="">Keine Kamera gefunden</option>' : "") + ds.map((d, i) => `<option value="${d.deviceId}">${d.label || (kind === "videoinput" ? "Kamera " : "Mikrofon ") + (i + 1)}</option>`).join("") + (kind === "audioinput" ? '<option value="none">Kein Mikrofon</option>' : "");
    if (saved && [...sel.options].some((o) => o.value === saved)) sel.value = saved;
  };
  fill($("#cam"), "videoinput", store.get("camId"));
  fill($("#mic"), "audioinput", store.get("micId"));
}

async function openCam() {
  S.cam?.getTracks().forEach((t) => t.stop()); S.cam = null;
  if (!needsCam()) { $("#bubble").classList.add("hidden"); return; }
  try {
    const id = $("#cam").value;
    S.cam = await navigator.mediaDevices.getUserMedia({ video: { ...(id ? { deviceId: { exact: id } } : {}), width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } } });
    $("#camPreview").srcObject = S.cam;
    $("#bubble").classList.remove("hidden");
  } catch (e) { msg("Kamera nicht verfügbar: " + e.message); $("#bubble").classList.add("hidden"); }
}

let meterRaf = 0, actx = null;
async function openMic() {
  S.mic?.getTracks().forEach((t) => t.stop()); S.mic = null; cancelAnimationFrame(meterRaf);
  if ($("#mic").value === "none") { $("#level").style.width = "0"; return; }
  try {
    const id = $("#mic").value;
    S.mic = await navigator.mediaDevices.getUserMedia({ audio: { ...(id ? { deviceId: { exact: id } } : {}), echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 } });
    actx ??= new AudioContext();
    const an = actx.createAnalyser(); an.fftSize = 512;
    actx.createMediaStreamSource(S.mic).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const loop = () => { an.getByteTimeDomainData(buf); let p = 0; for (const v of buf) p = Math.max(p, Math.abs(v - 128)); const w = Math.min(100, p / 1.1) + "%"; $("#level").style.width = w; if (S.pip) { const l = S.pip.document.querySelector(".lvl i"); if (l) l.style.width = w; } meterRaf = requestAnimationFrame(loop); };
    loop();
  } catch (e) { msg("Mikrofon nicht verfügbar: " + e.message); }
}

function setMode(m) {
  S.mode = m; store.set("mode", m);
  $$("#modes button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  $("#camRow").classList.toggle("hidden", !needsCam());
  $("#bubRow").classList.toggle("hidden", S.mode !== "both");
  $("#qualRow").classList.toggle("hidden", !needsScreen());
  $("#bubble").classList.toggle("solo", S.mode === "cam");
  $("#bubble").style.width = S.mode === "cam" ? "" : `${$("#bubSize").value * 100}%`;
  $("#bubble").dataset.corner = S.mode === "cam" ? "" : S.corner;
  openCam();
}

/* the bubble snaps to the corner it is dragged towards */
$("#bubble").addEventListener("pointerdown", (e) => {
  if (S.mode !== "both") return;
  const st = $("#stage").getBoundingClientRect();
  const up = (ev) => {
    removeEventListener("pointerup", up);
    const x = (ev.clientX - st.left) / st.width, y = (ev.clientY - st.top) / st.height;
    S.corner = (y < 0.5 ? "t" : "b") + (x < 0.5 ? "l" : "r");
    $("#bubble").dataset.corner = S.corner; store.set("corner", S.corner);
  };
  addEventListener("pointerup", up);
});

/* ---------- recording ---------- */
function pickMime(kind, withAudio) {
  const v = withAudio
    ? ["video/mp4;codecs=avc1.640033,opus", "video/mp4;codecs=avc1,opus", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    : ["video/mp4;codecs=avc1.640033", "video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const a = ["audio/webm;codecs=opus", "audio/mp4;codecs=opus", "audio/webm", "audio/mp4"];
  return (kind === "audio" ? a : v).find((m) => MediaRecorder.isTypeSupported(m)) || "";
}

/** One track: a MediaRecorder whose 1-second chunks are sent in order; failed sends are retried. */
function track(name, stream, mime, bps, recId) {
  const rec = new MediaRecorder(stream, { mimeType: mime, ...(name === "mic" ? { audioBitsPerSecond: 128_000 } : { videoBitsPerSecond: bps, audioBitsPerSecond: 160_000 }) });
  const q = []; let seq = 0, sending = false, sent = 0, done = null;
  const doneP = new Promise((r) => (done = r));
  let stopped = false;
  async function pump() {
    if (sending) return; sending = true;
    while (q.length) {
      const c = q[0];
      try {
        const res = await fetch(`/api/recordings/${recId}/tracks/${name}/${c.seq}`, { method: "PUT", body: c.blob });
        if (res.status === 409) { const j = await res.json().catch(() => ({})); if (typeof j.expected === "number") { while (q.length && q[0].seq < j.expected) q.shift(); if (q.length && q[0].seq > j.expected) throw new Error("chunk lost"); continue; } throw new Error("server refused"); }
        if (!res.ok) throw new Error("upload " + res.status);
        q.shift(); sent += c.blob.size; status();
      } catch (e) { status(true); await new Promise((r) => setTimeout(r, 1500)); }
    }
    sending = false;
    if (stopped && !q.length) done();
  }
  rec.ondataavailable = (e) => { if (e.data.size) { q.push({ seq: seq++, blob: e.data }); pump(); } };
  rec.onstop = () => { stopped = true; if (!q.length && !sending) done(); else pump(); };
  return { name, rec, get pending() { return q.length; }, get sent() { return sent; }, finished: doneP };
}

function status(retrying) {
  const pend = S.recs.reduce((n, t) => n + t.pending, 0);
  const mb = S.recs.reduce((n, t) => n + t.sent, 0) / 1e6;
  $("#msg").textContent = retrying ? "Verbindung zum Klipp-Server unterbrochen, wird wiederholt … (nichts geht verloren, solange dieser Tab offen bleibt)" : S.rec ? `${mb.toFixed(1)} MB gesichert${pend > 2 ? ` · ${pend} Teile warten` : ""}` : "";
}
const msg = (t) => ($("#msg").textContent = t);

async function start() {
  $("#start").disabled = true; msg("");
  try {
    if (needsScreen()) {
      const [h, fps] = $("#quality").value.split("-").map(Number);
      S.screen = await navigator.mediaDevices.getDisplayMedia({
        video: { height: { ideal: h }, width: { ideal: Math.round((h * 16) / 9) }, frameRate: { ideal: fps, max: fps } },
        audio: $("#sysAudio").checked ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false,
        selfBrowserSurface: "exclude", surfaceSwitching: "include", systemAudio: "include", monitorTypeSurfaces: "include",
      });
      $("#screenPreview").srcObject = S.screen; $("#screenPreview").classList.remove("hidden"); $("#hint").classList.add("hidden"); $("#screenPreview").play();
      S.screen.getVideoTracks()[0].addEventListener("ended", () => S.rec && stop());
    }
    if (needsCam() && !S.cam) await openCam();
    if (S.mode === "cam" && !S.cam) throw new Error("Keine Kamera");

    await openPip();
    if ($("#countdown").checked) await countdown();

    const sv = S.screen?.getVideoTracks()[0], sa = S.screen?.getAudioTracks() || [];
    const set = sv?.getSettings() || {}, cset = S.cam?.getVideoTracks()[0]?.getSettings() || {};
    const tracks = {};
    const plan = [];
    if (sv) { const mime = pickMime("video", sa.length > 0); tracks.screen = { mime, width: set.width, height: set.height }; plan.push(["screen", new MediaStream([sv, ...sa]), mime, bitrate(set)]); }
    if (S.cam) { const mime = pickMime("video", false); tracks.cam = { mime, width: cset.width, height: cset.height }; plan.push(["cam", new MediaStream(S.cam.getVideoTracks()), mime, S.mode === "cam" ? 8e6 : 3e6]); }
    if (S.mic) { const mime = pickMime("audio"); tracks.mic = { mime }; plan.push(["mic", new MediaStream(S.mic.getAudioTracks()), mime, 0]); }
    const meta = await api("/api/recordings", { method: "POST", body: { tracks, language: $("#lang").value, bubble: { corner: S.corner, size: Number($("#bubSize").value), shape: "circle" } } });
    S.rec = meta;
    S.recs = plan.map(([n, st, mime, bps]) => track(n, st, mime, bps, meta.id));
    S.recs.forEach((t) => t.rec.start(1000)); // all three start in the same tick: they stay in sync
    S.started = performance.now(); S.pausedTotal = 0; S.paused = false;
    document.title = "● Aufnahme · Klipp";
    $("#recbar").classList.remove("hidden");
    S.tick = setInterval(tick, 250); tick();
  } catch (e) {
    cleanup();
    if (e.name !== "NotAllowedError") msg("Start fehlgeschlagen: " + e.message);
    $("#start").disabled = false;
  }
}
const bitrate = (s) => { const px = (s.width || 1920) * (s.height || 1080), fps = s.frameRate || 30; return Math.round(Math.min(25e6, Math.max(4e6, px * fps * 0.1))); };
const elapsed = () => ((S.paused ? S.pausedAt : performance.now()) - S.started - S.pausedTotal) / 1000;
function tick() { const t = time(elapsed()); $("#timer").textContent = t; const p = S.pip?.document.querySelector(".t"); if (p) p.textContent = t; status(); }

function pause() {
  if (!S.rec) return;
  if (!S.paused) { S.recs.forEach((t) => t.rec.pause()); S.paused = true; S.pausedAt = performance.now(); }
  else { S.recs.forEach((t) => t.rec.resume()); S.pausedTotal += performance.now() - S.pausedAt; S.paused = false; }
  $("#recbar").classList.toggle("paused", S.paused);
  for (const b of [$("#pause"), S.pip?.document.querySelector(".pause")]) if (b) b.textContent = S.paused ? "Weiter" : "Pause";
}

async function stop() {
  if (!S.rec || S.stopping) return; S.stopping = true;
  const seconds = elapsed();
  clearInterval(S.tick);
  S.recs.forEach((t) => t.rec.state !== "inactive" && t.rec.stop());
  msg("Letzte Sekunden werden gesichert …");
  await Promise.all(S.recs.map((t) => t.finished));
  const id = S.rec.id;
  await api(`/api/recordings/${id}/finish`, { method: "POST", body: { seconds } });
  cleanup(true);
  location.href = `/v/${id}?new=1`;
}

async function restart() {
  if (!S.rec || !confirm("Diese Aufnahme verwerfen und neu beginnen?")) return;
  const id = S.rec.id; S.stopping = true;
  clearInterval(S.tick);
  S.recs.forEach((t) => { t.rec.ondataavailable = null; t.rec.state !== "inactive" && t.rec.stop(); });
  await api(`/api/recordings/${id}`, { method: "DELETE" }).catch(() => {});
  cleanup(); toast("Verworfen");
}

function cleanup(keepCam) {
  S.screen?.getTracks().forEach((t) => t.stop()); S.screen = null;
  S.pip?.close(); S.pip = null;
  S.rec = null; S.recs = []; S.stopping = false; S.paused = false;
  document.title = "Neue Aufnahme · Klipp";
  $("#recbar").classList.add("hidden"); $("#recbar").classList.remove("paused"); $("#pause").textContent = "Pause";
  $("#screenPreview").classList.add("hidden"); $("#hint").classList.remove("hidden");
  $("#start").disabled = false;
  if (!keepCam) status();
}

/* ---------- the floating bubble: stays on top of every app while you record (Chrome / Edge) ---------- */
async function openPip() {
  if (!("documentPictureInPicture" in window)) return;
  const withCam = Boolean(S.cam) && S.mode === "both";
  try {
    S.pip = await documentPictureInPicture.requestWindow({ width: withCam ? 230 : 260, height: withCam ? 300 : 96 });
  } catch { return; }
  const d = S.pip.document;
  d.head.innerHTML = `<style>
    *{box-sizing:border-box;margin:0}body{background:#111;color:#fff;font:600 14px system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100vh;padding:10px;user-select:none}
    .b{width:min(100%,82vh);aspect-ratio:1;border-radius:50%;overflow:hidden;box-shadow:0 0 0 3px rgba(255,255,255,.85)}.b video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
    .bar{display:flex;align-items:center;gap:6px;width:100%;justify-content:center}.t{font:600 15px ui-monospace,monospace;min-width:52px;text-align:center}
    button{border:0;border-radius:9px;padding:7px 10px;font:600 13px system-ui;cursor:pointer;background:#2a2a2e;color:#fff}.stop{background:#ff4d3a}
    .lvl{width:70%;height:4px;background:#2a2a2e;border-radius:2px;overflow:hidden}.lvl i{display:block;height:100%;width:0;background:#45c482}
    .count{position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.6);font:800 64px system-ui}</style>`;
  d.body.innerHTML = `${withCam ? '<div class="b"><video autoplay muted playsinline></video></div>' : ""}<div class="bar"><span class="t">0:00</span><button class="pause">Pause</button><button class="stop">Fertig</button></div><div class="lvl"><i></i></div>`;
  if (withCam) d.querySelector("video").srcObject = S.cam;
  d.querySelector(".pause").onclick = pause;
  d.querySelector(".stop").onclick = stop;
  S.pip.addEventListener("pagehide", () => (S.pip = null));
}

async function countdown() {
  for (const n of [3, 2, 1]) {
    const els = [document.createElement("div")];
    if (S.pip) els.push(S.pip.document.createElement("div"));
    for (const e of els) { e.className = "count"; e.textContent = n; }
    document.body.appendChild(els[0]); if (els[1]) S.pip.document.body.appendChild(els[1]);
    await new Promise((r) => setTimeout(r, 800));
    els.forEach((e) => e.remove());
  }
}

/* ---------- wiring ---------- */
$$("#modes button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
$("#cam").addEventListener("change", () => { store.set("camId", $("#cam").value); openCam(); });
$("#mic").addEventListener("change", () => { store.set("micId", $("#mic").value); openMic(); });
$("#lang").addEventListener("change", () => store.set("lang", $("#lang").value));
$("#quality").addEventListener("change", () => store.set("quality", $("#quality").value));
$("#bubSize").addEventListener("change", () => { store.set("bubSize", $("#bubSize").value); setMode(S.mode); });
$("#start").addEventListener("click", start);
$("#stop").addEventListener("click", stop);
$("#pause").addEventListener("click", pause);
$("#restart").addEventListener("click", restart);
addEventListener("beforeunload", (e) => { if (S.rec) { e.preventDefault(); e.returnValue = ""; } });
addEventListener("keydown", (e) => { if (S.rec && e.altKey && e.shiftKey && e.code === "KeyS") stop(); if (S.rec && e.altKey && e.shiftKey && e.code === "KeyP") pause(); });

(async () => {
  if (!navigator.mediaDevices?.getDisplayMedia) { msg("Dieser Browser kann den Bildschirm nicht aufnehmen. Nimm Chrome, Edge oder Firefox am Computer."); $("#start").disabled = true; }
  const nav = (navigator.language || "de").slice(0, 2);
  const map = { de: "german", en: "english", fr: "french", es: "spanish", it: "italian", nl: "dutch", pl: "polish", tr: "turkish", pt: "portuguese" };
  $("#lang").value = store.get("lang", map[nav] || "german");
  $("#quality").value = store.get("quality", "1080-30");
  $("#bubSize").value = store.get("bubSize", "0.2");
  // ask once for camera + mic so the device lists have names
  try { const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: S.mode !== "screen" }); s.getTracks().forEach((t) => t.stop()); } catch {}
  await devices();
  setMode(S.mode);
  openMic();
  navigator.mediaDevices.addEventListener?.("devicechange", devices);
})();
