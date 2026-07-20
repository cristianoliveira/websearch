import assert from "node:assert/strict";
import { after, test } from "node:test";
import { MissingCredentialError } from "./errors.ts";
import type { SearchOptions } from "./search.ts";
import { buildCodexRequestBody, getKey, mapCodexResult } from "./search.ts";

const baseOpts: SearchOptions = {
  provider: "codex",
  numResults: 5,
  content: false,
  freshness: null,
  country: null,
};

// === mapCodexResult: text `output` -> SearchPage ===

test("mapCodexResult returns one result with Codex title prefix and empty url", () => {
  const page = mapCodexResult("rust async", "Rust async is based on futures.", false);
  const r = page.results[0];
  assert.equal(r.title, "Codex search: rust async");
  assert.equal(r.url, "");
  assert.ok(r.snippet.includes("futures"));
  assert.equal(r.age, null);
  assert.equal(page.totalCount, null);
});

test("mapCodexResult snippet is truncated to ~500 (truncate appends '...')", () => {
  const r = mapCodexResult("q", "x".repeat(1000), false).results[0];
  assert.ok(r.snippet.length <= 503, `snippet was ${r.snippet.length}`);
  assert.ok(r.snippet.length < 1000);
});

test("mapCodexResult content is null unless includeContent", () => {
  assert.equal(mapCodexResult("q", "text", false).results[0].content, null);
  assert.equal(mapCodexResult("q", "text", true).results[0].content, "text");
});

test("mapCodexResult content is truncated to ~5000 (truncate appends '...')", () => {
  const r = mapCodexResult("q", "y".repeat(10000), true).results[0];
  assert.ok((r.content ?? "").length <= 5003, `content was ${(r.content ?? "").length}`);
  assert.ok((r.content ?? "").length < 10000);
});

test("mapCodexResult empty output returns empty page", () => {
  assert.deepEqual(mapCodexResult("q", "", false), { results: [], totalCount: null });
  assert.deepEqual(mapCodexResult("q", null, false), { results: [], totalCount: null });
  assert.deepEqual(mapCodexResult("q", undefined, false), { results: [], totalCount: null });
});

// === buildCodexRequestBody: SearchRequest body ===

test("buildCodexRequestBody includes model, search_query, settings, max_output_tokens", () => {
  const body = buildCodexRequestBody("hello", baseOpts);
  assert.equal(body.model, "gpt-5.4");
  assert.deepEqual(body.commands, { search_query: [{ q: "hello" }] });
  const settings = body.settings as Record<string, unknown>;
  assert.equal(settings.external_web_access, true);
  assert.equal(settings.search_context_size, "medium");
  assert.equal(body.max_output_tokens, 2500);
});

test("buildCodexRequestBody maps freshness week -> recency 7", () => {
  const body = buildCodexRequestBody("hello", { ...baseOpts, freshness: "week" });
  const sq = (body.commands as { search_query: Record<string, unknown>[] }).search_query[0];
  assert.equal(sq.recency, 7);
});

test("buildCodexRequestBody omits recency when no freshness", () => {
  const body = buildCodexRequestBody("hello", baseOpts);
  const sq = (body.commands as { search_query: Record<string, unknown>[] }).search_query[0];
  assert.equal("recency" in sq, false);
});

test("buildCodexRequestBody maps country -> user_location (uppercased)", () => {
  const body = buildCodexRequestBody("hello", { ...baseOpts, country: "de" });
  const settings = body.settings as Record<string, { country: string }>;
  assert.deepEqual(settings.user_location, { type: "approximate", country: "DE" });
});

// === getKey: credential lookup (throws MissingCredentialError, never exits) ===

const SAVED_ENV = { ...process.env };

after(() => {
  process.env = SAVED_ENV;
});

test("getKey throws MissingCredentialError when env var is absent", () => {
  delete process.env.BRAVE_API_KEY;
  assert.throws(
    () => getKey("brave"),
    MissingCredentialError,
    "getKey should throw MissingCredentialError",
  );
});

test("getKey MissingCredentialError contains provider, envVar, signupUrl", () => {
  delete process.env.BRAVE_API_KEY;
  try {
    getKey("brave");
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e instanceof MissingCredentialError);
    const err = e as MissingCredentialError;
    assert.equal(err.provider, "brave");
    assert.equal(err.envVar, "BRAVE_API_KEY");
    assert.ok(err.signupUrl.includes("brave.com"));
  }
});

test("getKey does not call process.exit", () => {
  delete process.env.BRAVE_API_KEY;
  // If process.exit were called, this test would die.
  // getKey now throws MissingCredentialError instead.
  assert.throws(() => getKey("brave"), MissingCredentialError);
});
