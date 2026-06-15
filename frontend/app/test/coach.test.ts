import assert from "node:assert/strict";
import test from "node:test";
import { createCoach, NON_SAFETY_GAP_SEC, CLEAN_STREAK_SEC, type CoachEvent } from "../src/live/coach";
import { classifyGrip } from "../src/live/grip";
import { makeHand } from "./helpers/hands";

const EXTENDED = classifyGrip(makeHand([false, false, false, false]));
const GUARD = classifyGrip(makeHand([true, true, true, true]));

function ev(partial: Partial<CoachEvent> & { t: number }): CoachEvent {
  return { present: true, steady: true, grip: GUARD, stepType: "chop", ...partial };
}

test("no correction while tracking is unstable — even with an unsafe grip", () => {
  const coach = createCoach();
  assert.equal(coach.update(ev({ t: 1, steady: false, grip: EXTENDED })), null);
  assert.equal(coach.update(ev({ t: 2, present: false, grip: EXTENDED })), null);
});

test("extended fingers during chop fires a SAFETY phrase immediately", () => {
  const coach = createCoach();
  const p = coach.update(ev({ t: 1, grip: EXTENDED }));
  assert.equal(p?.severity, "safety");
  assert.equal(p?.trigger, "extended-fingers-knife");
});

test("a chop correction does NOT fire during a stir step (stepType binding)", () => {
  const coach = createCoach();
  const p = coach.update(ev({ t: 1, grip: EXTENDED, stepType: "stir" }));
  // No stir-relevant phrase matches an extended grip → nothing fires.
  assert.equal(p, null);
});

test("non-safety output is throttled to one per 45s", () => {
  const coach = createCoach();
  const first = coach.update(ev({ t: 1, stepEntered: true }));
  assert.equal(first?.severity, "tip");
  // Another step entered 10s later — still inside the throttle window.
  assert.equal(coach.update(ev({ t: 11, stepEntered: true })), null);
  // After the gap, tips may flow again.
  const later = coach.update(ev({ t: 1 + NON_SAFETY_GAP_SEC + 1, stepEntered: true }));
  assert.notEqual(later, null);
  assert.notEqual(later?.severity, "safety");
});

test("safety bypasses the non-safety throttle", () => {
  const coach = createCoach();
  assert.equal(coach.update(ev({ t: 1, stepEntered: true }))?.severity, "tip");
  // 2s later — throttle is active for tips, but safety must still fire.
  const p = coach.update(ev({ t: 3, grip: EXTENDED }));
  assert.equal(p?.severity, "safety");
});

test("safety phrases rotate via per-phrase cooldown instead of repeating", () => {
  const coach = createCoach();
  const a = coach.update(ev({ t: 1, grip: EXTENDED }));
  const b = coach.update(ev({ t: 2, grip: EXTENDED }));
  assert.ok(a && b, "both fire");
  assert.notEqual(a!.id, b!.id, "different phrase while the first cools down");
});

test("sustained clean tracking earns positive reinforcement", () => {
  const coach = createCoach();
  // Steady, guard grip on a prep step (no triggers) for the full streak.
  let praise = null;
  for (let t = 1; t <= CLEAN_STREAK_SEC + 2 && !praise; t++) {
    praise = coach.update(ev({ t, stepType: "prep", grip: GUARD }));
  }
  assert.equal(praise?.severity, "praise");
  assert.equal(praise?.trigger, "steady-clean-streak");
});

test("camera-moving suppresses unsteady tips but NOT grip safety", () => {
  const coach = createCoach();
  // camera moving + dangerous grip during chop → safety still fires
  const p = coach.update(ev({ t: 1, cameraMoving: true, grip: EXTENDED }));
  assert.equal(p?.severity, "safety");
  // camera moving + safe grip → at most the gentle "steady the camera" tip, never a phantom action/safety
  const coach2 = createCoach();
  const q = coach2.update(ev({ t: 1, cameraMoving: true, grip: GUARD, stepType: "prep" }));
  assert.ok(q === null || q.trigger === "camera-unsteady");
});

test("action-aware: a stir during a stir step earns rhythm praise; mismatch nudges", () => {
  const coach = createCoach();
  // warm into steadiness, then a matching stir action
  const praise = coach.update(ev({ t: 1, stepType: "stir", action: "stir" }));
  assert.equal(praise?.trigger, "stir-detected");
  // a different coach: chopping motion during a stir step → mismatch tip
  const coach2 = createCoach();
  const tip = coach2.update(ev({ t: 1, stepType: "stir", action: "chop" }));
  assert.equal(tip?.trigger, "action-mismatch");
});

test("action-aware triggers never bypass the steady gate", () => {
  const coach = createCoach();
  // not steady, camera still → silent even with a matching action
  assert.equal(coach.update(ev({ t: 1, steady: false, stepType: "stir", action: "stir" })), null);
});

test("losing tracking resets the praise streak", () => {
  const coach = createCoach();
  for (let t = 1; t <= 30; t++) coach.update(ev({ t, stepType: "prep" }));
  coach.update(ev({ t: 31, present: false })); // hands leave
  // Re-acquire (consumes hands-returned), then a fresh streak must be needed.
  let praise = null;
  for (let t = 32; t <= 31 + CLEAN_STREAK_SEC - 5; t++) {
    const p = coach.update(ev({ t, stepType: "prep" }));
    if (p?.severity === "praise") praise = p;
  }
  assert.equal(praise, null, "no praise before a full fresh streak");
});
