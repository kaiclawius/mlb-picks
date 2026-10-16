// POST /api/record { sig, ref } -> { ok, ref, sol }
// Called by the page right after a swap. The server reads the transaction from Solana itself, so nobody can
// claim a buy that did not happen. Rules: one transaction counts once, no self-referrals, and a buyer stays
// with the first link that brought them (later links do not steal them).
import { CFG, isSignature, isAddress, HANDLE, short, db, rpc, checkBuy, limited, body, send } from "./_lib.js";

export async function resolveRef(ref) {
  ref = String(ref || "").replace(/^@/, "");
  if (isAddress(ref)) { const [h] = await db(["GET", `w:${ref}`]); return { wallet: ref, handle: h }; }
  if (HANDLE.test(ref.toLowerCase())) { const [w] = await db(["GET", `h:${ref.toLowerCase()}`]); return w ? { wallet: w, handle: ref.toLowerCase() } : null; }
  return null;
}

export default async function handler(req, res, deps = { rpc }) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  if (limited(req, 20)) return send(res, 429, { error: "Too many requests." });
  if (!CFG.mint) return send(res, 503, { error: "The coin is not live yet." });
  const { sig, ref } = await body(req);
  if (!isSignature(sig)) return send(res, 400, { error: "Bad transaction signature." });
  try {
    const r = await resolveRef(ref);
    if (!r) return send(res, 400, { error: "Unknown referral link." });
    const [seen] = await db(["GET", `tx:${sig}`]);
    if (seen) return send(res, 409, { error: "This transaction was already recorded." });
    let tx = null;
    for (let i = 0; i < 4 && !tx; i++) { // the page calls right after sending; give the chain a moment
      tx = await deps.rpc("getTransaction", [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
      if (!tx && i < 3) await new Promise((s) => setTimeout(s, 1500));
    }
    const buy = checkBuy(tx);
    if (buy.error) return send(res, 422, { error: buy.error });
    if (buy.buyer === r.wallet) return send(res, 422, { error: "You can’t refer yourself." });
    const [fresh] = await db(["SET", `tx:${sig}`, "1", "NX"]);
    if (!fresh) return send(res, 409, { error: "This transaction was already recorded." });
    // sticky attribution: the first referrer of a buyer keeps them
    const [, owner] = await db(["SET", `b:${buy.buyer}`, r.wallet, "NX"], ["GET", `b:${buy.buyer}`]);
    const credit = owner || r.wallet, newBuyer = owner === r.wallet && !(await db(["GET", `n:${buy.buyer}`]))[0];
    const [creditHandle] = credit === r.wallet ? [r.handle] : await db(["GET", `w:${credit}`]);
    const pair = buy.mint === CFG.pairMint;
    const item = JSON.stringify({ ref: creditHandle ? "@" + creditHandle : short(credit), buyer: short(buy.buyer), sol: buy.sol, pair, t: Date.now() });
    await db(
      ["ZINCRBY", "board:sol", String(buy.sol), credit],
      ...(newBuyer ? [["ZINCRBY", "board:cats", "1", credit], ["SET", `n:${buy.buyer}`, "1"], ["INCRBYFLOAT", "stat:cats", "1"]] : []),
      ["INCRBYFLOAT", "stat:sol", String(buy.sol)],
      ["LPUSH", "feed", item], ["LTRIM", "feed", "0", "49"],
    );
    return send(res, 200, { ok: true, ref: creditHandle ? "@" + creditHandle : short(credit), sol: buy.sol, pair, newCat: newBuyer });
  } catch (e) { return send(res, 503, { error: "Could not record right now. Your buy went through anyway." }); }
}
