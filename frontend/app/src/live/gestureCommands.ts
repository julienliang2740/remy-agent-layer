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

function thumbsUp(input: GestureInput): boolean {
  if (!validBase(input) || (input.grip?.curledFingers ?? 0) < 3) return false;
  const hand = input.hand;
  const wrist = hand[0]!;
  const thumbIp = hand[3]!;
  const thumbTip = hand[4]!;
  const indexMcp = hand[5]!;
  const scale = palmScale(hand);
  if (scale <= 0) return false;

  const thumbRises = thumbTip.y < thumbIp.y - scale * 0.18 && thumbTip.y < indexMcp.y;
  const thumbExtends = dist(thumbTip, wrist) > dist(thumbIp, wrist) * 1.06;
  return thumbRises && thumbExtends;
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
      candidate = null;
      latched = null;
      since = 0;
      return null;
    }

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
    since = 0;
  }

  return { update, reset };
}

export type GestureCommandTracker = ReturnType<typeof createGestureCommandTracker>;
