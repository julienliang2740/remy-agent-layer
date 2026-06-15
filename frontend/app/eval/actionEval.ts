/**
 * Action-classifier eval harness — sibling of gripEval.ts.
 *
 *   npm run eval:action
 *
 * Runs labeled landmark SEQUENCES (windows) through the real action tracker and
 * reports per-class precision/recall/F1 + a confusion matrix, including a
 * camera-motion category (each base action also filmed by a panning camera) to
 * prove robustness. Fixtures are synthetic today; recorded real clips slot into
 * the same {label, sequence, fps} format unchanged.
 */
import { createActionTracker, type MotionClass } from "../src/live/action";
import {
  makeActionSequence,
  panCamera,
  staticViewpoint,
  type ActionKind,
} from "../test/helpers/sequences";
import type { Hand } from "../src/live/types";

type Fixture = { id: string; label: MotionClass; sequence: Hand[]; fps: number };

const CLASSES: MotionClass[] = ["chop", "stir", "flip", "season", "knead", "idle"];

// Build a labeled fixture set: each action across seeds + a moving-camera variant.
const fixtures: Fixture[] = [];
const kinds: ActionKind[] = ["chop", "stir", "flip", "season", "knead", "idle"];
for (const kind of kinds) {
  for (const seed of [1, 2, 3]) {
    fixtures.push({ id: `${kind}-s${seed}`, label: kind, sequence: makeActionSequence(kind, 60, { seed }), fps: 30 });
  }
  // same action, but the camera pans + zooms + rolls the whole time
  fixtures.push({
    id: `${kind}-cam`,
    label: kind,
    sequence: panCamera(staticViewpoint(makeActionSequence(kind, 60, { seed: 9 }), { zoom: 1.3, roll: 0.3 }), {
      pan: { x: 0.004, y: 0.002 },
      roll: 0.01,
    }),
    fps: 30,
  });
}

function classify(seq: Hand[], fps: number): MotionClass {
  const tracker = createActionTracker({ fps });
  let last: MotionClass = "idle";
  for (const h of seq) last = tracker.update(h, { fps }).motionClass;
  return last;
}

const confusion = new Map<string, number>();
let correct = 0;
for (const f of fixtures) {
  const pred = classify(f.sequence, f.fps);
  confusion.set(`${f.label}|${pred}`, (confusion.get(`${f.label}|${pred}`) ?? 0) + 1);
  if (pred === f.label) correct++;
}
const count = (l: string, p: string) => confusion.get(`${l}|${p}`) ?? 0;

console.log(`\nAction classifier eval — ${fixtures.length} labeled sequences (incl. moving-camera variants)\n`);
console.log("class    precision  recall   f1     support");
console.log("-------  ---------  ------   -----  -------");
for (const c of CLASSES) {
  const tp = count(c, c);
  const fp = CLASSES.filter((o) => o !== c).reduce((s, o) => s + count(o, c), 0);
  const fn = CLASSES.filter((o) => o !== c).reduce((s, o) => s + count(c, o), 0);
  const support = tp + fn;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = support === 0 ? 1 : tp / support;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  console.log(`${c.padEnd(7)}  ${precision.toFixed(2).padEnd(9)}  ${recall.toFixed(2).padEnd(6)}   ${f1.toFixed(2).padEnd(5)}  ${support}`);
}
const acc = correct / fixtures.length;
console.log(`\noverall accuracy: ${(acc * 100).toFixed(1)}% (${correct}/${fixtures.length})`);
console.log("\nconfusion (rows = truth, cols = predicted):");
console.log(`${"".padEnd(9)}${CLASSES.map((c) => c.padEnd(8)).join("")}`);
for (const truth of CLASSES) {
  console.log(`${truth.padEnd(9)}${CLASSES.map((p) => String(count(truth, p)).padEnd(8)).join("")}`);
}

// Honest gate: synthetic separation is fuzzier than grip; floor below 100%.
if (acc < 0.8) process.exitCode = 1;
