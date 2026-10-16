// One-time setup for voice cloning: a Python environment with Chatterbox in stimme/.venv.
// Uses uv when available (fast), otherwise python -m venv + pip. NVIDIA GPUs get CUDA builds automatically;
// everything else gets the smaller CPU build of PyTorch (Apple Silicon uses its GPU through MPS).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const venv = join(ROOT, ".venv");
const py = join(venv, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const has = (cmd) => spawnSync(cmd, ["--version"], { stdio: "ignore" }).status === 0;
const run = (cmd, args) => { console.log("›", cmd, args.join(" ")); execFileSync(cmd, args, { stdio: "inherit", cwd: ROOT }); };
const nvidia = has("nvidia-smi");
const extra = nvidia || process.platform === "darwin" ? [] : ["--extra-index-url", "https://download.pytorch.org/whl/cpu"];

if (has("uv")) {
  if (!existsSync(py)) run("uv", ["venv", venv, "--python", "3.12"]);
  run("uv", ["pip", "install", "--python", py, "-r", "sidecar/requirements.txt", "--index-strategy", "unsafe-best-match", ...extra]);
} else {
  const sys = ["python3.12", "python3.11", "python3", "python"].find(has);
  if (!sys) { console.error("Python 3.10+ fehlt. Installiere Python (python.org) oder uv (https://docs.astral.sh/uv/)."); process.exit(1); }
  if (!existsSync(py)) run(sys, ["-m", "venv", venv]);
  run(py, ["-m", "pip", "install", "--upgrade", "pip"]);
  run(py, ["-m", "pip", "install", "-r", "sidecar/requirements.txt", ...extra]);
}
run(py, ["-c", "import chatterbox, torch; print('Chatterbox bereit, PyTorch', torch.__version__)"]);
console.log("\nFertig. Beim ersten Klonen lädt Stimme das Modell (~3 GB) einmal herunter.");
