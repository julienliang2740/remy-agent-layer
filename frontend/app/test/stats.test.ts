import assert from "node:assert/strict";
import test from "node:test";
import {
  completedSessions,
  computeStreak,
  deriveSkillTree,
  distinctSkills,
  SKILL_MASTERY_SESSIONS,
  type SessionRecord,
} from "../src/data/stats";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY + 5 * 60 * 60 * 1000; // some day, 5am

function rec(daysAgo: number, skill = "Sauté", done = 4, total = 4): SessionRecord {
  return { at: NOW - daysAgo * DAY, recipeId: "r", skill, done, total };
}

test("streak counts consecutive days ending today", () => {
  assert.equal(computeStreak([rec(0), rec(1), rec(2)], NOW), 3);
});

test("streak survives 'no session yet today' (ends yesterday)", () => {
  assert.equal(computeStreak([rec(1), rec(2)], NOW), 2);
});

test("a gap breaks the streak; no sessions = 0", () => {
  assert.equal(computeStreak([rec(0), rec(2), rec(3)], NOW), 1);
  assert.equal(computeStreak([rec(3), rec(4)], NOW), 0);
  assert.equal(computeStreak([], NOW), 0);
});

test("skill tree: each completed cook advances 1/3 toward mastery, capped at 100", () => {
  const tree = deriveSkillTree([rec(0), rec(1), rec(2), rec(3), rec(0, "Eggs")]);
  const saute = tree.find((s) => s.name === "Sauté")!;
  assert.equal(saute.level, 100); // 4 sessions ≥ SKILL_MASTERY_SESSIONS
  const eggs = tree.find((s) => s.name === "Eggs")!;
  assert.equal(eggs.level, Math.round(100 / SKILL_MASTERY_SESSIONS));
});

test("abandoned sessions don't count toward skills or completions", () => {
  const partial = rec(0, "Braise", 1, 4);
  assert.equal(deriveSkillTree([partial]).length, 0);
  assert.equal(completedSessions([partial]), 0);
  assert.equal(distinctSkills([partial, rec(0, "Eggs")]), 1);
});
