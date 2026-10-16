// POST /api/claim { handle, wallet, ts, sig } -> { handle, wallet }
// Reserves a short link name (@handle) for a wallet. The wallet proves it is the owner by signing a text
// message (no transaction, nothing is spent). One handle per wallet; the first wallet to claim a name keeps it.
import { HANDLE, isAddress, claimMessage, verifySigned, db, limited, body, send } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  if (limited(req, 10)) return send(res, 429, { error: "Too many tries. Wait a minute." });
  const { handle: raw, wallet, ts, sig } = await body(req);
  const handle = String(raw || "").toLowerCase().replace(/^@/, "");
  if (!HANDLE.test(handle)) return send(res, 400, { error: "Use 3 to 15 letters, numbers or _." });
  if (!isAddress(wallet)) return send(res, 400, { error: "That is not a Solana wallet address." });
  if (!Number.isFinite(Number(ts)) || Math.abs(Date.now() - Number(ts)) > 10 * 60_000) return send(res, 400, { error: "The signature expired. Sign again." });
  if (!verifySigned(claimMessage(handle, wallet, ts), sig, wallet)) return send(res, 401, { error: "The signature does not match this wallet." });
  try {
    const [mine] = await db(["GET", `w:${wallet}`]);
    if (mine) return send(res, 200, { handle: mine, wallet, existing: true });
    const [ok] = await db(["SET", `h:${handle}`, wallet, "NX"]);
    if (!ok) { const [owner] = await db(["GET", `h:${handle}`]); if (owner !== wallet) return send(res, 409, { error: `@${handle} is taken. Try another name.` }); }
    await db(["SET", `w:${wallet}`, handle]);
    return send(res, 200, { handle, wallet });
  } catch (e) { return send(res, 503, { error: "The board is offline. Your wallet link still works." }); }
}
