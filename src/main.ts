// websearch - Multi-provider web search CLI
// Requires Node 18+ (built-in fetch).

import { Command, Option } from "commander";
import {
  type Envelope,
  type ExtractData,
  error,
  type Hint,
  type SearchData,
  success,
  textPreview,
} from "./contracts.ts";
import { MissingCredentialError, OperationalError, UsageError } from "./errors.ts";
import { extractLocal } from "./extract.ts";
import { type RenderFormat, renderJSON, renderTOON } from "./output.ts";
import { PROVIDER_NAMES, search } from "./search.ts";
import {
  validateCount,
  validateCountry,
  validateFreshness,
  validateQuery,
  validateURL,
} from "./validation.ts";

// === CLI dependencies (testable seam) ===

export interface CLIOut {
  out: string[];
  err: string[];
}

export type SearchFn = typeof search;
export type ExtractFn = typeof extractLocal;

export interface CLIDependencies {
  search: SearchFn;
  extract: ExtractFn;
  format?: RenderFormat;
}

const defaultDeps: CLIDependencies = { search, extract: extractLocal, format: "toon" };

// === Envelope runner ===
// Renders an envelope to the selected format and maps exit code.

function renderEnvelope(env: Envelope, format: RenderFormat): string {
  if (format === "json") return renderJSON(env);
  return renderTOON(env);
}

function exitCodeFor(env: Envelope): number {
  if (env.ok) return 0;
  const code = env.error.code;
  // Usage errors → exit 2
  if (code === "INVALID_INPUT") return 2;
  // Everything else is operational → exit 1
  return 1;
}

// === Commander error mapping ===
// Converts Commander's internal errors (via exitOverride) to AXI envelopes.

function mapCommanderError(e: Error & { exitCode?: number; code?: string }): Envelope {
  // Commander throws CommanderError with .code for help/usage errors
  if (e.code === "commander.help") {
    return success("home", {}); // help is handled by Commander's output, this is for exit code
  }
  return error(null, "COMMANDER_ERROR", e.message);
}

// === CLI Construction ===

