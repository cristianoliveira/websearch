import { fetchLocalContent } from "./extract.ts";
import type { SearchResult } from "./types.ts";
import { truncate } from "./types.ts";

// === Provider Configuration ===

interface ProviderConfig {
  env: string;
  name: string;
  url: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  tavily: { env: "TAVILY_API_KEY", name: "Tavily", url: "https://app.tavily.com" },
  exa: { env: "EXA_API_KEY", name: "Exa", url: "https://dashboard.exa.ai" },
  websearchapi: {
    env: "WEBSEARCHAPI_KEY",
    name: "WebSearchAPI.ai",
    url: "https://websearchapi.ai",
  },
  brave: {
    env: "BRAVE_API_KEY",
    name: "Brave Search",
    url: "https://api-dashboard.search.brave.com",
  },
  serpapi: { env: "SERPAPI_KEY", name: "SerpAPI", url: "https://serpapi.com/manage-api-key" },
};

export const PROVIDER_NAMES = Object.keys(PROVIDERS);

export interface SearchOptions {
  provider: string;
  numResults: number;
  content: boolean;
  freshness: string | null;
  country: string | null;
  engine: string;
}

// === Utilities ===

function getKey(provider: string): string {
  const p = PROVIDERS[provider];
  const key = process.env[p.env];
  if (!key) {
    console.error(`Error: ${p.env} is not set.`);
    console.error(`Get your API key at: ${p.url}`);
    process.exit(1);
  }
  return key;
}

async function fetchJSON(url: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
  if (!options.signal) options.signal = AbortSignal.timeout(30000);
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${response.statusText}\n${text}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function freshnessDate(period: string): string | null {
  const days: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
  if (!days[period]) return null;
  const d = new Date();
  d.setDate(d.getDate() - days[period]);
  return d.toISOString();
}

// === Search Providers ===

// biome-ignore lint/suspicious/noExplicitAny: provider API responses are untyped
type APIResponse = any;

async function searchTavily(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const key = getKey("tavily");
  const body: Record<string, unknown> = {
    query,
    max_results: opts.numResults,
    search_depth: "basic",
  };
  if (opts.content) body.include_raw_content = "markdown";
  if (opts.freshness) body.time_range = opts.freshness;
  if (opts.country) body.country = opts.country;

  const data: APIResponse = await fetchJSON("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  return (data.results || []).map((r: APIResponse) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.content || "",
    content: opts.content ? truncate(r.raw_content) : null,
  }));
}

async function searchExa(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const key = getKey("exa");
  const contents: Record<string, unknown> = { highlights: { maxCharacters: 300 } };
  if (opts.content) contents.text = true;

  const body: Record<string, unknown> = {
    query,
    numResults: opts.numResults,
    type: "auto",
    contents,
  };
  if (opts.freshness) {
    const d = freshnessDate(opts.freshness);
    if (d) body.startPublishedDate = d;
  }

  const data: APIResponse = await fetchJSON("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify(body),
  });

  return (data.results || []).map((r: APIResponse) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.highlights?.[0] || "",
    content: opts.content ? truncate(r.text) : null,
    age: r.publishedDate || null,
  }));
}

async function searchWebSearchAPI(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const key = getKey("websearchapi");
  const body: Record<string, unknown> = { query, maxResults: opts.numResults };
  if (opts.content) body.includeContent = true;
  if (opts.freshness) body.timeframe = opts.freshness;
  if (opts.country) body.country = opts.country;

  const data: APIResponse = await fetchJSON("https://api.websearchapi.ai/ai-search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  return (data.organic || []).map((r: APIResponse) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.description || "",
    content: opts.content ? truncate(r.content) : null,
  }));
}

async function searchBrave(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const key = getKey("brave");
  const params = new URLSearchParams({
    q: query,
    count: Math.min(opts.numResults, 20).toString(),
  });
  if (opts.country) params.set("country", opts.country.toUpperCase());
  if (opts.freshness) {
    const map: Record<string, string> = { day: "pd", week: "pw", month: "pm", year: "py" };
    params.set("freshness", map[opts.freshness] || opts.freshness);
  }

  const data: APIResponse = await fetchJSON(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
    },
  );

  const results: SearchResult[] = (data.web?.results || [])
    .slice(0, opts.numResults)
    .map((r: APIResponse) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.description || "",
      age: r.age || r.page_age || null,
      content: null,
    }));

  return results;
}

async function searchSerpAPI(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const key = getKey("serpapi");
  const engine = opts.engine || "google";
  // Different engines use different query parameter names
  const queryParamMap: Record<string, string> = {
    youtube: "search_query",
    walmart: "query",
    ebay: "_nkw",
    naver: "query",
  };
  const queryParam = queryParamMap[engine] || "q";
  const params = new URLSearchParams({
    engine,
    [queryParam]: query,
    api_key: key,
    num: opts.numResults.toString(),
  });
  if (opts.freshness) {
    const map: Record<string, string> = {
      day: "qdr:d",
      week: "qdr:w",
      month: "qdr:m",
      year: "qdr:y",
    };
    if (map[opts.freshness]) params.set("tbs", map[opts.freshness]);
  }
  if (opts.country) params.set("gl", opts.country.toLowerCase());

  const data: APIResponse = await fetchJSON(`https://serpapi.com/search.json?${params}`);

  // Different engines return results in different fields
  const raw =
    data.organic_results || data.video_results || data.shopping_results || data.jobs_results || [];
  const results: SearchResult[] = raw.slice(0, opts.numResults).map((r: APIResponse) => ({
    title: r.title || "",
    url: r.link || "",
    snippet: r.snippet || r.description || "",
    age: r.date || r.published_date || null,
    content: null,
  }));

  return results;
}

// === Search Orchestration ===

type SearchFn = (query: string, opts: SearchOptions) => Promise<SearchResult[]>;

const SEARCH_FNS: Record<string, SearchFn> = {
  tavily: searchTavily,
  exa: searchExa,
  websearchapi: searchWebSearchAPI,
  brave: searchBrave,
  serpapi: searchSerpAPI,
};

export async function search(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const results = await SEARCH_FNS[opts.provider](query, opts);
  if (opts.content) {
    const fetches = results.map((r) =>
      r.content == null
        ? fetchLocalContent(r.url).then((c) => {
            r.content = c;
          })
        : Promise.resolve(),
    );
    await Promise.all(fetches);
  }
  return results;
}
