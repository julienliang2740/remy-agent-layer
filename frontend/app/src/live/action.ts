/**
 * Action tracker — the steadiness.ts analogue for cooking actions, and the
 * integration hub. Maintains a rolling window of camera-invariant NormalizedHand
 * frames, extracts features, runs a deterministic decision tree, and stabilizes
 * the label with steadiness-style hysteresis.
 *
 * Detected physical MotionClass {chop,stir,flip,season,knead,idle} is then
 * MAPPED to a recipe ActionLabel (StepType|idle) so coaching aligns with steps.
 *
 * Robust to camera motion two ways: (1) features run on normalized coords, so a
 * pan/zoom/roll cancels out; (2) when an EgomotionState says the camera is
 * moving but the hand articulation is low, we emit idle (the FRAME_MOTION_GATE)
 * instead of a phantom action.
 *
 * Honest limit: thresholds are calibrated on synthetic sequences derived from
 * the steadiness band; they MUST be re-tuned on real recorded clips. knead is
 * experimental; heat/plate/rest have no single-hand motion signature.
 */
import type { StepType } from "../data/recipes";
import { computeActionFeatures, type ActionFeatures } from "./actionFeatures";
import { normalizeHand, type NormalizedHand } from "./handframe";
import type { Hand } from "./types";

export type MotionClass = "chop" | "stir" | "flip" | "season" | "knead" | "idle";
export type ActionLabel = StepType | "idle";

export const MOTION_TO_STEPTYPE: Record<MotionClass, ActionLabel> = {
  chop: "chop",
  stir: "stir",
  knead: "prep",
  season: "prep",
  flip: "transfer",
  idle: "idle",
};

export type ActionState = {
  action: ActionLabel;
  motionClass: MotionClass;
  confidence: number;
  periodicity: number;
  circularity: number;
  intrinsicMotion: number;
  cameraMoving: boolean;
  periodHz: number | null;
};

export type ActionOptions = {
  windowSec: number;
  fps: number;
  idleIn: number;
  idleOut: number;
  periodicMin: number;
  circMin: number;
  ampStirMin: number;
  ampChop: number;
  vertical: number; // |sin(angle)| threshold
  flipBurst: number;
  flexKnead: number;
  ampKnead: number;
  enterFrames: number;
  minHeld: number;
};

export const ACTION_DEFAULTS: ActionOptions = {
  windowSec: 1.3,
  fps: 30,
  idleIn: 0.008,
  idleOut: 0.016,
  periodicMin: 0.4,
  circMin: 0.3,
  ampStirMin: 0.1,
  ampChop: 0.25,
  vertical: 0.82, // cos(35°)
  flipBurst: 3.0,
  flexKnead: 0.3,
  ampKnead: 0.2,
  enterFrames: 5,
  minHeld: 6,
};

const IDLE: ActionState = {
  action: "idle",
  motionClass: "idle",
  confidence: 1,
  periodicity: 0,
  circularity: 0,
  intrinsicMotion: 0,
  cameraMoving: false,
  periodHz: null,
};

/** Pure decision tree: features (+camera flag) → {motionClass, confidence}. */
export function classifyMotion(
  f: ActionFeatures,
  cameraMoving: boolean,
  cfg: ActionOptions,
): { motionClass: MotionClass; confidence: number } {
  // Frame-motion gate: camera moved but the hand barely articulated → idle.
  if (cameraMoving && f.intrinsicMotion < cfg.idleOut) {
    return { motionClass: "idle", confidence: 0.6 };
  }
  if (f.intrinsicMotion < cfg.idleIn) {
    return { motionClass: "idle", confidence: 1 };
  }
  // Flip: a single explosive, non-repeating burst.
  if (f.flipImpulse >= cfg.flipBurst && f.periodicity < cfg.periodicMin) {
    return { motionClass: "flip", confidence: clamp01((f.flipImpulse - cfg.flipBurst) / cfg.flipBurst) };
  }
  // Stir: circular path is the signature.
  if (f.circularity >= cfg.circMin && f.excursionAmp >= cfg.ampStirMin) {
    return { motionClass: "stir", confidence: clamp01((f.circularity - cfg.circMin) / (1 - cfg.circMin)) };
  }
  // Periodic, linear motions: chop (vertical, large) vs season (small).
  if (f.periodicity >= cfg.periodicMin) {
    if (f.verticality >= cfg.vertical && f.excursionAmp >= cfg.ampChop) {
      return { motionClass: "chop", confidence: clamp01((f.excursionAmp - cfg.ampChop) / cfg.ampChop) };
    }
    return { motionClass: "season", confidence: 0.5 };
  }
  // Aperiodic but big rhythmic flexion → knead (experimental).
  if (f.flexionSwing >= cfg.flexKnead && f.excursionAmp >= cfg.ampKnead) {
    return { motionClass: "knead", confidence: 0.4 };
  }
  return { motionClass: "idle", confidence: 0.5 };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function createActionTracker(opts: Partial<ActionOptions> = {}) {
  const cfg = { ...ACTION_DEFAULTS, ...opts };
  let window: NormalizedHand[] = [];
  let prevScale: number | undefined;
  let heldFrames = 0;
  let committed: MotionClass = "idle";
  let candidate: MotionClass = "idle";
  let candidateRun = 0;

  function reset(): ActionState {
    window = [];
    prevScale = undefined;
    heldFrames = 0;
    committed = "idle";
    candidate = "idle";
    candidateRun = 0;
    return { ...IDLE };
  }

  /** Feed one (smoothed) primary hand per frame, plus optional camera flag. */
  function update(
    hand: Hand | null,
    o: { fps?: number; cameraMoving?: boolean } = {},
  ): ActionState {
    const fps = o.fps && o.fps > 0 ? o.fps : cfg.fps;
    const cameraMoving = o.cameraMoving ?? false;
    const maxFrames = Math.min(60, Math.max(20, Math.round(cfg.windowSec * fps)));

    const nm = normalizeHand(hand, prevScale);
    if (!nm) {
      // lost the hand — decay the window so a stale buffer can't fire
      window = [];
      heldFrames = 0;
      candidate = "idle";
      candidateRun = 0;
      committed = "idle";
      return { ...IDLE, cameraMoving };
    }
    prevScale = nm.frame.scale;
    window.push(nm.norm);
    if (window.length > maxFrames) window.shift();
    heldFrames++;

    const f = computeActionFeatures(window, fps);
    const raw = classifyMotion(f, cameraMoving, cfg);

    // Hysteresis: a candidate must win enterFrames in a row to commit; idle is
    // adopted immediately (safer to go quiet than to assert a stale action).
    if (raw.motionClass === candidate) candidateRun++;
    else {
      candidate = raw.motionClass;
      candidateRun = 1;
    }
    if (heldFrames < cfg.minHeld) {
      committed = "idle";
    } else if (candidate === "idle" || candidateRun >= cfg.enterFrames) {
      committed = candidate;
    }

    return {
      action: MOTION_TO_STEPTYPE[committed],
      motionClass: committed,
      confidence: committed === raw.motionClass ? raw.confidence : 0.3,
      periodicity: f.periodicity,
      circularity: f.circularity,
      intrinsicMotion: f.intrinsicMotion,
      cameraMoving,
      periodHz: f.freqHz > 0 ? Math.round(f.freqHz * 10) / 10 : null,
    };
  }

  return { update, reset };
}

export type ActionTracker = ReturnType<typeof createActionTracker>;
