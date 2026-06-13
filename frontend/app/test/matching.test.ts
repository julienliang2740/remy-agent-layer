import assert from "node:assert/strict";
import test from "node:test";
import {
  combineOwned,
  normalize,
  ownedKeys,
  rankRecipes,
  scoreRecipe,
  skillAdjust,
} from "../src/data/matching";
import type { Recipe } from "../src/data/recipes";

function fakeRecipe(id: string, ingredients: string[], difficulty: 1 | 2 | 3): Recipe {
  return {
    id,
    title: id,
    emoji: "🍳",
    time: "10 min",
    level: "x",
    difficulty,
    skill: "x",
    blurb: "",
    ingredients: ingredients.map((name) => ({ name, amount: "1" })),
    tools: [],
    steps: [{ title: "t", body: "b", stepType: "prep" }],
    remyNote: "",
  };
}

test("normalize lowercases and de-pluralizes; combineOwned dedupes across sources", () => {
  assert.equal(normalize("Tomatoes"), "tomatoe"); // simple s-strip is documented behavior
  const merged = combineOwned(["Eggs", "garlic"], ["eggs", "Garlic", "Basil"]);
  assert.deepEqual(merged.length, 3);
});

test("scoreRecipe computes coverage pct, have and missing", () => {
  const r = fakeRecipe("r", ["A", "B", "C", "D"], 1);
  const s = scoreRecipe(ownedKeys(["A", "B"]), r);
  assert.equal(s.pct, 50);
  assert.deepEqual(s.have, ["A", "B"]);
  assert.deepEqual(s.missing, ["C", "D"]);
});

test("rankRecipes orders by coverage when no skill is given", () => {
  const high = fakeRecipe("high", ["A", "B"], 3);
  const low = fakeRecipe("low", ["A", "X", "Y", "Z"], 1);
  const ranked = rankRecipes(ownedKeys(["A", "B"]), [low, high]);
  assert.equal(ranked[0]!.recipe.id, "high");
});

test("skillAdjust: at/below level +3, one above 0, two+ above −6", () => {
  assert.equal(skillAdjust("beginner", 1), 3);
  assert.equal(skillAdjust("beginner", 2), 0);
  assert.equal(skillAdjust("beginner", 3), -6);
  assert.equal(skillAdjust("comfortable", 3), 3);
  assert.equal(skillAdjust(undefined, 3), 0);
});

test("skill fit reorders: a beginner sees the easy 80% above the hard 85%", () => {
  // easy: 4/5 owned = 80% +3 = 83 · hard: ~85% −6 = ~79
  const easy = fakeRecipe("easy", ["A", "B", "C", "D", "E"], 1);
  const hard = fakeRecipe("hard", ["A", "B", "C", "D", "E", "F", "G"], 3);
  const owned = ownedKeys(["A", "B", "C", "D", "F", "G"]); // easy 4/5=80, hard 6/7≈86
  const noSkill = rankRecipes(owned, [easy, hard]);
  assert.equal(noSkill[0]!.recipe.id, "hard", "raw coverage prefers hard");
  const beginner = rankRecipes(owned, [easy, hard], "beginner");
  assert.equal(beginner[0]!.recipe.id, "easy", "skill fit lifts the achievable recipe");
});
