// Bring a cat onboard: referral links, Jupiter swaps (solo or paired with catonboard), live board, hero graph.
// Without a deployed API (local file, preview) the board and graph run on clearly labelled preview data.
const C = window.CAT_CONFIG || {};
const $ = (s) => document.querySelector(s);
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SOL = "So11111111111111111111111111111111111111112";
const JUP = "https://lite-api.jup.ag/swap/v1";
const DECIMALS = 6; // pump.fun coins use 6 decimals
const short = (a) => (a ? a.slice(0, 4) + "…" + a.slice(-4) : "");
const fmt = (n, d = 2) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d });
const ago = (t) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? s + "s" : s < 3600 ? Math.round(s / 60) + "m" : Math.round(s / 3600) + "h"; };
const msg = (el, text, cls = "") => { el.textContent = text; el.className = "msg " + cls; };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

/* ---------- referral: /@name or ?r=name|wallet; the first link a visitor arrives with is kept ---------- */
const urlRef = (new URLSearchParams(location.search).get("r") || (location.pathname.match(/^\/@([a-z0-9_]{3,15})/i) || [])[1] || "").replace(/^@/, "");
if (urlRef && !store.get("cat-ref")) store.set("cat-ref", urlRef);
let REF = store.get("cat-ref") || "";
const refName = (r) => (r.length > 20 ? short(r) : "@" + r);

/* ---------- wallet ---------- */
const provider = () => window.phantom?.solana || window.solflare || window.backpack || window.solana || null;
let wallet = "", myHandle = "";
async function connect() {
  const p = provider();
  if (!p) { msg($("#linkMsg"), "No Solana wallet found. Install Phantom or Solflare, or open this page in its in-app browser.", "err"); return false; }
  try {
    const r = await p.connect(); wallet = (r?.publicKey || p.publicKey).toString();
    if (REF && (REF === wallet)) REF = "";
    onWallet(); return true;
  } catch { msg($("#linkMsg"), "Connection cancelled.", "err"); return false; }
}
function onWallet() {
  $("#connect").textContent = short(wallet) + " · connected"; $("#connect").disabled = true;
  $("#claimRow").hidden = false;
  showLink(); refreshSwapBtn(); loadBoard();
}
function link() { return location.origin + (myHandle ? "/@" + myHandle : "/?r=" + wallet); }
function showLink() {
  $("#linkBox").hidden = false; $("#myLink").textContent = link().replace(/^https?:\/\//, "");
  $("#shareRow").hidden = false;
  const text = myHandle ? `I’m bringing cats onboard. Use my link and get on the board 🐈` : `Bring a cat onboard 🐈`;
  $("#postX").href = "https://x.com/intent/post?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(link());
  drawCard();
  if (!myHandle) msg($("#linkMsg"), "Your wallet link works now. Claim a short @name to make it nicer.");
}
async function claim() {
  const handle = $("#handle").value.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_]{3,15}$/.test(handle)) { msg($("#linkMsg"), "Use 3 to 15 letters, numbers or _.", "err"); return; }
  const p = provider(); const ts = Date.now();
  const text = `Bring a cat onboard\nclaim @${handle} for ${wallet}\n${ts}`;
  let sig;
  try { const r = await p.signMessage(new TextEncoder().encode(text), "utf8"); sig = b58(r?.signature || r); }
  catch { msg($("#linkMsg"), "Signing cancelled. Nothing was claimed.", "err"); return; }
  $("#claim").disabled = true;
  try {
    const r = await fetch("/api/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle, wallet, ts, sig }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { msg($("#linkMsg"), j.error || "Could not claim right now.", "err"); return; }
    myHandle = j.handle; showLink();
    msg($("#linkMsg"), j.existing ? `This wallet already owns @${j.handle}.` : `@${j.handle} is yours. Post your link.`, "ok");
  } catch { msg($("#linkMsg"), "The board is offline. Your wallet link still works.", "err"); }
  finally { $("#claim").disabled = false; }
}
function b58(bytes) {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b);
  let s = ""; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = "1" + s; else break; }
  return s;
}

