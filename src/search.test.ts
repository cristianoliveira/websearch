import assert from "node:assert/strict";
import { test } from "node:test";
import type { SearchOptions } from "./search.ts";
import { buildCodexRequestBody, mapCodexResult } from "./search.ts";

const baseOpts: SearchOptions = {
  provider: "codex",
  numResults: 5,
  content: false,
  freshness: null,
  country: null,
};

// === mapCodexResult: text `output` -> single SearchResult ===

test("mapCodexResult returns one result with Codex title prefix and empty url", () => {
  const [r] = mapCodexResult("rust async", "Rust async is based on futures.", false);
  assert.equal(r.title, "Codex search: rust async");
  assert.equal(r.url, "");
  assert.ok(r.snippet.includes("futures"));
  assert.equal(r.age, null);
});

test("mapCodexResult snippet is truncated to ~500 (truncate appends '...')", () => {
  const [r] = mapCodexResult("q", "x".repeat(1000), false);
  assert.ok(r.snippet.length <= 503, `snippet was ${r.snippet.length}`);
  assert.ok(r.snippet.length < 1000);
});

test("mapCodexResult content is null unless includeContent", () => {
  assert.equal(mapCodexResult("q", "text", false)[0].content, null);
  assert.equal(mapCodexResult("q", "text", true)[0].content, "text");
});

test("mapCodexResult content is truncated to ~5000 (truncate appends '...')", () => {
  const [r] = mapCodexResult("q", "y".repeat(10000), true);
  assert.ok((r.content ?? "").length <= 5003, `content was ${(r.content ?? "").length}`);
  assert.ok((r.content ?? "").length < 10000);
});

test("mapCodexResult empty output returns no results", () => {
  assert.deepEqual(mapCodexResult("q", "", false), []);
  assert.deepEqual(mapCodexResult("q", null, false), []);
  assert.deepEqual(mapCodexResult("q", undefined, false), []);
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
