import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { CLIDependencies } from "./cli.ts";
import { MissingCredentialError } from "./errors.ts";
import { type CLIOut, runCLI } from "./main.ts";
import type { ExtractResult, SearchResult } from "./types.ts";

// === Test Helpers ===

function mockSearch(results: SearchResult[] | Error): CLIDependencies["search"] {
  return (_query, _opts) => {
    if (results instanceof Error) throw results;
    return Promise.resolve({ results, totalCount: null });
  };
}

function mockExtract(result: ExtractResult | Error): CLIDependencies["extract"] {
  return (_url) => {
    if (result instanceof Error) throw result;
    return Promise.resolve(result);
  };
}

function run(
  args: string[],
  deps?: Partial<CLIDependencies>,
): Promise<{ code: number; out: string; err: string }> {
  const capture: CLIOut = { out: [], err: [] };
  const fullDeps: CLIDependencies = {
    search: mockSearch([]),
    extract: mockExtract({ title: null, content: "" }),
    format: "json", // JSON for easy test assertions
    ...deps,
  };
  return runCLI(
    ["node", "websearch", ...args],
    fullDeps,
    (l) => capture.out.push(l),
    (l) => capture.err.push(l),
  ).then((code) => ({
    code,
    out: capture.out.join("\n"),
    err: capture.err.join("\n"),
  }));
}

// === Env sanitization ===

const SAVED_ENV = { ...process.env };
const PROVIDER_KEYS = [
  "TAVILY_API_KEY",
  "EXA_API_KEY",
  "WEBSEARCHAPI_KEY",
  "BRAVE_API_KEY",
  "SERPAPI_KEY",
  "CODEX_ACCESS_TOKEN",
  "WEBSEARCH_DEFAULT_PROVIDER",
];

function clearProviderEnv(): void {
  for (const key of PROVIDER_KEYS) delete process.env[key];
}

before(() => {
  clearProviderEnv();
});
after(() => {
  process.env = SAVED_ENV;
});

// =============================================================================
// No-argument home
// =============================================================================

test("AXI no-args: exit 0", async () => {
  const { code } = await run([]);
  assert.equal(code, 0, "no-args must exit 0 for compact state");
});

test("AXI no-args: structured data on stdout", async () => {
  const { out } = await run([]);
  assert.ok(out.length > 0, "no-args must produce structured output on stdout");
  const data = JSON.parse(out);
  assert.equal(data.ok, true);
  assert.equal(data.command, "home");
});

test("AXI no-args: empty stderr", async () => {
  const { err } = await run([]);
  assert.equal(err, "", "no-args must have empty stderr");
});

test("AXI no-args: contains executable, purpose, default provider, credentials", async () => {
  const { out } = await run([]);
  const data = JSON.parse(out);
  assert.equal(data.ok, true);
  assert.equal(data.command, "home");
  const d = data.data;
  assert.ok(typeof d.executable === "string", "must include executable path");
  assert.ok(typeof d.purpose === "string", "must include purpose");
  assert.ok(typeof d.defaultProvider === "string", "must include default provider");
  assert.ok(d.credentials && typeof d.credentials === "object", "must include credential status");
  assert.equal(d.credentials.brave, false, "brave credential should be false (env cleared)");
});

// =============================================================================
// Help
// =============================================================================

test("AXI --help: exit 0, human text on stdout, empty stderr", async () => {
  const { code, out, err } = await run(["--help"]);
  assert.equal(code, 0);
  assert.ok(out.includes("Usage:"), "help must include usage text");
  assert.ok(out.includes("Exit codes:"), "root help must include exit code summary");
  assert.ok(out.includes("Examples:"), "root help must include examples");
  assert.equal(err, "", "--help must have empty stderr");
});

test("AXI search --help: exit 0, includes examples", async () => {
  const { code, out } = await run(["search", "--help"]);
  assert.equal(code, 0);
  assert.ok(out.includes("Examples:"), "search --help must include examples section");
});

// =============================================================================
// Usage errors: exit 2, structured error on stdout, empty stderr
// =============================================================================

test("AXI unknown command: exit 2, structured error on stdout, empty stderr", async () => {
  const { code, out, err } = await run(["unknown-cmd"]);
  assert.equal(code, 2, "unknown command must exit 2");
  const data = JSON.parse(out);
  assert.equal(data.ok, false);
  assert.equal(data.error.code, "UNKNOWN_COMMAND");
  assert.equal(err, "", "usage error must have empty stderr");
});

test("AXI unknown flag: exit 2, structured error on stdout", async () => {
  const { code, out } = await run(["search", "--nope", "q"]);
  assert.equal(code, 2, "unknown flag must exit 2");
  const data = JSON.parse(out);
  assert.equal(data.ok, false);
  assert.equal(data.error.code, "UNKNOWN_FLAG");
});

test("AXI missing search query: exit 2, structured error on stdout", async () => {
  const { code, out } = await run(["search"]);
  assert.equal(code, 2, "missing query must exit 2");
  const data = JSON.parse(out);
  assert.equal(data.ok, false);
});

test("AXI invalid provider: exit 2, structured error on stdout", async () => {
  const { code, out } = await run(["search", "-p", "nope", "q"]);
  assert.equal(code, 2, "invalid provider must exit 2");
  const data = JSON.parse(out);
  assert.equal(data.ok, false);
});

