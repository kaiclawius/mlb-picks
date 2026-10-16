// Pipeline test without a browser: uploads prepared files in 256 KB chunks like the recorder does.
//   node test/api-upload.mjs screen.webm cam.webm mic.webm [language]
import { readFile } from "node:fs/promises";
const URL = process.env.KLIPP_URL || "http://localhost:4747";
const [screen, cam, mic, language = "english"] = process.argv.slice(2);
const files = { screen, cam, mic };
const tracks = Object.fromEntries(Object.entries(files).filter(([, f]) => f && f !== "-").map(([k]) => [k, { mime: k === "mic" ? "audio/webm;codecs=opus" : "video/webm;codecs=vp9" }]));
const meta = await (await fetch(URL + "/api/recordings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tracks, language }) })).json();
for (const [k, f] of Object.entries(files)) {
  if (!f || f === "-") continue;
  const b = await readFile(f);
  for (let i = 0, seq = 0; i < b.length; i += 256 * 1024, seq++) {
    const r = await fetch(`${URL}/api/recordings/${meta.id}/tracks/${k}/${seq}`, { method: "PUT", body: b.subarray(i, i + 256 * 1024) });
    if (!r.ok) throw new Error(`${k} ${seq}: ${r.status} ${await r.text()}`);
  }
}
await fetch(`${URL}/api/recordings/${meta.id}/finish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
let m;
for (let i = 0; i < 300; i++) {
  m = await (await fetch(`${URL}/api/recordings/${meta.id}`)).json();
  if (m.status === "error" || (m.status === "ready" && !["pending", "running"].includes(m.ai.transcript))) break;
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(meta.id, m.status, m.error || "", m.duration, JSON.stringify(m.ai));
console.log((m.transcript || []).map((w) => w.w).join(" "));
