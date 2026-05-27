export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string | null;
  age?: string | null;
}

export interface ExtractResult {
  title: string | null;
  content: string;
}

export function truncate(text: string | undefined | null, maxLen = 5000): string {
  if (!text) return "";
  return text.length > maxLen ? `${text.substring(0, maxLen)}...` : text;
}
