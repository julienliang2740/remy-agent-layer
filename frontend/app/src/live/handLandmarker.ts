import type { FilesetResolver as FilesetResolverType, HandLandmarker } from "@mediapipe/tasks-vision";

/**
 * Pinned to the installed @mediapipe/tasks-vision version so JS + WASM + model
 * never drift. Bump all three in lockstep with package.json on upgrade.
 */
const VERSION = "0.10.35";
const MODULE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`;
const WASM_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

type VisionModule = {
  FilesetResolver: typeof FilesetResolverType;
  HandLandmarker: typeof HandLandmarker;
};

/**
 * Load the MediaPipe ESM bundle from the CDN at runtime via the browser's
 * native dynamic import. The `Function` indirection hides the call from Metro's
 * static analyzer — Metro cannot parse `vision_bundle.mjs` (its
 * `import(t.toString())` throws a SyntaxError at bundle time), so we keep the
 * package as a types-only dependency and never let the bundler touch it.
 */
const importFromCdn = new Function("url", "return import(url);") as unknown as (
  url: string,
) => Promise<unknown>;

let pending: Promise<HandLandmarker> | null = null;

/**
 * Lazily create the (singleton) Hand Landmarker. After the one-time CDN
 * download (module + WASM + model) everything runs on-device with no per-frame
 * network calls. On failure the promise is cleared so a retry starts fresh.
 */
export function getHandLandmarker(): Promise<HandLandmarker> {
  if (!pending) {
    pending = (async () => {
      const { FilesetResolver, HandLandmarker: HandLandmarkerCtor } = (await importFromCdn(
        MODULE_URL,
      )) as VisionModule;
      const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
      return HandLandmarkerCtor.createFromOptions(fileset, {
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
