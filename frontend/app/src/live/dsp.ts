/**
 * Pure, dependency-free DSP/geometry primitives over time series, so every
 * action feature is unit-testable in isolation. Everything operates on series
 * derived from NormalizedHand (palm-length units), hence camera-distance
 * invariant. No MediaPipe types here.
 */
import type { Pt } from "./types";

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Linear ramp from 0 at lo to 1 at hi. */
export function softGate(x: number, lo: number, hi: number): number {
  if (hi <= lo) return x >= hi ? 1 : 0;
  return clamp01((x - lo) / (hi - lo));
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Remove the mean (constant detrend) — enough for windowed autocorrelation. */
export function detrend(xs: number[]): number[] {
  const m = mean(xs);
  return xs.map((x) => x - m);
}

/**
 * Dominant periodicity of a series via normalized autocorrelation.
 * Returns the strongest peak height in [0,1], its lag (frames), and the implied
 * frequency in Hz (= fps / lag) — fps-derived so 25 and 30fps agree. Searches
 * lags ~0.15s..min(half-window, 0.9s), i.e. roughly 1.1–6.7 Hz.
 */
export function autocorrPeriodicity(
  series: number[],
  fps: number,
): { periodicity: number; lagFrames: number; freqHz: number } {
  const n = series.length;
  const x = detrend(series);
  let denom = 0;
  for (const v of x) denom += v * v;
  if (denom < 1e-12 || n < 6) return { periodicity: 0, lagFrames: 0, freqHz: 0 };

  const lagMax = Math.min(Math.floor(n / 2), Math.round(fps * 0.9));
  // Pitch-detection style: a slow signal is trivially self-similar at short
  // lags, so only accept a peak AFTER the autocorrelation has first decorrelated
  // (dropped below DESCEND). This is what distinguishes a true period from a
  // slowly-varying signal — without it, a 1 Hz knead reads as high-frequency.
  const DESCEND = 0.3;
  let descended = false;
  let bestR = 0;
  let bestLag = 0;
  for (let k = 2; k <= lagMax; k++) {
    let num = 0;
    for (let i = 0; i + k < n; i++) num += x[i]! * x[i + k]!;
    const r = num / denom;
    if (!descended) {
      if (r < DESCEND) descended = true;
      continue;
    }
    if (r > bestR) {
      bestR = r;
      bestLag = k;
    }
  }
  return {
    periodicity: descended ? clamp01(bestR) : 0,
    lagFrames: bestLag,
    freqHz: bestLag > 0 ? fps / bestLag : 0,
  };
}

/** Signed polygon area (shoelace) of a path. */
export function shoelaceArea(path: Pt[]): number {
  let a = 0;
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    const q = path[(i + 1) % path.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Total length of a path (sum of segment lengths). */
export function pathLength(path: Pt[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    len += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  }
  return len;
}

/**
 * Isoperimetric circularity in [0,1]: 4π·|area| / perimeter².
 * 1 ≈ a circle, ~0 ≈ a straight reciprocating line. Robust shape measure that
 * cleanly separates stirring (loop) from chopping (line).
 */
export function pathCircularity(path: Pt[]): number {
  const peri = pathLength(path);
  if (peri < 1e-9) return 0;
  return clamp01((4 * Math.PI * Math.abs(shoelaceArea(path))) / (peri * peri));
}

/**
 * 2D PCA of a point cloud. Returns:
 *  - ratio  = sqrt(λ2/λ1) in [0,1] (0 = collinear/line, 1 = isotropic/circle)
 *  - angle  = orientation of the dominant axis (radians)
 *  - amp    = robust spread along the dominant axis (p95–p5 of the projection)
 */
export function principalExcursion(path: Pt[]): { ratio: number; angle: number; amp: number } {
  const n = path.length;
  if (n < 2) return { ratio: 0, angle: 0, amp: 0 };
  let mx = 0;
  let my = 0;
  for (const p of path) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of path) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= n;
  syy /= n;
  sxy /= n;
  // Eigenvalues of [[sxx,sxy],[sxy,syy]]
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  const l2 = Math.max(0, tr / 2 - disc);
  const angle = Math.atan2(l1 - sxx, sxy || 1e-9);
  // Project onto dominant axis for a robust amplitude.
  const ax = Math.cos(angle);
  const ay = Math.sin(angle);
  const proj = path.map((p) => (p.x - mx) * ax + (p.y - my) * ay).sort((a, b) => a - b);
  const p5 = proj[Math.floor(0.05 * (proj.length - 1))]!;
  const p95 = proj[Math.floor(0.95 * (proj.length - 1))]!;
  return { ratio: l1 > 1e-12 ? clamp01(Math.sqrt(l2 / l1)) : 0, angle, amp: p95 - p5 };
}

/** Frequency (Hz) of mean-crossings in a series — a light FFT stand-in. */
export function zeroCrossingFreq(series: number[], fps: number): number {
  const x = detrend(series);
  let crossings = 0;
  for (let i = 1; i < x.length; i++) {
    if ((x[i - 1]! <= 0 && x[i]! > 0) || (x[i - 1]! >= 0 && x[i]! < 0)) crossings++;
  }
  const seconds = x.length / fps;
  return seconds > 0 ? crossings / 2 / seconds : 0;
}
