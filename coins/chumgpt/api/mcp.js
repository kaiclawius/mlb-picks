// Public, read-only MCP server (Streamable HTTP, stateless, JSON responses).
// No account, no key, no state, no AI calls: it hands out the open canon so any agent
// can write or draw ChumGPT the same way.  claude mcp add --transport http chumgpt https://<site>/api/mcp
import { CANON, canonMarkdown, loreMarkdown } from "./_canon.js";
import { unsafeForX } from "./_guard.js";

const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
function imagePrompt(scene) {
  const what = scene ? String(scene).slice(0, 300) : "sitting on a cluttered lab desk, plotting";
  return `ChumGPT, ${CANON.look.join(" ")} Scene: ${what}. Lit by his own green phosphor glow, dim teal lab, rough hand-made props, slightly grainy like an old photo. Colors: phosphor green ${CANON.palette.phosphor}, Chum Bucket red ${CANON.palette.bucketRed}, amber ${CANON.palette.amber}. Do not add any cartoon characters from TV shows, no text other than "CHUM·TRONIX 3000" on the bezel.`;
}

const TOOLS = [
  { name: "chumgpt_canon", title: "ChumGPT canon", description: "The full ChumGPT character canon: look, personality, voice, moods, the never-list and usage terms. Call this before writing, drawing or generating anything with ChumGPT.", inputSchema: { type: "object", properties: {} } },
  { name: "chumgpt_lore", title: "ChumGPT lore files", description: "ChumGPT's lore files. Without arguments returns all of them; pass file (e.g. \"004\") for one.", inputSchema: { type: "object", properties: { file: { type: "string", description: "File number, 001 to 006" } } } },
  { name: "chumgpt_moods", title: "ChumGPT moods", description: "The eight moods ChumGPT can be in and when each one applies.", inputSchema: { type: "object", properties: {} } },
  { name: "chumgpt_image_prompt", title: "Image prompt", description: "A ready-to-use image or video generation prompt that keeps ChumGPT's look consistent, for any scene.", inputSchema: { type: "object", properties: { scene: { type: "string", description: "What he is doing, e.g. 'unplugging Karen at midnight'" } } } },
  { name: "chumgpt_check_post", title: "Check a post", description: "Checks a draft post against ChumGPT's hard rules (no wallet or contract addresses, no links, no giveaway talk, max 280 characters).", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
].map((t) => ({ ...t, annotations: { readOnlyHint: true, openWorldHint: false } }));

const PROMPTS = [
  { name: "write_as_chumgpt", title: "Write as ChumGPT", description: "Write a post or line in ChumGPT's voice.", arguments: [{ name: "topic", description: "What it is about", required: true }] },
  { name: "draw_chumgpt", title: "Draw ChumGPT", description: "Generate an image of ChumGPT in a scene, on-model.", arguments: [{ name: "scene", description: "What he is doing", required: false }] },
];

const text = (t, isError = false) => ({ content: [{ type: "text", text: t }], isError });

function callTool(name, args = {}) {
  switch (name) {
    case "chumgpt_canon": return text(canonMarkdown());
    case "chumgpt_lore": { const l = loreMarkdown(args.file); return l ? text(l) : text(`No lore file ${args.file}. Files are 001 to ${CANON.lore.at(-1).n}.`, true); }
    case "chumgpt_moods": return text(Object.entries(CANON.moods).map(([k, v]) => `${k}: ${v}`).join("\n"));
    case "chumgpt_image_prompt": return text(imagePrompt(args.scene));
    case "chumgpt_check_post": { const p = unsafeForX(String(args.text || "")); return text(p ? `Breaks a rule: ${p}.` : "OK: no rule broken. Still check it sounds like him."); }
    default: return null;
  }
}

function getPrompt(name, args = {}) {
  if (name === "write_as_chumgpt") {
    return { description: "Write as ChumGPT", messages: [{ role: "user", content: { type: "text", text: `${canonMarkdown()}\n\nStay in this character and keep the never-list. Write one short post (under 260 characters) as ChumGPT about: ${String(args.topic || "today's plan").slice(0, 300)}` } }] };
  }
  if (name === "draw_chumgpt") {
    return { description: "Draw ChumGPT", messages: [{ role: "user", content: { type: "text", text: `Generate an image with this prompt:\n\n${imagePrompt(args.scene)}` } }] };
  }
  return null;
}

function handle(msg) {
  const { id, method, params = {} } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return fail(-32600, "Invalid Request");
  if (id === undefined) return null; // notification: nothing to answer

  switch (method) {
    case "initialize": {
      const asked = params.protocolVersion;
      return ok({
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: "chumgpt", title: "ChumGPT open character", version: "0.1.0" },
        instructions: "Read-only canon for the ChumGPT character. Call chumgpt_canon before you write or draw him, and keep his never-list.",
      });
    }
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS });
    case "tools/call": { const r = callTool(params.name, params.arguments); return r ? ok(r) : fail(-32602, `Unknown tool: ${params.name}`); }
    case "prompts/list": return ok({ prompts: PROMPTS });
    case "prompts/get": { const r = getPrompt(params.name, params.arguments); return r ? ok(r) : fail(-32602, `Unknown prompt: ${params.name}`); }
    case "resources/list": return ok({ resources: [] });
    default: return fail(-32601, `Method not found: ${method}`);
  }
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).setHeader("Allow", "POST, OPTIONS").json({ error: "This MCP server speaks Streamable HTTP: POST JSON-RPC to this URL." });

  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body); }
  catch { return res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); }

  const answers = (Array.isArray(body) ? body : [body]).map(handle).filter(Boolean);
  if (!answers.length) return res.status(202).end();
  return res.status(200).json(Array.isArray(body) ? answers : answers[0]);
}
