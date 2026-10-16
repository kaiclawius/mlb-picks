import { test } from "node:test";
import assert from "node:assert/strict";
import * as C from "../web/js/cuts.js";
import { keepSegments, mapTime, mapForward, cues, toVtt } from "../server/media.js";
import { collapseLoops } from "../server/transcribe.js";
import { lines } from "../server/ai.js";

const W = (s) => s.split(" ").map((w, i) => ({ w, s: i * 0.5, e: i * 0.5 + 0.4 }));

test("cuts merge, subtract and stay sorted", () => {
  assert.deepEqual(C.normalize([[5, 6], [1, 2], [1.5, 3]]), [[1, 3], [5, 6]]);
  assert.deepEqual(C.subtract([[1, 5]], [2, 3]), [[1, 2], [3, 5]]);
  assert.deepEqual(C.add([[1, 2]], [2.01, 4]), [[1, 4]]);
  assert.equal(C.removed([[1, 2], [3, 5]]), 3);
});

test("deleting words cuts from the word before to the word after", () => {
  const w = W("eins zwei drei vier");
  assert.deepEqual(C.wordsRange(w, 1, 2), [0.4, 1.5]);
});

test("filler words and long pauses become cuts", () => {
  const w = [{ w: "Also", s: 0, e: 0.3 }, { w: "ähm,", s: 0.4, e: 0.7 }, { w: "los", s: 3, e: 3.3 }];
  assert.equal(C.fillerCuts(w).length, 1);
  assert.deepEqual(C.pauseCuts(w, 3.5), [[0.9, 2.85]]);
});

test("keep segments and time mapping after cuts", () => {
  const k = keepSegments(10, [[0, 1], [4, 5]]);
  assert.deepEqual(k, [[1, 4], [5, 10]]);
  assert.equal(mapTime(2, k), 1);
  assert.equal(mapTime(4.5, k), null);
  assert.equal(mapForward(4.5, k), 3);
  assert.equal(mapTime(6, k), 4);
});

test("captions: short lines, VTT format", () => {
  const cs = cues(W("a b c d e f g h i"));
  assert.equal(cs.length, 2);
  assert.match(toVtt(cs), /^WEBVTT\n\n00:00:00\.000 --> 00:00:02\.900\na b c d e f\n/);
});

test("whisper loops are collapsed, real repeats stay", () => {
  const out = collapseLoops(W("ja ja das ist es das ist es das ist es fertig"));
  assert.equal(out.map((w) => w.w).join(" "), "ja ja das ist es fertig");
});

test("transcript lines for prompts carry timestamps", () => {
  assert.equal(lines([{ w: "Hallo.", s: 0, e: 0.5 }, { w: "Weiter", s: 65, e: 65.4 }]), "[00:00] Hallo.\n[01:05] Weiter");
});
