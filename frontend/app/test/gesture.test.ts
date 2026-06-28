import assert from "node:assert/strict";
import test from "node:test";
import { classifyGrip } from "../src/live/grip";
import { createGestureCommandTracker, type GestureInput } from "../src/live/gestureCommands";
import type { Hand } from "../src/live/types";
import { makeHand } from "./helpers/hands";

function input(hand: Hand, now: number): GestureInput {
  return {
    hand,
    handCount: 1,
    steady: true,
    grip: classifyGrip(hand),
    action: null,
    cameraMoving: false,
    now,
  };
}

test("open palm must be held before it toggles pause and then latches", () => {
  const tracker = createGestureCommandTracker();
  const hand = makeHand([false, false, false, false]);

  assert.equal(tracker.update(input(hand, 0)), null);
  assert.equal(tracker.update(input(hand, 800)), null);
  assert.equal(tracker.update(input(hand, 900))?.command, "toggle_pause");
  assert.equal(tracker.update(input(hand, 1200)), null);
});

test("thumbs up maps to next step after the hold threshold", () => {
  const tracker = createGestureCommandTracker();
  const hand = makeHand([true, true, true, true]);

  assert.equal(tracker.update(input(hand, 0)), null);
  assert.equal(tracker.update(input(hand, 700))?.command, "next_step");
});

test("pinch maps to repeat instruction and wins over open palm", () => {
  const tracker = createGestureCommandTracker();
  const hand = makeHand([false, false, false, false]);
  hand[8] = { ...hand[4]!, x: hand[4]!.x + 0.01, y: hand[4]!.y + 0.01 };

  assert.equal(tracker.update(input(hand, 0)), null);
  assert.equal(tracker.update(input(hand, 500))?.command, "repeat_instruction");
});

test("gestures do not fire while camera is moving", () => {
  const tracker = createGestureCommandTracker();
  const hand = makeHand([false, false, false, false]);
  const moving = { ...input(hand, 1000), cameraMoving: true };

  assert.equal(tracker.update(moving), null);
  assert.equal(tracker.update({ ...moving, now: 3000 }), null);
});
