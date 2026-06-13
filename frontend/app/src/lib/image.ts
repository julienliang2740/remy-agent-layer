/**
 * Client-side image downscaling before upload to /detect — cost control for
 * the vision API. Documented limits:
 *
 *   MAX_DIMENSION = 1024 px (longest side; vision models gain nothing above this)
 *   JPEG_QUALITY  = 0.7
 *
 * Web-only implementation (canvas). On native this becomes expo-image-manipulator;
 * callers treat a null return as "send the original".
 */
export const MAX_DIMENSION = 1024;
export const JPEG_QUALITY = 0.7;

/** Longest-side fit: returns target {width, height} for a source size. Pure — unit-tested. */
export function fitWithin(
  width: number,
  height: number,
  maxDim: number = MAX_DIMENSION,
): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) return { width, height };
  const scale = maxDim / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Downscale an image (by URI) to a JPEG blob. Returns null when the platform
 * has no canvas (native) or decoding fails — caller falls back to original bytes.
 */
export async function downscaleToJpeg(uri: string): Promise<Blob | null> {
  return downscaleImpl(uri);
}

async function downscaleImpl(uri: string): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  try {
    const source = await fetch(uri).then((r) => r.blob());
    const bitmap = await createImageBitmap(source);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY),
    );
  } catch {
    return null;
  }
}

// E2E hook: lets Playwright measure the REAL shipped downscale function
// (before/after byte sizes) without bundler gymnastics. Harmless in prod.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__remyDownscale = downscaleToJpeg;
}
