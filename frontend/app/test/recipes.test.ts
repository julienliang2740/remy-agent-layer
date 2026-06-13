import assert from "node:assert/strict";
import test from "node:test";
import { RECIPES, STEP_TYPES, inferStepType, stepMinutes } from "../src/data/recipes";

const allSteps = RECIPES.flatMap((r) => r.steps.map((s) => ({ recipe: r.id, ...s })));

test("every recipe step has a valid stepType (no untagged steps)", () => {
  const untagged = allSteps.filter((s) => !STEP_TYPES.includes(s.stepType));
  assert.deepEqual(untagged, []);
});

test("≥80% of steps carry a 'why' explanation", () => {
  const withWhy = allSteps.filter((s) => typeof s.why === "string" && s.why.length > 10);
  const coverage = withWhy.length / allSteps.length;
  assert.ok(coverage >= 0.8, `why coverage ${(coverage * 100).toFixed(0)}% < 80%`);
});

test("every heat step has a doneness cue", () => {
  const heatMissing = allSteps.filter((s) => s.stepType === "heat" && !s.doneness);
  assert.deepEqual(
    heatMissing.map((s) => `${s.recipe}:${s.title}`),
    [],
  );
});

test("every recipe has a difficulty 1–3 and the levels are all represented", () => {
  for (const r of RECIPES) assert.ok([1, 2, 3].includes(r.difficulty), r.id);
  const levels = new Set(RECIPES.map((r) => r.difficulty));
  assert.equal(levels.size, 3);
});

test("stepMinutes: explicit minutes win, keywords fall back, hands-on steps get null", () => {
  assert.equal(
    stepMinutes({ title: "Simmer", body: "simmer 15 minutes", stepType: "heat" }),
    15,
  );
  assert.equal(stepMinutes({ title: "Boil the pasta", body: "cook it", stepType: "heat" }), 9);
  assert.equal(stepMinutes({ title: "Slice", body: "slice the tomato", stepType: "chop" }), null);
});

test("inferStepType maps backend free-text steps onto the vocabulary", () => {
  assert.equal(inferStepType("Dice the onion finely"), "chop");
  assert.equal(inferStepType("Stir until combined"), "stir");
  assert.equal(inferStepType("Sear the chicken skin-side down"), "heat");
  assert.equal(inferStepType("Serve warm with bread"), "plate");
  assert.equal(inferStepType("Let it rest five minutes"), "rest");
  assert.equal(inferStepType("Gather your ingredients"), "prep");
});
