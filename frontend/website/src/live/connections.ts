/**
 * The canonical MediaPipe 21-landmark hand skeleton, as index pairs to draw as
 * bones. Landmark layout: 0 = wrist; 1-4 thumb; 5-8 index; 9-12 middle;
 * 13-16 ring; 17-20 pinky (each finger MCP → … → TIP).
 */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // middle
  [5, 9], [9, 10], [10, 11], [11, 12],
  // ring
  [9, 13], [13, 14], [14, 15], [15, 16],
  // pinky
  [13, 17], [17, 18], [18, 19], [19, 20],
  // palm base
  [0, 17],
];

/** Wrist + the five fingertips — the points used to measure motion/steadiness. */
export const KEY_POINTS = [0, 4, 8, 12, 16, 20] as const;
