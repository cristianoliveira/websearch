---
name: web-search
description: Web search, content extraction, and research via multiple providers (Tavily, Exa, Brave, etc.). Use when searching for documentation, facts, current information, extracting content from URLs, or fetching pages. Triggers on "search for", "look up", "find information", "extract content", "fetch page", "search the web", "research", or any web lookup task.
---

# Web Search

Multi-provider web search and content extraction via the `websearch` CLI.

## Commands

### search — Find web pages

```bash
websearch search "query"                       # Search (default: Brave)
websearch search "query" -p brave              # Specific provider
websearch search "query" -n 10                 # More results (default: 5)
websearch search "query" --content             # Include page content
websearch search "query" --freshness week      # Filter: day, week, month, year
websearch search "query" --country DE          # Country-specific results
websearch search "query" -p serpapi --engine google_scholar  # SerpAPI engine
```

### extract — Get page content as markdown

```bash
websearch extract "https://example.com/article"
websearch extract "https://docs.rust-lang.org/book/ch04-01-what-is-ownership.html"
```

Extraction is always local (fetches HTML, parses with Readability, converts to markdown). No API credits used.



All commands support `--json` for raw JSON output.

## Provider Guide

| Provider | Best for | Free tier |
|---|---|---|
| tavily | General AI-optimized search | 1,000/month |
| exa | Semantic search | 1,000/month |
| websearchapi | Google-powered search, generous quota | 2,000/month |
| brave | Independent index, privacy-focused | ~1,000/month |
| serpapi | YouTube, Scholar, Amazon (40+ engines) | 100/month |

**Defaults:** search→brave, extract→local

### Provider characteristics

- **tavily**: Returns the richest snippets — noticeably more extracted content per result than other providers. Good mix of official docs and community sources. Best general-purpose choice.
- **exa**: Semantic/neural search — finds the freshest content and understands meaning beyond keywords. Great for "what's the latest on X" or exploratory queries. Can occasionally return lower-quality SEO-heavy content for common topics.
- **websearchapi**: Google-powered results. Reliably surfaces canonical/official sources (official docs, Stack Overflow). Most generous free tier (2,000/month) — good fallback when other quotas run low.
- **brave** (default): Independent index (not Google/Bing). Also reliably surfaces official docs and vendor guides. Good alternative perspective to Google-based results.
- **serpapi**: Tight free tier (100/month) and sometimes returns fewer results than requested. Reserve for specialized engines: `-p serpapi --engine youtube` for video tutorials, `--engine google_scholar` for academic papers, `--engine google_news` for news.

## Setup

Each provider needs an API key as an environment variable. Only configure the ones you use:

```
TAVILY_API_KEY      # https://app.tavily.com
EXA_API_KEY         # https://dashboard.exa.ai
WEBSEARCHAPI_KEY    # https://websearchapi.ai
BRAVE_API_KEY       # https://api-dashboard.search.brave.com
SERPAPI_KEY          # https://serpapi.com/manage-api-key
```

## Tips

- Use `--content` to include page text in search results (avoids a separate extract call)
- Use `extract` to read long documentation pages (free, no API credits)
- Use `-p serpapi --engine youtube` to search YouTube, or `--engine google_scholar` for papers
- When a provider's quota runs low, switch with `-p`
