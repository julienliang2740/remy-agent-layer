/**
 * Minimal HTTP API around the detector + recipe layer, using only Node built-ins
 * so there's nothing extra to install. The Expo app (or curl) can call this.
 *
 *   npm run serve
 *
 *   GET  /health                  -> { ok, detector }
 *   POST /detect                  -> DetectionRun
 *        body: raw image bytes, with Content-Type: image/jpeg|png|gif|webp
 *   POST /recipe                  -> { inventory, recipe }
 *        body: JSON { "inventory": DetectionResult, "preference"?: string }
 *   POST /reviews                 -> stored Review
 *        body: JSON { recipeId, recipeStars, remyStars, tags? }
 *   GET  /reviews                 -> { aggregates: { [recipeId]: {count, avgRecipe, avgRemy} } }
 *
 * Cross-cutting: CORS for the app/website dev servers, structured request
 * logging (request id, route, status, latency, detector), and a sliding-window
 * rate limit on the model-backed endpoints (/detect, /recipe).
 */
import "./env.js";
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { allowedOrigins, corsOrigin } from "./cors.js";
import { detectorFromEnv, imageFromBuffer } from "./detector.js";
import { generateRecipe } from "./recipe.js";
import { createRateLimiter } from "./rateLimit.js";
import { ReviewSchema, ReviewStore } from "./reviews.js";
import {
  DetectionResultSchema,
  SUPPORTED_MEDIA_TYPES,
  type SupportedMediaType,
} from "./types.js";

const PORT = Number(process.env.PORT) || 8787;
const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB — generous for phone photos.
const MAX_PREFERENCE_CHARS = 200;
const detector = detectorFromEnv();
const reviews = new ReviewStore(process.env.REMY_REVIEWS_PATH ?? "data/reviews.json");
const CORS_ALLOW = allowedOrigins(process.env.REMY_ALLOWED_ORIGINS);
/** 20 model-backed requests per minute per client — the cost fuse. */
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
/** Reviews are cheap but still writeable — cap abuse separately. */
const reviewLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

/** One structured line per request: id, route, status, latency, detector. */
function logRequest(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), ...fields }));
}

function clientKey(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  // CORS header is set per-request via setHeader in the handler (allowlist),
  // so it's preserved here without reflecting an arbitrary origin.
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

function normalizeMediaType(header: string | undefined): SupportedMediaType | null {
  const type = (header ?? "").split(";")[0]!.trim().toLowerCase();
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(type)
    ? (type as SupportedMediaType)
    : null;
}

async function handleDetect(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const mediaType = normalizeMediaType(req.headers["content-type"]);
  if (!mediaType) {
    sendJson(res, 415, {
      error: `Content-Type must be one of: ${SUPPORTED_MEDIA_TYPES.join(", ")}`,
    });
    return;
  }
  const body = await readBody(req);
  if (body.length === 0) {
    sendJson(res, 400, { error: "empty image body" });
    return;
  }
  const run = await detector.detect(imageFromBuffer(body, mediaType));
  sendJson(res, 200, run);
}

async function handleRecipe(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    sendJson(res, 400, { error: "body must be valid JSON" });
    return;
  }
  const obj = parsed as { inventory?: unknown; preference?: unknown };
  const inventory = DetectionResultSchema.safeParse(obj.inventory);
  if (!inventory.success) {
    sendJson(res, 400, { error: "body.inventory must be a DetectionResult" });
    return;
  }
  const recipe = await generateRecipe(inventory.data, {
    preference:
      typeof obj.preference === "string"
        ? obj.preference.slice(0, MAX_PREFERENCE_CHARS)
        : undefined,
  });
  sendJson(res, 200, { inventory: inventory.data, recipe });
}

async function handlePostReview(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    sendJson(res, 400, { error: "body must be valid JSON" });
    return;
  }
  const review = ReviewSchema.safeParse(parsed);
  if (!review.success) {
    sendJson(res, 400, { error: "invalid review" });
    return;
  }
  sendJson(res, 201, reviews.add(review.data));
}

const server = createServer((req, res) => {
  const started = Date.now();
  const id = randomUUID().slice(0, 8);
  const route = `${req.method} ${(req.url ?? "/").split("?")[0]}`;

  // CORS: echo the Origin only if it's on the allowlist (never a blanket *).
  const allowOrigin = corsOrigin(req.headers.origin, CORS_ALLOW);
  if (allowOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Vary", "Origin");
  }

  // CORS preflight for allowlisted browser clients.
  if (req.method === "OPTIONS") {
    if (allowOrigin) {
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    res.writeHead(allowOrigin ? 204 : 403);
    res.end();
    return;
  }

  const finish = (status: number) =>
    logRequest({
      id,
      route,
      status,
      ms: Date.now() - started,
      detector: route === "POST /detect" ? detector.name : undefined,
    });
  res.on("finish", () => finish(res.statusCode));

  const handle = async (): Promise<void> => {
    // Rate limit the model-backed (cost) endpoints and the writeable one.
    const key = clientKey(req);
    if (route === "POST /detect" || route === "POST /recipe") {
      if (!limiter.allow(key)) {
        res.setHeader("Retry-After", String(limiter.retryAfterSecs(key)));
        sendJson(res, 429, { error: "rate limited — try again shortly" });
        return;
      }
    } else if (route === "POST /reviews") {
      if (!reviewLimiter.allow(key)) {
        res.setHeader("Retry-After", String(reviewLimiter.retryAfterSecs(key)));
        sendJson(res, 429, { error: "rate limited — try again shortly" });
        return;
      }
    }
    switch (route) {
      case "GET /health":
        sendJson(res, 200, { ok: true, detector: detector.name });
        return;
      case "POST /detect":
        await handleDetect(req, res);
        return;
      case "POST /recipe":
        await handleRecipe(req, res);
        return;
      case "POST /reviews":
        await handlePostReview(req, res);
        return;
      case "GET /reviews":
        sendJson(res, 200, { aggregates: reviews.aggregates() });
        return;
      default:
        sendJson(res, 404, { error: `no route for ${route}` });
    }
  };
  handle().catch((err) => {
    // Log the real cause server-side; never leak it (could reveal keys/quota).
    logRequest({ id, route, status: 500, error: err instanceof Error ? err.message : String(err) });
    sendJson(res, 500, { error: "internal error" });
  });
});

server.listen(PORT, () => {
  console.log(`remy agent layer listening on http://localhost:${PORT}`);
  console.log(`  detector: ${detector.name}`);
  console.log(`  POST /detect   (raw image body)`);
  console.log(`  POST /recipe   (JSON { inventory, preference? })`);
  console.log(`  POST /reviews  (JSON { recipeId, recipeStars, remyStars, tags? })`);
  console.log(`  GET  /reviews  (aggregate ratings)`);
});
