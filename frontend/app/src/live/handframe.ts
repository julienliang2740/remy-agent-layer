/**
 * View-invariant hand normalization — the always-on backbone that makes action
 * recognition robust to camera motion (handheld pan, zoom, roll, head-worn).
 *
 * Each hand is mapped into its OWN canonical frame:
 *   origin o = wrist (landmark 0)
 *   scale  s = median of the three rigid palm bones |0→5|, |0→9|, |0→17|
 *              (palm bones don't flex, so s tracks camera distance/zoom, not
 *               articulation; median-of-3 survives one occluded MCP)
 *   axis   u = unit(0→9)  (wrist→middle-MCP, a long stable bone) = hand "up"
 *          v = perp(u)
 *   norm[i] = ( (H[i]-o)·v / s , (H[i]-o)·u / s , 0 )
 *
 * Invariance: a camera change is an image-space similarity T(p) = c·R·p + b.
 * Then H[i]-o cancels b, dividing by s cancels c, and projecting onto u/v
 * cancels R — so normalizeHand(T(H)) == normalizeHand(H) for ANY pan b, zoom c,
 * roll R. Proven algebraically and asserted in handframe.test.ts.
 *
 * Pure, framework-agnostic, null on malformed input (mirrors grip.ts).
 */
import type { Hand, Pt } from "./types";

export type HandFrame = {
  origin: Pt;
  scale: number;
  /** Roll angle of the hand's up-axis in image space (radians). */
  angle: number;
  u: Pt;
  v: Pt;
};

/** A hand expressed in its canonical frame (camera-invariant). 21 points. */
export type NormalizedHand = Pt[];

/** Below this palm scale the hand is edge-on/degenerate; dividing explodes. */
export const S_MIN = 1e-4;

const WRIST = 0;
const PALM_MCPS = [5, 9, 17] as const; // index, middle, pinky MCP
const UP_MCP = 9; // middle-finger MCP

function median3(a: number, b: number, c: number): number {
  return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
}

/** Median rigid palm-bone length from the wrist — the camera-distance proxy. */
export function palmScale(hand: Hand): number {
  const o = hand[WRIST]!;
  const [a, b, c] = PALM_MCPS.map((i) => {
    const p = hand[i]!;
    return Math.hypot(p.x - o.x, p.y - o.y);
  }) as [number, number, number];
  return median3(a, b, c);
}

/**
 * Normalize a hand into its canonical frame. Returns null on malformed input
 * (<21 landmarks). On a one-frame scale collapse, falls back to `prevScale` so
 * a single bad frame doesn't drop the whole window.
 */
export function normalizeHand(
  hand: Hand | null | undefined,
  prevScale?: number,
): { norm: NormalizedHand; frame: HandFrame } | null {
  if (!hand || hand.length < 21) return null;
  const o = hand[WRIST]!;
  let s = palmScale(hand);
  if (s < S_MIN) {
    if (prevScale && prevScale >= S_MIN) s = prevScale;
    else return null;
  }
  const up = hand[UP_MCP]!;
  const ux = up.x - o.x;
  const uy = up.y - o.y;
  const ulen = Math.hypot(ux, uy) || 1;
  const u: Pt = { x: ux / ulen, y: uy / ulen, z: 0 };
  const v: Pt = { x: -u.y, y: u.x, z: 0 };

  const norm: NormalizedHand = hand.map((p) => {
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    return { x: (dx * v.x + dy * v.y) / s, y: (dx * u.x + dy * u.y) / s, z: 0 };
  });

  return { norm, frame: { origin: { ...o }, scale: s, angle: Math.atan2(u.y, u.x), u, v } };
}
