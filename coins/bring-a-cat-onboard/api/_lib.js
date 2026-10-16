// Shared server code: config, base58, a tiny store (Upstash Redis over REST, or memory for local runs),
// a Solana RPC call, and the check that a swap really bought our coin (or the paired coin).
import nacl from "tweetnacl";

export const CFG = {
  mint: process.env.MINT || "",            // our coin ($BRINGACAT) mint address
  pairMint: process.env.PAIR_MINT || "",   // catonboard mint address, for "Pair it"
  rpc: process.env.RPC_URL || "https://api.mainnet-beta.solana.com",
  // our coin trades against catonboard, so every buy also buys it (shown as a link to catonboard in the graph)
  quotedInPair: process.env.QUOTED_IN_PAIR !== "false",
  minSol: Number(process.env.MIN_SOL || 0.05),   // smaller buys are not counted (spam, wash trading)
  maxAgeSec: 3600,                               // only fresh transactions can be recorded
};

/* ---------- base58 (Solana addresses and signatures) ---------- */
const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58decode(s) {
  if (typeof s !== "string" || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return null;
  let n = 0n; for (const c of s) n = n * 58n + BigInt(A.indexOf(c));
  const out = []; while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of s) { if (c === "1") out.unshift(0); else break; }
  return Uint8Array.from(out);
}
export const isAddress = (s) => { const b = b58decode(s); return !!b && b.length === 32; };
export const isSignature = (s) => { const b = b58decode(s); return !!b && b.length === 64; };
export const short = (a) => (a ? a.slice(0, 4) + "…" + a.slice(-4) : "");
export const HANDLE = /^[a-z0-9_]{3,15}$/;

/* ---------- store ---------- */
const U = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, T = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const persistent = !!(U && T);
const mem = (globalThis.__catStore ??= { kv: new Map(), z: new Map(), l: new Map() });
function memCmd([op, ...a]) {
  const { kv, z, l } = mem;
  switch (op) {
    case "GET": return kv.get(a[0]) ?? null;
    case "SET": { const nx = a.includes("NX"); if (nx && kv.has(a[0])) return null; kv.set(a[0], a[1]); return "OK"; }
    case "INCRBYFLOAT": { const v = Number(kv.get(a[0]) || 0) + Number(a[1]); kv.set(a[0], String(v)); return String(v); }
    case "ZINCRBY": { const m = z.get(a[0]) || new Map(); m.set(a[2], (m.get(a[2]) || 0) + Number(a[1])); z.set(a[0], m); return String(m.get(a[2])); }
    case "ZSCORE": { const v = z.get(a[0])?.get(a[1]); return v == null ? null : String(v); }
    case "ZREVRANGE": { const m = [...(z.get(a[0]) || new Map())].sort((x, y) => y[1] - x[1]).slice(Number(a[1]), Number(a[2]) + 1); return m.flatMap(([k, v]) => [k, String(v)]); }
    case "ZCARD": return (z.get(a[0]) || new Map()).size;
    case "LPUSH": { const x = l.get(a[0]) || []; x.unshift(...a.slice(1).reverse()); l.set(a[0], x); return x.length; }
    case "LTRIM": { const x = l.get(a[0]) || []; l.set(a[0], x.slice(Number(a[1]), Number(a[2]) + 1)); return "OK"; }
    case "LRANGE": return (l.get(a[0]) || []).slice(Number(a[1]), Number(a[2]) + 1);
    case "MGET": return a.map((k) => kv.get(k) ?? null);
    default: throw new Error("memory store: " + op);
  }
}
// run several commands; returns their results in order
export async function db(...cmds) {
  if (!persistent) return cmds.map(memCmd);
  const r = await fetch(U.replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { Authorization: `Bearer ${T}`, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error("store " + r.status);
  return (await r.json()).map((x) => { if (x.error) throw new Error(x.error); return x.result; });
}

/* ---------- solana ---------- */
export async function rpc(method, params) {
  const r = await fetch(CFG.rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error(j.error.message || "rpc error");
  return j.result;
}
// A buy counts when: the transaction succeeded, is fresh, the fee payer (the buyer) ended up with more of our
// coin or the paired coin, and spent at least MIN_SOL. Returns { buyer, sol, mint } or { error }.
export function checkBuy(tx, now = Date.now() / 1000) {
  if (!tx) return { error: "Transaction not found yet. Try again in a few seconds." };
  if (tx.meta?.err) return { error: "That transaction failed on chain." };
  if (tx.blockTime && now - tx.blockTime > CFG.maxAgeSec) return { error: "That transaction is too old to record." };
  const keys = tx.transaction?.message?.accountKeys || [];
  const first = keys[0]; const buyer = typeof first === "string" ? first : first?.pubkey;
  if (!buyer) return { error: "Unreadable transaction." };
  const mints = [CFG.mint, CFG.pairMint].filter(Boolean);
  const bal = (list, mint) => (list || []).filter((b) => b.owner === buyer && b.mint === mint).reduce((s, b) => s + Number(b.uiTokenAmount?.uiAmount || 0), 0);
  const got = mints.find((m) => bal(tx.meta.postTokenBalances, m) > bal(tx.meta.preTokenBalances, m));
  if (!got) return { error: "This transaction did not buy the coin." };
  const sol = ((tx.meta.preBalances?.[0] || 0) - (tx.meta.postBalances?.[0] || 0)) / 1e9;
  if (sol < CFG.minSol) return { error: `Buys under ${CFG.minSol} SOL are not counted.` };
  return { buyer, sol: Math.round(sol * 1e4) / 1e4, mint: got };
}

/* ---------- wallet ownership: the wallet signs a short text message ---------- */
export const claimMessage = (handle, wallet, ts) => `Bring a cat onboard\nclaim @${handle} for ${wallet}\n${ts}`;
export function verifySigned(message, sigB58, wallet) {
  const sig = b58decode(sigB58), pk = b58decode(wallet);
  if (!sig || sig.length !== 64 || !pk || pk.length !== 32) return false;
  return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pk);
}

/* ---------- http helpers ---------- */
const hits = new Map();
export function limited(req, max = 20, windowMs = 60_000) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now); hits.set(ip, list); if (hits.size > 5000) hits.clear();
  return list.length > max;
}
export async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let s = ""; for await (const c of req) { s += c; if (s.length > 4000) break; }
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}
export const send = (res, code, obj, cache) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", cache || "no-store"); res.end(JSON.stringify(obj)); };
