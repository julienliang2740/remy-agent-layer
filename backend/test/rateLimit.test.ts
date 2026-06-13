import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter } from "../src/rateLimit.js";

test("allows up to the limit, then blocks", () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
  assert.equal(rl.allow("a"), true);
  assert.equal(rl.allow("a"), true);
  assert.equal(rl.allow("a"), true);
  assert.equal(rl.allow("a"), false);
});

test("window slides: old hits expire and free capacity", () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
  assert.equal(rl.allow("a"), true); // t=0
  t = 500;
  assert.equal(rl.allow("a"), true); // t=500
  assert.equal(rl.allow("a"), false); // full
  t = 1001; // first hit (t=0) expired
  assert.equal(rl.allow("a"), true);
});

test("keys are independent", () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
  assert.equal(rl.allow("a"), true);
  assert.equal(rl.allow("b"), true);
  assert.equal(rl.allow("a"), false);
});

test("retryAfterSecs reports time until capacity frees", () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 1, windowMs: 10_000, now: () => t });
  rl.allow("a");
  t = 4000;
  assert.equal(rl.retryAfterSecs("a"), 6); // 10s window - 4s elapsed
  assert.equal(rl.retryAfterSecs("never-seen"), 0);
});
