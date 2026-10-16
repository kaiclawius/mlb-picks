// GET /api/board -> { live, top: [{ name, wallet, sol, cats }], feed: [...], stats: { cats, sol, cats_total_refs } }
// The leaderboard ranks referrers by SOL their link brought in; "cats" = new buyers they brought.
import { CFG, short, db, persistent, send } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "GET only" });
  try {
    const [top, feed, cats, sol, refs] = await db(["ZREVRANGE", "board:sol", "0", "19", "WITHSCORES"], ["LRANGE", "feed", "0", "19"], ["GET", "stat:cats"], ["GET", "stat:sol"], ["ZCARD", "board:sol"]);
    const wallets = []; for (let i = 0; i < top.length; i += 2) wallets.push([top[i], Number(top[i + 1])]);
    const extra = wallets.length ? await db(["MGET", ...wallets.map(([w]) => `w:${w}`)], ...wallets.map(([w]) => ["ZSCORE", "board:cats", w])) : [[]];
    const handles = extra[0] || [];
    return send(res, 200, {
      live: !!CFG.mint, persistent,
      top: wallets.map(([w, s], i) => ({ name: handles[i] ? "@" + handles[i] : short(w), wallet: w, sol: Math.round(s * 100) / 100, cats: Number(extra[i + 1] || 0) })),
      feed: feed.map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean),
      stats: { cats: Math.round(Number(cats || 0)), sol: Math.round(Number(sol || 0) * 100) / 100, referrers: Number(refs || 0) },
    }, "public, s-maxage=5, stale-while-revalidate=20");
  } catch (e) { return send(res, 503, { error: "board offline" }); }
}