/* ---------- share card ---------- */
const catImg = new Image(); catImg.src = "img/cat.svg";
function drawCard() {
  const c = $("#card"), g = c.getContext("2d"), W = 1200, H = 675;
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#e3e9e5"; g.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); }
  for (let y = 0; y <= H; y += 40) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
  // a small referral graph in the corner
  const pts = [[930, 200], [1040, 140], [1080, 280], [980, 360], [860, 300], [1110, 400], [900, 450]];
  g.strokeStyle = "#00b86c"; g.lineWidth = 3; pts.slice(1).forEach(([x, y]) => { g.beginPath(); g.moveTo(...pts[0]); g.lineTo(x, y); g.stroke(); });
  pts.forEach(([x, y], i) => { g.fillStyle = i ? "#00d47e" : "#0a0f0c"; g.beginPath(); g.arc(x, y, i ? 12 : 22, 0, 7); g.fill(); });
  if (catImg.complete) g.drawImage(catImg, 70, 70, 76, 76);
  g.fillStyle = "#5d6b63"; g.font = "500 26px 'JetBrains Mono', monospace"; g.fillText("REFERRAL SEASON · $BRINGACAT", 168, 120);
  g.fillStyle = "#0a0f0c"; g.font = "700 96px 'Space Grotesk', sans-serif";
  const who = myHandle ? "@" + myHandle : short(wallet);
  g.fillText(who.length > 13 ? who.slice(0, 13) + "…" : who, 70, 330);
  g.font = "700 72px 'Space Grotesk', sans-serif"; g.fillText("is bringing cats", 70, 420);
  g.fillStyle = "#00b86c"; g.fillText("onboard.", 70, 500);
  g.fillStyle = "#e8fbf2"; g.beginPath(); g.roundRect(70, 550, 760, 64, 32); g.fill();
  g.fillStyle = "#007a47"; g.font = "500 28px 'JetBrains Mono', monospace"; g.fillText(link().replace(/^https?:\/\//, "").slice(0, 44), 98, 592);
  try { $("#cardImg").src = c.toDataURL("image/png"); $("#cardImg").hidden = false; } catch {}
}
catImg.onload = () => { if (wallet) drawCard(); };

/* ---------- swap (Jupiter): solo = all into our coin, pair = half ours, half catonboard ---------- */
let mode = "solo", quotes = [], qTimer = 0, busy = false;
const legs = () => {
  const lam = Math.floor(Number(String($("#amt").value).replace(",", ".")) * 1e9);
  if (!(lam > 0)) return [];
  if (mode === "pair" && C.PAIR_CA) return [{ mint: C.CA, lam: Math.floor(lam / 2), name: "$BRINGACAT" }, { mint: C.PAIR_CA, lam: lam - Math.floor(lam / 2), name: "catonboard" }];
  return [{ mint: C.CA, lam, name: "$BRINGACAT" }];
};
function refreshSwapBtn() {
  const b = $("#swap");
  if (!C.CA) { b.textContent = "Launching soon"; b.disabled = true; return; }
  if (mode === "pair" && !C.PAIR_CA) { b.textContent = "Pairing opens soon"; b.disabled = true; return; }
  b.disabled = busy; b.textContent = busy ? "Waiting for your wallet…" : !wallet ? "Connect wallet to buy" : mode === "pair" ? "Buy both · 2 approvals" : "Buy $BRINGACAT";
}
async function quote() {
  quotes = []; const L = legs();
  if (!C.CA || !L.length || (mode === "pair" && !C.PAIR_CA)) { $("#qOut").textContent = "—"; return; }
  $("#qOut").textContent = "…";
  try {
    quotes = await Promise.all(L.map(async (l) => {
      const r = await fetch(`${JUP}/quote?inputMint=${SOL}&outputMint=${l.mint}&amount=${l.lam}&slippageBps=300&restrictIntermediateTokens=true`);
      if (!r.ok) throw new Error("quote " + r.status);
      return { ...l, q: await r.json() };
    }));
    $("#qOut").textContent = quotes.map((x) => `${fmt(Number(x.q.outAmount) / 10 ** DECIMALS, 0)} ${x.name}`).join(" + ");
    $("#qRoute").textContent = "Jupiter · " + [...new Set(quotes.flatMap((x) => (x.q.routePlan || []).map((p) => p.swapInfo?.label).filter(Boolean)))].slice(0, 2).join(", ");
  } catch { $("#qOut").textContent = "no route yet"; quotes = []; }
}
const requote = () => { clearTimeout(qTimer); qTimer = setTimeout(quote, 400); };
let web3p = null;
const web3 = () => (web3p ??= new Promise((ok, no) => { const s = document.createElement("script"); s.src = "vendor/solana-web3.iife.min.js"; s.onload = () => ok(window.solanaWeb3); s.onerror = no; document.head.appendChild(s); }));
async function swap() {
  if (!wallet && !(await connect())) return;
  if (!quotes.length) await quote();
  if (!quotes.length) { msg($("#swapMsg"), "No route right now. Try again in a moment.", "err"); return; }
  busy = true; refreshSwapBtn(); msg($("#swapMsg"), "");
  const { VersionedTransaction } = await web3();
  const done = [];
  try {
    for (const leg of quotes) {
      const r = await fetch(`${JUP}/swap`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteResponse: leg.q, userPublicKey: wallet, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, dynamicSlippage: true, prioritizationFeeLamports: "auto" }) });
      const j = await r.json(); if (!j.swapTransaction) throw new Error(j.error || "swap build failed");
      const tx = VersionedTransaction.deserialize(Uint8Array.from(atob(j.swapTransaction), (c) => c.charCodeAt(0)));
      msg($("#swapMsg"), `Approve the ${leg.name} swap in your wallet…`);
      const s = await provider().signAndSendTransaction(tx);
      done.push({ sig: s.signature || s, name: leg.name });
    }
  } catch (e) {
    if (!done.length) { msg($("#swapMsg"), /reject|cancel|denied/i.test(e.message) ? "Cancelled. Nothing was swapped." : "Swap failed: " + e.message, "err"); busy = false; refreshSwapBtn(); return; }
  }
  busy = false; refreshSwapBtn();
  const links = done.map((d) => `${d.name}: solscan.io/tx/${short(d.sig)}`).join(" · ");
  msg($("#swapMsg"), `You’re onboard 🐈 ${links}`, "ok");
  if (REF) for (const d of done) record(d.sig);
  quote();
}
async function record(sig) {
  try {
    const r = await fetch("/api/record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sig, ref: REF }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { msg($("#swapMsg"), `You’re onboard 🐈 Counted for ${j.ref}.`, "ok"); loadBoard(); }
    else if (r.status !== 409) msg($("#swapMsg"), `Swap done. Not counted for the link: ${j.error || "server busy"}`, "");
  } catch {}
}

/* ---------- board + live feed (preview data when there is no API) ---------- */
let live = false, seen = new Set(), firstLoad = true;
const tier = (cats, rank) => (rank <= 3 && cats > 0 ? "Cat on Board" : cats >= 25 ? "Big Cat" : cats >= 5 ? "Cat" : cats >= 1 ? "Kitten" : "");
function renderBoard(d) {
  const tb = $("#topRows"); tb.innerHTML = "";
  if (!d.top.length) tb.innerHTML = `<tr><td colspan="4" class="empty">No cats yet. Be the first link on the board.</td></tr>`;
  d.top.slice(0, 10).forEach((t, i) => {
    const tr = document.createElement("tr"); if (i === 0) tr.className = "top1";
    tr.innerHTML = `<td><span class="rank"></span></td><td><span class="nm"></span><span class="tier hide-s"></span></td><td class="r"></td><td class="r"></td>`;
    tr.querySelector(".rank").textContent = String(i + 1).padStart(2, "0");
    tr.querySelector(".nm").textContent = t.name; const tr8 = tier(t.cats, i + 1); const te = tr.querySelector(".tier"); if (tr8) te.textContent = tr8; else te.remove();
    tr.children[2].textContent = t.cats; tr.children[3].textContent = fmt(t.sol);
    tb.appendChild(tr);
  });
  const ul = $("#feed");
  const items = d.feed.slice(0, 20);
  if (!items.length) ul.innerHTML = `<li class="empty">Waiting for the first cat…</li>`;
  else {
    const fresh = items.filter((f) => !seen.has(f.t + f.buyer)).reverse();
    if (ul.querySelector(".empty")) ul.innerHTML = "";
    for (const f of fresh) {
      seen.add(f.t + f.buyer);
      const li = document.createElement("li"); if (!firstLoad) li.className = "new";
      li.innerHTML = `<span><b></b> brought <span class="buyer"></span> onboard · <span class="amt"></span></span><time></time>`;
      li.querySelector("b").textContent = f.ref; li.querySelector(".buyer").textContent = f.buyer;
      li.querySelector(".amt").textContent = fmt(f.sol) + " SOL" + (f.pair ? " · paired" : "");
      li.querySelector("time").dataset.t = f.t; ul.prepend(li);
      if (!firstLoad) { net.join(f.ref); toast(`<b>${esc(f.ref)}</b> brought ${esc(f.buyer)} onboard`); }
      else net.join(f.ref, true);
    }
    while (ul.children.length > 20) ul.lastChild.remove();
  }
  ul.querySelectorAll("time").forEach((t) => (t.textContent = ago(Number(t.dataset.t))));
  count($("#sCats"), d.stats.cats); count($("#sSol"), d.stats.sol, 2); count($("#sRefs"), d.stats.referrers);
  $("#sTop").textContent = d.top[0]?.name || "—";
  $("#hudCats").textContent = `${fmt(d.stats.cats, 0)} cats onboard`;
  firstLoad = false;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function count(el, to, d = 0) {
  const from = Number(el.dataset.v || 0); el.dataset.v = to;
  if (RM || from === to) { el.textContent = fmt(to, d); return; }
  const t0 = performance.now(); (function f(t) { const k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 4); el.textContent = fmt(from + (to - from) * e, d); if (k < 1) requestAnimationFrame(f); })(t0);
}
let toastT = 0;
function toast(html) { const t = $("#toast"); t.innerHTML = html; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600); }
async function loadBoard() {
  try {
    const r = await fetch("/api/board", { cache: "no-store" }); if (!r.ok) throw 0;
    const d = await r.json(); if (!Array.isArray(d.top)) throw 0;
    live = true; $("#boardTag").textContent = d.live ? "live · on chain" : "live · coin launching"; $("#hudMode").textContent = "live"; renderBoard(d);
  } catch { if (!live) startPreview(); }
}