export function buildProgram(
  outWriter?: (line: string) => void,
  errWriter?: (line: string) => void,
  deps: CLIDependencies = defaultDeps,
): Command {
  const out = outWriter ?? console.log;
  const err = errWriter ?? console.error;
  const format = deps.format ?? "toon";
  const { search: searchFn, extract: extractFn } = deps;

  const program = new Command();

  program
    .name("websearch")
    .description("Multi-provider web search CLI")
    .addHelpText(
      "after",
      `
Environment variables:
  TAVILY_API_KEY              Tavily (https://app.tavily.com)
  EXA_API_KEY                 Exa (https://dashboard.exa.ai)
  WEBSEARCHAPI_KEY            WebSearchAPI.ai (https://websearchapi.ai)
  BRAVE_API_KEY               Brave Search (https://api-dashboard.search.brave.com)
  SERPAPI_KEY                 Google, Scholar, YouTube, Amazon (https://serpapi.com/manage-api-key)
  CODEX_ACCESS_TOKEN          Codex search - EXPERIMENTAL (alpha/search, text-only)
  WEBSEARCH_DEFAULT_PROVIDER  Override default provider for search`,
    )
    .exitOverride()
    .configureOutput({
      writeOut: (str) => out(str.replace(/\n$/, "")),
      writeErr: (str) => err(str.replace(/\n$/, "")),
    });

  // Wrapper: catches errors, builds envelope, renders
  const wrap = async (
    fn: () => Promise<Envelope>,
    formatOverride?: RenderFormat,
  ): Promise<void> => {
    const renderFormat = formatOverride ?? format;
    const envelope = await fn().catch((caught: unknown) => {
      const e = caught as Error & { exitCode?: number; code?: string };
      if (e instanceof UsageError) {
        return error("search", "INVALID_INPUT", e.message, {
          field: (e as UsageError).field,
          invalidValue: (e as UsageError).invalidValue,
          validValues: (e as UsageError).validValues,
        }) as Envelope;
      }
      if (e instanceof MissingCredentialError) {
        const mc = e as MissingCredentialError;
        return error("search", "MISSING_CREDENTIAL", e.message, {
          recovery: { command: `export ${mc.envVar}=<key>`, reason: `get key at ${mc.signupUrl}` },
        }) as Envelope;
      }
      if (e instanceof OperationalError) {
        return error("search", (e as OperationalError).code, e.message) as Envelope;
      }
      // Commander errors (help, usage)
      return mapCommanderError(e);
    });
    out(renderEnvelope(envelope, renderFormat));
    if (!envelope.ok) {
      const exitErr = new Error(envelope.error.message) as Error & { exitCode: number };
      exitErr.exitCode = exitCodeFor(envelope);
      throw exitErr;
    }
  };

  program
    .command("search")
    .description("Search the web")
    .argument("<query...>", "Search query")
    .addOption(
      new Option("-p, --provider <name>", "Provider to use")
        .choices(PROVIDER_NAMES)
        .default("brave")
        .env("WEBSEARCH_DEFAULT_PROVIDER"),
    )
    .option("-n <num>", "Number of results", "5")
    .option("--content", "Include page content")
    .option("--full", "Disable content truncation")
    .option("--freshness <period>", "Filter: day, week, month, year")
    .option("--country <code>", "Two-letter country code")
    .option("--json", "Output raw JSON")
    .action(async (queryParts: string[], opts) => {
      await wrap(
        async () => {
          const rawQuery = queryParts.join(" ");
          const query = validateQuery(rawQuery);
          const numResults = validateCount(opts.n);
          const freshness = validateFreshness(opts.freshness ?? null);
          const country = validateCountry(opts.country ?? null);

          const results = await searchFn(query, {
            provider: opts.provider,
            numResults,
            content: opts.content ?? false,
            freshness,
            country,
          });

          // Apply truncation: default 500 char snippet preview, --full bypasses
          const snippetMax = opts.full ? Infinity : 500;
          const contentMax = opts.full ? Infinity : 5000;
          const processed = results.map((r) => ({
            ...r,
            snippet: textPreview(r.snippet, snippetMax).text,
            content: r.content ? textPreview(r.content, contentMax).text : null,
          }));

          const data: SearchData = {
            query,
            provider: opts.provider,
            requestedCount: numResults,
            returnedCount: processed.length,
            totalCount: null,
            results: processed,
          };

          const hints: Hint[] = [];
          const hasTruncated = results.some(
            (r) => r.snippet.length > snippetMax || (r.content && r.content.length > contentMax),
          );
          if (hasTruncated && !opts.full) {
            hints.push({
              command: `websearch search ${query} --full`,
              reason: "some results were truncated — use --full for complete content",
            });
          }

          return success("search", data, hints);
        },
        opts.json ? "json" : undefined,
      );
    });

  program
    .command("extract")
    .description("Extract content from a URL as markdown (local, no API credits)")
    .argument("<url>", "URL to extract")
    .option("--json", "Output raw JSON")
    .option("--full", "Disable content truncation")
    .action(async (url: string, opts) => {
      await wrap(
        async () => {
          const validatedUrl = validateURL(url);
          const result = await extractFn(validatedUrl.href);
          const contentMax = opts.full ? Infinity : 5000;

          const data: ExtractData = {
            url: validatedUrl.href,
            title: result.title,
            content: textPreview(result.content, contentMax),
          };

          return success("extract", data);
        },
        opts.json ? "json" : undefined,
      );
    });

  return program;
}

// === Main entry point (production) ===

const argv1 = process.argv[1];
const isMain =
  argv1 != null && (argv1.endsWith("/dist/websearch.js") || argv1.endsWith("src/main.ts"));
if (isMain) {
  buildProgram()
    .parseAsync()
    .catch((e: Error) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
}
