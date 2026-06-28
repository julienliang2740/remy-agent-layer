import type { ActionState } from "./action";
import type { GripResult } from "./grip";
import { palmScale } from "./handframe";
import type { Hand, Pt } from "./types";

export type GestureCommand = "toggle_pause" | "next_step" | "repeat_instruction";

export type GestureCommandEvent = {
  id: number;
  command: GestureCommand;
  label: string;
  at: number;
};

export type GestureInput = {
  hand: Hand | null;
  handCount: number;
  steady: boolean;
  grip: GripResult | null;
  action: ActionState | null;
  cameraMoving: boolean;
  now: number;
};

const HOLD_MS: Record<GestureCommand, number> = {
  toggle_pause: 900,
  next_step: 700,
  repeat_instruction: 500,
};

const COOLDOWN_MS: Record<GestureCommand, number> = {
  toggle_pause: 2600,
  next_step: 3000,
  repeat_instruction: 2200,
};

const LABEL: Record<GestureCommand, string> = {
  toggle_pause: "Pause / resume",
  next_step: "Next step",
  repeat_instruction: "Repeat step",
};

const RELEASE_GRACE_MS = 220;
const FINGER_JOINTS: ReadonlyArray<readonly [number, number, number]> = [
  [5, 6, 8],
  [9, 10, 12],
  [13, 14, 16],
  [17, 18, 20],
];

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function validBase(input: GestureInput): input is GestureInput & { hand: Hand } {
  return (
    !!input.hand &&
    input.hand.length >= 21 &&
    input.handCount === 1 &&
    input.steady &&
    !input.cameraMoving &&
    (input.action == null || input.action.action === "idle")
  );
}

function openPalm(input: GestureInput): boolean {
  return validBase(input) && (input.grip?.extendedFingers ?? 0) >= 4;
}

function foldedFingersForThumbsUp(hand: Hand, scale: number): number {
  let folded = 0;
  for (const [mcpIdx, pipIdx, tipIdx] of FINGER_JOINTS) {
    const mcp = hand[mcpIdx]!;
    const pip = hand[pipIdx]!;
    const tip = hand[tipIdx]!;
    const closeToPalm = dist(tip, mcp) < scale * 0.85;
    const notPointingUp = tip.y > pip.y - scale * 0.08;
    if (closeToPalm || notPointingUp) folded++;
  }
  return folded;
}

function thumbsUp(input: GestureInput): boolean {
  if (!validBase(input)) return false;
  const hand = input.hand;
  const wrist = hand[0]!;
  const thumbMcp = hand[2]!;
  const thumbIp = hand[3]!;
  const thumbTip = hand[4]!;
  const indexMcp = hand[5]!;
  const indexTip = hand[8]!;
  const scale = palmScale(hand);
  if (scale <= 0) return false;

  const foldedFingers = Math.max(input.grip?.curledFingers ?? 0, foldedFingersForThumbsUp(hand, scale));
  if (foldedFingers < 3) return false;

  const thumbRises = thumbTip.y < thumbIp.y - scale * 0.06 && thumbTip.y < indexMcp.y + scale * 0.1;
  const thumbExtends = dist(thumbTip, wrist) > dist(thumbIp, wrist) * 1.01;
  const thumbAwayFromFingers = dist(thumbTip, indexTip) > scale * 0.55;
  const thumbLongEnough = dist(thumbTip, thumbMcp) > scale * 0.45;
  return thumbRises && thumbExtends && thumbAwayFromFingers && thumbLongEnough;
}

function pinch(input: GestureInput): boolean {
  if (!validBase(input)) return false;
  const hand = input.hand;
  const scale = palmScale(hand);
  if (scale <= 0) return false;
  return dist(hand[4]!, hand[8]!) < scale * 0.35;
}

function detectPose(input: GestureInput): GestureCommand | null {
  if (pinch(input)) return "repeat_instruction";
  if (thumbsUp(input)) return "next_step";
  if (openPalm(input)) return "toggle_pause";
  return null;
}

export function createGestureCommandTracker() {
  let candidate: GestureCommand | null = null;
  let since = 0;
  let lastPoseAt = -Infinity;
  let latched: GestureCommand | null = null;
  let nextId = 1;
  const lastFired: Record<GestureCommand, number> = {
    toggle_pause: -Infinity,
    next_step: -Infinity,
    repeat_instruction: -Infinity,
  };

  function update(input: GestureInput): GestureCommandEvent | null {
    const pose = detectPose(input);

    if (!pose) {
      if (candidate && input.now - lastPoseAt <= RELEASE_GRACE_MS) return null;
      candidate = null;
      latched = null;
      since = 0;
      return null;
    }

    lastPoseAt = input.now;

    if (pose !== candidate) {
      candidate = pose;
      since = input.now;
      return null;
    }

    if (latched === pose) return null;
    if (input.now - since < HOLD_MS[pose]) return null;
    if (input.now - lastFired[pose] < COOLDOWN_MS[pose]) return null;

    lastFired[pose] = input.now;
    latched = pose;
    return { id: nextId++, command: pose, label: LABEL[pose], at: input.now };
  }

  function reset(): void {
    candidate = null;
    latched = null;
    lastPoseAt = -Infinity;
    since = 0;
  }

  return { update, reset };
}

export type GestureCommandTracker = ReturnType<typeof createGestureCommandTracker>;