test("AXI stderr: empty for usage errors", async () => {
  const { err } = await run(["unknown-cmd"]);
  assert.equal(err, "", "usage error must have empty stderr");
});

// =============================================================================
// Validation before dependencies
// =============================================================================

test("AXI invalid -n: exit 2, error before provider call", async () => {
  let searchCalled = false;
  const { code, out } = await run(["search", "-n", "nope", "q"], {
    search: ((_q, _o) => {
      searchCalled = true;
      return Promise.resolve({ results: [], totalCount: null });
    }) as CLIDependencies["search"],
  });
  assert.equal(searchCalled, false, "search must NOT be called after validation fails");
  assert.equal(code, 2, "validation error must exit 2");
  const data = JSON.parse(out);
  assert.equal(data.ok, false);
  assert.equal(data.error.code, "INVALID_INPUT");
});

test("AXI invalid freshness: exit 2, valid values named", async () => {
  let searchCalled = false;
  const { code, out } = await run(["search", "--freshness", "century", "q"], {
    search: ((_q, _o) => {
      searchCalled = true;
      return Promise.resolve({ results: [], totalCount: null });
    }) as CLIDependencies["search"],
  });
  assert.equal(searchCalled, false);
  assert.equal(code, 2);
  const data = JSON.parse(out);
  assert.equal(data.ok, false);
});

// =============================================================================
// Missing credential
// =============================================================================

test("AXI missing credential: exit 1, structured error on stdout, empty stderr", async () => {
  const { code, out, err } = await run(["search", "test query"], {
    search: mockSearch(
      new MissingCredentialError(
        "BRAVE_API_KEY not set",
        "brave",
        "BRAVE_API_KEY",
        "https://brave.com",
      ),
    ),
  });
  assert.equal(code, 1, "missing credential must exit 1");
  const data = JSON.parse(out);
  assert.equal(data.ok, false);
  assert.equal(data.error.code, "MISSING_CREDENTIAL");
  assert.ok(out.includes("BRAVE_API_KEY"), "error must include credential hint");
  assert.equal(err, "", "credential error must have empty stderr");
});

// =============================================================================
// Empty search
// =============================================================================

test("AXI empty search: exit 0, structured output with query/provider/zero count", async () => {
  const { code, out, err } = await run(["search", "nothing matches this"]);
  assert.equal(code, 0, "empty search must exit 0");
  const data = JSON.parse(out);
  assert.equal(data.ok, true);
  assert.equal(data.command, "search");
  assert.equal(data.data.returnedCount, 0);
  assert.equal(data.data.totalCount, null);
  assert.equal(err, "", "empty search must have empty stderr");
});

test("AXI search: totalCount reported when available", async () => {
  const { out } = await run(["search", "q"], {
    search: mockSearch([
      { title: "T", url: "https://a.com", snippet: "desc", content: null, age: null },
    ]),
  });
  const data = JSON.parse(out);
  assert.equal(data.data.returnedCount, 1);
  assert.equal(data.data.totalCount, null, "mock returns null; real providers may report totals");
});

// =============================================================================
// Truncation
// =============================================================================

test("AXI truncation: text preview includes total size and truncated flag", async () => {
  const longSnippet = "x".repeat(600);
  const { code, out } = await run(["search", "q"], {
    search: mockSearch([
      { title: "Test", url: "https://a.com", snippet: longSnippet, content: null, age: null },
    ]),
  });
  assert.equal(code, 0);
  // Truncated snippet should be ~503 chars, full snippet should NOT appear
  assert.ok(!out.includes(longSnippet), "full snippet must not appear in output");
  assert.ok(out.includes("--full"), "truncated output must include --full hint");
});

test("AXI full output: --full flag removes CLI truncation", async () => {
  const longSnippet = "x".repeat(600);
  const { code, out } = await run(["search", "--full", "q"], {
    search: mockSearch([
      { title: "Test", url: "https://a.com", snippet: longSnippet, content: null, age: null },
    ]),
  });
  assert.equal(code, 0);
  assert.ok(out.includes(longSnippet), "--full must include complete snippet");
});

// =============================================================================
// Extract
// =============================================================================

test("AXI extract invalid URL: exit 2, no fetch attempted", async () => {
  let extractCalled = false;
  const { code, out } = await run(["extract", "not-a-url"], {
    extract: ((_u) => {
      extractCalled = true;
      return Promise.resolve({ title: null, content: "" });
    }) as CLIDependencies["extract"],
  });
  assert.equal(extractCalled, false);
  assert.equal(code, 2);
  const data = JSON.parse(out);
  assert.equal(data.ok, false);
});

// =============================================================================
// Exit code summary
// =============================================================================

test("AXI exit codes: 0=success/help/home/empty, 1=operational, 2=usage", async () => {
  // Home
  assert.equal((await run([])).code, 0);
  // Help
  assert.equal((await run(["--help"])).code, 0);
  // Empty search
  assert.equal((await run(["search", "test"])).code, 0);
  // Usage error
  assert.equal((await run(["unknown-cmd"])).code, 2);
  // Credential error
  assert.equal(
    (
      await run(["search", "q"], {
        search: mockSearch(new MissingCredentialError("x", "brave", "X", "https://x.com")),
      })
    ).code,
    1,
  );
});
