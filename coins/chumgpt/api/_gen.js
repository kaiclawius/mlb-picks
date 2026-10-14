import Anthropic from "@anthropic-ai/sdk";
import { MODEL, PERSONA } from "./_persona.js";

const client = new Anthropic();

// One short generation in character. Returns the text, or null on refusal.
export async function generate(instruction, userText) {
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: [{ type: "text", text: PERSONA, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `${instruction}\n\n${userText}` }],
  });
  if (msg.stop_reason === "refusal") return null;
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  return text.replace(/^["“]|["”]$/g, "").trim() || null;
}

export function cronAuthorized(req) {
  // Vercel cron sends "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.authorization === `Bearer ${secret}`;
}
