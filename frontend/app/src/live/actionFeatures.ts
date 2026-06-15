/**
 * Stateless windowed feature extraction over a window of NormalizedHand
 * (camera-invariant by construction). The serializable ActionFeatures vector is
 * the seam where a future trained model would plug in. Pure; no MediaPipe types.
 */
import { autocorrPeriodicity, pathCircularity, principalExcursion } from "./dsp";
import type { NormalizedHand } from "./handframe";
import type { Pt } from "./types";

/** Tips + MCP knuckle row — the points whose articulation defines the action. */
export const KEY_POINTS = [4, 8, 12, 16, 20, 5, 9, 13, 17] as const;
const TIPS = [8, 12, 16, 20] as const;

export type ActionFeatures = {
  /** Mean frame-to-frame articulation of key points (palm-length units/frame). */
  intrinsicMotion: number;
  periodicity: number;
  freqHz: number;
  circularity: number;
  excursionRatio: number;
  excursionAngle: number;
  excursionAmp: number;
  /** |sin(dominant-axis angle)| — 1 = along the hand's up-axis (chop), 0 = across. */
  verticality: number;
  flexionSwing: number;
  flipImpulse: number;
  frames: number;
};

const ZERO: ActionFeatures = {
  intrinsicMotion: 0,
  periodicity: 0,
  freqHz: 0,
  circularity: 0,
  excursionRatio: 0,
  excursionAngle: 0,
  excursionAmp: 0,
  verticality: 0,
  flexionSwing: 0,
  flipImpulse: 0,
  frames: 0,
};

export function computeActionFeatures(window: NormalizedHand[], fps: number): ActionFeatures {
  const n = window.length;
  if (n < 3) return { ...ZERO, frames: n };

  const perFrameMotion: number[] = [];
  let motionSum = 0;
  for (let t = 1; t < n; t++) {
    let fm = 0;
    for (const i of KEY_POINTS) {
      const a = window[t]![i]!;
      const b = window[t - 1]![i]!;
      fm += Math.hypot(a.x - b.x, a.y - b.y);
    }
    fm /= KEY_POINTS.length;
    perFrameMotion.push(fm);
    motionSum += fm;
  }
  const intrinsicMotion = perFrameMotion.length ? motionSum / perFrameMotion.length : 0;

  const path: Pt[] = [];
  const ys: number[] = [];
  for (let t = 0; t < n; t++) {
    let cx = 0;
    let cy = 0;
    for (const i of TIPS) {
      cx += window[t]![i]!.x;
      cy += window[t]![i]!.y;
    }
    cx /= TIPS.length;
    cy /= TIPS.length;
    path.push({ x: cx, y: cy, z: 0 });
    ys.push(cy);
  }

  const { periodicity, freqHz } = autocorrPeriodicity(ys, fps);
  const circularity = pathCircularity(path);
  const exc = principalExcursion(path);

  let ymin = Infinity;
  let ymax = -Infinity;
  for (const y of ys) {
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  }

  const sorted = [...perFrameMotion].sort((a, b) => a - b);
  const med = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
  const peak = sorted.length ? sorted[sorted.length - 1]! : 0;
  const flipImpulse = med > 1e-6 ? peak / med : peak > 0 ? 99 : 0;

  return {
    intrinsicMotion,
    periodicity,
    freqHz,
    circularity,
    excursionRatio: exc.ratio,
    excursionAngle: exc.angle,
    excursionAmp: exc.amp,
    verticality: Math.abs(Math.sin(exc.angle)),
    flexionSwing: ymax - ymin,
    flipImpulse,
    frames: n,
  };
}
