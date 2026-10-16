// Cuts are time ranges [start, end] (seconds in the original recording) that are skipped.
// All editing (trim, deleted words, fillers, pauses) ends up as this one list.

export function normalize(cuts, duration = Infinity) {
  const cs = cuts.map(([a, b]) => [Math.max(0, a), Math.min(duration, b)]).filter(([a, b]) => b - a > 0.02).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const c of cs) { const l = out[out.length - 1]; if (l && c[0] <= l[1] + 0.02) l[1] = Math.max(l[1], c[1]); else out.push([...c]); }
  return out.map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)]);
}
export const add = (cuts, range, d) => normalize([...cuts, range], d);
export function subtract(cuts, [a, b], d) {
  const out = [];
  for (const [x, y] of cuts) {
    if (y <= a || x >= b) out.push([x, y]);
    else { if (x < a) out.push([x, a]); if (y > b) out.push([b, y]); }
  }
  return normalize(out, d);
}
export const inCut = (cuts, t) => cuts.find(([a, b]) => t >= a && t < b) || null;
export const removed = (cuts) => cuts.reduce((s, [a, b]) => s + b - a, 0);
export const wordCut = (cuts, w) => cuts.some(([a, b]) => (w.s + w.e) / 2 >= a && (w.s + w.e) / 2 < b);

/** Range that removes words i..j cleanly: from the end of the word before to the start of the word after. */
export function wordsRange(words, i, j) {
  const prev = words[i - 1], next = words[j + 1];
  const a = prev ? Math.max(prev.e, words[i].s - 0.25) : Math.max(0, words[i].s - 0.25);
  const b = next ? Math.min(next.s, words[j].e + 0.25) : words[j].e + 0.25;
  return [a, b];
}

const FILLERS = new Set(["äh", "ähm", "öhm", "ehm", "hm", "hmm", "mhm", "uh", "um", "umm", "uhm", "erm", "eh", "äääh", "ääh", "ähh", "uhh"]);
export const isFiller = (w) => FILLERS.has(w.w.toLowerCase().replace(/[^a-zäöüß]/g, ""));

export function fillerCuts(words) {
  const out = [];
  words.forEach((w, i) => { if (isFiller(w)) out.push(wordsRange(words, i, i)); });
  return out;
}

/** Long silences between words: keep 0.35 s of air, cut the rest. Also dead air at the start and the end. */
export function pauseCuts(words, duration, min = 1.0) {
  const out = [];
  if (!words.length) return out;
  if (words[0].s > 0.8) out.push([0, words[0].s - 0.4]);
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].s - words[i - 1].e;
    if (gap > min) out.push([words[i - 1].e + 0.2, words[i].s - 0.15]);
  }
  const last = words[words.length - 1].e;
  if (duration - last > 1.2) out.push([last + 0.7, duration]);
  return out.map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)]);
}
