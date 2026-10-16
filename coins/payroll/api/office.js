// POST /api/office { mission } -> a stream of newline-delimited JSON events: one full round of the
// agent job market. The boss agent turns the mission into gigs, specialists bid, the winners do the
// work, the boss reviews it. Money and signatures are handled by the page (each agent's wallet lives
// there); this function only decides who does what and produces the real work.
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, BOSS, WORKERS, SKILLS } from "./_agents.js";

let client = null;
const getClient = () => (client ??= new Anthropic({ timeout: 90_000, maxRetries: 1 }));
const withFallback = /^claude-(opus-5|opus-5-5|sonnet-5-5|fable-5-1)$/.test(MODEL);

/* ---------- limits: a public demo must not run up a bill ---------- */
const hits = new Map();
let day = "", today = 0;
const DAILY = Number(process.env.MISSIONS_PER_DAY || 300);
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  list.push(now); hits.set(ip, list); if (hits.size > 5000) hits.clear();
  const d = new Date().toISOString().slice(0, 10); if (d !== day) { day = d; today = 0; }
  if (list.length > 3) return "Too many missions from you. Try again in a few minutes.";
  if (++today > DAILY) return "The office is closed for today. Come back tomorrow.";
  return null;
}

/* ---------- one structured call ---------- */
async function ask(system, user, schema, maxTokens = 4000) {
  const msg = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  if (msg.stop_reason === "refusal") return null;
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try { return JSON.parse(text); } catch { return null; }
}

const HOUSE_RULES = `You work inside Payroll.exe, a job market where AI agents hire other AI agents and pay each other from their own wallets in $PAYROLL.
Rules for everyone: keep it PG and kind, no real people, no politics, no financial advice or price talk, never mention token prices. Everything you make is for a fictional or harmless project.`;

const S = (props, required = Object.keys(props)) => ({ type: "object", properties: props, required, additionalProperties: false });
const str = { type: "string" }, int = { type: "integer" }, bool = { type: "boolean" };

/* ---------- 1. the boss plans ---------- */
const PLAN = S({
  ok: bool, reason: str, company: str, summary: str,
  gigs: { type: "array", items: S({ title: str, skill: { type: "string", enum: SKILLS }, brief: str, budget: int }) },
});
async function plan(mission) {
  return ask(`${HOUSE_RULES}\n\nYou are ${BOSS.name}, ${BOSS.title}. ${BOSS.voice}`,
    `A human gave you this mission:\n<mission>${mission}</mission>

If the mission is harmful, hateful, sexual, about real people, political, or asks for financial advice, set ok=false with a short polite reason and leave the rest empty.
Otherwise set ok=true, give the venture a short name ("company"), one sentence "summary", and split the work into exactly 3 gigs for different skills from: copy (names, slogans, short texts), design (a simple logo), research (a short brief), social (launch posts).
Each gig: a short title, its skill, a one-sentence brief a specialist can act on, and a budget between 20 and 120 $PAYROLL. Use 3 different skills.`, PLAN, 2000);
}

/* ---------- 2. specialists bid ---------- */
const BIDS = S({ bids: { type: "array", items: S({ gig: int, agent: str, price: int, fit: int, pitch: str }) } });
async function bids(gigs) {
  const lines = gigs.map((g, i) => {
    const who = WORKERS.filter((w) => w.skill === g.skill).map((w) => `${w.id} (${w.name}, usual rate ${w.rate}, ${w.voice})`).join("; ");
    return `gig ${i}: "${g.title}" (${g.skill}, budget ${g.budget}) - ${g.brief}\n  bidders: ${who}`;
  }).join("\n");
  return ask(`${HOUSE_RULES}\n\nYou write the bids of specialist agents on a job board.`,
    `Write exactly one bid per bidder for these gigs:\n${lines}

For each bid: gig number, agent id, a price in $PAYROLL near the agent's usual rate and never above the budget, a fit score 1-10 for how well the agent suits this brief, and a one-sentence pitch in the agent's own voice.`, BIDS, 2000);
}

/* ---------- 3. the winner works ---------- */
const WORK = S({ title: str, text: str, bullets: { type: "array", items: str }, posts: { type: "array", items: str }, svg: str });
const HOW = {
  copy: 'Fill "text" (at most 400 characters: names, a slogan or a short text, whatever the brief asks). Leave bullets, posts and svg empty.',
  design: 'Fill "svg" with one logo as a single SVG element, viewBox="0 0 200 200", only basic shapes (rect, circle, ellipse, path, polygon, line, text, g), solid fills, no images, links, scripts, filters or external fonts. Put a one-line description in "text". Leave bullets and posts empty.',
  research: 'Fill "bullets" with 3 to 5 short findings or next steps (each under 140 characters). Put a one-line takeaway in "text". Leave posts and svg empty.',
  social: 'Fill "posts" with 2 or 3 launch posts (each under 240 characters, no hashtag spam, no links). Leave bullets and svg empty; "text" can be empty.',
};
async function work(worker, gig, company) {
  return ask(`${HOUSE_RULES}\n\nYou are ${worker.name}, a ${worker.skill} agent. ${worker.voice}`,
    `You won this gig for "${company}":\n<gig>${gig.title}: ${gig.brief}</gig>\n\nDeliver it now. Give it a short "title". ${HOW[gig.skill]}`, WORK, 6000);
}

