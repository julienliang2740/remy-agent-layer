# ADR 0002 — On-device CV for live coaching; server only for slow work

Status: Accepted

## Context
Remy's "during the cook" coaching reacts to what your hands are doing (grip,
steadiness) and must feel immediate — a safety nudge that arrives a second late
is useless. Round-tripping video frames to a server adds latency, cost, privacy
exposure, and a hard dependency on connectivity, none of which a real-time
safety layer can tolerate.

## Decision
Split the system by latency budget:
- **On-device, real-time:** hand-landmark tracking (MediaPipe Hand Landmarker,
  ~30fps, WASM/GPU), the grip classifier (`live/grip.ts`), the steadiness gate
  (`live/steadiness.ts`), and the coaching state machine (`live/coach.ts`). No
  network in this loop; frames never leave the device.
- **Server, relaxed latency:** ingredient detection from photos, recipe
  generation, and review aggregation — work measured in seconds where a network
  call is fine. These go through `lib/api.ts` to the backend agent layer.

The CV core is written as pure, framework-agnostic TypeScript so it is unit-
testable without a device and portable to the Expo native build later.

## Consequences
- Live coaching works offline and keeps camera data private by construction.
- The coaching engine is fully testable in Node (synthetic landmark fixtures,
  injected clock) — see `test/grip.test.ts`, `test/coach.test.ts`, and the eval
  harness in `eval/`.
- Trade-off: on-device geometry can't "see" the food (is the pan boiling?), only
  the hands. Food/action recognition is a deliberate future layer; today timed
  steps are text-inferred and clearly framed as such.
- A Metro bundler constraint (it can't parse MediaPipe's `vision_bundle.mjs`)
  forced a runtime CDN import on the app's web build — documented in the README.
