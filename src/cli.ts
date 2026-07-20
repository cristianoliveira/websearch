// websearch - Multi-provider web search CLI (Commander setup)
// Requires Node 18+ (built-in fetch).

import { Command, Option } from "commander";
import type { Envelope, ExtractData, Hint, SearchData } from "./contracts.ts";
import { success, textPreview } from "./contracts.ts";
import type { extractLocal } from "./extract.ts";
import type { RenderFormat } from "./output.ts";
import { PROVIDER_NAMES } from "./search.ts";
import {
  validateCount,
  validateCountry,
  validateFreshness,
  validateQuery,
  validateURL,
} from "./validation.ts";

// === Dependencies ===

export type SearchFn = typeof import("./search.ts").search;
export type ExtractFn = typeof extractLocal;

export interface CLIDependencies {
  search: SearchFn;
  extract: ExtractFn;
  format?: RenderFormat;
}

// === CLI Construction ===

export function buildProgram(deps: CLIDependencies, onResult: (env: Envelope) => void): Command {
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
    .exitOverride();

  // Action wrapper: validates, executes, calls onResult, throws for exit code
  const handle = async (fn: () => Promise<Envelope>): Promise<void> => {
    const envelope = await fn();
    onResult(envelope);
    if (!envelope.ok) {
      const exitErr = new Error(envelope.error.message) as Error & { exitCode: number };
      exitErr.exitCode = envelope.error.code === "INVALID_INPUT" ? 2 : 1;
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
      await handle(async () => {
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
      });
    });

  program
    .command("extract")
    .description("Extract content from a URL as markdown (local, no API credits)")
    .argument("<url>", "URL to extract")
    .option("--json", "Output raw JSON")
    .option("--full", "Disable content truncation")
    .action(async (url: string, opts) => {
      await handle(async () => {
        const validatedUrl = validateURL(url);
        const result = await extractFn(validatedUrl.href);
        const contentMax = opts.full ? Infinity : 5000;

        const data: ExtractData = {
          url: validatedUrl.href,
          title: result.title,
          content: textPreview(result.content, contentMax),
        };

        return success("extract", data);
      });
    });

  return program;
}
