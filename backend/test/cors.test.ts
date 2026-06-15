import assert from "node:assert/strict";
import test from "node:test";
import { allowedOrigins, corsOrigin, DEFAULT_ALLOWED_ORIGINS } from "../src/cors.js";

test("corsOrigin echoes an allowlisted origin and rejects others", () => {
  const allow = ["http://localhost:8082", "https://app.remy.example"];
  assert.equal(corsOrigin("https://app.remy.example", allow), "https://app.remy.example");
  assert.equal(corsOrigin("http://localhost:8082", allow), "http://localhost:8082");
  assert.equal(corsOrigin("https://evil.example", allow), null);
});

test("corsOrigin returns null for a missing Origin (curl / same-origin)", () => {
  assert.equal(corsOrigin(undefined, DEFAULT_ALLOWED_ORIGINS), null);
  assert.equal(corsOrigin("", DEFAULT_ALLOWED_ORIGINS), null);
});

test("allowedOrigins merges env origins with defaults and dedupes", () => {
  const list = allowedOrigins("https://a.example, https://b.example , http://localhost:8082");
  assert.ok(list.includes("https://a.example"));
  assert.ok(list.includes("https://b.example"));
  // localhost:8082 is a default; not duplicated
  assert.equal(list.filter((o) => o === "http://localhost:8082").length, 1);
  assert.deepEqual(allowedOrigins(undefined), DEFAULT_ALLOWED_ORIGINS);
});
