// Built-in voices. Each pack is a Hugging Face repo with an ONNX model that sherpa-onnx can run.
// Licenses are the licenses of the voice data, listed so you know what you may ship.
export const PACKS = {
  "de-thorsten": { repo: "csukuangfj/vits-piper-de_DE-thorsten-high", type: "vits", model: "de_DE-thorsten-high.onnx", license: "CC0 (Thorsten-Voice)", size: 115 },
  "de-thorsten-emotional": { repo: "csukuangfj/vits-piper-de_DE-thorsten_emotional-medium", type: "vits", model: "de_DE-thorsten_emotional-medium.onnx", license: "CC0 (Thorsten-Voice)", size: 78 },
  "de-kerstin": { repo: "csukuangfj/vits-piper-de_DE-kerstin-low", type: "vits", model: "de_DE-kerstin-low.onnx", license: "CC0", size: 64 },
  "de-mls": { repo: "csukuangfj/vits-piper-de_DE-mls-medium", type: "vits", model: "de_DE-mls-medium.onnx", license: "CC-BY 4.0 (Multilingual LibriSpeech): Namensnennung", size: 78 },
  "fr-tom": { repo: "csukuangfj/vits-piper-fr_FR-tom-medium", type: "vits", model: "fr_FR-tom-medium.onnx", license: "Piper fr_FR tom (see MODEL_CARD)", size: 64 },
  "fr-siwis": { repo: "csukuangfj/vits-piper-fr_FR-siwis-medium", type: "vits", model: "fr_FR-siwis-medium.onnx", license: "CC-BY 4.0 (SIWIS)", size: 64 },
  "en-kokoro": { repo: "csukuangfj/kokoro-multi-lang-v1_0", type: "kokoro", model: "model.onnx", license: "Apache 2.0 (Kokoro-82M)", size: 340,
    skip: [/^dict\//, /\.fst$/, /lexicon-zh/, /^date-zh/] },
};

// sid = speaker id inside the pack. Kokoro v1.0 order as published by sherpa-onnx.
export const VOICES = [
  { id: "thorsten", name: "Thorsten", lang: "de", gender: "m", pack: "de-thorsten", sid: 0, note: "Klar, neutral. Die beste deutsche Standardstimme." },
  { id: "thorsten-froh", name: "Thorsten (fröhlich)", lang: "de", gender: "m", pack: "de-thorsten-emotional", sid: 0, note: "amüsiert" },
  { id: "thorsten-fluestern", name: "Thorsten (flüsternd)", lang: "de", gender: "m", pack: "de-thorsten-emotional", sid: 7, note: "Flüstern" },
  { id: "thorsten-ueberrascht", name: "Thorsten (überrascht)", lang: "de", gender: "m", pack: "de-thorsten-emotional", sid: 6 },
  { id: "kerstin", name: "Kerstin", lang: "de", gender: "f", pack: "de-kerstin", sid: 0, note: "Weiblich, etwas einfachere Qualität." },
  { id: "mls-anna", name: "Anna (MLS)", lang: "de", gender: "f", pack: "de-mls", sid: 3, note: "Aus 236 Sprechern des MLS-Datensatzes." },
  { id: "mls-jonas", name: "Jonas (MLS)", lang: "de", gender: "m", pack: "de-mls", sid: 0 },
  { id: "tom", name: "Tom", lang: "fr", gender: "m", pack: "fr-tom", sid: 0, note: "Français. Speaks English with a strong French accent, too." },
  { id: "siwis", name: "Siwis", lang: "fr", gender: "f", pack: "fr-siwis", sid: 0, note: "Français." },
  { id: "heart", name: "Heart", lang: "en", accent: "US", gender: "f", pack: "en-kokoro", sid: 3, note: "Warm and natural. The best English default." },
  { id: "bella", name: "Bella", lang: "en", accent: "US", gender: "f", pack: "en-kokoro", sid: 2 },
  { id: "nicole", name: "Nicole", lang: "en", accent: "US", gender: "f", pack: "en-kokoro", sid: 6, note: "Soft, close to the mic." },
  { id: "sarah", name: "Sarah", lang: "en", accent: "US", gender: "f", pack: "en-kokoro", sid: 9 },
  { id: "michael", name: "Michael", lang: "en", accent: "US", gender: "m", pack: "en-kokoro", sid: 16 },
  { id: "adam", name: "Adam", lang: "en", accent: "US", gender: "m", pack: "en-kokoro", sid: 11 },
  { id: "puck", name: "Puck", lang: "en", accent: "US", gender: "m", pack: "en-kokoro", sid: 18, note: "Upbeat." },
  { id: "emma", name: "Emma", lang: "en", accent: "UK", gender: "f", pack: "en-kokoro", sid: 21 },
  { id: "george", name: "George", lang: "en", accent: "UK", gender: "m", pack: "en-kokoro", sid: 26 },
  { id: "daniel", name: "Daniel", lang: "en", accent: "UK", gender: "m", pack: "en-kokoro", sid: 24 },
];
export const DEFAULT_VOICE = { de: "thorsten", en: "heart", fr: "tom" };
