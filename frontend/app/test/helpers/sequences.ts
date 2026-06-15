import type { Hand, Pt } from "../../src/live/types";
import { makeHand, jitterHand } from "./hands";

/**
 * Synthetic, deterministic cooking-action sequences for testing the action
 * classifier and camera-motion robustness. Each generator animates a base hand
 * over time by perturbing the fingertips/DIPs (articulation relative to the
 * rigid palm), which is exactly what the wrist-anchored normalization measures.
 */
export type ActionKind = "chop" | "stir" | "flip" | "season" | "knead" | "idle";

const TIP_CLUSTER = [8, 12, 16, 20];
const DIP_CLUSTER = [7, 11, 15, 19];

function seededNoise(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}

function offsetFrame(base: Hand, idxs: number[], dx: number, dy: number): Hand {
  return base.map((p, i) => (idxs.includes(i) ? { x: p.x + dx, y: p.y + dy, z: p.z } : { ...p }));
}

/**
 * Build a labeled sequence of raw image-space hands for an action.
 * The pipeline normalizes these internally, so amplitudes are chosen in image
 * units that map to sensible palm-length values (palm scale ≈ 0.25).
 */
export function makeActionSequence(
  kind: ActionKind,
  frames = 48,
  opts: { fps?: number; seed?: number } = {},
): Hand[] {
  const fps = opts.fps ?? 30;
  const base = makeHand([false, false, false, false]);
  const rnd = seededNoise(opts.seed ?? 7);
  const out: Hand[] = [];

  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    let frame: Hand;
    switch (kind) {
      case "chop": {
        // ~2.5 Hz vertical (along the hand's up-axis) fingertip swing.
        const dy = 0.07 * Math.sin(2 * Math.PI * 2.5 * t);
        frame = offsetFrame(base, TIP_CLUSTER, 0, dy);
        frame = offsetFrame(frame, DIP_CLUSTER, 0, dy * 0.5);
        break;
      }
      case "stir": {
        // ~1.6 Hz circular fingertip path.
        const a = 2 * Math.PI * 1.6 * t;
        frame = offsetFrame(base, TIP_CLUSTER, 0.055 * Math.cos(a), 0.055 * Math.sin(a));
        frame = offsetFrame(frame, DIP_CLUSTER, 0.027 * Math.cos(a), 0.027 * Math.sin(a));
        break;
      }
      case "flip": {
        // single explosive non-repeating burst near the middle.
        const tc = frames / fps / 2;
        const g = Math.exp(-((t - tc) ** 2) / (2 * 0.08 ** 2));
        frame = offsetFrame(base, TIP_CLUSTER, 0, -0.14 * g);
        break;
      }
      case "season": {
        // small fast (~5 Hz) flicks of thumb + index + middle fingertips.
        const dy = 0.018 * Math.sin(2 * Math.PI * 5 * t);
        frame = offsetFrame(base, [4, 8, 12], 0, dy);
        break;
      }
      case "knead": {
        // large slow (~1 Hz) open/close flexion of the whole fingertip cluster.
        const dy = 0.09 * Math.sin(2 * Math.PI * 1.0 * t);
        frame = offsetFrame(base, TIP_CLUSTER, 0, dy);
        frame = offsetFrame(frame, DIP_CLUSTER, 0, dy * 0.8);
        break;
      }
      case "idle":
      default:
        frame = base.map((p) => ({ ...p }));
        break;
    }
    // small per-frame sensor jitter so nothing is pixel-perfect (low, like a
    // real stabilized landmark stream — idle must stay clearly below actions)
    out.push(jitterHand(frame, (opts.seed ?? 7) + f, 0.0012));
    void rnd;
  }
  return out;
}

function rot(p: Pt, ang: number): Pt {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

/** Apply ONE camera similarity (zoom·R(roll)·p + pan) to a hand. */
export function applyCameraTransform(
  hand: Hand,
  t: { pan?: { x: number; y: number }; zoom?: number; roll?: number },
): Hand {
  const zoom = t.zoom ?? 1;
  const roll = t.roll ?? 0;
  const pan = t.pan ?? { x: 0, y: 0 };
  return hand.map((p) => {
    const r = rot({ x: p.x * zoom, y: p.y * zoom, z: p.z }, roll);
    return { x: r.x + pan.x, y: r.y + pan.y, z: p.z };
  });
}

/** Apply the SAME transform to every frame (static camera, different viewpoint). */
export function staticViewpoint(
  seq: Hand[],
  t: Parameters<typeof applyCameraTransform>[1],
): Hand[] {
  return seq.map((h) => applyCameraTransform(h, t));
}

/** Time-varying camera: accumulates pan/zoom/roll each frame (camera in motion). */
export function panCamera(
  seq: Hand[],
  perFrame: { pan?: { x: number; y: number }; zoom?: number; roll?: number },
): Hand[] {
  return seq.map((h, f) =>
    applyCameraTransform(h, {
      pan: { x: (perFrame.pan?.x ?? 0) * f, y: (perFrame.pan?.y ?? 0) * f },
      zoom: 1 + (perFrame.zoom ?? 0) * f,
      roll: (perFrame.roll ?? 0) * f,
    }),
  );
}
