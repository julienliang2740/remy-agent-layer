import type { Recipe } from "./recipes";

/**
 * Ingredient matching + a stand-in "scan" detector.
 *
 * NOTE: real ingredient detection from a fridge photo is a server/vision job
 * (the backend /detect endpoint, or the MediaPipe layer which only sees *hands*,
 * not food). Until that's wired, `detectFromPhotos` is a deterministic MOCK so
 * the upload → "here's what I found" flow is demoable end-to-end. The UI labels
 * it as a sample scan so it's honest.
 */

/** Normalize an ingredient name to a match key: lowercase, de-pluralized, trimmed. */
export function normalize(name: string): string {
  const n = name.trim().toLowerCase();
  return n.endsWith("s") && n.length > 3 ? n.slice(0, -1) : n;
}

/** Pool of things the mock scanner can "see" in a kitchen photo. */
const DETECTABLE = [
  "Tomato",
  "Garlic",
  "Onion",
  "Eggs",
  "Spinach",
  "Parmesan",
  "Butter",
  "Pasta",
  "Rice",
  "Olive oil",
  "Lemon",
  "Bell pepper",
  "Carrot",
  "Basil",
  "Green onion",
];

/** Tiny deterministic string hash so the same photos always "detect" the same items. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Mock detector: deterministic from the captured shots' ids. More photos surface
 * more ingredients, which feels like a real scan. Returns display names.
 */
export function detectFromPhotos(shots: { id: string }[]): string[] {
  if (shots.length === 0) return [];
  const picked = new Set<string>();
  for (const shot of shots) {
    const h = hash(shot.id);
    // each photo contributes ~3 items (>>> keeps the index non-negative)
    for (let k = 0; k < 3; k++) {
      picked.add(DETECTABLE[(h >>> (k * 5)) % DETECTABLE.length]!);
    }
  }
  return [...picked];
}

/** Merge manually-selected + detected names into one unique display list (deduped by key). */
export function combineOwned(selected: string[], found: string[]): string[] {
  const seen = new Map<string, string>();
  for (const name of [...selected, ...found]) {
    const key = normalize(name);
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()];
}

/** Set of normalized keys for fast membership checks. */
export function ownedKeys(names: string[]): Set<string> {
  return new Set(names.map(normalize));
}

export type RecipeScore = {
  recipe: Recipe;
  pct: number;
  have: string[];
  missing: string[];
};

/** Coverage of a single recipe against what you own. */
export function scoreRecipe(owned: Set<string>, recipe: Recipe): RecipeScore {
  const have: string[] = [];
  const missing: string[] = [];
  for (const ing of recipe.ingredients) {
    (owned.has(normalize(ing.name)) ? have : missing).push(ing.name);
  }
  const pct = Math.round((have.length / recipe.ingredients.length) * 100);
  return { recipe, pct, have, missing };
}

export const SKILL_LEVELS = ["beginner", "intermediate", "comfortable"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

/**
 * Skill-fit adjustment added to coverage for ranking. A recipe at or below the
 * cook's level gets a small boost; one a full level above is neutral (a
 * stretch goal); two or more above is penalized so a beginner isn't pointed
 * at a braise just because they own chicken.
 */
export function skillAdjust(skill: SkillLevel | undefined, difficulty: number): number {
  if (!skill) return 0;
  const rank = SKILL_LEVELS.indexOf(skill) + 1; // 1..3
  const over = difficulty - rank;
  if (over <= 0) return 3;
  if (over === 1) return 0;
  return -6;
}

/**
 * All recipes scored and sorted by coverage adjusted for skill fit
 * (ties: fewer missing, then shorter ingredient list). `pct` itself stays the
 * pure coverage number shown in the UI.
 */
export function rankRecipes(
  owned: Set<string>,
  recipes: Recipe[],
  skill?: SkillLevel,
): RecipeScore[] {
  return recipes
    .map((r) => scoreRecipe(owned, r))
    .sort(
      (a, b) =>
        b.pct + skillAdjust(skill, b.recipe.difficulty) -
          (a.pct + skillAdjust(skill, a.recipe.difficulty)) ||
        a.missing.length - b.missing.length ||
        a.recipe.ingredients.length - b.recipe.ingredients.length,
    );
}
