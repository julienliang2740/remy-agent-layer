/**
 * Coaching state machine — decides WHEN to speak. Rules (unit-tested):
 *
 *  1. No corrections while tracking is unstable (hand absent or not steady) —
 *     except nothing at all fires then; we never coach what we can't see.
 *  2. Non-safety output is throttled: at most one per NON_SAFETY_GAP_SEC (45s).
 *  3. severity "safety" BYPASSES the global throttle (its own per-phrase
 *     cooldown still applies so it doesn't strobe).
 *  4. Positive reinforcement after sustained clean tracking:
 *     CLEAN_STREAK_SEC (60s) steady with no trigger firing → a praise phrase.
 *  5. Step relevance: a phrase only fires if its stepTypes include the current
 *     stepType (or "any") — a chop correction can never fire during a stir.
 *
 * Pure & clock-injected: feed it events, it returns a phrase or null.
 */
import type { StepType } from "../data/recipes";
import type { ActionLabel } from "./action";
import { COACH_PHRASES, type CoachPhrase, type TriggerId } from "./coachPhrases";
import type { GripResult } from "./grip";

export const NON_SAFETY_GAP_SEC = 45;
export const CLEAN_STREAK_SEC = 60;

export type CoachEvent = {
  /** Event time in seconds (monotonic; injectable for tests). */
  t: number;
  present: boolean;
  steady: boolean;
  grip: GripResult | null;
  stepType: StepType;
  /** True on the frame a new step begins. */
  stepEntered?: boolean;
  /** Recognized action (camera-invariant), if any. */
  action?: ActionLabel | null;
  /** The camera (not the hand) is moving — suppresses false steadiness alarms. */
  cameraMoving?: boolean;
};

/** stepTypes that have a detectable single-hand action signature. */
const ACTIONABLE: StepType[] = ["chop", "stir", "transfer", "prep"];

/** Map trigger ids to predicates over the event. */
const TRIGGERS: Record<TriggerId, (e: CoachEvent) => boolean> = {
  "extended-fingers-knife": (e) => e.stepType === "chop" && e.grip?.grip === "extended",
  "extended-fingers-any": (e) => e.grip?.grip === "extended",
  "partial-grip-knife": (e) => e.stepType === "chop" && e.grip?.grip === "partial",
  "unsteady-while-cutting": () => false, // evaluated specially (needs unstable state)
  "guard-grip-good": (e) => e.stepType === "chop" && e.grip?.grip === "guard",
  "steady-clean-streak": () => false, // evaluated specially (needs streak state)
  "step-entered": (e) => e.stepEntered === true,
  "hands-returned": () => false, // evaluated specially (needs absence state)
  // Action-aware (advisory): only when the action signal is meaningful for the step.
  "stir-detected": (e) => e.stepType === "stir" && e.action === "stir",
  "action-mismatch": (e) =>
    ACTIONABLE.includes(e.stepType) &&
    e.action != null &&
    e.action !== "idle" &&
    e.action !== e.stepType,
  "no-action-during-step": (e) =>
    (e.stepType === "chop" || e.stepType === "stir") && e.action === "idle",
  "camera-unsteady": (e) => e.cameraMoving === true,
};

export function createCoach(phrases: CoachPhrase[] = COACH_PHRASES) {
  let lastNonSafetyAt = -Infinity;
  const lastFiredById = new Map<string, number>();
  let cleanSince: number | null = null;
  let wasAbsent = false;

  function eligible(p: CoachPhrase, e: CoachEvent): boolean {
    if (!p.stepTypes.includes("any") && !p.stepTypes.includes(e.stepType)) return false;
    const last = lastFiredById.get(p.id) ?? -Infinity;
    if (e.t - last < p.cooldownSec) return false;
    if (p.severity !== "safety" && e.t - lastNonSafetyAt < NON_SAFETY_GAP_SEC) return false;
    return true;
  }

  function fire(p: CoachPhrase, t: number): CoachPhrase {
    lastFiredById.set(p.id, t);
    if (p.severity !== "safety") lastNonSafetyAt = t;
    cleanSince = null; // anything spoken resets the praise streak
    return p;
  }

  /** Try every safety-severity phrase; return the first eligible one that triggers. */
  function trySafety(e: CoachEvent): CoachPhrase | null {
    for (const p of phrases) {
      if (p.severity !== "safety") continue;
      if (!eligible(p, e)) continue;
      if (TRIGGERS[p.trigger](e)) return fire(p, e.t);
    }
    return null;
  }

  function update(e: CoachEvent): CoachPhrase | null {
    // Can't coach what we can't see.
    if (!e.present) {
      cleanSince = null;
      wasAbsent = true;
      return null;
    }

    // Camera-moving mode: image steadiness is unreliable, but grip safety
    // (camera-invariant) still matters, and we may nudge the user to steady the
    // shot. We do NOT fire steadiness-based tips or false "hold steady" here.
    if (e.cameraMoving) {
      cleanSince = null;
      const safety = trySafety(e);
      if (safety) return safety;
      const cam = phrases.find((p) => p.trigger === "camera-unsteady" && eligible(p, e));
      return cam ? fire(cam, e.t) : null;
    }

    // Genuine hand unsteadiness (camera still): stay quiet.
    if (!e.steady) {
      cleanSince = null;
      return null;
    }

    // Re-engagement after the hands come back.
    if (wasAbsent) {
      wasAbsent = false;
      const back = phrases.find((p) => p.trigger === "hands-returned" && eligible(p, e));
      if (back) return fire(back, e.t);
    }

    // Rule 3: safety first, throttle-exempt.
    const safety = trySafety(e);
    if (safety) return safety;

    // Rule 2: throttled tips/praise from direct triggers.
    for (const p of phrases) {
      if (p.severity === "safety") continue;
      if (p.trigger === "steady-clean-streak" || p.trigger === "hands-returned") continue;
      if (!eligible(p, e)) continue;
      if (TRIGGERS[p.trigger](e)) return fire(p, e.t);
    }

    // Rule 4: praise after a sustained clean streak.
    cleanSince ??= e.t;
    if (e.t - cleanSince >= CLEAN_STREAK_SEC) {
      const praise = phrases.find((p) => p.trigger === "steady-clean-streak" && eligible(p, e));
      if (praise) return fire(praise, e.t);
    }

    return null;
  }

  return { update };
}

export type Coach = ReturnType<typeof createCoach>;
