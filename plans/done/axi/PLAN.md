# Websearch AXI remediation plan

## Status

Planned. No implementation has started.

## Goal

Turn `websearch` into deterministic, compact, discoverable, and recoverable CLI for autonomous agents while preserving explicit JSON interoperability and optional human-readable output.

## Success criteria

- Default command output is specification-compatible TOON on stdout.
- JSON output represents same semantic value as TOON.
- Domain/search/extraction code contains no rendering or process termination.
- Input is validated before credentials, filesystem, subprocess, or network access.
- Exit codes are consistent: `0` success/empty/no-op, `1` operational failure, `2` usage failure.
- Usage and operational errors use selected structured format on stdout.
- stderr is empty unless explicit debug/progress mode is active.
- No-argument invocation returns compact live state with exit `0`.
- Empty and truncated data are explicit and actionable.
- Provider failures are translated and redacted.
- CLI contract has deterministic tests for all required paths.
- Help is local, complete, and includes runnable examples.
- Representative output size is measured against JSON without fixed savings claims.

## Non-goals

- Changing provider search semantics or adding providers.
- Adding interactive prompts.
- Introducing pagination where provider APIs cannot support it.
- Exposing provider credentials or probing provider networks from no-argument view.
- Maintaining undocumented human output as default.

## Target architecture

Keep dependency wiring in composition root and keep domain values format-independent.

```text
src/main.ts          composition root; constructs dependencies and starts CLI
src/cli.ts           Commander setup, command dispatch, exit-code mapping
src/contracts.ts     success/error/home/search/extract envelope types
src/errors.ts        typed usage and operational errors; redaction mapping
src/validation.ts    pure query/count/freshness/country/URL validation
src/output.ts        TOON/JSON/human renderers; only format-aware boundary
src/search.ts        provider orchestration returning domain values
src/extract.ts       extraction returning domain values
src/types.ts         provider-independent result and text-preview types
src/cli.test.ts      subprocess/command contract tests
src/output.test.ts   serialization and semantic parity tests
src/validation.test.ts pure validation tests
src/errors.test.ts   translation/redaction tests
```

Exact files may be adjusted if smaller separation is clearer, but rendering, validation, domain behavior, and dependency wiring must not collapse into one module.

## Proposed contracts

Use one stable envelope family. Final field names must be locked by tests before renderer implementation.

```ts
type Hint = {
  command: string;
  reason: string;
};

type SuccessEnvelope<T> = {
  ok: true;
  command: "home" | "search" | "extract";
  data: T;
  hints: Hint[];
};

type ErrorEnvelope = {
  ok: false;
  command: "home" | "search" | "extract" | null;
  error: {
    code: string;
    message: string;
    field?: string;
    invalidValue?: string;
    validValues?: string[];
    recovery?: Hint;
  };
};

type TextPreview = {
  text: string;
  totalChars: number;
  truncated: boolean;
};

type SearchData = {
  query: string;
  provider: string;
  requestedCount: number;
  returnedCount: number;
  totalCount: number | null;
  results: SearchResultView[];
};
```

Rules:

- `totalCount` is `null` when provider does not report it; never pretend returned count is total match count.
- Empty search is successful `results: []`, with query/provider/count context.
- Stable error codes are agent decision keys; prose messages are concise explanations.
- Hints appear only when they prevent predictable follow-up calls.
- Unknown values use placeholders in commands, never invented values.
- Secrets and raw upstream payloads are absent from all envelopes.

## Output and flag contract

### Global format selection

- Default: TOON.
- Keep current `--json` as explicit compatibility flag.
- Add `--format toon|json|human` only if one global option makes behavior clearer.
- If `--json` and incompatible `--format` are combined, return structured usage error with exit `2`.
- `--help` remains concise human help on stdout with exit `0`.

Before implementation:

1. Read current TOON specification.
2. Evaluate maintained TypeScript TOON libraries for spec compatibility, deterministic encoding, round-trip support, and bundle impact.
3. Record chosen package and rejected alternatives in plan decision note or commit message.
4. Do not hand-roll TOON or parse it with regular expressions.

### Search

Default output contains only decision-relevant fields: title, URL, age when present, and bounded snippet preview. Content is omitted unless requested.

Add or formalize:

- `-n, --count <integer>` with documented minimum/maximum; retain `-n` behavior.
- `--freshness day|week|month|year` as declared choices.
- `--country <ISO-3166-1-alpha-2>` validated before provider call.
- `--content` to request bounded content previews.
- `--full` to remove CLI truncation for requested large text.
- `--fields <comma-separated>` only if measured output shows meaningful savings beyond default view.

Do not add fake pagination. If provider exposes total/paging later, model it in provider response first.

### Extract

