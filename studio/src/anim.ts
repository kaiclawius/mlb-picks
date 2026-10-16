import { Easing, interpolate, useVideoConfig } from "remotion";

// One easing for everything: fast out, long calm settle. No bounces.
export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Fade + rise for an element that appears at `start` frames into its scene. */
export function reveal(frame: number, start = 0, dist = 28, dur = 26): React.CSSProperties {
  const k = interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return { opacity: k, transform: `translateY(${(1 - k) * dist}px)` };
}

/** Fades the whole scene out over its last frames, so cuts feel soft even without a transition. */
export function outro(frame: number, total: number, dur = 12) {
  return interpolate(frame, [total - dur, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

/** Layout unit: 1 = a 1080p frame. Every size in the scenes is a multiple of it. */
export function useLayout() {
  const { width, height } = useVideoConfig();
  const portrait = height > width * 1.2;
  const square = !portrait && height > width * 0.8;
  const u = portrait ? width / 1080 : Math.min(width / 1920, height / 1080);
  const pad = (portrait ? 80 : square ? 80 : 120) * u;
  return { width, height, portrait, square, u, pad };
}
