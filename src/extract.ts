import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { OperationalError } from "./errors.ts";
import { fetchErrorToOpCode } from "./translate.ts";
import type { ExtractResult } from "./types.ts";
import { truncate } from "./types.ts";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function htmlToMarkdown(html: string): string {
  const dom = new JSDOM(html);
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  turndown.use(gfm);
  turndown.addRule("removeEmptyLinks", {
    filter: (node: HTMLElement) => node.nodeName === "A" && !node.textContent?.trim(),
    replacement: () => "",
  });
  return turndown
    .turndown(dom.window.document.body)
    .replace(/\[\\?\[\s*\\?\]\]\([^)]*\)/g, "")
    .replace(/ +/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractFromHtml(html: string, url: string): ExtractResult {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article?.content) {
    return { title: article.title || null, content: htmlToMarkdown(article.content) };
  }

  // Fallback: strip noise elements and extract main content
  const fallbackDoc = new JSDOM(html, { url });
  const body = fallbackDoc.window.document;
  for (const el of body.querySelectorAll("script, style, noscript, nav, header, footer, aside")) {
    el.remove();
  }

  const title = body.querySelector("title")?.textContent?.trim() || null;
  const main = body.querySelector("main, article, [role='main'], .content, #content") || body.body;
  const text = main?.innerHTML || "";

  if (text.trim().length > 100) {
    return { title, content: htmlToMarkdown(text) };
  }

  throw new Error("Could not extract readable content from this page.");
}

export async function fetchLocalContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new OperationalError(
        `Content fetch failed (HTTP ${response.status})`,
        fetchErrorToOpCode(response.status),
      );
    }

    const html = await response.text();
    return truncate(extractFromHtml(html, url).content);
  } catch (e) {
    if (e instanceof OperationalError) throw e;
    throw new OperationalError("Content fetch failed", fetchErrorToOpCode(e as Error), e as Error);
  }
}

export async function extractLocal(url: string): Promise<ExtractResult> {
  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new OperationalError(
      `Extraction failed (HTTP ${response.status})`,
      fetchErrorToOpCode(response.status),
    );
  }

  const html = await response.text();
  return extractFromHtml(html, url);
}
