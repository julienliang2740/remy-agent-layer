import assert from "node:assert/strict";
import test from "node:test";
import { COACH_PHRASES } from "../src/live/coachPhrases";
import { STEP_TYPES } from "../src/data/recipes";

const VALID_TRIGGERS = new Set([
  "extended-fingers-knife",
  "extended-fingers-any",
  "partial-grip-knife",
  "unsteady-while-cutting",
  "guard-grip-good",
  "steady-clean-streak",
  "step-entered",
  "hands-returned",
]);

test("library ships at least 40 phrases", () => {
  assert.ok(COACH_PHRASES.length >= 40, `only ${COACH_PHRASES.length} phrases`);
});

test("every phrase has the full schema: trigger, stepTypes, severity, cooldown, what/how/why", () => {
  const ids = new Set<string>();
  for (const p of COACH_PHRASES) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.ok(VALID_TRIGGERS.has(p.trigger), `${p.id}: bad trigger ${p.trigger}`);
    assert.ok(p.stepTypes.length > 0, `${p.id}: no stepTypes`);
    for (const st of p.stepTypes) {
      assert.ok(st === "any" || (STEP_TYPES as readonly string[]).includes(st), `${p.id}: ${st}`);
    }
    assert.ok(["safety", "tip", "praise"].includes(p.severity), p.id);
    assert.ok(p.cooldownSec > 0, `${p.id}: cooldown`);
    for (const field of [p.what, p.how, p.why]) {
      assert.ok(typeof field === "string" && field.length >= 8, `${p.id}: thin what/how/why`);
    }
  }
});

test("safety coverage exists for knife work and heat", () => {
  const knifeSafety = COACH_PHRASES.filter(
    (p) => p.severity === "safety" && p.stepTypes.includes("chop"),
  );
  const heatSafety = COACH_PHRASES.filter(
    (p) => p.severity === "safety" && p.stepTypes.includes("heat"),
  );
  assert.ok(knifeSafety.length >= 3, "need rotation variety for knife safety");
  assert.ok(heatSafety.length >= 1);
});

test("every stepType has at least one relevant phrase", () => {
  for (const st of STEP_TYPES) {
    const covered = COACH_PHRASES.some(
      (p) => p.stepTypes.includes(st) || p.stepTypes.includes("any"),
    );
    assert.ok(covered, `no phrase covers ${st}`);
  }
});