/* preview: made-up names, clearly labelled, so the page shows how it moves before launch */
let pv = null;
function startPreview() {
  if (pv) return;
  $("#boardTag").textContent = "preview · sample data"; $("#hudMode").textContent = "preview";
  const names = ["@whiskers", "@solcat", "@meowfi", "@tabby", "@purrbot", "@nyan", "@kitkat", "@zoomies"];
  const board = new Map(names.map((n, i) => [n, { name: n, cats: 12 - i, sol: (9 - i) * 1.7 + 0.3 }]));
  const rnd = () => "1Bcd23efGh45iJkL6mNo7pQr8sTu9vWx".split("").sort(() => Math.random() - 0.5).join("");
  pv = { feed: [], board, stats: { cats: 61, sol: 74.2, referrers: names.length } };
  const tick = () => {
    const ref = names[Math.floor(Math.pow(Math.random(), 1.6) * names.length)], sol = Math.round((0.05 + Math.random() * 0.9) * 100) / 100;
    const b = board.get(ref); b.cats++; b.sol += sol; pv.stats.cats++; pv.stats.sol = Math.round((pv.stats.sol + sol) * 100) / 100;
    pv.feed.unshift({ ref, buyer: short(rnd()), sol, pair: Math.random() < 0.4, t: Date.now() }); pv.feed.length = Math.min(pv.feed.length, 20);
    renderBoard({ top: [...board.values()].sort((x, y) => y.sol - x.sol), feed: pv.feed, stats: pv.stats });
  };
  for (let i = 0; i < 6; i++) tick();
  if (!RM) setInterval(() => { if (!document.hidden) tick(); }, 2400);
}

