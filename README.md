# websearch

Multi-provider web search and content extraction CLI.

## Install

```bash
npm install -g @juanibiapina/websearch
```

## Usage

```bash
websearch search "query"                       # Search (default: Brave)
websearch search "query" -p brave              # Specific provider
websearch search "query" -n 10                 # More results (default: 5)
websearch search "query" --content             # Include page content
websearch search "query" --freshness week      # Filter: day, week, month, year
websearch search "query" -p codex              # EXPERIMENTAL: AI-synthesized text answer (alpha/search)
websearch extract "https://example.com"        # Extract page content as markdown
```

All commands support `--json` for raw JSON output.

## Providers

| Provider | Best for | Free tier |
|---|---|---|
| tavily | General AI-optimized search | 1,000/month |
| exa | Semantic search | 1,000/month |
| websearchapi | Google-powered search, generous quota | 2,000/month |
| brave | Independent index, privacy-focused | ~1,000/month |
| codex | **EXPERIMENTAL** AI-synthesized text answer (alpha/search, no result rows) | none (Codex/OpenAI auth) |
| google | Web search via Google | 250/month* |
| scholar | Academic papers | 250/month* |
| youtube | Video search | 250/month* |
| amazon | Product search | 250/month* |

*google, scholar, youtube, and amazon share a single SerpAPI quota (250/month).

## Environment Variables

```
TAVILY_API_KEY      # https://app.tavily.com
EXA_API_KEY         # https://dashboard.exa.ai
WEBSEARCHAPI_KEY    # https://websearchapi.ai
BRAVE_API_KEY       # https://api-dashboard.search.brave.com
SERPAPI_KEY         # google, scholar, youtube, amazon (https://serpapi.com/manage-api-key)
CODEX_ACCESS_TOKEN  # codex (EXPERIMENTAL alpha/search; `codex login`, see ~/.codex/auth.json)
```

> **Note on codex:** the `alpha/search` endpoint returns a single synthesized text answer, not structured result rows. It is undocumented/internal and may change. `-n` is ignored; use `--content` for the full answer. Override the model with `WEBSEARCH_CODEX_MODEL`.

## AI Agent Skill

This repo includes a skill file that teaches AI coding agents how to use websearch. Install it with:

```bash
npx skills add juanibiapina/websearch
```

## License

MIT
