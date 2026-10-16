// A stand-in for the Anthropic API so the AI features can be tested without a key or cost.
//   node test/fake-claude.mjs 4800   then run Klipp with ANTHROPIC_BASE_URL=http://127.0.0.1:4800 ANTHROPIC_API_KEY=test
import { createServer } from "node:http";
const port = Number(process.argv[2] || 4800);
createServer(async (req, res) => {
  let b = ""; for await (const c of req) b += c;
  const body = JSON.parse(b || "{}");
  const user = JSON.stringify(body.messages);
  const props = Object.keys(body.output_config?.format?.schema?.properties || {});
  console.log(req.method, req.url, body.model, "betas:", req.headers["anthropic-beta"], "fallbacks:", body.fallbacks, "effort:", body.output_config?.effort, "fields:", props.join(","));
  let out;
  if (props.includes("tldr")) out = { title: "So funktioniert der neue Export", summary: "Kurze Tour durch den Export: Schnitte, Bubble und Untertitel landen automatisch im fertigen Video.", tldr: ["Schnitte werden übernommen", "Die Bubble bleibt, wo du sie hinlegst"], chapters: [{ t: 0, title: "Einleitung" }, { t: 7, title: "Der Export" }], actions: ["Export einmal selbst testen"] };
  else if (props.includes("moments")) out = { answer: "Im Video wird gezeigt, dass du fragen sollst, was du für dein Land tun kannst.", moments: [{ t: 2, label: "Die Kernaussage" }, { t: 9, label: "Schluss" }] };
  else if (props.includes("steps")) out = { title: "Export in drei Schritten", intro: "So exportierst du eine Aufnahme als MP4.", steps: [{ t: 1, title: "Aufnahme öffnen", text: "Öffne die Aufnahme in der Bibliothek." }, { t: 5, title: "Bearbeiten wählen", text: "Klicke auf den Tab Bearbeiten." }, { t: 10, title: "Exportieren", text: "Klicke bei MP4 auf Erstellen und lade die Datei." }], tips: ["Untertitel gibt es als eigene Variante."] };
  else if (props.includes("lines")) { const n = (user.match(/Return exactly (\d+) lines/) || [])[1] | 0; out = { lines: Array.from({ length: n }, (_, i) => `[EN] line ${i + 1}`) }; }
  else out = {};
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ id: "msg_test", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text: JSON.stringify(out) }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }));
}).listen(port, "127.0.0.1", () => console.log("fake claude on", port));
