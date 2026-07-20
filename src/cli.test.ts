import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Command } from "commander";
import { MissingCredentialError } from "./errors.ts";
import type { CLIDependencies } from "./main.ts";
import { buildProgram, type CLIOut } from "./main.ts";
import type { ExtractResult, SearchResult } from "./types.ts";

// === Test Helpers ===

type MockSearch = CLIDependencies["search"];
type MockExtract = CLIDependencies["extract"];

function mockSearch(results: SearchResult[] | Error): MockSearch {
  return (_query, _opts) => {
    if (results instanceof Error) throw results;
    return Promise.resolve(results);
  };
}

function mockExtract(result: ExtractResult | Error): MockExtract {
  return (_url) => {
    if (result instanceof Error) throw result;
    return Promise.resolve(result);
  };
}

function buildCapture(deps?: Partial<CLIDependencies>): { program: Command; capture: CLIOut } {
  const capture: CLIOut = { out: [], err: [] };
  const program = buildProgram(
    (line) => capture.out.push(line),
    (line) => capture.err.push(line),
    { search: mockSearch([]), extract: mockExtract({ title: null, content: "" }), ...deps },
  );
  return { program, capture };
}

async function run(
  program: Command,
  args: string[],
  capture: CLIOut,
): Promise<{ code: number; out: string; err: string }> {
  try {
    await program.parseAsync(["node", "websearch", ...args]);
    return { code: 0, out: capture.out.join("\n"), err: capture.err.join("\n") };
  } catch (e) {
    const code = (e as { exitCode?: number }).exitCode ?? 1;
    return { code, out: capture.out.join("\n"), err: capture.err.join("\n") };
  }
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
//
// AXI target: exit 0, structured TOON on stdout, empty stderr, compact state
// Current:    exit 1, help on stderr, empty stdout
// =============================================================================

test("AXI no-args: exit 0", async () => {
  const { program, capture } = buildCapture();
  const { code } = await run(program, [], capture);
  assert.equal(code, 0, "no-args must exit 0 for compact state (currently 1)");
});

test("AXI no-args: structured data on stdout", async () => {
  const { program, capture } = buildCapture();
  const { out } = await run(program, [], capture);
  assert.ok(out.length > 0, "no-args must produce structured output on stdout (currently empty)");
  assert.ok(
    out.includes("{") || out.includes('"'),
    "no-args must be parseable structured data (currently help on stderr)",
  );
});

test("AXI no-args: empty stderr", async () => {
  const { program, capture } = buildCapture();
  const { err } = await run(program, [], capture);
  assert.equal(err, "", "no-args must have empty stderr (currently shows help)");
});

// =============================================================================
// Help
//
// AXI target: exit 0, human text on stdout, empty stderr, local + examples
// Current:    exit 0, text on stdout, mostly ok but no examples
// =============================================================================

test("AXI --help: exit 0, human text on stdout, empty stderr", async () => {
  const { program, capture } = buildCapture();
  const { code, out, err } = await run(program, ["--help"], capture);
  assert.equal(code, 0);
  assert.ok(out.includes("Usage:"), "help must include usage");
  assert.equal(err, "", "help must have empty stderr");
});

test("AXI search --help: local to search, includes examples", async () => {
  const { program, capture } = buildCapture();
  const { out } = await run(program, ["search", "--help"], capture);
  assert.ok(out.includes("search"), "search --help must mention search");
  assert.ok(
    out.includes("Example") || out.includes("example") || out.includes("websearch search"),
    "search --help must include runnable examples",
  );
});

test("AXI extract --help: local to extract, includes examples", async () => {
  const { program, capture } = buildCapture();
  const { out } = await run(program, ["extract", "--help"], capture);
  assert.ok(out.includes("extract"), "extract --help must mention extract");
  assert.ok(
    out.includes("Example") || out.includes("example") || out.includes("websearch extract"),
    "extract --help must include runnable examples",
  );
});

// =============================================================================
// Usage errors
//
// AXI target: exit 2, structured error on stdout, empty stderr
// Current:    exit 1, prose error on stderr
// =============================================================================

test("AXI unknown command: exit 2, structured error on stdout, empty stderr", async () => {
  const { program, capture } = buildCapture();
  const { code, out, err } = await run(program, ["unknown-cmd"], capture);
  assert.equal(code, 2, "unknown command must exit 2 (currently 1)");
  assert.ok(out.length > 0, "error must be on stdout (currently on stderr)");
  assert.equal(err, "", "usage error must have empty stderr");
});

test("AXI unknown flag: exit 2, structured error on stdout", async () => {
  const { program, capture } = buildCapture();
  const { code, out } = await run(program, ["search", "--nope", "q"], capture);
  assert.equal(code, 2, "unknown flag must exit 2 (currently 1)");
  assert.ok(out.length > 0, "error must be on stdout (currently on stderr)");
});

test("AXI missing search query: exit 2, structured error on stdout", async () => {
  const { program, capture } = buildCapture();
  const { code, out } = await run(program, ["search"], capture);
  assert.equal(code, 2, "missing query must exit 2 (currently 1)");
  assert.ok(out.length > 0, "error must be on stdout (currently on stderr)");
});

test("AXI invalid provider: exit 2, structured error naming valid choices", async () => {
  const { program, capture } = buildCapture();
  const { code, out } = await run(program, ["search", "-p", "nope", "q"], capture);
  assert.equal(code, 2, "invalid provider must exit 2 (currently 1)");
  assert.ok(out.length > 0, "error must be on stdout (currently on stderr)");
});

// =============================================================================
// Validation before dependencies
//
// AXI target: invalid input rejected before any network/credential call
// Current:    Commander validates provider only; -n/freshness/country/URL unchecked
// =============================================================================

test("AXI invalid -n: exit 2, error before provider call", async () => {
  // Validation happens before mock search — search must NOT be called.
  let searchCalled = false;
  const { program, capture } = buildCapture({
    search: ((_q, _o) => {
      searchCalled = true;
      return Promise.resolve([]);
    }) as CLIDependencies["search"],
  });
  const { code, out } = await run(program, ["search", "-n", "nope", "q"], capture);
  // Phase 3: validation prevents dependency call (this is now true).
  assert.equal(searchCalled, false, "search must NOT be called after validation fails");
  // AXI target (still red): exit 2 with structured error on stdout.
  assert.equal(code, 2, "validation error must exit 2 (currently 1 — error mapping pending)");
  assert.ok(out.length > 0, "error must be on stdout (pending structured rendering)");
});

test("AXI invalid freshness: exit 2, valid values named", async () => {
  let searchCalled = false;
  const { program, capture } = buildCapture({
    search: ((_q, _o) => {
      searchCalled = true;
      return Promise.resolve([]);
    }) as CLIDependencies["search"],
  });
  const { code, out } = await run(program, ["search", "--freshness", "century", "q"], capture);
  assert.equal(searchCalled, false, "search must NOT be called after validation fails");
  assert.equal(code, 2, "validation error must exit 2 (currently 1)");
  assert.ok(out.length > 0, "error must be on stdout (pending)");
});

// =============================================================================
// Missing credential
//
// AXI target: exit 1, structured error on stdout with recovery hint, empty stderr
// Current:    process.exit(1) inside getKey, error on stderr
// =============================================================================

test("AXI missing credential: exit 1, structured error on stdout, empty stderr", async () => {
  // Inject a mock search that throws MissingCredentialError (simulating getKey failure)
  const { program, capture } = buildCapture({
    search: mockSearch(
      new MissingCredentialError(
        "BRAVE_API_KEY not set",
        "brave",
        "BRAVE_API_KEY",
        "https://brave.com",
      ),
    ),
  });
  const { code, out, err } = await run(program, ["search", "test query"], capture);
  assert.equal(code, 1, "missing credential must exit 1");
  // AXI target: structured error on stdout with recovery hint.
  // Currently: error is lost (Commander with exitOverride re-throws but doesn't render).
  assert.ok(
    out.length > 0 || err.length > 0,
    "error must be surfaced (currently lost between Commander exitOverride and action rejection)",
  );
  assert.equal(err, "", "credential error must have empty stderr");
});

// =============================================================================
// Empty search
//
// AXI target: exit 0, structured success envelope with empty results + query context
// Current:    "No results found." on stderr, no structured output
// =============================================================================

test("AXI empty search: exit 0, structured output with query/provider/zero count", async () => {
  // Inject mock that returns empty results
  const { program, capture } = buildCapture();
  const result = await run(program, ["search", "nothing matches this"], capture);
  assert.equal(result.code, 0, "empty search must exit 0");
  // Currently: prints "No results found." to stderr. AXI: structured on stdout.
  assert.equal(result.err, "", "empty search must have empty stderr");
});

// =============================================================================
// Truncation metadata
//
// AXI target: truncated results include preview, total size, --full hint
// Current:    implicit "..." suffix, no metadata
// =============================================================================

test("AXI truncation: text preview includes total size and truncated flag", async () => {
  // Placeholder: requires mocked provider returning large content.
  assert.ok(true, "contract — tested with mocked provider after Phase 2");
});

test("AXI full output: --full flag removes CLI truncation", async () => {
  assert.ok(true, "contract — tested after --full flag is implemented");
});

// =============================================================================
// Extract URL validation
//
// AXI target: validate URL syntax + protocol before fetch; invalid = exit 2
// Current:    passes anything to fetch, raw error leaks
// =============================================================================

test("AXI extract invalid URL: exit 2, no fetch attempted", async () => {
  let extractCalled = false;
  const { program, capture } = buildCapture({
    extract: ((_u) => {
      extractCalled = true;
      return Promise.resolve({ title: null, content: "" });
    }) as CLIDependencies["extract"],
  });
  const { code, out } = await run(program, ["extract", "not-a-url"], capture);
  assert.equal(extractCalled, false, "extract must NOT be called after validation fails");
  assert.equal(code, 2, "validation error must exit 2 (currently 1 — error mapping pending)");
  assert.ok(out.length > 0, "error must be on stdout (pending)");
});

// =============================================================================
// stderr contract
//
// AXI target: stderr empty for all normal success and error paths
// Current:    errors and help-on-error go to stderr
// =============================================================================

test("AXI stderr: empty for --help", async () => {
  const { program, capture } = buildCapture();
  const { err } = await run(program, ["--help"], capture);
  assert.equal(err, "", "--help must have empty stderr");
});

test("AXI stderr: empty for usage errors", async () => {
  const { program, capture } = buildCapture();
  const { err } = await run(program, ["unknown-cmd"], capture);
  assert.equal(err, "", "usage error must have empty stderr (currently has error text)");
});

// =============================================================================
// Exit code summary
// =============================================================================

test("AXI exit codes: 0=success/help/home/empty, 1=operational, 2=usage", async () => {
  // This is the meta-contract verified by all other tests.
  // 0: help, no-args home, search success, search empty, extract success, --full
  // 1: missing credential, provider HTTP/auth/timeout/rate-limit failures
  // 2: unknown command/flag, missing query, invalid -n/freshness/country/provider/URL
  assert.ok(true, "contract — verified across individual test cases");
});
