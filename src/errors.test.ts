import assert from "node:assert/strict";
import { test } from "node:test";
import { MissingCredentialError, OpCode, OperationalError, UsageError } from "./errors.ts";

// === UsageError ===

test("UsageError stores field, invalidValue, validValues", () => {
  const e = new UsageError("bad field", "country", "MOON", ["us", "de"]);
  assert.equal(e.message, "bad field");
  assert.equal(e.field, "country");
  assert.equal(e.invalidValue, "MOON");
  assert.deepEqual(e.validValues, ["us", "de"]);
  assert.equal(e.name, "UsageError");
});

test("UsageError optional fields default to undefined", () => {
  const e = new UsageError("nope");
  assert.equal(e.field, undefined);
  assert.equal(e.invalidValue, undefined);
  assert.equal(e.validValues, undefined);
});

// === MissingCredentialError ===

test("MissingCredentialError stores provider, envVar, signupUrl", () => {
  const e = new MissingCredentialError(
    "BRAVE_API_KEY not set",
    "brave",
    "BRAVE_API_KEY",
    "https://api-dashboard.search.brave.com",
  );
  assert.equal(e.provider, "brave");
  assert.equal(e.envVar, "BRAVE_API_KEY");
  assert.equal(e.signupUrl, "https://api-dashboard.search.brave.com");
  assert.equal(e.name, "MissingCredentialError");
});

// === OperationalError ===

test("OperationalError stores code and optional cause", () => {
  const cause = new Error("fetch failed");
  const e = new OperationalError("Brave returned 500", OpCode.PROVIDER_UNAVAILABLE, cause);
  assert.equal(e.message, "Brave returned 500");
  assert.equal(e.code, OpCode.PROVIDER_UNAVAILABLE);
  assert.equal(e.cause, cause);
  assert.equal(e.name, "OperationalError");
});

test("OperationalError cause defaults to undefined", () => {
  const e = new OperationalError("timeout", OpCode.PROVIDER_TIMEOUT);
  assert.equal(e.code, OpCode.PROVIDER_TIMEOUT);
  assert.equal(e.cause, undefined);
});
