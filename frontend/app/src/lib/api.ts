/**
 * Client for the Remy agent layer (backend/). All calls have hard timeouts and
 * throw on failure — callers own the explicit offline-fallback branch, so the
 * mock path is always a visible, deliberate decision rather than a default.
 */
import { downscaleToJpeg } from "./image";

export const API_BASE =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_REMY_API) ||
  "http://localhost:8787";

const DETECT_TIMEOUT_MS = 20_000;
const RECIPE_TIMEOUT_MS = 25_000;
const REVIEW_TIMEOUT_MS = 8_000;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(t) };
}

/** Shapes mirrored from backend/src/types.ts + recipe.ts (kept structural). */
export type ApiIngredient = {
  name: string;
  quantity: number;
  unit: string;
  quantityKind: "exact" | "estimate" | "unknown";
  category: string;
  confidence: number;
};
export type ApiDetectionRun = {
  result: { items: ApiIngredient[]; notes: string };
  meta: { detector: string; elapsedMs: number };
};
export type ApiRecipe = {
  title: string;
  description: string;
  servings: number;
  timeMinutes: number;
  usesFromInventory: string[];
  pantryAssumptions: string[];
  missingButRecommended: { name: string; why: string }[];
  steps: string[];
};
export type ReviewAggregate = { count: number; avgRecipe: number; avgRemy: number };

/**
 * POST one photo's real bytes to /detect. Downscales client-side first
 * (1024px / q0.7 — see lib/image.ts) to keep vision costs down.
 */
export async function detectImage(uri: string): Promise<ApiDetectionRun> {
  const small = await downscaleToJpeg(uri);
  const blob: Blob = small ?? (await fetch(uri).then((r) => r.blob()));
  const { signal, cancel } = withTimeout(DETECT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/detect`, {
      method: "POST",
      headers: { "Content-Type": small ? "image/jpeg" : blob.type || "image/jpeg" },
      body: blob,
      signal,
    });
    if (!res.ok) throw new Error(`detect failed: HTTP ${res.status}`);
    return (await res.json()) as ApiDetectionRun;
  } finally {
    cancel();
  }
}

/** Detect across all photos and merge unique ingredient names (highest confidence first). */
export async function detectPhotos(
  uris: string[],
): Promise<{ names: string[]; detector: string }> {
  const runs = await Promise.all(uris.map((u) => detectImage(u)));
  const byName = new Map<string, number>();
  for (const run of runs) {
    for (const item of run.result.items) {
      const key = item.name.toLowerCase();
      byName.set(key, Math.max(byName.get(key) ?? 0, item.confidence));
    }
  }
  const names = [...byName.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([n]) => n[0]!.toUpperCase() + n.slice(1));
  return { names, detector: runs[0]?.meta.detector ?? "unknown" };
}

/** POST the user's actual basket to /recipe and get a generated recipe back. */
export async function generateRecipeFromBasket(
  basket: string[],
  preference?: string,
): Promise<ApiRecipe> {
  const inventory = {
    items: basket.map((name) => ({
      name,
      quantity: 1,
      unit: "count",
      quantityKind: "unknown" as const,
      category: "other",
      confidence: 1,
    })),
    notes: "",
  };
  const { signal, cancel } = withTimeout(RECIPE_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/recipe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventory, preference }),
      signal,
    });
    if (!res.ok) throw new Error(`recipe failed: HTTP ${res.status}`);
    const data = (await res.json()) as { recipe: ApiRecipe };
    return data.recipe;
  } finally {
    cancel();
  }
}

export async function postReview(review: {
  recipeId: string;
  recipeStars: number;
  remyStars: number;
  tags: string[];
}): Promise<void> {
  const { signal, cancel } = withTimeout(REVIEW_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(review),
      signal,
    });
    if (!res.ok) throw new Error(`review failed: HTTP ${res.status}`);
  } finally {
    cancel();
  }
}

export async function getReviewAggregates(): Promise<Record<string, ReviewAggregate>> {
  const { signal, cancel } = withTimeout(REVIEW_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/reviews`, { signal });
    if (!res.ok) throw new Error(`reviews failed: HTTP ${res.status}`);
    const data = (await res.json()) as { aggregates: Record<string, ReviewAggregate> };
    return data.aggregates;
  } finally {
    cancel();
  }
}
