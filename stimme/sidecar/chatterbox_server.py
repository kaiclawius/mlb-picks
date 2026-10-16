"""Voice cloning for Stimme, with Chatterbox Multilingual (Resemble AI, MIT license).

Started by the Node server on demand:  python sidecar/chatterbox_server.py <port> <device>
Keeps the model in memory and answers small JSON requests on 127.0.0.1 only.
Every generated file carries Resemble's inaudible Perth watermark, so cloned speech stays traceable.
"""
import hmac
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS, Conditionals

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4849
WANT = sys.argv[2] if len(sys.argv) > 2 else "auto"
# Only the Stimme server that started us knows this token, and files are only read/written inside the Stimme folder.
TOKEN = os.environ.get("STIMME_SIDECAR_TOKEN", "")
HOME = os.path.realpath(os.environ.get("STIMME_HOME_DIR", os.getcwd()))


def inside_home(path):
    real = os.path.realpath(path)
    return real == HOME or real.startswith(HOME + os.sep)


def pick_device():
    if WANT != "auto":
        return WANT
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


DEVICE = pick_device()
if DEVICE == "cpu":
    torch.set_num_threads(max(1, min(8, torch.get_num_threads())))
state = {"ready": False, "error": None, "device": DEVICE}
model = None
lock = threading.Lock()  # one generation at a time: the model is not thread-safe


def load():
    global model
    try:
        model = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE)
        state["ready"] = True
    except Exception as e:  # noqa: BLE001 - reported to the Node side
        state["error"] = str(e)


threading.Thread(target=load, daemon=True).start()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def allowed(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        if host not in ("127.0.0.1", "localhost"):
            return False
        return bool(TOKEN) and hmac.compare_digest(self.headers.get("X-Stimme-Token", ""), TOKEN)

    def do_GET(self):
        if not self.allowed():
            return self.reply(403, {"error": "forbidden"})
        if self.path == "/health":
            return self.reply(200, state)
        self.reply(404, {"error": "not found"})

    def do_POST(self):
        if not self.allowed():
            return self.reply(403, {"error": "forbidden"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            req = json.loads(self.rfile.read(n) or b"{}")
            for key in ("ref", "out", "conds"):
                if key in req and not inside_home(str(req[key])):
                    return self.reply(400, {"error": f"{key} must be inside the Stimme folder"})
            if not state["ready"]:
                return self.reply(503, {"error": state["error"] or "model is still loading"})
            if self.path == "/prepare":
                # reference recording -> speaker conditionals, saved once per voice
                with lock:
                    model.prepare_conditionals(req["ref"], exaggeration=float(req.get("exaggeration", 0.5)))
                    model.conds.save(req["out"])
                return self.reply(200, {"ok": True})
            if self.path == "/speak":
                t0 = time.time()
                with lock:
                    model.conds = Conditionals.load(req["conds"], map_location="cpu").to(DEVICE)
                    wav = model.generate(
                        req["text"],
                        language_id=req.get("lang", "de"),
                        exaggeration=float(req.get("exaggeration", 0.5)),
                        cfg_weight=float(req.get("cfg", 0.5)),
                        temperature=float(req.get("temperature", 0.8)),
                    )
                ta.save(req["out"], wav, model.sr)
                return self.reply(200, {"ok": True, "sampleRate": model.sr, "seconds": wav.shape[-1] / model.sr, "took": time.time() - t0})
            self.reply(404, {"error": "not found"})
        except Exception as e:  # noqa: BLE001
            self.reply(500, {"error": str(e)})


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
