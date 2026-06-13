import assert from "node:assert/strict";
import test from "node:test";
import { classifyGrip, fingerCurled } from "../src/live/grip";
import { makeHand, jitterHand } from "./helpers/hands";

test("all four fingers curled → guard (knuckle-guard grip)", () => {
  const r = classifyGrip(makeHand([true, true, true, true]));
  assert.equal(r?.grip, "guard");
  assert.equal(r?.curledFingers, 4);
});

test("all four fingers extended → extended (unsafe near a blade)", () => {
  const r = classifyGrip(makeHand([false, false, false, false]));
  assert.equal(r?.grip, "extended");
  assert.equal(r?.extendedFingers, 4);
});

test("three curled, one out → still guard (threshold = 3)", () => {
  const r = classifyGrip(makeHand([true, true, true, false]));
  assert.equal(r?.grip, "guard");
});

test("two and two → partial", () => {
  const r = classifyGrip(makeHand([true, true, false, false]));
  assert.equal(r?.grip, "partial");
});

test("malformed hand (too few landmarks) → null, never a guess", () => {
  assert.equal(classifyGrip(makeHand([true, true, true, true]).slice(0, 10)), null);
  assert.equal(classifyGrip(null), null);
  assert.equal(classifyGrip(undefined), null);
});

test("fingerCurled: tip inside PIP radius counts as curled", () => {
  const guard = makeHand([true, false, false, false]);
  assert.equal(fingerCurled(guard, 6, 8), true); // index curled
  assert.equal(fingerCurled(guard, 10, 12), false); // middle extended
});

test("classification survives landmark jitter (robustness)", () => {
  for (let seed = 1; seed <= 20; seed++) {
    assert.equal(classifyGrip(jitterHand(makeHand([true, true, true, true]), seed))?.grip, "guard");
    assert.equal(
      classifyGrip(jitterHand(makeHand([false, false, false, false]), seed))?.grip,
      "extended",
    );
  }
});
