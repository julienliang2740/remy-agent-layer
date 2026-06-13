import { Platform } from "react-native";

/**
 * Tiny persistence helper. On web it's localStorage (survives refresh — the
 * MVP target); on native it falls back to in-memory until AsyncStorage is
 * added. All values are JSON; failures fall back silently so storage can
 * never crash the app.
 */
const mem = new Map<string, string>();

function readRaw(key: string): string | null {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    return localStorage.getItem(key);
  }
  return mem.get(key) ?? null;
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = readRaw(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    const raw = JSON.stringify(value);
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem(key, raw);
    } else {
      mem.set(key, raw);
    }
  } catch {
    // best-effort — never crash on storage
  }
}
