import { KEY_POINTS } from "./connections";
import type { Hand, Pt } from "./types";

/**
 * Exponential moving average over a hand's landmarks. MediaPipe output jitters
 * a few pixels frame-to-frame even when the hand is still; smoothing keeps both
 * the overlay and the steadiness signal from twitching.
 *
 * `alpha` is the weight of the new frame (0 = frozen, 1 = no smoothing).
 * Returns a fresh array; when there's no previous frame (or the point count
 * changed, e.g. a hand just appeared) it passes the new landmarks through.
 */
export function smoothLandmarks(prev: Hand | null, next: Hand, alpha = 0.5): Hand {
  if (!prev || prev.length !== next.length) {
    return next.map((p) => ({ ...p }));
  }
  return next.map((p, i) => {
    const q = prev[i]!;
    return {
      x: q.x + (p.x - q.x) * alpha,
      y: q.y + (p.y - q.y) * alpha,
      z: q.z + (p.z - q.z) * alpha,
    };
  });
}

/**
 * Mean 2D (x/y) displacement of the wrist + fingertips between two frames, in
 * normalized image units. z is ignored — depth from a single camera is noisy
 * and not what "is the hand holding still" is about.
 */
export function meanMotion(a: Hand, b: Hand): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (const i of KEY_POINTS) {
    const p = a[i];
    const q = b[i];
    if (!p || !q) continue;
    sum += Math.hypot(p.x - q.x, p.y - q.y);
  }
  return sum / KEY_POINTS.length;
}

export type { Pt };
