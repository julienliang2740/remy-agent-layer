import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

/**
 * WASM runtime is loaded from jsdelivr, pinned to the installed
 * @mediapipe/tasks-vision version so the JS and WASM never drift apart.
 * Bump this string in lockstep with package.json on upgrade.
 */
const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

/** Google's hosted Hand Landmarker model (float16). Vendor to /public for offline later. */
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let pending: Promise<HandLandmarker> | null = null;

/**
 * Lazily create the (singleton) Hand Landmarker. Everything runs on-device —
 * after the one-time WASM + model download there are no network calls per frame.
 * On failure the promise is cleared so a later retry can start fresh.
 */
export function getHandLandmarker(): Promise<HandLandmarker> {
  if (!pending) {
    pending = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
      return HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })().catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}
