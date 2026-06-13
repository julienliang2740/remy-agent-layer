/**
 * Grip classifier — pure geometry over MediaPipe's 21 hand landmarks.
 *
 * Safety model for knife work: the "claw"/knuckle-guard grip curls the
 * non-knife hand's fingertips back toward the palm so knuckles (not tips)
 * face the blade. Extended fingertips near a blade are the #1 beginner cut.
 *
 * Geometry (all in MediaPipe's normalized image space):
 *   A finger is CURLED when its TIP is closer to the wrist than its PIP joint:
 *       dist(tip, wrist) < dist(pip, wrist) * CURL_RATIO
 *   CURL_RATIO = 1.0 — at full extension the tip is well beyond the PIP, so
 *   tip-inside-PIP is an unambiguous fold. The thumb is excluded: it opposes
 *   the fingers and doesn't follow the same fold axis.
 *
 * Classification thresholds (documented, unit-tested):
 *   guard    — ≥ GUARD_MIN_CURLED (3) of the 4 fingers curled
 *   extended — ≥ EXTENDED_MIN (3) of the 4 fingers extended
 *   partial  — anything in between
 *
 * Steadiness (the second half of B1) lives in steadiness.ts: rolling mean
 * motion with hysteresis (enter steady < 0.012 units/frame, leave > 0.022,
 * ≥ 6 frames present). Re-exported here so the coaching engine has one import.
 */
import type { Hand, Pt } from "./types";

export { createSteadinessTracker, type SteadinessState } from "./steadiness";

export const CURL_RATIO = 1.0;
export const GUARD_MIN_CURLED = 3;
export const EXTENDED_MIN = 3;

/** [pip, tip] landmark indices per finger (index, middle, ring, pinky). */
const FINGERS: ReadonlyArray<readonly [number, number]> = [
  [6, 8],
  [10, 12],
  [14, 16],
  [18, 20],
];
const WRIST = 0;

export type GripClass = "guard" | "extended" | "partial";

export type GripResult = {
  grip: GripClass;
  curledFingers: number;
  extendedFingers: number;
  /** Per-finger curl flags (index, middle, ring, pinky). */
  curled: boolean[];
};

function d2(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** True when one finger's tip has folded inside its PIP joint (toward the wrist). */
export function fingerCurled(hand: Hand, pipIdx: number, tipIdx: number): boolean {
  const wrist = hand[WRIST];
  const pip = hand[pipIdx];
  const tip = hand[tipIdx];
  if (!wrist || !pip || !tip) return false;
  return d2(tip, wrist) < d2(pip, wrist) * CURL_RATIO;
}

/**
 * Classify a hand's grip. Returns null when the hand is missing or malformed
 * (fewer than 21 landmarks) — callers must treat null as "don't coach".
 */
export function classifyGrip(hand: Hand | null | undefined): GripResult | null {
  if (!hand || hand.length < 21) return null;
  const curled = FINGERS.map(([pip, tip]) => fingerCurled(hand, pip, tip));
  const curledFingers = curled.filter(Boolean).length;
  const extendedFingers = curled.length - curledFingers;
  const grip: GripClass =
    curledFingers >= GUARD_MIN_CURLED
      ? "guard"
      : extendedFingers >= EXTENDED_MIN
        ? "extended"
        : "partial";
  return { grip, curledFingers, extendedFingers, curled };
}
