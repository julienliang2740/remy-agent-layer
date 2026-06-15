/**
 * CORS origin allowlisting. The model-backed endpoints cost money, so we never
 * reflect an arbitrary Origin — only origins on the allowlist get an
 * Access-Control-Allow-Origin header back. Configure extra origins (e.g. the
 * deployed web app) via REMY_ALLOWED_ORIGINS (comma-separated).
 */
export const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8082", // Expo web
  "http://localhost:8081",
  "http://localhost:5173", // Vite website dev
  "http://localhost:4173", // Vite/serve preview
];

/** Parse the env allowlist + defaults into a deduped list. */
export function allowedOrigins(env?: string): string[] {
  const extra = (env ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra])];
}

/**
 * Returns the Origin to echo in Access-Control-Allow-Origin, or null when the
 * request's Origin is not allowed (header is then omitted → browser blocks it).
 * A missing Origin (curl, same-origin, server-to-server) returns null and is
 * simply un-annotated — those callers don't enforce CORS anyway.
 */
export function corsOrigin(origin: string | undefined, allow: string[]): string | null {
  if (!origin) return null;
  return allow.includes(origin) ? origin : null;
}