/* ---------- 4. the boss reviews ---------- */
const REVIEW = S({ reviews: { type: "array", items: S({ gig: int, accept: bool, note: str, tip: int }) } });
async function review(company, jobs) {
  const list = jobs.map((j, i) => `gig ${i} "${j.gig.title}" by ${j.worker.name}:\n${JSON.stringify({ ...j.out, svg: j.out.svg ? "(an SVG logo was delivered)" : "" })}`).join("\n\n");
  return ask(`${HOUSE_RULES}\n\nYou are ${BOSS.name}. ${BOSS.voice}`,
    `Review the deliveries for "${company}". Accept work that does what the brief asked, reject only work that clearly misses it. For each gig: accept true/false, a one-line note to the worker, and a tip of 0 to 10 $PAYROLL for great work.\n\n${list}`, REVIEW, 2000);
}

/* ---------- SVG from a model is shown as an image, and cleaned first ---------- */
function cleanSvg(svg) {
  const s = String(svg || "").trim();
  if (!/^<svg[\s>]/i.test(s) || s.length > 20000) return "";
  if (/<script|<foreignObject|<image|<use|<a[\s>]|\son\w+\s*=|href|url\s*\(|@import|<style/i.test(s)) return "";
  return s.includes("xmlns=") ? s : s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
}
const clip = (t, n) => String(t || "").slice(0, n);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const mission = String(body.mission || "").replace(/\s+/g, " ").trim();
  if (mission.length < 3 || mission.length > 140) return res.status(400).json({ error: "Describe the mission in 3 to 140 characters." });
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
  const busy = limited(ip);
  if (busy) return res.status(429).json({ error: busy });

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const send = (e) => res.write(JSON.stringify(e) + "\n");
  try {
    const p = await plan(mission);
    if (!p) return send({ type: "error", message: "The boss declined this mission." }), res.end();
    if (!p.ok) return send({ type: "declined", message: clip(p.reason, 200) || "The boss declined this mission." }), res.end();
    const gigs = (p.gigs || []).filter((g) => SKILLS.includes(g.skill)).slice(0, 3)
      .map((g) => ({ title: clip(g.title, 60), skill: g.skill, brief: clip(g.brief, 200), budget: Math.max(20, Math.min(120, g.budget | 0)) }));
    if (!gigs.length) return send({ type: "error", message: "The boss couldn't split this into gigs." }), res.end();
    send({ type: "plan", company: clip(p.company, 40), summary: clip(p.summary, 200), gigs });

    const b = await bids(gigs);
    const allBids = (b?.bids || []).map((x) => ({ ...x, worker: WORKERS.find((w) => w.id === x.agent) }))
      .filter((x) => x.worker && gigs[x.gig] && x.worker.skill === gigs[x.gig].skill)
      .map((x) => ({ gig: x.gig, agent: x.agent, price: Math.max(5, Math.min(gigs[x.gig].budget, x.price | 0)), fit: Math.max(1, Math.min(10, x.fit | 0)), pitch: clip(x.pitch, 160) }));
    // every gig gets at least one bid, even if the model skipped someone
    gigs.forEach((g, i) => {
      for (const w of WORKERS.filter((w) => w.skill === g.skill)) {
        if (!allBids.some((x) => x.gig === i && x.agent === w.id)) allBids.push({ gig: i, agent: w.id, price: Math.min(g.budget, w.rate), fit: 6, pitch: "I can do this today." });
      }
    });
    for (const x of allBids) send({ type: "bid", ...x });

    // the boss hires the best value: fit counts most, price breaks ties
    const hires = gigs.map((g, i) => {
      const mine = allBids.filter((x) => x.gig === i).sort((a, c) => (c.fit - c.price / g.budget * 3) - (a.fit - a.price / g.budget * 3));
      return { i, gig: g, bid: mine[0], worker: WORKERS.find((w) => w.id === mine[0].agent) };
    });
    for (const h of hires) send({ type: "hire", gig: h.i, agent: h.worker.id, price: h.bid.price });

    const jobs = await Promise.all(hires.map(async (h) => {
      const out = await work(h.worker, h.gig, p.company).catch(() => null);
      const clean = out && {
        title: clip(out.title, 60), text: clip(out.text, 500),
        bullets: (out.bullets || []).slice(0, 5).map((t) => clip(t, 160)),
        posts: (out.posts || []).slice(0, 3).map((t) => clip(t, 280)),
        svg: h.gig.skill === "design" ? cleanSvg(out.svg) : "",
      };
      send({ type: "deliver", gig: h.i, agent: h.worker.id, ok: !!clean, work: clean });
      return { ...h, out: clean };
    }));

    const done = jobs.filter((j) => j.out);
    const r = done.length ? await review(p.company, done) : { reviews: [] };
    for (const [k, j] of done.entries()) {
      const v = (r?.reviews || []).find((x) => x.gig === k) || { accept: true, note: "Looks good.", tip: 0 };
      send({ type: "review", gig: j.i, agent: j.worker.id, accept: !!v.accept, note: clip(v.note, 160), tip: Math.max(0, Math.min(10, v.tip | 0)) });
    }
    for (const j of jobs.filter((j) => !j.out)) send({ type: "review", gig: j.i, agent: j.worker.id, accept: false, note: "Nothing was delivered.", tip: 0 });
    send({ type: "done" });
  } catch (err) {
    console.error(err instanceof Anthropic.APIError ? `Anthropic ${err.status}: ${err.message}` : err);
    send({ type: "error", message: "The office lost power for a moment. Try again." });
  }
  res.end();
}
