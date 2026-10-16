// The player: the screen video, the camera bubble on top (kept in sync), captions, chapters, comments
// on the timeline, and cuts that are skipped while playing. No rendering needed to watch an edit.
import { $, time, icons, store } from "/js/lib.js";
import { inCut } from "/js/cuts.js";

export function parseVtt(text) {
  const out = [];
  const ts = (s) => { const p = s.trim().split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
  for (const block of text.replace(/\r/g, "").split("\n\n")) {
    const lines = block.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    out.push({ start: ts(a), end: ts(b.trim().split(/\s+/)[0]), text: lines.slice(i + 1).join("\n") });
  }
  return out;
}

export function createPlayer(root, meta) {
  root.classList.add("player");
  root.innerHTML = `
    <div class="frame">
      <video class="main" playsinline preload="auto"></video>
      <div class="bub hidden"><video class="cam" playsinline muted preload="auto"></video></div>
      <div class="caption hidden"><span></span></div>
      <button class="bigplay" aria-label="Abspielen">${icons.play}</button>
    </div>
    <div class="bar">
      <button class="pp" aria-label="Abspielen">${icons.play}</button>
      <span class="tm">0:00 / 0:00</span>
      <div class="track" role="slider" aria-label="Position" tabindex="0"><div class="cuts"></div><div class="buf"></div><div class="fill"></div><div class="marks"></div><div class="knob"></div><div class="hover"></div></div>
      <button class="rate" title="Geschwindigkeit">1×</button>
      <button class="ccb" title="Untertitel (C)">${icons.cc}</button>
      <button class="fs" title="Vollbild (F)">${icons.full}</button>
    </div>`;
  const main = $(".main", root), cam = $(".cam", root), bub = $(".bub", root), cap = $(".caption", root);
  const P = { main, cam, cuts: meta.edits?.cuts || [], cues: [], captions: store.get("cc", true), chapters: meta.chapters || [], comments: meta.comments || [], listeners: new Set() };
  const D = () => meta.duration || main.duration || 0;

  main.src = `/media/${meta.id}/${meta.media.main}`;
  if (meta.media.cam) { cam.src = `/media/${meta.id}/${meta.media.cam}`; }
  main.poster = `/media/${meta.id}/thumb.jpg`;

  P.setBubble = (b) => {
    meta.bubble = b;
    const show = meta.media.cam && !b.hidden;
    bub.classList.toggle("hidden", !show);
    bub.dataset.corner = b.corner; bub.dataset.shape = b.shape || "circle";
    bub.style.width = `${(b.size || 0.2) * 100}%`;
  };
  P.setBubble(meta.bubble);

  P.setCuts = (c) => { P.cuts = c; drawCuts(); };
  P.setMarks = ({ chapters, comments } = {}) => { if (chapters) P.chapters = chapters; if (comments) P.comments = comments; drawMarks(); };
  P.loadCaptions = async (file) => {
    try { P.cues = parseVtt(await (await fetch(`/media/${meta.id}/${file}?t=${Date.now()}`)).text()); } catch { P.cues = []; }
    showCaption();
  };
  P.seek = (t) => { main.currentTime = Math.max(0, Math.min(D() - 0.05, t)); if (cam.src) cam.currentTime = main.currentTime; };
  P.play = () => main.play(); P.pause = () => main.pause();
  P.toggle = () => (main.paused ? main.play() : main.pause());
  P.on = (fn) => (P.listeners.add(fn), () => P.listeners.delete(fn));
  P.time = () => main.currentTime;

  /* sync + skip cuts, every frame while playing */
  let raf = 0;
  function loop() {
    const t = main.currentTime;
    const c = inCut(P.cuts, t);
    if (c && !main.paused) { if (c[1] >= D() - 0.05) { main.pause(); main.currentTime = c[0]; } else main.currentTime = c[1]; }
    if (cam.src && !bub.classList.contains("hidden")) {
      if (Math.abs(cam.currentTime - main.currentTime) > 0.15) cam.currentTime = main.currentTime;
      if (main.paused !== cam.paused) main.paused ? cam.pause() : cam.play().catch(() => {});
    }
    ui(); showCaption();
    for (const fn of P.listeners) fn(main.currentTime);
    raf = main.paused ? 0 : requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  main.addEventListener("play", () => { root.classList.add("playing"); const c = inCut(P.cuts, main.currentTime); if (c) main.currentTime = c[1]; kick(); });
  main.addEventListener("pause", () => { root.classList.remove("playing"); cam.pause(); loop(); });
  main.addEventListener("seeked", () => { if (cam.src) cam.currentTime = main.currentTime; loop(); });
  main.addEventListener("ratechange", () => { cam.playbackRate = main.playbackRate; });
  main.addEventListener("loadedmetadata", () => { ui(); drawCuts(); drawMarks(); });
  main.addEventListener("progress", ui);
  main.addEventListener("ended", () => root.classList.remove("playing"));

  /* controls */
  const track = $(".track", root);
  const tFromX = (x) => { const r = track.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * D(); };
  track.addEventListener("pointerdown", (e) => {
    track.setPointerCapture(e.pointerId); P.seek(tFromX(e.clientX));
    const mv = (ev) => P.seek(tFromX(ev.clientX));
    track.addEventListener("pointermove", mv);
    track.addEventListener("pointerup", () => track.removeEventListener("pointermove", mv), { once: true });
  });
  track.addEventListener("pointermove", (e) => {
    const h = $(".hover", root), t = tFromX(e.clientX), r = track.getBoundingClientRect();
    const ch = [...P.chapters].reverse().find((c) => c.t <= t);
    h.textContent = time(t) + (ch ? " · " + ch.title : ""); h.style.left = `${e.clientX - r.left}px`;
  });
  track.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") P.seek(main.currentTime + 5); if (e.key === "ArrowLeft") P.seek(main.currentTime - 5); });
  $(".pp", root).onclick = P.toggle; $(".bigplay", root).onclick = P.toggle;
  main.addEventListener("click", P.toggle);
  const rates = [1, 1.25, 1.5, 1.75, 2];
  const rateBtn = $(".rate", root);
  main.playbackRate = store.get("rate", 1); rateBtn.textContent = main.playbackRate + "×";
  rateBtn.onclick = () => { const r = rates[(rates.indexOf(main.playbackRate) + 1) % rates.length]; main.playbackRate = r; rateBtn.textContent = r + "×"; store.set("rate", r); };
  const ccBtn = $(".ccb", root);
  const setCC = (on) => { P.captions = on; store.set("cc", on); ccBtn.classList.toggle("on", on); showCaption(); };
  ccBtn.onclick = () => setCC(!P.captions); setCC(P.captions);
  $(".fs", root).onclick = () => (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen());
  P.keys = (e) => {
    if (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") { e.preventDefault(); P.toggle(); }
    else if (k === "arrowright" || k === "l") P.seek(main.currentTime + (k === "l" ? 10 : 5));
    else if (k === "arrowleft" || k === "j") P.seek(main.currentTime - (k === "j" ? 10 : 5));
    else if (k === "c") setCC(!P.captions);
    else if (k === "f") $(".fs", root).click();
    else if (k === "m") main.muted = !main.muted;
  };

  function ui() {
    const d = D(), t = main.currentTime, k = d ? t / d : 0;
    $(".fill", root).style.width = `${k * 100}%`; $(".knob", root).style.left = `${k * 100}%`;
    const b = main.buffered.length ? main.buffered.end(main.buffered.length - 1) / d : 0;
    $(".buf", root).style.width = `${Math.min(1, b) * 100}%`;
    $(".tm", root).textContent = `${time(t)} / ${time(d)}`;
    $(".pp", root).innerHTML = main.paused ? icons.play : icons.pause;
  }
  function showCaption() {
    const t = main.currentTime;
    const c = P.captions && P.cues.find((x) => t >= x.start && t <= x.end + 0.15);
    cap.classList.toggle("hidden", !c);
    if (c) cap.firstElementChild.textContent = c.text;
  }
  function drawCuts() {
    const d = D(); if (!d) return;
    $(".cuts", root).innerHTML = P.cuts.map(([a, b]) => `<i style="left:${(a / d) * 100}%;width:${((b - a) / d) * 100}%"></i>`).join("");
  }
  function drawMarks() {
    const d = D(); if (!d) return;
    $(".marks", root).innerHTML =
      P.chapters.filter((c) => c.t > 0).map((c) => `<i class="ch" style="left:${(c.t / d) * 100}%" title="${c.title.replace(/"/g, "&quot;")}"></i>`).join("") +
      P.comments.map((c) => `<b style="left:${(c.t / d) * 100}%" title="${(c.emoji || "") + " " + c.name}">${c.emoji || ""}</b>`).join("");
  }
  return P;
}