/* ---------- hero graph: wallets as nodes, referrals as edges; a new cat flies in to its referrer ---------- */
const net = (() => {
  const cv = $("#net"), g = cv.getContext("2d"); let W = 0, H = 0, dpr = 1, visible = true, raf = 0;
  const hubs = new Map(), nodes = [];
  const size = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); hubs.forEach(place); };
  const center = { x: 0.5, y: 0.46 };
  let hubN = 0;
  function place(h) { const a = h.i * 2.399, rad = 0.12 + 0.07 * Math.sqrt(h.i); h.x = (center.x + Math.cos(a) * rad) * W; h.y = (center.y + Math.sin(a) * rad * 1.05) * H; }
  function hub(name) { let h = hubs.get(name); if (!h) { h = { name, i: hubN++, n: 0 }; place(h); hubs.set(name, h); } return h; }
  function join(name, instant) {
    const h = hub(name); h.n++; const a = Math.random() * 6.283, d = 26 + Math.random() * 34 + Math.min(40, h.n * 2);
    const n = { h, a, d, t: instant || RM ? 1 : 0, born: performance.now() }; nodes.push(n); if (nodes.length > 240) nodes.shift();
    if (RM) draw();
  }
  function draw(now = performance.now()) {
    g.clearRect(0, 0, W, H);
    // hub to center spokes
    g.lineWidth = 1; g.strokeStyle = "rgba(10,15,12,.12)";
    hubs.forEach((h) => { g.beginPath(); g.moveTo(center.x * W, center.y * H); g.lineTo(h.x, h.y); g.stroke(); });
    for (const n of nodes) {
      if (n.t < 1) n.t = Math.min(1, (now - n.born) / 900);
      const e = 1 - Math.pow(1 - n.t, 4), tx = n.h.x + Math.cos(n.a) * n.d, ty = n.h.y + Math.sin(n.a) * n.d;
      const sx = n.h.x + Math.cos(n.a) * (n.d + 220), sy = n.h.y + Math.sin(n.a) * (n.d + 220);
      const x = sx + (tx - sx) * e, y = sy + (ty - sy) * e;
      g.strokeStyle = `rgba(0,184,108,${0.2 + 0.5 * (1 - e) })`; g.lineWidth = n.t < 1 ? 2 : 1;
      g.beginPath(); g.moveTo(n.h.x, n.h.y); g.lineTo(x, y); g.stroke();
      g.fillStyle = n.t < 1 ? "#00d47e" : "#7fe9bc"; g.beginPath(); g.arc(x, y, n.t < 1 ? 4.5 : 3, 0, 7); g.fill();
      if (n.t < 1) { g.strokeStyle = `rgba(0,212,126,${1 - e})`; g.beginPath(); g.arc(tx, ty, 4 + 18 * e, 0, 7); g.stroke(); }
    }
    hubs.forEach((h) => { g.fillStyle = "#0a0f0c"; g.beginPath(); g.arc(h.x, h.y, 5 + Math.min(7, Math.sqrt(h.n)), 0, 7); g.fill();
      g.fillStyle = "#5d6b63"; g.font = "500 11px 'JetBrains Mono', monospace"; g.fillText(h.name, h.x + 10, h.y - 8); });
    g.fillStyle = "#00d47e"; g.beginPath(); g.arc(center.x * W, center.y * H, 9, 0, 7); g.fill();
    g.strokeStyle = "rgba(0,212,126,.35)"; g.lineWidth = 6; g.beginPath(); g.arc(center.x * W, center.y * H, 14, 0, 7); g.stroke();
  }
  const loop = (t) => { raf = 0; if (visible && !document.hidden) draw(t); raf = requestAnimationFrame(loop); };
  new ResizeObserver(() => { size(); draw(); }).observe(cv);
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(cv);
  size();
  if (!RM) raf = requestAnimationFrame(loop);
  return { join };
})();

