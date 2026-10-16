// End-to-end: records ~12 s with fake camera, fake screen and a speech file as microphone, then waits
// for processing and the transcript. Run with a Klipp server on KLIPP_URL (default http://localhost:4747).
//   node test/e2e-record.mjs [speech.wav] [seconds] [mode]
import { chromium } from "playwright";
const URL = process.env.KLIPP_URL || "http://localhost:4747";
const [wav, secs = "12", mode = "both"] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen",
    "--enable-usermedia-screen-capturing", "--allow-http-screen-capture", ...(wav ? [`--use-file-for-fake-audio-capture=${wav}`] : [])],
});
const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push("pageerror: " + e.message));
await page.goto(URL + "/record");
await page.waitForTimeout(1200);
await page.click(`#modes [data-mode="${mode}"]`);
await page.uncheck("#countdown");
await page.waitForTimeout(800);
const support = await page.evaluate(() => ["video/mp4;codecs=avc1,opus", "video/webm;codecs=vp9,opus", "video/mp4;codecs=avc1"].map((m) => m + "=" + MediaRecorder.isTypeSupported(m)));
console.log("mime support:", support.join(" "));
await page.click("#start");
await page.waitForSelector("#recbar:not(.hidden)", { timeout: 15000 });
console.log("recording…");
await page.waitForTimeout(Number(secs) * 1000 / 2);
await page.click("#pause"); await page.waitForTimeout(1500); await page.click("#pause");
await page.waitForTimeout(Number(secs) * 1000 / 2);
await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/rec.png" : "/tmp/rec.png" });
await page.click("#stop");
await page.waitForURL(/\/v\/[a-z0-9]{10}/, { timeout: 30000 });
const id = page.url().match(/\/v\/([a-z0-9]{10})/)[1];
console.log("recording id", id);
let meta;
for (let i = 0; i < 240; i++) {
  meta = await (await fetch(`${URL}/api/recordings/${id}`)).json();
  if (meta.status === "error") break;
  if (meta.status === "ready" && !["pending", "running"].includes(meta.ai.transcript)) break;
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(JSON.stringify({ status: meta.status, error: meta.error, duration: meta.duration, media: meta.media, ai: meta.ai, title: meta.title, words: meta.transcript?.length }, null, 1));
console.log("text:", (meta.transcript || []).map((w) => w.w).join(" ").slice(0, 300));
if (process.env.SHOT_DIR) { await page.waitForTimeout(1500); await page.screenshot({ path: process.env.SHOT_DIR + "/watch.png", fullPage: true }); }
console.log(logs.filter((l) => /error|warn/i.test(l)).slice(0, 10).join("\n"));
await browser.close();
