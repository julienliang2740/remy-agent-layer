import { useCallback, useEffect, useRef, useState } from "react";
import { IMU_STALE_MS, nearestSample, type ImuSample } from "./imu";

/**
 * The ONLY impure IMU surface. Feature-detects the web DeviceMotion API, handles
 * the iOS Safari requestPermission() user-gesture flow, and buffers samples for
 * the tracking loop. Degrades to a no-op (latest()=>null) when unavailable, so
 * egomotion silently runs vision-only and nothing breaks.
 */
export type MotionPermission = "unknown" | "granted" | "denied" | "unsupported";

export type DeviceMotionApi = {
  enabled: boolean;
  permission: MotionPermission;
  requestPermission: () => Promise<void>;
  latest: (t?: number) => ImuSample | null;
};

type RequestableDME = typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };

export function useDeviceMotion(): DeviceMotionApi {
  const bufferRef = useRef<ImuSample[]>([]);
  const supported = typeof window !== "undefined" && typeof DeviceMotionEvent !== "undefined";
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<MotionPermission>(
    supported ? "unknown" : "unsupported",
  );

  const handlerRef = useRef((e: DeviceMotionEvent) => {
    const r = e.rotationRate;
    if (!r) return;
    const a = e.accelerationIncludingGravity ?? e.acceleration;
    const buf = bufferRef.current;
    buf.push({
      t: performance.now(),
      rotRate: { alpha: r.alpha ?? 0, beta: r.beta ?? 0, gamma: r.gamma ?? 0 },
      accel: { x: a?.x ?? 0, y: a?.y ?? 0, z: a?.z ?? 0 },
      hasGravityRemoved: !!e.acceleration,
    });
    if (buf.length > 24) buf.shift();
  });

  const subscribe = useCallback(() => {
    if (!supported) return;
    window.addEventListener("devicemotion", handlerRef.current);
    setEnabled(true);
  }, [supported]);

  const requestPermission = useCallback(async () => {
    if (!supported) {
      setPermission("unsupported");
      return;
    }
    const DME = DeviceMotionEvent as RequestableDME;
    try {
      if (typeof DME.requestPermission === "function") {
        const res = await DME.requestPermission();
        setPermission(res === "granted" ? "granted" : "denied");
        if (res === "granted") subscribe();
      } else {
        setPermission("granted");
        subscribe();
      }
    } catch {
      setPermission("denied");
    }
  }, [supported, subscribe]);

  useEffect(() => {
    const h = handlerRef.current;
    return () => {
      if (supported) window.removeEventListener("devicemotion", h);
    };
  }, [supported]);

  return {
    enabled,
    permission,
    requestPermission,
    latest: (t) => nearestSample(bufferRef.current, t ?? performance.now(), IMU_STALE_MS),
  };
}
