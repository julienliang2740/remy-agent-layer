import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

/**
 * Durable review store. Reviews land in a JSON file (atomic rewrite) — small,
 * dependency-free, and trivially portable to SQLite/D1 later since all access
 * goes through this module. The path is injectable so tests use a temp file.
 */
export const ReviewSchema = z.object({
  recipeId: z.string().min(1),
  recipeStars: z.number().int().min(0).max(5),
  remyStars: z.number().int().min(0).max(5),
  tags: z.array(z.string()).default([]),
  /** Unix ms; assigned server-side when omitted. */
  at: z.number().optional(),
});
export type Review = z.infer<typeof ReviewSchema>;

export type ReviewAggregate = {
  count: number;
  avgRecipe: number;
  avgRemy: number;
};

export class ReviewStore {
  constructor(private readonly path: string) {}

  private readAll(): Review[] {
    try {
      return z.array(ReviewSchema).parse(JSON.parse(readFileSync(this.path, "utf8")));
    } catch {
      return [];
    }
  }

  add(review: Review): Review {
    const all = this.readAll();
    const stamped = { ...review, at: review.at ?? Date.now() };
    all.push(stamped);
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(all, null, 2), "utf8");
    return stamped;
  }

  list(recipeId?: string): Review[] {
    const all = this.readAll();
    return recipeId ? all.filter((r) => r.recipeId === recipeId) : all;
  }

  /** Per-recipe aggregates for surfacing ratings on recipe cards. */
  aggregates(): Record<string, ReviewAggregate> {
    const out: Record<string, ReviewAggregate> = {};
    for (const r of this.readAll()) {
      const agg = (out[r.recipeId] ??= { count: 0, avgRecipe: 0, avgRemy: 0 });
      // running means
      agg.avgRecipe = (agg.avgRecipe * agg.count + r.recipeStars) / (agg.count + 1);
      agg.avgRemy = (agg.avgRemy * agg.count + r.remyStars) / (agg.count + 1);
      agg.count += 1;
    }
    for (const agg of Object.values(out)) {
      agg.avgRecipe = Math.round(agg.avgRecipe * 10) / 10;
      agg.avgRemy = Math.round(agg.avgRemy * 10) / 10;
    }
    return out;
  }
}
