import assert from "node:assert/strict";
import { test } from "node:test";
import { decode } from "@toon-format/toon";
import { error, success, textPreview } from "./contracts.ts";
import { renderJSON, renderTOON } from "./output.ts";

// === Shared test data ===

const searchEnvelope = success("search", {
  query: "rust async",
  provider: "brave",
  requestedCount: 5,
  returnedCount: 2,
  totalCount: null,
  results: [
    {
      title: "Async Rust",
      url: "https://example.com/1",
      snippet: "Rust async is...",
      content: null,
      age: null,
    },
    {
      title: "Tokio",
      url: "https://example.com/2",
      snippet: "Learn Tokio",
      content: null,
      age: "2024-01-15",
    },
  ],
});

const errorEnvelope = error("search", "INVALID_INPUT", "bad country", {
  field: "country",
  invalidValue: "MOON",
  validValues: ["US", "DE"],
});

const emptySearch = success("search", {
  query: "no-match",
  provider: "brave",
  requestedCount: 5,
  returnedCount: 0,
  totalCount: null,
  results: [],
});

// === renderTOON ===

test("renderTOON produces spec-compatible TOON string", () => {
  const output = renderTOON(searchEnvelope);
  // Must be decodable by @toon-format/toon
  const decoded = decode(output) as Record<string, unknown>;
  assert.equal(decoded.ok, true);
  assert.equal(decoded.command, "search");
  const data = decoded.data as Record<string, unknown>;
  assert.equal(data.query, "rust async");
  assert.equal(data.returnedCount, 2);
  assert.ok(Array.isArray(data.results));
});

test("renderTOON encodes error envelopes", () => {
  const output = renderTOON(errorEnvelope);
  const decoded = decode(output) as Record<string, unknown>;
  assert.equal(decoded.ok, false);
  const err = (decoded as Record<string, unknown>).error as Record<string, unknown>;
  assert.equal(err.code, "INVALID_INPUT");
  assert.equal(err.field, "country");
});

test("renderTOON handles empty arrays", () => {
  const output = renderTOON(emptySearch);
  const decoded = decode(output) as Record<string, unknown>;
  const data = decoded.data as Record<string, unknown>;
  assert.equal(data.returnedCount, 0);
});

test("renderTOON is deterministic", () => {
  const a = renderTOON(searchEnvelope);
  const b = renderTOON(searchEnvelope);
  assert.equal(a, b, "same input must produce byte-identical output");
});

// === renderJSON ===

test("renderJSON produces valid JSON with same semantic value as TOON", () => {
  const json = renderJSON(searchEnvelope);
  const parsed = JSON.parse(json);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, "search");

  // Verify same semantic value as TOON
  const toon = renderTOON(searchEnvelope);
  const fromToon = decode(toon);
  assert.deepEqual(parsed, fromToon);
});

test("renderJSON encodes errors", () => {
  const json = renderJSON(errorEnvelope);
  const parsed = JSON.parse(json);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, "INVALID_INPUT");
});

// === RenderFormat selector ===

test("renderTOON and renderJSON accept the same envelope type", () => {
  // Type-level check: both accept SuccessEnvelope
  const r1: string = renderTOON(searchEnvelope);
  const r2: string = renderJSON(searchEnvelope);
  assert.ok(r1.length > 0);
  assert.ok(r2.length > 0);
});

// === Text preview in search results ===

test("renderTOON includes truncated text preview metadata when present", () => {
  // Use extract envelope which has TextPreview
  const extractEnvelope = success("extract", {
    url: "https://example.com",
    title: "Test Page",
    content: textPreview("hello world", 100),
  });
  const output = renderTOON(extractEnvelope);
  const decoded = decode(output) as Record<string, unknown>;
  const data = decoded.data as Record<string, unknown>;
  const content = data.content as Record<string, unknown>;
  assert.equal(content.text, "hello world");
  assert.equal(content.truncated, false);
});
