// Drives the Klipp MCP server like an agent would: lists tools, records a narrated website flow,
// reads the result, looks at frames, comments. Needs Stimme next to Klipp (or STIMME_URL).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFileSync } from "node:fs";
const [site, shotDir] = process.argv.slice(2);
const client = new Client({ name: "test-agent", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["server/mcp.js"], env: { ...process.env }, stderr: "inherit" }));
const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));
const call = async (name, args) => { const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 900_000 }); if (r.isError) console.log("ERROR", name, r.content[0].text); return r; };
console.log((await call("stimme_voices", {})).content[0].text.split("\n").slice(0, 4).join("\n"));
const t0 = Date.now();
const rec = await call("klipp_record_website", {
  url: site, title: "Agent-Demo: Rechnung exportieren", agent: "Test-Agent", language: "de", voice: "thorsten",
  steps: [
    { action: "wait", value: 300, say: "Hallo! Ich zeige dir kurz, was ich gebaut habe.", chapter: "Start" },
    { action: "type", target: "#q", value: "Rechnung März", say: "Zuerst suche ich die Rechnung vom März." },
    { action: "click", target: "text=Exportieren", say: "Dann klicke ich auf Exportieren.", chapter: "Export" },
    { action: "highlight", target: "#done", say: "Und hier siehst du: Der Export ist fertig." },
  ],
});
console.log(rec.content[0].text, `(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
const id = rec.content[0].text.match(/ID: ([a-z0-9]{10})/)?.[1];
if (!id) process.exit(1);
await new Promise((r) => setTimeout(r, 20000)); // transcript in the background
console.log((await call("klipp_get", { id })).content[0].text);
const fr = await call("klipp_frames", { id, count: 3, width: 960 });
fr.content.filter((c) => c.type === "image").forEach((c, i) => writeFileSync(`${shotDir}/mcp-frame-${i}.jpg`, Buffer.from(c.data, "base64")));
console.log("frames:", fr.content.filter((c) => c.type === "image").length);
console.log((await call("klipp_comment", { id, t: 4, text: "Ich habe die Suche schneller gemacht." })).content[0].text);
console.log((await call("klipp_search", { query: "Rechnung" })).content[0].text);
await client.close();
