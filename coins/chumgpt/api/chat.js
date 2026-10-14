// POST /api/chat  { messages: [{role, content}, ...] }  ->  streamed plain text "[mood] reply"
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, PERSONA, CHAT_FORMAT } from "./_persona.js";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the Vercel environment

// Best-effort per-instance rate limit. Set a monthly spend limit in the Anthropic Console as the real cap.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 60_000, max = 12;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

function cleanHistory(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 600).trim() }))
    .filter((m) => m.content)
    .slice(-10);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

const REFUSED = "[sad] my evil circuits refuse to compute that one. let's talk about the formula instead.";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
  if (limited(ip)) return res.status(429).send("[rage] too many questions! even evil geniuses need a minute. try again soon.");

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const messages = cleanHistory(body.messages);
  if (!messages) return res.status(400).json({ error: "bad messages" });

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  let wrote = false;
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: `${PERSONA}\n\n${CHAT_FORMAT}`, cache_control: { type: "ephemeral" } }],
      messages,
    });
    stream.on("text", (t) => { wrote = true; res.write(t); });
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal" && !wrote) res.write(REFUSED);
    res.end();
  } catch (err) {
    console.error(err instanceof Anthropic.APIError ? `Anthropic ${err.status}: ${err.message}` : err);
    if (!wrote) res.status(err instanceof Anthropic.RateLimitError ? 429 : 502);
    res.end(wrote ? "" : "[rage] my servers are overheating. karen probably unplugged something. try again in a moment.");
  }
}
