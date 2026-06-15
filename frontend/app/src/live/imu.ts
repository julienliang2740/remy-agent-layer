/**
 * Pure IMU helpers + types. No subscriptions live here (that's useDeviceMotion),
 * so everything is unit-testable. The IMU layer is an optional enhancement to
 * the camera-motion flag; when absent, egomotion runs vision-only.
 */
export type ImuSample = {
  /** ms timestamp (same clock as the frame loop). */
  t: number;
  /** Rotation rate in deg/s (DeviceMotion convention). */
  rotRate: { alpha: number; beta: number; gamma: number };
  accel: { x: number; y: number; z: number };
  hasGravityRemoved: boolean;
};

/** Per-axis sign flips — iOS/Android and front/rear cameras differ. Config, not hard-coded. */
export type AxisSign = { alpha: 1 | -1; beta: 1 | -1; gamma: 1 | -1 };
export const DEFAULT_AXIS_SIGN: AxisSign = { alpha: 1, beta: 1, gamma: 1 };

/** Beyond this staleness a gyro sample no longer matches the visual frame. */
export const IMU_STALE_MS = 120;

export const DEG2RAD = Math.PI / 180;

/** Remove a slow-moving (gravity) component from an accel channel via a one-pole high-pass. */
export function highPassAccel(prevFiltered: number, prevRaw: number, raw: number, alpha = 0.8): number {
  return alpha * (prevFiltered + raw - prevRaw);
}

/** Nearest sample to time `t` within `staleMs`, else null. Buffer assumed time-ordered. */
export function nearestSample(
  buffer: ImuSample[],
  t: number,
  staleMs = IMU_STALE_MS,
): ImuSample | null {
  let best: ImuSample | null = null;
  let bestDt = Infinity;
  for (const s of buffer) {
    const d = Math.abs(s.t - t);
    if (d < bestDt) {
      bestDt = d;
      best = s;
    }
  }
  return best && bestDt <= staleMs ? best : null;
}
