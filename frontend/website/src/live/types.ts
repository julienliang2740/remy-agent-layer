/**
 * Shared types for the on-device hand-tracking layer.
 *
 * `Pt` is intentionally structural (just x/y/z in [0,1] normalized image space)
 * so the core never depends on MediaPipe's concrete `NormalizedLandmark` class —
 * keeping `smoothing`/`steadiness`/`draw` pure and portable (e.g. to the Expo
 * web build) and trivially unit-testable.
 */
export type Pt = { x: number; y: number; z: number };

/** One detected hand: its 21 landmarks, already smoothed. */
export type Hand = Pt[];
