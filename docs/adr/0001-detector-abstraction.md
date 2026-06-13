# ADR 0001 — Provider-agnostic detector abstraction

Status: Accepted

## Context
The "photo → ingredient inventory" step can be served by several vision
backends: Google Gemini (free tier), Claude vision (paid, higher quality), or a
deterministic mock for offline/dev/CI. We did not want the recipe layer, the
HTTP server, the CLI, or the test suite to know or care which one is active —
and we wanted the whole pipeline to run with zero credentials so contributors
and CI are never blocked on an API key.

## Decision
Define a single `Detector` interface (`detect(image) → DetectionRun`) in
`backend/src/types.ts`. Every backend implements it
(`detectors/{gemini,claudeVision,mock}.ts`). A factory (`detector.ts`,
`detectorFromEnv`) selects one by environment: Gemini key → Gemini, else
Anthropic key → Claude, else Mock. All real backends return Zod-validated JSON,
so a result is always shape-correct or the call throws. The frontend mirrors
this: `lib/api.ts` calls the backend and the local sample detector is an
explicit, labeled fallback — never the silent default.

## Consequences
- Adding a backend (e.g. a fine-tuned local CV model) is one new class, no
  call-site changes.
- The entire pipeline — CLI, server, tests — runs offline on the mock at $0.
- Cost is contained at one seam (the factory), where rate limiting also lives.
- Trade-off: provider-specific features must be normalized to the common schema
  (e.g. Gemini's uppercase type schema is mirrored from the Zod schema), which
  is a small maintenance cost paid once per provider.
