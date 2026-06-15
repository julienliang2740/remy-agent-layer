import assert from "node:assert/strict";
import test from "node:test";
import { createActionTracker, type ActionState } from "../src/live/action";
import { makeActionSequence, panCamera, staticViewpoint, type ActionKind } from "./helpers/sequences";
import type { Hand } from "../src/live/types";

/** Drive a whole sequence through a fresh tracker; return the final state. */
function run(seq: Hand[], fps = 30, cameraMoving = false): ActionState {
  const tracker = createActionTracker({ fps });
  let last: ActionState = { action: "idle" } as ActionState;
  for (const h of seq) last = tracker.update(h, { fps, cameraMoving });
  return last;
}

const EXPECT: Record<ActionKind, string> = {
  chop: "chop",
  stir: "stir",
  flip: "flip",
  season: "season",
  knead: "knead",
  idle: "idle",
};

for (const kind of ["chop", "stir", "flip", "season", "idle"] as ActionKind[]) {
  test(`classifies ${kind} as its own motion class`, () => {
    const st = run(makeActionSequence(kind, 60));
    assert.equal(st.motionClass, EXPECT[kind], `got ${st.motionClass} (period ${st.periodicity.toFixed(2)} circ ${st.circularity.toFixed(2)} im ${st.intrinsicMotion.toFixed(3)})`);
  });
}

test("motion classes map to the right recipe stepType labels", () => {
  assert.equal(run(makeActionSequence("chop", 60)).action, "chop");
  assert.equal(run(makeActionSequence("stir", 60)).action, "stir");
  assert.equal(run(makeActionSequence("season", 60)).action, "prep");
  assert.equal(run(makeActionSequence("flip", 60)).action, "transfer");
  assert.equal(run(makeActionSequence("idle", 60)).action, "idle");
});

test("CAMERA INVARIANCE: a chop under heavy pan+zoom+roll is still a chop", () => {
  const chop = makeActionSequence("chop", 60);
  const viewed = staticViewpoint(chop, { pan: { x: 0.2, y: -0.15 }, zoom: 1.7, roll: Math.PI / 5 });
  assert.equal(run(viewed).motionClass, "chop");
  const stir = makeActionSequence("stir", 60);
  assert.equal(run(staticViewpoint(stir, { zoom: 0.6, roll: -Math.PI / 4 })).motionClass, "stir");
});

test("FRAME-MOTION GATE: a still hand under a fast-panning camera is idle, not chop/stir", () => {
  const idle = makeActionSequence("idle", 60);
  const panned = panCamera(idle, { pan: { x: 0.01, y: 0.004 } }); // camera sliding every frame
  const st = run(panned, 30, /*cameraMoving*/ true);
  assert.equal(st.motionClass, "idle", `phantom action ${st.motionClass}`);
});

test("a real chop survives the window even at 25fps (fps invariance)", () => {
  assert.equal(run(makeActionSequence("chop", 50, { fps: 25 }), 25).motionClass, "chop");
});

test("hysteresis: a brief stir blip inside a chop run does not flip the label", () => {
  const tracker = createActionTracker({ fps: 30 });
  const chop = makeActionSequence("chop", 60);
  const stir = makeActionSequence("stir", 60);
  let st: ActionState = { action: "idle" } as ActionState;
  for (const h of chop) st = tracker.update(h, { fps: 30 });
  assert.equal(st.motionClass, "chop");
  // inject 2 stir frames (below enterFrames=5) — must stay chop
  for (let i = 0; i < 2; i++) st = tracker.update(stir[i]!, { fps: 30 });
  assert.equal(st.motionClass, "chop");
});

test("warm-up: no non-idle label before minHeld frames", () => {
  const tracker = createActionTracker({ fps: 30 });
  const chop = makeActionSequence("chop", 60);
  const states = chop.slice(0, 4).map((h) => tracker.update(h, { fps: 30 }));
  assert.ok(states.every((s) => s.motionClass === "idle"));
});

test("robust across seeds", () => {
  for (let seed = 1; seed <= 8; seed++) {
    assert.equal(run(makeActionSequence("chop", 60, { seed })).motionClass, "chop");
    assert.equal(run(makeActionSequence("stir", 60, { seed })).motionClass, "stir");
    assert.equal(run(makeActionSequence("idle", 60, { seed })).motionClass, "idle");
  }
});
