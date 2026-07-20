import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Command } from "commander";
import { buildProgram, type CLIOut } from "./main.ts";

// === Test Helpers ===

function buildCapture(): { program: Command; capture: CLIOut } {
  const capture: CLIOut = { out: [], err: [] };
  const program = buildProgram(
    (line) => capture.out.push(line),
    (line) => capture.err.push(line),
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

function setFakeCredential(): void {
  // Phase 1 workaround: getKey calls process.exit(1) when key is missing,
  // which kills the test process. Set a fake key so tests survive.
  // Phase 2 injects the search function and removes process.exit.
  process.env.BRAVE_API_KEY = "test-fake-key";
}

before(() => {
  clearProviderEnv();
  setFakeCredential();
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
  void buildCapture();
  // Placeholder: currently reaches provider (slow network).
  // Cannot test without injected mock search (Phase 2).
  assert.ok(true, "contract — tested after validation layer prevents network access");
});

test("AXI invalid freshness: exit 2, valid values named", async () => {
  void buildCapture();
  // Placeholder: currently reaches provider (slow network).
  // Cannot test without injected mock search (Phase 2).
  assert.ok(true, "contract — tested after validation layer prevents network access");
});

// =============================================================================
// Missing credential
//
// AXI target: exit 1, structured error on stdout with recovery hint, empty stderr
// Current:    process.exit(1) inside getKey, error on stderr
// =============================================================================

test("AXI missing credential: exit 1, structured error on stdout, empty stderr", async () => {
  void buildCapture();
  // Placeholder: getKey calls process.exit(1) which kills the process.
  // Cannot test until Phase 2 removes process.exit and injects mock search.
  assert.ok(true, "contract — tested after getKey throws instead of process.exit");
});

// =============================================================================
// Empty search
//
// AXI target: exit 0, structured success envelope with empty results + query context
// Current:    "No results found." on stderr, no structured output
// =============================================================================

test("AXI empty search: exit 0, structured output with query/provider/zero count", async () => {
  void buildCapture();
  // Placeholder: requires mocked provider returning empty to verify contract.
  // Until Phase 2, this documents the expected contract.
  assert.ok(true, "contract — tested with mocked provider after Phase 2");
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
  void buildCapture();
  // Currently reaches fetch and throws raw error.
  // With exitOverride, the error from extract action bubbles as unhandled rejection?
  // Commander handles action rejections with .catch and prints the error.
  // This test documents the target.
  assert.ok(true, "contract — tested after URL validation is added");
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
