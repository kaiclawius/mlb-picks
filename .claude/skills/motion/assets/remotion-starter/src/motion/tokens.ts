// The motion system: one set of durations, easings and springs for the whole video.
// Change the feel of everything in one place instead of tuning every element.
import { Easing } from "remotion";

export const FPS = 30;
/** Seconds -> frames at the project frame rate. */
export const s = (seconds: number) => Math.round(seconds * FPS);

/** Durations in frames (30 fps). Entrances are longer than exits; holds give the eye time to read. */
export const DUR = {
  micro: s(0.2),    // tick, small accent
  enter: s(0.6),    // text or element arriving
  enterBig: s(0.9), // hero headline, product shot
  exit: s(0.4),     // leaving is quicker than arriving
  move: s(0.8),     // position change, camera move between two points
  stagger: 4,       // frames between siblings (words, cards, list items)
  transition: s(0.5),
};

/** Easing curves. Name them by intent, not by shape. */
export const EASE = {
  /** Arrivals: fast start, long soft settle (expo-out). The default for anything entering. */
  enter: Easing.bezier(0.16, 1, 0.3, 1),
  /** Departures: gentle start, quick finish. */
  exit: Easing.bezier(0.7, 0, 0.84, 0),
  /** Moving from A to B while staying on screen (camera, layout changes). */
  move: Easing.bezier(0.65, 0, 0.35, 1),
  /** Slightly springy arrival for playful brands; use sparingly. */
  pop: Easing.bezier(0.34, 1.56, 0.64, 1),
  linear: Easing.linear,
};

/** Spring presets for spring(). `smooth` never overshoots; `snappy` overshoots a little. */
export const SPRING = {
  smooth: { damping: 200 },
  gentle: { damping: 18, stiffness: 120, mass: 1 },
  snappy: { damping: 13, stiffness: 160, mass: 0.6 },
  bouncy: { damping: 9, stiffness: 140, mass: 0.7 },
};

/** Reading time for on-screen text: ~3.3 words per second plus a beat, never under 1.5 s. */
export const readFrames = (text: string, minSeconds = 1.5) =>
  Math.max(s(minSeconds), s(text.trim().split(/\s+/).length / 3.3 + 0.8));
