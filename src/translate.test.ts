import assert from "node:assert/strict";
import { test } from "node:test";
import { OpCode } from "./errors.ts";
import { boundedBody, fetchErrorToOpCode, redactSecrets } from "./translate.ts";

// === redactSecrets ===

test("redactSecrets removes bearer tokens", () => {
  const input = "Authorization: Bearer sk-12345abcdef";
  const result = redactSecrets(input);
  assert.ok(!result.includes("sk-12345abcdef"), "bearer token must be redacted");
  assert.ok(result.includes("[REDACTED]"), "must indicate redaction");
});

test("redactSecrets removes api_key query params", () => {
  const input = "https://api.example.com?api_key=secret123&q=test";
  const result = redactSecrets(input);
  assert.ok(!result.includes("secret123"), "api_key value must be redacted");
  assert.ok(result.includes("https://api.example.com"), "URL structure preserved");
});

test("redactSecrets removes x-api-key headers", () => {
  const result = redactSecrets("x-api-key: abc-def-ghi");
  assert.ok(!result.includes("abc-def-ghi"));
});

test("redactSecrets passes through benign text unchanged", () => {
  const input = "Status: 200 OK\nContent-Type: application/json";
  assert.equal(redactSecrets(input), input);
});

test("redactSecrets handles empty string", () => {
  assert.equal(redactSecrets(""), "");
});

// === boundedBody ===

test("boundedBody returns full text when under max", () => {
  assert.equal(boundedBody("hello", 100), "hello");
});

test("boundedBody truncates with size info when over max", () => {
  const result = boundedBody("x".repeat(500), 100);
  assert.ok(result.length < 200, "truncated result should be reasonable");
  assert.ok(result.includes("500"), "must include total size");
  assert.ok(result.includes("truncated") || result.includes("..."), "must indicate truncation");
});

test("boundedBody returns empty string for empty input", () => {
  assert.equal(boundedBody("", 100), "");
});

// === fetchErrorToOpCode ===

test("fetchErrorToOpCode maps 401/403 to AUTHENTICATION_FAILED", () => {
  assert.equal(fetchErrorToOpCode(401), OpCode.AUTHENTICATION_FAILED);
  assert.equal(fetchErrorToOpCode(403), OpCode.AUTHENTICATION_FAILED);
});

test("fetchErrorToOpCode maps 429 to RATE_LIMITED", () => {
  assert.equal(fetchErrorToOpCode(429), OpCode.RATE_LIMITED);
});

test("fetchErrorToOpCode maps 5xx to PROVIDER_UNAVAILABLE", () => {
  assert.equal(fetchErrorToOpCode(500), OpCode.PROVIDER_UNAVAILABLE);
  assert.equal(fetchErrorToOpCode(502), OpCode.PROVIDER_UNAVAILABLE);
  assert.equal(fetchErrorToOpCode(503), OpCode.PROVIDER_UNAVAILABLE);
});

test("fetchErrorToOpCode maps 4xx to INVALID_PROVIDER_RESPONSE", () => {
  assert.equal(fetchErrorToOpCode(400), OpCode.INVALID_PROVIDER_RESPONSE);
  assert.equal(fetchErrorToOpCode(404), OpCode.INVALID_PROVIDER_RESPONSE);
});

test("fetchErrorToOpCode maps timeout/abort to PROVIDER_TIMEOUT", () => {
  const abortError = new DOMException("The operation was aborted", "AbortError");
  assert.equal(fetchErrorToOpCode(abortError), OpCode.PROVIDER_TIMEOUT);
});

test("fetchErrorToOpCode maps TypeError (network failure) to PROVIDER_UNAVAILABLE", () => {
  const netError = new TypeError("fetch failed");
  assert.equal(fetchErrorToOpCode(netError), OpCode.PROVIDER_UNAVAILABLE);
});

test("fetchErrorToOpCode maps unknown errors to PROVIDER_UNAVAILABLE", () => {
  assert.equal(fetchErrorToOpCode(new Error("something")), OpCode.PROVIDER_UNAVAILABLE);
});
