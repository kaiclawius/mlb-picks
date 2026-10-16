// Claude turns the transcript into things people actually use: a title, a summary for people who won't
// watch, chapters, answers to questions about the video, a written step-by-step guide, and translations.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

let client = null;
const claude = () => (client ??= new Anthropic({ timeout: 180_000, maxRetries: 2 }));
// server-side fallback: if a request is declined, the API retries it on a suitable model by itself
const FALLBACK = /^claude-(opus-5|opus-5-5|sonnet-5-5|fable-5-1)$/.test(config.claudeModel);

const S = (props, required = Object.keys(props)) => ({ type: "object", properties: props, required, additionalProperties: false });
const str = { type: "string" }, num = { type: "number" };
const arr = (items) => ({ type: "array", items });

async function ask(system, user, schema, effort = "low") {
  const msg = await claude().beta.messages.create({
    model: config.claudeModel,
    max_tokens: 16000,
    ...(FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    output_config: { effort, format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (msg.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (msg.stop_reason === "max_tokens") throw new Error("The answer was too long.");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** Transcript as timestamped lines, the format every prompt below reads. */
export function lines(words) {
  const out = []; let cur = null;
  for (const w of words) {
    if (!cur || w.s - cur.end > 1.2 || cur.n >= 18 || /[.!?]$/.test(cur.text)) { cur = { s: w.s, end: w.e, text: w.w, n: 1 }; out.push(cur); }
    else { cur.text += " " + w.w; cur.end = w.e; cur.n++; }
  }
  return out.map((l) => `[${mmss(l.s)}] ${l.text}`).join("\n");
}

const BASE = `You work inside Klipp, a screen recording app. Users record their screen and camera to explain things to colleagues or customers.
Always answer in the language the transcript is spoken in, unless told otherwise. Never invent content that is not in the transcript.
Timestamps are seconds from the start of the recording (convert [mm:ss] to seconds).`;

/** Title, summary for people who won't watch, key points, chapters, action items. */
export function describe(words, duration) {
  return ask(`${BASE}\nYou write the text that goes with a recording.`,
    `Recording length: ${Math.round(duration)} s.\n<transcript>\n${lines(words)}\n</transcript>

Write:
- title: specific, at most 8 words, no quotes, no emojis.
- summary: 2-3 sentences someone can read instead of watching.
- tldr: 2-5 key points, each one short sentence.
- chapters: for recordings longer than 60 s, 2-8 chapters where the topic changes, each { t: start in seconds, title: 2-5 words }; first chapter at 0. Shorter recordings: empty list.
- actions: concrete to-dos or requests the speaker asks for (empty list if none).`,
    S({ title: str, summary: str, tldr: arr(str), chapters: arr(S({ t: num, title: str })), actions: arr(str) }));
}

/** "Ask the video": an answer with the moments that back it up. */
export function answer(words, question, title) {
  return ask(`${BASE}\nYou answer questions about one recording ("${title}") for someone who has not watched it.`,
    `<transcript>\n${lines(words)}\n</transcript>\n\n<question>${question}</question>

Answer briefly and only from the transcript. If the transcript does not contain the answer, say so plainly.
Add up to 3 moments where the answer is shown, each { t: seconds, label: a few words }.`,
    S({ answer: str, moments: arr(S({ t: num, label: str })) }), "medium");
}

/** A written how-to: steps with the second where each one happens (we add a screenshot per step). */
export function guide(words, title) {
  return ask(`${BASE}\nYou turn a screen recording into a written step-by-step guide, like an internal how-to or SOP.`,
    `Recording: "${title}".\n<transcript>\n${lines(words)}\n</transcript>

Write a guide someone can follow without the video:
- title: what the guide teaches.
- intro: one or two sentences: what you will achieve and what you need.
- steps: 3-15 steps in order. Each: t (the second in the recording where this step is shown, so we can take a screenshot), title (imperative, short), text (1-3 sentences, concrete: what to click, type or check).
- tips: 0-4 short tips or warnings mentioned in the recording.`,
    S({ title: str, intro: str, steps: arr(S({ t: num, title: str, text: str })), tips: arr(str) }), "medium");
}

/** Translates caption lines one-to-one. */
export async function translate(texts, language) {
  const out = [];
  for (let i = 0; i < texts.length; i += 150) {
    const part = texts.slice(i, i + 150);
    const r = await ask(`You translate video captions. Keep the meaning, keep it short enough to read, keep names and product terms.`,
      `Translate each line into ${language}. Return exactly ${part.length} lines in the same order.\n\n${part.map((t, k) => `${k + 1}. ${t}`).join("\n")}`,
      S({ lines: arr(str) }));
    for (let k = 0; k < part.length; k++) out.push(r.lines[k] ?? part[k]);
  }
  return out;
}

export function explainError(e) {
  if (e instanceof Anthropic.AuthenticationError) return "The Anthropic API key is not valid.";
  if (e instanceof Anthropic.RateLimitError) return "Claude is busy right now. Try again in a minute.";
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status}.`;
  return e?.message || String(e);
}
