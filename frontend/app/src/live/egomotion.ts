/**
 * Camera-egomotion classifier. Its job is the `cameraMoving` flag that the
 * action tracker and coach use to avoid phantom actions and false "hold steady"
 * alarms while the camera (not the hand) is what's moving.
 *
 * Vision path (always available): the common-mode frame-to-frame motion of the
 * stable palm anchors {0,5,9,13,17}. Those knuckles barely articulate, so their
 * shared image motion is overwhelmingly camera motion. With two hands present,
 * the motion common to both is almost certainly the camera.
 *
 * IMU enhancement (optional): when a fresh gyro sample exists, a small-angle
 * model corroborates the vision estimate and raises confidence; it never gates
 * correctness, and absence simply means vision-only (the design's floor).
 *
 * Pure + clock-injected; no-op safe (prevHands null → cameraMoving false).
 */
import { DEG2RAD, type ImuSample } from "./imu";
import type { Hand, Pt } from "./types";

const PALM_ANCHORS = [0, 5, 9, 13, 17] as const;

export type EgomotionState = {
  /** Common-mode palm-anchor flow magnitude (image units/frame). */
  frameVel: number;
  cameraMoving: boolean;
  /** Confidence in the cameraMoving decision (vision-only 0.4; IMU agreement higher). */
  camConf: number;
  source: "vision" | "imu" | "fusion";
};

export type EgomotionOptions = {
  flowRef: number;
  camIn: number;
  camOut: number;
  clearFrames: number;
  focalN: number; // normalized focal length for IMU flow (phone ~0.78, headworn ~0.42)
  gyroSatDegS: number;
};

export const EGOMOTION_DEFAULTS: EgomotionOptions = {
  flowRef: 0.03,
  camIn: 0.5,
  camOut: 0.25,
  clearFrames: 4,
  focalN: 0.78,
  gyroSatDegS: 250,
};

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Component-median displacement of the palm anchors between two hands. */
export function palmAnchorFlow(hand: Hand, prevHand: Hand): Pt {
  const dxs: number[] = [];
  const dys: number[] = [];
  for (const i of PALM_ANCHORS) {
    const a = hand[i];
    const b = prevHand[i];
    if (!a || !b) continue;
    dxs.push(a.x - b.x);
    dys.push(a.y - b.y);
  }
  return { x: median(dxs), y: median(dys), z: 0 };
}

/** Predicted image-plane flow magnitude from gyro pan/tilt over dt (small-angle). */
export function predictImuFlow(imu: ImuSample, dt: number, focalN: number): number {
  // beta = pitch (vertical pan), gamma = roll, alpha = yaw(horizontal pan)
  const yaw = imu.rotRate.alpha * DEG2RAD;
  const pitch = imu.rotRate.beta * DEG2RAD;
  return focalN * Math.hypot(yaw, pitch) * dt;
}

export function createEgomotionTracker(opts: Partial<EgomotionOptions> = {}) {
  const cfg = { ...EGOMOTION_DEFAULTS, ...opts };
  let moving = false;
  let calmRun = 0;

  function reset(): EgomotionState {
    moving = false;
    calmRun = 0;
    return { frameVel: 0, cameraMoving: false, camConf: 0, source: "vision" };
  }

  function update(
    hands: Hand[],
    prevHands: Hand[] | null,
    imu: ImuSample | null,
    dt: number,
  ): EgomotionState {
    if (!prevHands || hands.length === 0 || prevHands.length === 0) {
      moving = false;
      calmRun = 0;
      return { frameVel: 0, cameraMoving: false, camConf: 0, source: "vision" };
    }

    // Vision flow: primary hand, or the two-hand common mode when available.
    let flow = palmAnchorFlow(hands[0]!, prevHands[0]!);
    if (hands.length >= 2 && prevHands.length >= 2) {
      const f2 = palmAnchorFlow(hands[1]!, prevHands[1]!);
      flow = { x: (flow.x + f2.x) / 2, y: (flow.y + f2.y) / 2, z: 0 };
    }
    const frameVel = Math.hypot(flow.x, flow.y);
    const sCam = frameVel / cfg.flowRef;

    // IMU corroboration (optional).
    let source: EgomotionState["source"] = "vision";
    let camConf = 0.4;
    if (imu && dt > 0) {
      const imuFlow = predictImuFlow(imu, dt, cfg.focalN);
      const gyroMag = Math.hypot(imu.rotRate.alpha, imu.rotRate.beta, imu.rotRate.gamma);
      const reliable = gyroMag < cfg.gyroSatDegS;
      const agree = Math.abs(imuFlow - frameVel) < Math.max(0.01, 0.5 * frameVel);
      source = "fusion";
      camConf = reliable && agree ? 0.85 : 0.4;
    }

    // Hysteresis: enter above camIn, leave only after `clearFrames` calm frames.
    if (sCam >= cfg.camIn) {
      moving = true;
      calmRun = 0;
    } else if (sCam < cfg.camOut) {
      calmRun++;
      if (calmRun >= cfg.clearFrames) moving = false;
    } else {
      calmRun = 0;
    }

    return { frameVel, cameraMoving: moving, camConf, source };
  }

  return { update, reset };
}

export type EgomotionTracker = ReturnType<typeof createEgomotionTracker>;
