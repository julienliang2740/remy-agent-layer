import type { Hand, Pt } from "../../src/live/types";

/**
 * Synthetic 21-landmark hands for grip tests and the eval harness.
 * Geometry mirrors MediaPipe's layout: wrist at the bottom, fingers fanning
 * up. A curled finger's TIP is pulled back toward the wrist (inside its PIP);
 * an extended finger's TIP is far above it.
 */
const WRIST: Pt = { x: 0.5, y: 0.9, z: 0 };

function finger(x: number, curledFinger: boolean): Pt[] {
  // mcp, pip, dip, tip
  const mcp = { x, y: 0.65, z: 0 };
  const pip = { x, y: 0.55, z: 0 };
  const dip = { x, y: curledFinger ? 0.62 : 0.45, z: 0 };
  const tip = { x, y: curledFinger ? 0.8 : 0.35, z: 0 };
  return [mcp, pip, dip, tip];
}

/** Build a full hand; `curled` = [index, middle, ring, pinky]. */
export function makeHand(curled: [boolean, boolean, boolean, boolean]): Hand {
  const thumb: Pt[] = [
    { x: 0.36, y: 0.82, z: 0 },
    { x: 0.32, y: 0.74, z: 0 },
    { x: 0.29, y: 0.67, z: 0 },
    { x: 0.27, y: 0.6, z: 0 },
  ];
  return [
    WRIST,
    ...thumb,
    ...finger(0.42, curled[0]),
    ...finger(0.48, curled[1]),
    ...finger(0.54, curled[2]),
    ...finger(0.6, curled[3]),
  ];
}

/** Deterministic jitter so fixtures aren't pixel-identical. */
export function jitterHand(hand: Hand, seed: number, amount = 0.012): Hand {
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
  return hand.map((p) => ({
    x: p.x + rnd() * amount,
    y: p.y + rnd() * amount,
    z: p.z,
  }));
}