- Validate URL syntax and allowed protocols before `fetch`.
- Default extraction content is bounded and represented with truncation metadata.
- `--full` emits complete extracted content.
- Unsupported protocol is usage error, not fetch failure.

### No arguments

Return TOON home envelope and exit `0` containing:

- executable absolute path with home collapsed to `~`;
- one-sentence purpose;
- default provider;
- provider credential readiness as booleans/status labels, without values;
- 1–2 relevant commands using current default provider.

No network calls. Do not print full manual.

## Detailed implementation phases

## Phase 1 — Lock behavior with failing CLI tests

Create a test seam before changing behavior. Prefer constructing Commander program with injected dependencies and output writers; use subprocess tests only for final process-level verification.

### Red tests

1. No args: exit `0`, TOON stdout, empty stderr, compact home state.
2. Search success: structured TOON with query/provider/count/results.
3. Extract success: structured TOON with title/content metadata.
4. JSON compatibility: same semantic domain value.
5. Empty search: exit `0`, explicit context, empty results.
6. Unknown command, unknown flag, missing query: exit `2` structured stdout.
7. Invalid provider/count/freshness/country/URL/protocol: exit `2`; dependency spy untouched.
8. Missing credential: exit `1`, redacted structured failure with recovery.
9. Provider HTTP, timeout, auth, rate-limit, malformed response: exit `1`, no raw payload.
10. Content partial failure: successful rows preserved; failure represented separately.
11. Truncation: preview, total size, `truncated: true`, runnable `--full` hint.
12. Full output: complete text, `truncated: false`, no redundant hint.
13. Help: local arguments, defaults, valid values, and 2–3 examples.
14. stderr: empty for all normal success and error cases.

Test environment must clear ambient provider variables and mock fetch. No test may consume API quota.

## Phase 2 — Separate composition, command dispatch, and rendering

1. Move Commander construction into `buildProgram(dependencies)`.
2. Inject configured search and extraction clients once at composition root.
3. Inject stdout/stderr writers for deterministic tests.
4. Replace direct `console.log/error` calls with returned envelopes.
5. Remove `process.exit` from `getKey` and domain modules.
6. Let one top-level runner render envelope, set exit code, and terminate naturally.
7. Add typed command result carrying envelope and exit status if that keeps Commander exceptions isolated.

Checkpoint: existing provider helper tests and new command tests compile; failures should now be contract differences, not hard exits.

## Phase 3 — Implement pure validation before dependencies

Write validator tests first, then implement:

- Query: reject missing, empty, or whitespace-only text.
- Count: reject partial parses (`5x`), decimals, zero, negatives, overflow, and values above documented cap. Use strict integer parsing, not `parseInt` acceptance.
- Freshness: declared enum only.
- Country: exactly two ASCII letters; normalize uppercase after validation.
- URL: valid absolute URL and explicit protocol allowlist (`http`, `https`; decide whether deterministic `data:` remains test-only through injected extractor rather than public CLI).
- Provider: retain Commander choices and validate environment-derived default too.
- Field selection: reject unknown/duplicate/empty field names if introduced.

Prove validation precedes credential lookup and fetch with call-order/dependency spies.

## Phase 4 — Add typed errors and dependency translation

Define typed failures such as:

