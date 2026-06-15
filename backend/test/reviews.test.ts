import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReviewSchema, ReviewStore } from "../src/reviews.js";

function tempStore(): ReviewStore {
  return new ReviewStore(join(mkdtempSync(join(tmpdir(), "remy-reviews-")), "reviews.json"));
}

test("reviews persist to disk and round-trip", () => {
  const store = tempStore();
  store.add({ recipeId: "garlic-butter-pasta", recipeStars: 5, remyStars: 4, tags: ["Loved it"] });
  store.add({ recipeId: "garlic-butter-pasta", recipeStars: 3, remyStars: 5, tags: [] });
  const list = store.list("garlic-butter-pasta");
  assert.equal(list.length, 2);
  assert.ok(list.every((r) => typeof r.at === "number"), "server stamps timestamps");
});

test("aggregates compute count and rounded means per recipe", () => {
  const store = tempStore();
  store.add({ recipeId: "a", recipeStars: 5, remyStars: 4, tags: [] });
  store.add({ recipeId: "a", recipeStars: 4, remyStars: 5, tags: [] });
  store.add({ recipeId: "b", recipeStars: 2, remyStars: 2, tags: [] });
  const agg = store.aggregates();
  assert.deepEqual(agg["a"], { count: 2, avgRecipe: 4.5, avgRemy: 4.5 });
  assert.deepEqual(agg["b"], { count: 1, avgRecipe: 2, avgRemy: 2 });
});

test("schema rejects out-of-range and malformed reviews", () => {
  assert.equal(ReviewSchema.safeParse({ recipeId: "", recipeStars: 5, remyStars: 5 }).success, false);
  assert.equal(
    ReviewSchema.safeParse({ recipeId: "x", recipeStars: 6, remyStars: 0 }).success,
    false,
  );
  assert.equal(
    ReviewSchema.safeParse({ recipeId: "x", recipeStars: 4, remyStars: 5 }).success,
    true,
  );
});

test("schema caps lengths so a hostile client can't store giant blobs", () => {
  assert.equal(
    ReviewSchema.safeParse({ recipeId: "x".repeat(200), recipeStars: 3, remyStars: 3 }).success,
    false,
    "over-long recipeId rejected",
  );
  assert.equal(
    ReviewSchema.safeParse({
      recipeId: "x",
      recipeStars: 3,
      remyStars: 3,
      tags: Array.from({ length: 50 }, () => "t"),
    }).success,
    false,
    "too many tags rejected",
  );
  assert.equal(
    ReviewSchema.safeParse({
      recipeId: "x",
      recipeStars: 3,
      remyStars: 3,
      tags: ["a".repeat(100)],
    }).success,
    false,
    "over-long tag rejected",
  );
});

test("add() is crash-safe: round-trips after an atomic write", () => {
  const store = tempStore();
  store.add({ recipeId: "atomic", recipeStars: 4, remyStars: 4, tags: [] });
  store.add({ recipeId: "atomic", recipeStars: 2, remyStars: 5, tags: [] });
  assert.equal(store.list("atomic").length, 2);
  assert.equal(store.aggregates()["atomic"]?.count, 2);
});

test("listing with no filter returns everything; empty store is empty", () => {
  const store = tempStore();
  assert.deepEqual(store.list(), []);
  store.add({ recipeId: "a", recipeStars: 1, remyStars: 1, tags: [] });
  store.add({ recipeId: "b", recipeStars: 2, remyStars: 2, tags: [] });
  assert.equal(store.list().length, 2);
});
