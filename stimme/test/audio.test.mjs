import { test } from "node:test";
import assert from "node:assert/strict";
import { sentences, join, wav, readWav, resample } from "../server/audio.js";

test("text is split into sentences, long ones at commas", () => {
  assert.deepEqual(sentences("Hallo Welt. Wie geht's? Gut!"), ["Hallo Welt.", "Wie geht's?", "Gut!"]);
  const long = "Das ist ein sehr langer Satz, " + "mit vielen Teilen, ".repeat(20) + "und einem Ende.";
  for (const s of sentences(long)) assert.ok(s.length <= 220);
});

test("chunks are joined with pauses and start times", () => {
  const a = new Float32Array(100).fill(0.5), b = new Float32Array(50).fill(-0.5);
  const r = join([a, b], 100, [0.5, 0]);
  assert.equal(r.samples.length, 200);
  assert.deepEqual(r.starts, [0, 1.5]);
});

test("WAV round trip and resampling", () => {
  const s = Float32Array.from({ length: 480 }, (_, i) => Math.sin(i / 10) * 0.8);
  const back = readWav(wav(s, 24000));
  assert.equal(back.sampleRate, 24000);
  assert.ok(Math.abs(back.samples[100] - s[100]) < 1e-3);
  assert.equal(resample(s, 24000, 12000).length, 240);
});
