// All settings in one place. Everything can be changed with environment variables (or a .env file).
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// tiny .env reader: KEY=value lines, no quotes needed
if (existsSync(join(ROOT, ".env"))) {
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const env = process.env;
export const config = {
  port: Number(env.KLIPP_PORT || 4747),
  // only this computer can reach Klipp unless you set KLIPP_HOST=0.0.0.0 (then everyone in your network can)
  host: env.KLIPP_HOST || "127.0.0.1",
  library: resolve(env.KLIPP_LIBRARY || join(homedir(), "Klipp")),
  whisperModel: env.KLIPP_WHISPER_MODEL || "onnx-community/whisper-base_timestamped",
  language: env.KLIPP_LANGUAGE || "", // "" = detect automatically, or e.g. "german", "english"
  claudeModel: env.KLIPP_CLAUDE_MODEL || "claude-opus-5-5",
  hasClaude: Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN),
  transcribe: env.KLIPP_TRANSCRIBE !== "off",
  open: env.KLIPP_OPEN === "1", // open the browser on start
  // Stimme (text to speech) for narrated agent videos: a running Stimme server, or the Stimme folder next to Klipp
  stimmeUrl: env.STIMME_URL || "http://127.0.0.1:4848",
  stimmeDir: resolve(env.STIMME_DIR || join(ROOT, "..", "stimme")),
};
