import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHand, palmScale, S_MIN } from "../src/live/handframe";
import { makeHand } from "./helpers/hands";
import { applyCameraTransform } from "./helpers/sequences";

function maxDiff(a: { x: number; y: number }[], b: { x: number; y: number }[]): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]!.x - b[i]!.x), Math.abs(a[i]!.y - b[i]!.y));
  return m;
}

test("INVARIANCE: pan, zoom, and roll cancel out in the normalized frame", () => {
  const hand = makeHand([false, true, false, true]); // arbitrary pose
  const base = normalizeHand(hand)!.norm;
  for (const pan of [{ x: 0.3, y: -0.2 }, { x: -0.25, y: 0.25 }]) {
    for (const zoom of [0.5, 1.0, 2.0]) {
      for (const roll of [0, Math.PI / 6, Math.PI / 2, Math.PI]) {
        const moved = normalizeHand(applyCameraTransform(hand, { pan, zoom, roll }))!.norm;
        assert.ok(
          maxDiff(base, moved) < 1e-9,
          `pan ${JSON.stringify(pan)} zoom ${zoom} roll ${roll} changed normalized coords by ${maxDiff(base, moved)}`,
        );
      }
    }
  }
});

test("normalizeHand returns null on malformed input", () => {
  assert.equal(normalizeHand(null), null);
  assert.equal(normalizeHand(makeHand([true, true, true, true]).slice(0, 12)), null);
});

test("palm scale grows with zoom (camera-distance proxy)", () => {
  const hand = makeHand([false, false, false, false]);
  const s1 = palmScale(hand);
  const s2 = palmScale(applyCameraTransform(hand, { zoom: 2 }));
  assert.ok(Math.abs(s2 - 2 * s1) < 1e-9);
  assert.ok(s1 > S_MIN);
});

test("wrist maps to the origin in the normalized frame", () => {
  const norm = normalizeHand(makeHand([false, false, false, false]))!.norm;
  assert.ok(Math.hypot(norm[0]!.x, norm[0]!.y) < 1e-9);
});
