/**
 * Standalone sanity check of the scan→match pipeline (run via backend's tsx:
 * `npx tsx ../frontend/app/src/data/pipeline.check.ts`). Not part of the app
 * bundle — a temporary harness exercised in CI-ish fashion during development.
 */
import { combineOwned, detectFromPhotos, ownedKeys, rankRecipes, scoreRecipe } from "./matching";
import { RECIPES } from "./recipes";

for (let t = 0; t < 200; t++) {
  const shots = Array.from({ length: (t % 4) + 1 }, (_, i) => ({ id: `${t}-${i}-photo` }));
  const found = detectFromPhotos(shots);
  if (found.some((f) => typeof f !== "string")) throw new Error(`bad detect at ${t}`);
  const all = combineOwned(["Pasta", "Garlic", `custom thing ${t}`], found);
  const ranked = rankRecipes(ownedKeys(all), RECIPES);
  if (!ranked.length || ranked.some((r) => Number.isNaN(r.pct) || r.pct < 0 || r.pct > 100)) {
    throw new Error(`bad rank at ${t}`);
  }
}
const empty = scoreRecipe(ownedKeys([]), RECIPES[0]!);
if (empty.pct !== 0 || empty.missing.length !== RECIPES[0]!.ingredients.length) {
  throw new Error("empty-owned scoring wrong");
}
console.log("pipeline OK: 200 simulated runs, all ranks valid, empty-basket safe");