/* ---------- wire up ---------- */
$("#connect").addEventListener("click", connect);
$("#claim").addEventListener("click", claim);
$("#handle").addEventListener("keydown", (e) => { if (e.key === "Enter") claim(); });
$("#copyLink").addEventListener("click", (e) => navigator.clipboard?.writeText(link()).then(() => { e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy"), 1200); }));
$("#dlCard").addEventListener("click", () => { const a = document.createElement("a"); a.download = `bring-a-cat-${myHandle || short(wallet)}.png`; a.href = $("#card").toDataURL("image/png"); a.click(); });
for (const [id, m] of [["#mSolo", "solo"], ["#mPair", "pair"]]) $(id).addEventListener("click", () => { mode = m; $("#mSolo").setAttribute("aria-pressed", m === "solo"); $("#mPair").setAttribute("aria-pressed", m === "pair"); refreshSwapBtn(); requote(); });
$("#amt").addEventListener("input", requote);
document.querySelectorAll(".quick button").forEach((b) => b.addEventListener("click", () => { $("#amt").value = b.dataset.v; requote(); }));
$("#swap").addEventListener("click", swap);
$("#refLine").innerHTML = REF ? `Invited by <b></b>. Your buy brings a cat onboard for them.` : "No referral link used. Your buy still counts for the pool.";
if (REF) $("#refLine b").textContent = refName(REF);
if (REF) $("#livePill").textContent = `${refName(REF)} invited you onboard`;
$("#ca").textContent = C.CA || "launching soon";
if (C.CA) { $("#pumpLink").href = "https://pump.fun/coin/" + C.CA; $("#dexLink").href = "https://dexscreener.com/solana/" + C.CA; }
$("#copyCa").addEventListener("click", (e) => { if (C.CA) navigator.clipboard?.writeText(C.CA).then(() => { e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy"), 1200); }); });
refreshSwapBtn(); quote(); loadBoard();
setInterval(() => { if (live && !document.hidden) loadBoard(); }, 8000);
provider()?.isConnected && provider().publicKey && ((wallet = provider().publicKey.toString()), onWallet());
