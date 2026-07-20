---
name: web-search
description: Web search and content extraction. Use when searching the web for documentation, facts or research. Triggers on "search", "look up", "find information", "search the web", "research", or any web lookup task.
---

# Web Search

Multi-provider web search and content extraction via the `websearch` CLI.

Output is **structured TOON** by default on stdout. Use `--json` for JSON. Errors are structured on stdout; stderr is reserved for diagnostics.

## Commands

### Discovery — check configured providers

```bash
websearch    # Shows default provider, credential status, all configured providers
```

### search — Find web pages

```bash
websearch search "query"                       # Search (default: Brave)
websearch search "query" -p brave              # Specific provider
websearch search "query" -n 10                 # More results (default: 5)
websearch search "query" --content             # Include page content
websearch search "query" --full                # Disable content truncation
websearch search "query" --freshness week      # Filter: day, week, month, year
websearch search "query" --country DE          # Country-specific results
websearch search "query" --json                # JSON output instead of TOON
websearch search "query" -p codex              # AI-synthesized search (Codex backend)
websearch search "query" -p scholar            # Academic papers
websearch search "query" -p youtube            # Video search
websearch search "query" -p amazon --country US  # Product search
```

`--content` and `--country` work with all providers. `--freshness` works with all except youtube and amazon. `--full` removes CLI truncation (500 chars snippet, 5000 chars content by default).

### extract — Get page content as markdown

```bash
websearch extract "https://example.com/article"
websearch extract "https://docs.rust-lang.org/book/ch04-01-what-is-ownership.html"
websearch extract "https://..." --full           # Full content, no truncation
websearch extract "https://..." --json           # JSON output
```

## Output format

- **TOON** (default) — compact structured output on stdout
- **JSON** (`--json`) — same semantic value for interoperability
- Errors are structured on stdout; stderr is empty unless debug mode active

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Success, empty results, no-args home, help |
| 1 | Operational failure (missing credential, provider error, timeout) |
| 2 | Usage error (invalid input, unknown command/flag) |

### Structured error example

```
ok: false
command: null
error:
  code: UNKNOWN_FLAG
  message: "error: unknown option '--nope'"
```

## Providers

Default provider is **brave**. Override with `-p <name>`.

| Provider | Source |
|---|---|
| brave | Brave independent index |
| codex | **EXPERIMENTAL** Codex AI-synthesized text answer (alpha/search) |
| tavily | Tavily AI search |
| exa | Exa neural/semantic index |
| websearchapi | Google (via WebSearchAPI.ai) |
| google | Google (via SerpAPI) |
| scholar | Google Scholar (via SerpAPI) |
| youtube | YouTube (via SerpAPI) |
| amazon | Amazon product search (via SerpAPI) |

### Provider details

- **brave**: Returns short snippets (~200-300 chars). Reports `totalCount` from API.
- **tavily**: Returns long snippets (~800-1100 chars).
- **exa**: Semantic search, matches by meaning not just keywords. Returns snippets (~200 chars).
- **websearchapi**: Google-powered. Returns short snippets (~150 chars).
- **google**: Google-powered. Returns short snippets (~150 chars). Reports `totalCount` via `search_information.total_results`.
- **scholar**: Returns academic papers with citation snippets. Reports `totalCount`.
- **youtube**: Returns video titles, links, and descriptions. Reports `totalCount`.
- **amazon**: Returns product titles, prices, and ratings. `--country` maps to regional Amazon domains (e.g. `de` → amazon.de). Defaults to amazon.com. Reports `totalCount`.
- **codex** *(EXPERIMENTAL)*: Hits the internal/alpha `alpha/search` endpoint and returns a SINGLE synthesized text answer, NOT structured result rows. There is no `url`/`title`/`snippet` per result — we map the answer text into one result (`snippet` = first 500 chars; use `--content` for the full answer). `-n` is ignored. Auth via `CODEX_ACCESS_TOKEN` (Codex/OpenAI bearer auth; `codex login` / `~/.codex/auth.json`). `--country` sets user location; `--freshness` maps to `recency` (days). Endpoint + shape are undocumented and may change. Override model with `WEBSEARCH_CODEX_MODEL` (default `gpt-5.4`).

## Setup

Each provider needs an API key as an environment variable:

```
TAVILY_API_KEY      # https://app.tavily.com
EXA_API_KEY         # https://dashboard.exa.ai
WEBSEARCHAPI_KEY    # https://websearchapi.ai
BRAVE_API_KEY       # https://api-dashboard.search.brave.com
CODEX_ACCESS_TOKEN  # EXPERIMENTAL alpha/search (`codex login`, ~/.codex/auth.json)
SERPAPI_KEY         # google, scholar, youtube, amazon (https://serpapi.com/manage-api-key)
```
