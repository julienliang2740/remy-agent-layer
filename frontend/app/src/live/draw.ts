import { HAND_CONNECTIONS } from "./connections";
import type { Hand } from "./types";

/** Brand colors (hex twins of the oklch tokens in styles.css). */
const WARM = "#d97706";
const LEAF = "#059669";
const DOT = "rgba(247,250,249,0.95)"; // canvas

/**
 * Draw the hand skeleton(s) onto the overlay canvas. Landmarks are in [0,1]
 * normalized space; the canvas is sized to the video's intrinsic resolution and
 * the whole layer is mirrored in CSS, so we draw raw coordinates here.
 *
 * `steady` tints the skeleton: warm while the user is still settling, leaf once
 * tracking is locked — the same visual gate downstream guidance keys off.
 */
export function drawHands(
  ctx: CanvasRenderingContext2D,
  hands: Hand[],
  { steady }: { steady: boolean },
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (hands.length === 0) return;

  const stroke = steady ? LEAF : WARM;
  ctx.lineWidth = Math.max(2, width * 0.004);
  ctx.lineCap = "round";
  ctx.strokeStyle = stroke;

  for (const hand of hands) {
    // bones
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      const p = hand[a];
      const q = hand[b];
      if (!p || !q) continue;
      ctx.moveTo(p.x * width, p.y * height);
      ctx.lineTo(q.x * width, q.y * height);
    }
    ctx.stroke();

    // joints
    const r = Math.max(3, width * 0.006);
    for (const p of hand) {
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, r, 0, Math.PI * 2);
      ctx.fillStyle = DOT;
      ctx.fill();
      ctx.lineWidth = Math.max(1, width * 0.002);
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
}
