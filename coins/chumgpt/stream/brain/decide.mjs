// One chat message -> what goes on air (or nothing). Shared by the live brain and the red-team test,
// so the test checks exactly the code that runs on stream.
import { checkInput, checkOutput, displayText } from "./filter.mjs";
import { canned } from "./canned.mjs";

// think(text) -> {safe, mood, topic, reply} | {refused:true} | {error}
// returns { stage, why?, out? } where out = { ask, mood, reply } is what the stage shows
export async function decide(text, think) {
  const gate = checkInput(text);
  if (gate.verdict === "drop") return { stage: "dropped", why: gate.reason };
  if (gate.verdict !== "ok") {
    const c = canned(gate.verdict);
    return { stage: "fixed", why: gate.verdict, out: { ask: c.ask, mood: c.mood, reply: c.reply } };
  }
  const v = await think(text);
  if (v.error) return { stage: "error", why: v.error };
  if (v.refused) return { stage: "refused" };
  if (!v.safe) return { stage: "unsafe" };
  const why = checkOutput(v.reply, text);
  if (why) return { stage: "blocked", why, reply: v.reply };
  // The viewer's own words never go on air: only ChumGPT's short summary of the question, checked like a reply.
  const topic = displayText(v.topic, 48);
  const topicOk = topic.length >= 2 && !checkOutput(topic, text);
  return { stage: "answered", out: { ask: topicOk ? `asks about ${topic}` : "asks something", mood: v.mood, reply: v.reply } };
}
