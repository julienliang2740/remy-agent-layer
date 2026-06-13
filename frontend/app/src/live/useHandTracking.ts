import { useCallback, useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { getHandLandmarker } from "./handLandmarker";
import { drawHands } from "./draw";
import { classifyGrip, type GripResult } from "./grip";
import { smoothLandmarks } from "./smoothing";
import { createSteadinessTracker } from "./steadiness";
import type { Hand } from "./types";

export type TrackingStatus =
  | "idle"
  | "loading-model"
  | "requesting-camera"
  | "tracking"
  | "error";

/** "environment" = rear (for cooking), "user" = front; "unknown" = a webcam that doesn't report. */
export type Facing = "environment" | "user" | "unknown";

export type HandTracking = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  status: TrackingStatus;
  error: string | null;
  /** A hand is in frame. */
  present: boolean;
  /** Tracking locked on a held-still hand. */
  steady: boolean;
  /** Number of hands detected this frame. */
  handCount: number;
  /** Rolling-average motion (normalized units/frame). */
  motion: number;
  /** Grip classification of the primary hand (null when no/odd hand). */
  grip: GripResult | null;
  /** Measured detection rate. */
  fps: number;
  /** Which camera is live. Mirror the view only when this is NOT "environment". */
  facing: Facing;
  /** Begin model load → camera → tracking loop. Idempotent. */
  start: () => void;
  /** Switch between front/rear cameras while tracking. */
  flip: () => void;
};

/**
 * Owns the full on-device pipeline: load the Hand Landmarker, open the webcam,
 * and run a requestAnimationFrame loop that detects → smooths → measures
 * steadiness → draws, exposing a small reactive snapshot for the UI.
 *
 * Prefers the rear ("environment") camera for cooking; on a laptop with only a
 * front webcam it falls back to that. State is updated only when a value
 * actually changes (the raw signals tick at ~30fps) to avoid needless renders.
 */
export function useHandTracking(): HandTracking {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [present, setPresent] = useState(false);
  const [steady, setSteady] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const [motion, setMotion] = useState(0);
  const [grip, setGrip] = useState<GripResult | null>(null);
  const [fps, setFps] = useState(0);
  const [facing, setFacing] = useState<Facing>("unknown");

  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedRef = useRef(false);
  const desiredFacingRef = useRef<Facing>("environment");

  const trackerRef = useRef(createSteadinessTracker());
  const prevHandsRef = useRef<Hand[] | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const fpsRef = useRef({ frames: 0, since: 0 });

  /** Open (or re-open) the camera with the desired facing and bind it to the video. */
  const openStream = useCallback(async (want: Facing) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({
      video:
        want === "unknown"
          ? { width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: want } },
      audio: false,
    });
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) throw new Error("Camera surface not ready.");
    video.srcObject = stream;
    await video.play();

    // Webcams often don't report facingMode → treat as "unknown" (mirror it).
    const reported = stream.getVideoTracks()[0]?.getSettings().facingMode;
    setFacing(reported === "environment" ? "environment" : reported === "user" ? "user" : "unknown");
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        setStatus("loading-model");
        const landmarker = await getHandLandmarker();

        setStatus("requesting-camera");
        await openStream(desiredFacingRef.current);

        setStatus("tracking");
        runLoop(landmarker);
      } catch (err) {
        startedRef.current = false;
        setError(err instanceof Error ? err.message : "Could not start the camera.");
        setStatus("error");
      }
    })();
  }, [openStream]);

  /** Toggle front/rear without tearing down the running detection loop. */
  const flip = useCallback(() => {
    if (!startedRef.current) return;
    const next: Facing = facing === "environment" ? "user" : "environment";
    desiredFacingRef.current = next;
    void openStream(next).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not switch camera.");
    });
  }, [facing, openStream]);

  function runLoop(landmarker: HandLandmarker) {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      // Only run detection on a fresh frame — also keeps detectForVideo's
      // timestamp strictly increasing.
      if (video.currentTime === lastVideoTimeRef.current) return;
      lastVideoTimeRef.current = video.currentTime;

      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      const raw = result.landmarks as Hand[];

      const smoothed = raw.map((hand, i) =>
        smoothLandmarks(prevHandsRef.current?.[i] ?? null, hand, 0.5),
      );
      prevHandsRef.current = smoothed;

      const st = trackerRef.current.update(smoothed[0] ?? null);

      const ctx = canvas.getContext("2d");
      if (ctx) drawHands(ctx, smoothed, { steady: st.steady });

      // FPS, sampled every ~500ms.
      const f = fpsRef.current;
      if (f.since === 0) f.since = now;
      f.frames += 1;
      if (now - f.since >= 500) {
        setFps(Math.round((f.frames * 1000) / (now - f.since)));
        f.frames = 0;
        f.since = now;
      }

      // Reactive snapshot — set only on change.
      setPresent((p) => (p === st.present ? p : st.present));
      setSteady((s) => (s === st.steady ? s : st.steady));
      setHandCount((c) => (c === smoothed.length ? c : smoothed.length));
      const g = classifyGrip(smoothed[0] ?? null);
      setGrip((prev) => (prev?.grip === g?.grip ? prev : g));
      const m = Math.round(st.motion * 1000) / 1000;
      setMotion((prev) => (prev === m ? prev : m));
    };
    tick();
  }

  // Tear down on unmount.
  useEffect(() => stop, [stop]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    present,
    steady,
    handCount,
    motion,
    grip,
    fps,
    facing,
    start,
    flip,
  };
}
