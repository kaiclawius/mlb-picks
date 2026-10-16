// Settings, all overridable with environment variables or a .env file.
import { existsSync, readFileSync } from "node:fs";
import { homedir, cpus } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(ROOT, ".env"))) {
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const env = process.env;
export const config = {
  port: Number(env.STIMME_PORT || 4848),
  host: env.STIMME_HOST || "127.0.0.1",
  home: resolve(env.STIMME_HOME || join(homedir(), "Stimme")), // models/, voices/, history/
  threads: Number(env.STIMME_THREADS || Math.max(1, Math.min(4, cpus().length - 1))),
  python: env.STIMME_PYTHON || join(ROOT, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"),
  cloneDevice: env.STIMME_DEVICE || "auto", // auto | cuda | mps | cpu
  hfMirror: env.STIMME_HF || "https://huggingface.co",
};
