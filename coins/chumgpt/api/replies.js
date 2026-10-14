// Cron: answer recent mentions in character. Reading mentions needs an X API plan with read access.
import { REPLY_FORMAT } from "./_persona.js";
import { generate, cronAuthorized } from "./_gen.js";
import { getMentions, postTweet, xConfigured } from "./_x.js";

const MAX_REPLIES = 10;

export default async function handler(req, res) {
  if (!cronAuthorized(req)) return res.status(401).json({ error: "unauthorized" });
  const userId = process.env.X_USER_ID;
  if (!xConfigured() || !userId) return res.status(200).json({ skipped: "X keys or X_USER_ID not set" });
  const hours = Number(process.env.REPLY_WINDOW_HOURS || 24);
  const since = new Date(Date.now() - hours * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z");
  const out = [];
  try {
    const mentions = (await getMentions(userId, since)).filter((m) => m.author_id !== userId).slice(0, MAX_REPLIES);
    for (const m of mentions) {
      const text = await generate(REPLY_FORMAT, `The mention:\n${m.text.slice(0, 500)}`);
      if (!text || text === "SKIP" || text.length > 280) { out.push({ id: m.id, skipped: true }); continue; }
      if (req.query.dry) { out.push({ id: m.id, dry: text }); continue; }
      const t = await postTweet(text, m.id);
      out.push({ id: m.id, replied: t.id });
    }
    return res.status(200).json({ count: out.length, out });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err.message || err), out });
  }
}
