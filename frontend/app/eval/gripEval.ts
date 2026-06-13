/**
 * Grip-classifier eval harness.
 *
 *   npm run eval:grip      (or: npx tsx eval/gripEval.ts)
 *
 * Reads labeled landmark fixtures (eval/fixtures.json), runs classifyGrip,
 * and prints per-class precision / recall / F1 plus a confusion matrix.
 * Fixtures are synthetic today; recorded clips from real sessions use the
 * exact same {label, hand} format.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyGrip, type GripClass } from "../src/live/grip";
import type { Hand } from "../src/live/types";

type Fixture = { id: string; label: GripClass; hand: Hand };

const fixtures: Fixture[] = JSON.parse(
  readFileSync(join(__dirname, "fixtures.json"), "utf8"),
);

const CLASSES: GripClass[] = ["guard", "extended", "partial"];
const confusion = new Map<string, number>();
let correct = 0;

for (const f of fixtures) {
  const predicted = classifyGrip(f.hand)?.grip ?? "null";
  confusion.set(`${f.label}|${predicted}`, (confusion.get(`${f.label}|${predicted}`) ?? 0) + 1);
  if (predicted === f.label) correct++;
}

function count(label: string, predicted: string): number {
  return confusion.get(`${label}|${predicted}`) ?? 0;
}

console.log(`\nGrip classifier eval — ${fixtures.length} fixtures\n`);
console.log("class      precision  recall   f1     support");
console.log("---------  ---------  ------   -----  -------");
for (const c of CLASSES) {
  const tp = count(c, c);
  const fp = CLASSES.filter((o) => o !== c).reduce((s, o) => s + count(o, c), 0);
  const fn = CLASSES.filter((o) => o !== c).reduce((s, o) => s + count(c, o), 0);
  const support = tp + fn;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = support === 0 ? 0 : tp / support;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  console.log(
    `${c.padEnd(9)}  ${precision.toFixed(2).padEnd(9)}  ${recall.toFixed(2).padEnd(6)}   ${f1
      .toFixed(2)
      .padEnd(5)}  ${support}`,
  );
}
console.log(`\noverall accuracy: ${(correct / fixtures.length * 100).toFixed(1)}% (${correct}/${fixtures.length})`);

console.log("\nconfusion (rows = truth, cols = predicted):");
console.log(`${"".padEnd(10)}${CLASSES.map((c) => c.padEnd(10)).join("")}`);
for (const truth of CLASSES) {
  console.log(
    `${truth.padEnd(10)}${CLASSES.map((p) => String(count(truth, p)).padEnd(10)).join("")}`,
  );
}

const accuracy = correct / fixtures.length;
if (accuracy < 1) process.exitCode = 1;
