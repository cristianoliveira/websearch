// websearch - Multi-provider web search CLI
// Requires Node 18+ (built-in fetch).

import { Command, Option } from "commander";
import { extractLocal } from "./extract.ts";
import { PROVIDER_NAMES, search } from "./search.ts";
import type { ExtractResult, SearchResult } from "./types.ts";

// === Output Formatters ===

function printResults(
  results: SearchResult[],
  out: (line: string) => void = console.log,
  err: (line: string) => void = console.error,
): void {
  if (results.length === 0) {
    err("No results found.");
    return;
  }
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    out(`--- Result ${i + 1} ---`);
    out(`Title: ${r.title}`);
    out(`Link: ${r.url}`);
    if (r.age) out(`Age: ${r.age}`);
    out(`Snippet: ${r.snippet}`);
    if (r.content) out(`Content:\n${r.content}`);
    out("");
  }
}

function printExtract(result: ExtractResult, out: (line: string) => void = console.log): void {
  if (result.title) out(`# ${result.title}\n`);
  out(result.content);
}

export interface CLIOut {
  out: string[];
  err: string[];
}

export interface CLIDependencies {
  search: typeof search;
  extract: typeof extractLocal;
}

const defaultDeps: CLIDependencies = { search, extract: extractLocal };

// === CLI Construction (testable seam) ===

export function buildProgram(
  outWriter?: (line: string) => void,
  errWriter?: (line: string) => void,
  deps: CLIDependencies = defaultDeps,
): Command {
  const out = outWriter ?? console.log;
  const err = errWriter ?? console.error;
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
    .option("--freshness <period>", "Filter: day, week, month, year")
    .option("--country <code>", "Two-letter country code")
    .option("--json", "Output raw JSON")
    .action(async (queryParts: string[], opts) => {
      const query = queryParts.join(" ");
      const results = await searchFn(query, {
        provider: opts.provider,
        numResults: parseInt(opts.n, 10),
        content: opts.content ?? false,
        freshness: opts.freshness ?? null,
        country: opts.country ?? null,
      });
      if (opts.json) out(JSON.stringify(results, null, 2));
      else printResults(results, out, err);
    });

  program
    .command("extract")
    .description("Extract content from a URL as markdown (local, no API credits)")
    .argument("<url>", "URL to extract")
    .option("--json", "Output raw JSON")
    .action(async (url: string, opts) => {
      const result = await extractFn(url);
      if (opts.json) out(JSON.stringify(result, null, 2));
      else printExtract(result, out);
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
