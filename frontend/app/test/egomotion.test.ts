import assert from "node:assert/strict";
import test from "node:test";
import { createEgomotionTracker, palmAnchorFlow } from "../src/live/egomotion";
import { nearestSample, highPassAccel, type ImuSample } from "../src/live/imu";
import { makeHand } from "./helpers/hands";
import { makeActionSequence, panCamera, applyCameraTransform } from "./helpers/sequences";
import type { Hand } from "../src/live/types";

const dt = 1 / 30;

test("pure camera pan raises cameraMoving; a still hand stays flagged", () => {
  const idle = panCamera(makeActionSequence("idle", 30), { pan: { x: 0.03, y: 0.01 } });
  const ego = createEgomotionTracker();
  let prev: Hand | null = null;
  let last = ego.update([], null, null, dt);
  for (const h of idle) {
    last = ego.update([h], prev ? [prev] : null, null, dt);
    prev = h;
  }
  assert.equal(last.cameraMoving, true);
  assert.ok(last.frameVel > 0.02);
});

test("a hand articulating in front of a STILL camera does not trip cameraMoving", () => {
  // chop moves fingertips, but the palm anchors (wrist + MCPs) stay put.
  const chop = makeActionSequence("chop", 40);
  const ego = createEgomotionTracker();
  let prev: Hand | null = null;
  let everMoving = false;
  for (const h of chop) {
    const s = ego.update([h], prev ? [prev] : null, null, dt);
    everMoving = everMoving || s.cameraMoving;
    prev = h;
  }
  assert.equal(everMoving, false);
});

test("no-op safe: null prevHands → not moving", () => {
  const ego = createEgomotionTracker();
  const s = ego.update([makeHand([false, false, false, false])], null, null, dt);
  assert.equal(s.cameraMoving, false);
  assert.equal(s.frameVel, 0);
});

test("hysteresis: a brief calm frame mid-pan does not immediately clear the flag", () => {
  const ego = createEgomotionTracker();
  const base = makeHand([false, false, false, false]);
  const panned = (k: number) => applyCameraTransform(base, { pan: { x: 0.03 * k, y: 0 } });
  let prev = panned(0);
  for (let k = 1; k <= 5; k++) {
    ego.update([panned(k)], [prev], null, dt);
    prev = panned(k);
  }
  // one calm frame (no displacement)
  const s = ego.update([prev], [prev], null, dt);
  assert.equal(s.cameraMoving, true); // needs clearFrames calm frames to drop
});

test("two-hand common-mode translation reads as camera motion", () => {
  const ego = createEgomotionTracker();
  const a0 = makeHand([false, false, false, false]);
  const b0 = applyCameraTransform(a0, { pan: { x: 0.2, y: 0 } });
  const a1 = applyCameraTransform(a0, { pan: { x: 0.03, y: 0 } });
  const b1 = applyCameraTransform(b0, { pan: { x: 0.03, y: 0 } });
  ego.update([a0, b0], null, null, dt);
  const s = ego.update([a1, b1], [a0, b0], null, dt);
  assert.equal(s.cameraMoving, true);
});

test("IMU fusion raises confidence when gyro agrees with vision", () => {
  const ego = createEgomotionTracker();
  const base = makeHand([false, false, false, false]);
  const moved = applyCameraTransform(base, { pan: { x: 0.03, y: 0 } });
  // gyro yaw chosen so focalN*rad*dt ≈ 0.03 (vision frameVel)
  const radPerSec = 0.03 / (0.78 * dt);
  const imu: ImuSample = {
    t: 0,
    rotRate: { alpha: radPerSec / (Math.PI / 180), beta: 0, gamma: 0 },
    accel: { x: 0, y: 0, z: 0 },
    hasGravityRemoved: false,
  };
  ego.update([base], null, null, dt);
  const s = ego.update([moved], [base], imu, dt);
  assert.equal(s.source, "fusion");
  assert.ok(s.camConf > 0.5);
});

test("palmAnchorFlow returns the common translation of the anchor knuckles", () => {
  const a = makeHand([false, false, false, false]);
  const b = applyCameraTransform(a, { pan: { x: 0.05, y: -0.02 } });
  const flow = palmAnchorFlow(b, a);
  assert.ok(Math.abs(flow.x - 0.05) < 1e-6 && Math.abs(flow.y + 0.02) < 1e-6);
});

test("imu helpers: nearestSample respects staleness; highPass removes a constant", () => {
  const buf: ImuSample[] = [0, 40, 80, 200].map((t) => ({
    t,
    rotRate: { alpha: 0, beta: 0, gamma: 0 },
    accel: { x: 0, y: 0, z: 0 },
    hasGravityRemoved: false,
  }));
  assert.equal(nearestSample(buf, 70)?.t, 80);
  assert.equal(nearestSample(buf, 1000), null);
  // constant input → high-pass output decays toward 0
  let f = 0;
  let prevRaw = 1;
  for (let i = 0; i < 50; i++) f = highPassAccel(f, prevRaw, 1, 0.8);
  assert.ok(Math.abs(f) < 0.05);
});
