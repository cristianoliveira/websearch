// websearch - Multi-provider web search CLI (composition root)
// Requires Node 18+ (built-in fetch).

import { buildProgram, type CLIDependencies } from "./cli.ts";
import { type Envelope, error, type HomeData, success } from "./contracts.ts";
import { MissingCredentialError, OperationalError, UsageError } from "./errors.ts";
import { extractLocal } from "./extract.ts";
import { type RenderFormat, renderJSON, renderTOON } from "./output.ts";
import { PROVIDER_NAMES, search } from "./search.ts";

// === Output helpers ===

export interface CLIOut {
  out: string[];
  err: string[];
}

function renderEnvelope(env: Envelope, format: RenderFormat): string {
  if (format === "json") return renderJSON(env);
  return renderTOON(env);
}

function exitCodeFor(env: Envelope): number {
  if (env.ok) return 0;
  const code = env.error.code;
  // Usage errors → exit 2
  if (
    code === "INVALID_INPUT" ||
    code === "UNKNOWN_COMMAND" ||
    code === "UNKNOWN_FLAG" ||
    code === "MISSING_ARGUMENT"
  )
    return 2;
  // Everything else is operational → exit 1
  return 1;
}

// === Error translation ===

function translateError(e: unknown, command: string): Envelope {
  if (e instanceof UsageError) {
    return error(command as Envelope["command"], "INVALID_INPUT", e.message, {
      field: e.field,
      invalidValue: e.invalidValue,
      validValues: e.validValues,
    });
  }
  if (e instanceof MissingCredentialError) {
    return error(command as Envelope["command"], "MISSING_CREDENTIAL", e.message, {
      recovery: { command: `export ${e.envVar}=<key>`, reason: `get key at ${e.signupUrl}` },
    });
  }
  if (e instanceof OperationalError) {
    return error(command as Envelope["command"], e.code, e.message);
  }
  const msg = e instanceof Error ? e.message : String(e);
  return error(command as Envelope["command"], "UNEXPECTED_ERROR", msg);
}

// === Home state builder ===

function buildHome(): Envelope {
  const defaultProvider = process.env.WEBSEARCH_DEFAULT_PROVIDER || "brave";
  const credentials: Record<string, boolean> = {};
  for (const p of PROVIDER_NAMES) {
    const envVar = {
      tavily: "TAVILY_API_KEY",
      exa: "EXA_API_KEY",
      websearchapi: "WEBSEARCHAPI_KEY",
      brave: "BRAVE_API_KEY",
      google: "SERPAPI_KEY",
      scholar: "SERPAPI_KEY",
      youtube: "SERPAPI_KEY",
      amazon: "SERPAPI_KEY",
      codex: "CODEX_ACCESS_TOKEN",
    }[p];
    credentials[p] = envVar ? !!process.env[envVar] : false;
  }

  const data: HomeData = {
    executable: "~/websearch",
    purpose: "Multi-provider web search and content extraction CLI",
    defaultProvider,
    credentials,
  };

  return success("home", data, [
    { command: `websearch search "your query"`, reason: "search with default provider" },
  ]);
}

// === Commander error mapping ===

function mapCommanderError(e: Error & { exitCode?: number; code?: string }): Envelope {
  if (e.code === "commander.helpDisplayed" || e.code === "commander.help") {
    return success("home", {});
  }
  if (e.code === "commander.unknownCommand" || e.code === "commander.excessArguments") {
    return error(null, "UNKNOWN_COMMAND", e.message);
  }
  if (e.code === "commander.unknownOption") {
    return error(null, "UNKNOWN_FLAG", e.message);
  }
  if (e.code === "commander.missingArgument") {
    return error(null, "MISSING_ARGUMENT", e.message);
  }
  if (e.code === "commander.invalidArgument") {
    return error(null, "INVALID_INPUT", e.message);
  }
  return error(null, "USAGE_ERROR", e.message);
}

// === Main runner ===

export async function runCLI(
  args: string[],
  deps: CLIDependencies,
  out: (line: string) => void,
  _err: (line: string) => void,
): Promise<number> {
  const program = buildProgram(deps, (env) => {
    out(renderEnvelope(env, format));
  });

  // Silence Commander's output — we handle all rendering ourselves
  program.configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  });

  // Determine format from args (check for --json)
  const hasJson = args.includes("--json");
  const format: RenderFormat = hasJson ? "json" : (deps.format ?? "toon");

  // No-args: home
  const userArgs = args.slice(2); // skip "node" and "websearch"
  if (userArgs.length === 0 || (userArgs.length === 1 && userArgs[0] === "--json")) {
    const home = buildHome();
    out(renderEnvelope(home, format));
    return 0;
  }

  // Check for --help — let Commander handle it
  if (userArgs.includes("--help") || userArgs.includes("-h")) {
    // Commander prints help; we just need exit 0
    try {
      await program.parseAsync(args);
      return 0;
    } catch (e) {
      const ce = e as { exitCode?: number; code?: string };
      if (ce.code === "commander.helpDisplayed" || ce.code === "commander.help") return 0;
      // Commander error during help — render as structured
      const envelope = mapCommanderError(ce as Error & { exitCode?: number; code?: string });
      out(renderEnvelope(envelope, format));
      return exitCodeFor(envelope);
    }
  }

  try {
    await program.parseAsync(args);
    return 0;
  } catch (e) {
    // Commander errors (usage, help)
    const ce = e as { exitCode?: number; code?: string };
    if (ce.code?.startsWith("commander.")) {
      const envelope = mapCommanderError(ce as Error & { exitCode?: number; code?: string });
      out(renderEnvelope(envelope, format));
      return exitCodeFor(envelope);
    }
    // Action errors (from our typed errors)
    const cmd = userArgs[0] || "search";
    const envelope = translateError(e, cmd);
    out(renderEnvelope(envelope, format));
    return exitCodeFor(envelope);
  }
}

// === Main entry point (production) ===

const argv1 = process.argv[1];
const isMain =
  argv1 != null && (argv1.endsWith("/dist/websearch.js") || argv1.endsWith("src/main.ts"));
if (isMain) {
  const deps: CLIDependencies = { search, extract: extractLocal, format: "toon" };
  runCLI(process.argv, deps, console.log, console.error)
    .then((code) => {
      if (code !== 0) process.exit(code);
    })
    .catch((e: Error) => {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    });
}
