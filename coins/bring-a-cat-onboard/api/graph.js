// GET /api/graph -> { edges: [{ ref, buyer, sol, pair, t }] } the last 800 referrals, newest first,
// for the network view on the page (who brought whom; paired buys also hang off catonboard).
import { db, send } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "GET only" });
  try {
    const [edges] = await db(["LRANGE", "edges", "0", "799"]);
    return send(res, 200, { edges: edges.map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean) }, "public, s-maxage=10, stale-while-revalidate=30");
  } catch { return send(res, 503, { error: "graph offline" }); }
}
