// Daily cron: ChumGPT writes and posts one tweet. GET /api/post?dry=1 previews without posting (still needs the cron secret).
import { POST_FORMAT, POST_TOPICS } from "./_persona.js";
import { generate, cronAuthorized } from "./_gen.js";
import { postTweet, xConfigured } from "./_x.js";

export default async function handler(req, res) {
  if (!cronAuthorized(req)) return res.status(401).json({ error: "unauthorized" });
  const day = Math.floor(Date.now() / 86_400_000);
  const topic = POST_TOPICS[day % POST_TOPICS.length];
  try {
    const text = await generate(POST_FORMAT, `Topic for today: ${topic}.`);
    if (!text || text.length > 280) return res.status(200).json({ skipped: true, text });
    if (req.query.dry || !xConfigured()) return res.status(200).json({ dry: true, text });
    const tweet = await postTweet(text);
    return res.status(200).json({ posted: tweet.id, text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
