// The reply desk behind admin.html. ChumGPT drafts, a human approves: nothing here posts
// on its own, every reply goes out only when someone presses "post" on the desk.
//   GET  /api/admin?action=status
//   GET  /api/admin?action=mentions        mentions from the last REPLY_WINDOW_HOURS, each with a draft
//   POST /api/admin?action=draft  {text}   a fresh draft for one mention
//   POST /api/admin?action=idea            a draft for an extra post
//   POST /api/admin?action=send   {text, replyTo?}
import { REPLY_FORMAT, POST_FORMAT, POST_TOPICS } from "./_persona.js";
import { generate, adminAuthorized, unsafeForX } from "./_gen.js";
import { getMentions, postTweet, xConfigured } from "./_x.js";

const MAX_MENTIONS = 10;

async function draftReply(text) {
  const out = await generate(REPLY_FORMAT, `The mention:\n${String(text).slice(0, 500)}`);
  if (!out || out === "SKIP") return { draft: "", skip: true };
  return { draft: out, skip: false, problem: unsafeForX(out) };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!adminAuthorized(req)) return res.status(401).json({ error: "wrong or missing admin token" });
  const action = req.query.action;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const userId = process.env.X_USER_ID;

  try {
    if (action === "status") {
      return res.status(200).json({ claude: !!process.env.ANTHROPIC_API_KEY, x: xConfigured(), userId: !!userId });
    }

    if (action === "mentions" && req.method === "GET") {
      if (!xConfigured() || !userId) return res.status(400).json({ error: "X keys or X_USER_ID not set in Vercel" });
      const hours = Number(process.env.REPLY_WINDOW_HOURS || 24);
      const since = new Date(Date.now() - hours * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z");
      const mentions = (await getMentions(userId, since)).filter((m) => m.author_id !== userId).slice(0, MAX_MENTIONS);
      const items = await Promise.all(mentions.map(async (m) => {
        const d = await draftReply(m.text).catch(() => ({ draft: "", skip: false, problem: "draft failed, try again" }));
        return { id: m.id, text: m.text, username: m.username, created_at: m.created_at, ...d };
      }));
      return res.status(200).json({ items });
    }

    if (action === "draft" && req.method === "POST") {
      if (!body.text) return res.status(400).json({ error: "text missing" });
      return res.status(200).json(await draftReply(body.text));
    }

    if (action === "idea" && req.method === "POST") {
      const topic = POST_TOPICS[Math.floor(Math.random() * POST_TOPICS.length)];
      const draft = await generate(POST_FORMAT, `Topic: ${topic}.`);
      return res.status(200).json({ topic, draft: draft || "", problem: unsafeForX(draft) });
    }

    if (action === "send" && req.method === "POST") {
      const text = String(body.text || "").trim();
      const replyTo = body.replyTo ? String(body.replyTo) : undefined;
      if (replyTo && !/^\d{1,25}$/.test(replyTo)) return res.status(400).json({ error: "bad replyTo" });
      const problem = unsafeForX(text);
      if (problem) return res.status(400).json({ error: `not posted: ${problem}` });
      if (!xConfigured()) return res.status(400).json({ error: "X keys not set in Vercel" });
      const tweet = await postTweet(text, replyTo);
      return res.status(200).json({ posted: tweet.id });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
