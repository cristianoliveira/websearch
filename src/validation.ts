import { UsageError } from "./errors.ts";

// === Pure validation functions ===
// All are synchronous, pure, and must be called before any dependency call.

const VALID_FRESHNESS = new Set(["day", "week", "month", "year"]);
const URL_PROTOCOLS = new Set(["http:", "https:"]);
const DEFAULT_MAX_COUNT = 20;

/** Validate and normalize search query. Non-empty, non-whitespace string. */
export function validateQuery(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new UsageError("search query must not be empty", "query", raw);
  }
  return trimmed;
}

/**
 * Validate result count. Must be a positive integer in [1, max].
 * Rejects non-integer, zero, negative, decimal, partial parses ("5x"), overflow.
 */
export function validateCount(raw: string, max = DEFAULT_MAX_COUNT): number {
  // Strict integer: must be digits only, no decimals, no leading +/-, no partial.
  if (!/^\d{1,9}$/.test(raw)) {
    throw new UsageError(`count must be a positive integer (1-${max})`, "count", raw, [`1-${max}`]);
  }

  const n = Number(raw);

  if (n < 1) {
    throw new UsageError(`count must be at least 1, got ${n}`, "count", raw, [`1-${max}`]);
  }

  if (n > max) {
    throw new UsageError(`count must be at most ${max}, got ${n}`, "count", raw, [`1-${max}`]);
  }

  return n;
}

/** Validate freshness period. Must be one of: day, week, month, year. Null passes through. */
export function validateFreshness(raw: string | null): string | null {
  if (raw === null || raw === undefined) return null;
  if (!VALID_FRESHNESS.has(raw)) {
    throw new UsageError(`freshness must be one of: day, week, month, year`, "freshness", raw, [
      "day",
      "week",
      "month",
      "year",
    ]);
  }
  return raw;
}

/**
 * Validate country code. Must be exactly two ASCII letters (ISO 3166-1 alpha-2).
 * Returns uppercase. Null passes through.
 */
export function validateCountry(raw: string | null): string | null {
  if (raw === null || raw === undefined) return null;
  if (!/^[A-Za-z]{2}$/.test(raw)) {
    throw new UsageError(
      "country must be a two-letter ISO 3166-1 alpha-2 code (e.g. US, DE)",
      "country",
      raw,
    );
  }
  return raw.toUpperCase();
}

/**
 * Validate URL for extraction. Must be absolute http/https URL with valid syntax.
 */
export function validateURL(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UsageError("URL must be a valid absolute URL (e.g. https://example.com)", "url", raw);
  }

  if (!URL_PROTOCOLS.has(parsed.protocol)) {
    throw new UsageError(
      `URL protocol must be http or https, got ${parsed.protocol.replace(":", "")}`,
      "url",
      raw,
      ["http://...", "https://..."],
    );
  }

  return parsed;
}
