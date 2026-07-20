import assert from "node:assert/strict";
import { test } from "node:test";
import { error, success, textPreview } from "./contracts.ts";

// === success ===

test("success creates envelope with ok=true and command", () => {
  const e = success("search", { query: "test" });
  assert.equal(e.ok, true);
  assert.equal(e.command, "search");
  assert.deepEqual(e.data, { query: "test" });
  assert.deepEqual(e.hints, []);
});

test("success includes optional hints", () => {
  const e = success("extract", {}, [
    { command: "websearch extract --full URL", reason: "for full content" },
  ]);
  assert.equal(e.hints.length, 1);
  assert.equal(e.hints[0].command, "websearch extract --full URL");
});

// === error ===

test("error creates envelope with ok=false and error info", () => {
  const e = error("search", "INVALID_INPUT", "bad field");
  assert.equal(e.ok, false);
  assert.equal(e.command, "search");
  assert.equal(e.error.code, "INVALID_INPUT");
  assert.equal(e.error.message, "bad field");
  assert.equal(e.error.field, undefined);
});

test("error includes optional extra fields", () => {
  const e = error("search", "INVALID_INPUT", "bad country", {
    field: "country",
    invalidValue: "MOON",
    validValues: ["US", "DE"],
  });
  assert.equal(e.error.field, "country");
  assert.equal(e.error.invalidValue, "MOON");
  assert.deepEqual(e.error.validValues, ["US", "DE"]);
});

test("error includes recovery hint", () => {
  const e = error(null, "MISSING_CREDENTIAL", "BRAVE_API_KEY not set", {
    recovery: { command: "export BRAVE_API_KEY=...", reason: "get key at https://brave.com" },
  });
  assert.equal(e.error.recovery?.command, "export BRAVE_API_KEY=...");
});

// === textPreview ===

test("textPreview returns untruncated for small text", () => {
  const p = textPreview("hello", 100);
  assert.equal(p.text, "hello");
  assert.equal(p.totalChars, 5);
  assert.equal(p.truncated, false);
});

test("textPreview truncates large text with metadata", () => {
  const p = textPreview("x".repeat(100), 50);
  assert.ok(p.text.length <= 53, `expected <= 53, got ${p.text.length}`);
  assert.equal(p.totalChars, 100);
  assert.equal(p.truncated, true);
});
