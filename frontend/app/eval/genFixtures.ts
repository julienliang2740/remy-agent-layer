/**
 * Regenerate eval/fixtures.json — labeled landmark sequences for the grip
 * classifier eval. Synthetic for now (jittered canonical poses); recorded
 * clips from real cooking sessions slot into the same format later.
 *
 *   npx tsx eval/genFixtures.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeHand, jitterHand } from "../test/helpers/hands";

const cases: { label: string; curled: [boolean, boolean, boolean, boolean]; seed: number }[] = [
  { label: "guard", curled: [true, true, true, true], seed: 11 },
  { label: "guard", curled: [true, true, true, true], seed: 22 },
  { label: "guard", curled: [true, true, true, false], seed: 33 }, // pinky drifting out — still guard
  { label: "guard", curled: [false, true, true, true], seed: 44 },
  { label: "extended", curled: [false, false, false, false], seed: 55 },
  { label: "extended", curled: [false, false, false, false], seed: 66 },
  { label: "extended", curled: [true, false, false, false], seed: 77 }, // one tucked — still extended
  { label: "extended", curled: [false, false, false, true], seed: 88 },
  { label: "partial", curled: [true, true, false, false], seed: 99 },
  { label: "partial", curled: [false, false, true, true], seed: 111 },
  { label: "partial", curled: [true, false, true, false], seed: 122 },
  { label: "partial", curled: [false, true, false, true], seed: 133 },
];

const fixtures = cases.map((c, i) => ({
  id: `${c.label}-${i + 1}`,
  label: c.label,
  hand: jitterHand(makeHand(c.curled), c.seed),
}));

writeFileSync(join(__dirname, "fixtures.json"), JSON.stringify(fixtures, null, 2));
console.log(`wrote ${fixtures.length} fixtures to eval/fixtures.json`);