- `INVALID_INPUT` (usage, exit `2`)
- `MISSING_CREDENTIAL`
- `AUTHENTICATION_FAILED`
- `RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `PROVIDER_TIMEOUT`
- `INVALID_PROVIDER_RESPONSE`
- `EXTRACTION_FAILED`
- `CONTENT_FETCH_PARTIAL`

Implementation rules:

1. `getKey` throws typed missing-credential error; it never logs or exits.
2. `fetchJSON` reads only bounded upstream body for internal debug context and never exposes it normally.
3. Map HTTP status and abort/timeout errors to domain codes.
4. Keep raw cause available only to explicit debug diagnostics after secret redaction.
5. Replace `(HTTP ...)` and `(Error: ...)` content strings with structured partial failure metadata.
6. Recovery gives one action, for example setting credential or retrying later.
7. Never echo credential values, authorization headers, complete upstream bodies, or stack traces.

Add adversarial tests where upstream error strings contain fake bearer tokens/API keys.

## Phase 5 — Implement renderers and TOON default

1. Add maintained TOON library.
2. Render success/error envelopes through same selected formatter.
3. Make serializer deterministic: stable field construction/order and no timestamps/random IDs in output.
4. Implement JSON using same envelope object, not separate schema.
5. Keep optional human renderer isolated and explicit.
6. Configure Commander error handling (`exitOverride`/custom output) so usage errors pass through structured renderer.
7. Ensure progress/debug is only on stderr and disabled by default.

Serialization tests must cover:

- strings requiring escaping/quoting;
- Unicode and multiline content;
- empty arrays and null values;
- nested errors/hints;
- declared array lengths;
- semantic TOON round-trip;
- TOON/JSON semantic equality;
- repeated runs producing byte-identical output for same input.

## Phase 6 — Empty state, counts, truncation, and hints

### Empty state

Return successful search envelope with original normalized query, provider, requested count, returned count `0`, reported total when available, and `results: []`. Add a next command only when useful, preserving provider/country/freshness scope.

### Counts

Change provider boundary from bare `SearchResult[]` to a page/result object capable of carrying provider-reported total. Use `null` when unavailable. Keep returned count separate from requested count and total count.

### Truncation

Replace implicit `...` mutation with explicit `TextPreview`. Choose documented default limits based on measured representative outputs. Apply consistently to snippets and extracted/requested content.

When truncated:

- include original character count;
- include preview character count if not derivable cheaply;
- set `truncated: true`;
- include copyable command preserving query/provider/scope and adding `--full`.

When not truncated, omit full-output hint. `--full` must bypass CLI truncation while provider-side truncation remains accurately described if known.

### Field control

Measure before adding `--fields`. If default envelope is already compact, defer it. If added, validate fields locally and keep metadata/error schema stable across field selections.

## Phase 7 — No-argument home and command help

### Home

Implement pure home-state builder. Resolve executable absolute path, collapse only current home prefix to `~`, inspect credential presence without exposing values, and make output deterministic by sorting provider state according to declared provider order.

### Help

Root and each subcommand help must include:

- required arguments;
- each flag and default;
- valid enum/range/protocol values;
- environment override behavior;
- 2–3 runnable examples;
- output format behavior;
- exit-code summary at root level.

Keep `search --help` search-local and `extract --help` extract-local. Do not append all credential documentation to every command unless relevant.

Update `README.md` examples to show TOON default, JSON compatibility, `--full`, structured errors, and no-argument discovery.

## Phase 8 — Verification and rollout

Run:

```bash
npm test
npm run check
npm run lint
npm run build
```

Also run black-box matrix against built `dist/websearch.js` with isolated environment:

| Path | Expected exit | stdout | stderr |
|---|---:|---|---|
| no args | 0 | TOON home | empty |
| help | 0 | local human help | empty |
| search success | 0 | TOON result envelope | empty |
| search empty | 0 | TOON empty envelope | empty |
| extract success | 0 | TOON extract envelope | empty |
| usage failure | 2 | structured error | empty |
| missing credential | 1 | structured error | empty |
| provider failure | 1 | redacted structured error | empty |
| truncated output | 0 | metadata + `--full` hint | empty |
| JSON mode | matching | semantic JSON equivalent | empty |

Measure at least three representative payloads:

1. five ordinary search results;
2. empty result;
3. extraction with large content.

Record bytes and tokenizer counts for TOON and JSON. Report observed differences only; do not claim universal percentage savings.

Build output must contain new dependency and CLI behavior. Test installed/bin invocation, not only TypeScript source.

## Phase 9 — Maintenance cleanup

Migrate `biome.json` to installed Biome schema/version and replace deprecated `linter.recommended` configuration with supported preset. Keep this separate from behavior commits unless required for CI.

## Commit strategy

Use small forward-only commits; never amend:

1. `test: define AXI CLI contracts`
2. `refactor: separate CLI composition and domain results`
3. `feat: validate CLI input before dependencies`
4. `feat: translate and redact dependency errors`
5. `feat: add TOON-first output boundary`
6. `feat: add explicit empty and truncation metadata`
7. `feat: add AXI home and command discovery`
8. `docs: document AXI command contract`
9. `chore: migrate biome configuration`

Each behavior commit starts with failing tests and ends with test/check/lint/build green.

## Risks and mitigations

- **Breaking current prose consumers:** prose was undocumented as machine contract. Keep explicit human format if useful; document default change prominently.
- **TOON library immaturity:** gate selection on current specification and round-trip tests; do not implement custom encoder.
- **Provider total counts unavailable:** represent unknown as `null`; never infer.
- **Commander writes/errors internally:** isolate through custom writers and `exitOverride`, covered by process tests.
- **Large `--full` output:** explicit opt-in is acceptable; keep default bounded.
- **Ambient credentials causing network tests:** clear environment and inject deterministic clients/fetch.
- **Raw errors leaking in debug mode:** apply redaction before every sink, including stderr.

## Definition of done

- All success criteria in this document pass automated tests.
- No live-network tests are needed for CLI contract.
- Built executable passes verification matrix.
- README matches actual output and exit behavior.
- TOON/JSON schema and sample outputs are documented.
- Evaluation findings have direct regression tests.
- No raw dependency payload, secret, or stack trace appears in normal output.
