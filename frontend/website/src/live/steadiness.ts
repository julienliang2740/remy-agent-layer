import { meanMotion } from "./smoothing";
import type { Hand } from "./types";

export type SteadinessState = {
  /** A hand is currently visible. */
  present: boolean;
  /** Tracking is locked: a hand has been held still for long enough. */
  steady: boolean;
  /** Rolling-average motion (normalized units/frame); 0 when no hand. */
  motion: number;
  /** Consecutive frames the hand has been present. */
  heldFrames: number;
};

export type SteadinessOptions = {
  /** Frames averaged for the motion estimate. */
  windowSize: number;
  /** Below this average motion → become steady. */
  steadyIn: number;
  /** Above this average motion → drop out of steady (hysteresis gap). */
  steadyOut: number;
  /** Frames a hand must be present before it can be considered steady. */
  minHeld: number;
};

const DEFAULTS: SteadinessOptions = {
  windowSize: 10,
  steadyIn: 0.012,
  steadyOut: 0.022,
  minHeld: 6,
};

/**
 * Turns a stream of (smoothed) hand landmarks into a stable present/steady
 * signal. Pure aside from its own rolling buffer — feed it one hand per frame
 * (the primary hand) via `update`.
 *
 * Hysteresis (`steadyIn` < `steadyOut`) plus a `minHeld` warm-up stop the
 * "locked" indicator from flickering on the boundary, so downstream guidance
 * only fires on genuinely stable tracking.
 */
export function createSteadinessTracker(opts: Partial<SteadinessOptions> = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const window: number[] = [];
  let prev: Hand | null = null;
  let heldFrames = 0;
  let steady = false;

  function reset(): SteadinessState {
    window.length = 0;
    prev = null;
    heldFrames = 0;
    steady = false;
    return { present: false, steady: false, motion: 0, heldFrames: 0 };
  }

  function update(hand: Hand | null): SteadinessState {
    if (!hand || hand.length === 0) return reset();

    heldFrames += 1;
    if (prev) {
      window.push(meanMotion(prev, hand));
      if (window.length > cfg.windowSize) window.shift();
    }
    prev = hand;

    const motion =
      window.length === 0 ? Infinity : window.reduce((a, b) => a + b, 0) / window.length;

    if (steady) {
      if (motion > cfg.steadyOut) steady = false;
    } else if (heldFrames >= cfg.minHeld && motion <= cfg.steadyIn) {
      steady = true;
    }

    return {
      present: true,
      steady,
      motion: Number.isFinite(motion) ? motion : 0,
      heldFrames,
    };
  }

  return { update, reset };
}

export type SteadinessTracker = ReturnType<typeof createSteadinessTracker>;
