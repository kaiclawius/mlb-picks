// Built-in voices with sherpa-onnx (Piper/VITS for German, Kokoro for English). Runs on the CPU, faster than real time.
import { createRequire } from "node:module";
import { join } from "node:path";
import { config } from "./config.js";
import { PACKS } from "./catalog.js";
import { ensure } from "./models.js";

const require = createRequire(import.meta.url);
const sherpa = require("sherpa-onnx-node");
const engines = {}; // pack -> Promise<OfflineTts>

async function engine(pack) {
  engines[pack] ??= (async () => {
    const dir = await ensure(pack);
    const p = PACKS[pack];
    const model = p.type === "kokoro"
      ? { kokoro: { model: join(dir, p.model), voices: join(dir, "voices.bin"), tokens: join(dir, "tokens.txt"), dataDir: join(dir, "espeak-ng-data"),
          lexicon: join(dir, "lexicon-us-en.txt"), lengthScale: 1.0 } }
      : { vits: { model: join(dir, p.model), tokens: join(dir, "tokens.txt"), dataDir: join(dir, "espeak-ng-data"), noiseScale: 0.667, noiseScaleW: 0.8, lengthScale: 1.0 } };
    return sherpa.OfflineTts.createAsync({ model: { ...model, numThreads: config.threads, provider: "cpu", debug: 0 }, maxNumSentences: 1, silenceScale: 0.3 });
  })().catch((e) => { delete engines[pack]; throw e; });
  return engines[pack];
}

/** One chunk of text -> { samples: Float32Array, sampleRate }. */
export async function synth(voice, text, speed = 1) {
  const tts = await engine(voice.pack);
  const out = await tts.generateAsync({ text, sid: voice.sid, speed, enableExternalBuffer: false });
  return { samples: out.samples, sampleRate: out.sampleRate };
}
export const warm = (pack) => engine(pack);
