import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateCount,
  validateCountry,
  validateFreshness,
  validateQuery,
  validateURL,
} from "./validation.ts";

// === validateQuery ===

test("validateQuery returns normalized query for non-empty string", () => {
  assert.equal(validateQuery("hello"), "hello");
  assert.equal(validateQuery("  hello world  "), "hello world");
});

test("validateQuery throws UsageError for empty string", () => {
  assert.throws(() => validateQuery(""), { name: "UsageError" });
});

test("validateQuery throws UsageError for whitespace-only", () => {
  assert.throws(() => validateQuery("   "), { name: "UsageError" });
});

// === validateCount ===

test("validateCount returns parsed integer for valid string", () => {
  assert.equal(validateCount("5"), 5);
  assert.equal(validateCount("1"), 1);
  assert.equal(validateCount("20"), 20);
});

test("validateCount throws UsageError for non-numeric", () => {
  assert.throws(() => validateCount("nope"), { name: "UsageError" });
  assert.throws(() => validateCount("5x"), { name: "UsageError" });
});

test("validateCount throws UsageError for decimal", () => {
  assert.throws(() => validateCount("5.5"), { name: "UsageError" });
});

test("validateCount throws UsageError for zero", () => {
  assert.throws(() => validateCount("0"), { name: "UsageError" });
});

test("validateCount throws UsageError for negative", () => {
  assert.throws(() => validateCount("-1"), { name: "UsageError" });
});

test("validateCount throws UsageError for above max (default 20)", () => {
  assert.throws(() => validateCount("21"), { name: "UsageError" });
});

test("validateCount accepts custom max", () => {
  assert.equal(validateCount("50", 100), 50);
  assert.throws(() => validateCount("101", 100), { name: "UsageError" });
});

// === validateFreshness ===

test("validateFreshness returns value for valid period", () => {
  assert.equal(validateFreshness("day"), "day");
  assert.equal(validateFreshness("week"), "week");
  assert.equal(validateFreshness("month"), "month");
  assert.equal(validateFreshness("year"), "year");
});

test("validateFreshness returns null for null/undefined", () => {
  assert.equal(validateFreshness(null), null);
});

test("validateFreshness throws UsageError for invalid period", () => {
  assert.throws(() => validateFreshness("century"), { name: "UsageError" });
  assert.throws(() => validateFreshness(""), { name: "UsageError" });
});

// === validateCountry ===

test("validateCountry uppercases valid ISO 3166-1 alpha-2", () => {
  assert.equal(validateCountry("us"), "US");
  assert.equal(validateCountry("DE"), "DE");
  assert.equal(validateCountry("gb"), "GB");
});

test("validateCountry returns null for null/undefined", () => {
  assert.equal(validateCountry(null), null);
});

test("validateCountry throws UsageError for non-two-letter", () => {
  assert.throws(() => validateCountry("USA"), { name: "UsageError" });
  assert.throws(() => validateCountry("u"), { name: "UsageError" });
});

test("validateCountry throws UsageError for non-alpha", () => {
  assert.throws(() => validateCountry("12"), { name: "UsageError" });
  assert.throws(() => validateCountry("U$"), { name: "UsageError" });
});

// === validateURL ===

test("validateURL returns URL for valid http/https", () => {
  const u = validateURL("https://example.com");
  assert.equal(u.protocol, "https:");
  assert.equal(u.hostname, "example.com");
});

test("validateURL accepts http", () => {
  const u = validateURL("http://example.com/path?q=1");
  assert.equal(u.protocol, "http:");
});

test("validateURL throws UsageError for unsupported protocol", () => {
  assert.throws(() => validateURL("ftp://example.com"), { name: "UsageError" });
  assert.throws(() => validateURL("file:///etc/passwd"), { name: "UsageError" });
});

test("validateURL throws UsageError for invalid URL syntax", () => {
  assert.throws(() => validateURL("not-a-url"), { name: "UsageError" });
  assert.throws(() => validateURL(""), { name: "UsageError" });
});
