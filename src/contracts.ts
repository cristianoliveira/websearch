// === AXI Envelope Types ===
// Stable, provider-independent domain envelopes.
// Used by all renderers (TOON, JSON, human) — same object, different serialization.

import type { SearchResult } from "./types.ts";

export interface Hint {
  command: string;
  reason: string;
}

export interface SuccessEnvelope<T> {
  ok: true;
  command: "home" | "search" | "extract";
  data: T;
  hints: Hint[];
}

export interface ErrorInfo {
  code: string;
  message: string;
  field?: string;
  invalidValue?: string;
  validValues?: string[];
  recovery?: Hint;
}

export interface ErrorEnvelope {
  ok: false;
  command: "home" | "search" | "extract" | null;
  error: ErrorInfo;
}

export type Envelope<T = unknown> = SuccessEnvelope<T> | ErrorEnvelope;

// === Domain data shapes ===

export interface TextPreview {
  text: string;
  totalChars: number;
  truncated: boolean;
}

export interface SearchData {
  query: string;
  provider: string;
  requestedCount: number;
  returnedCount: number;
  totalCount: number | null;
  results: SearchResult[];
}

export interface HomeData {
  executable: string;
  purpose: string;
  defaultProvider: string;
  credentials: Record<string, boolean>;
}

export interface ExtractData {
  url: string;
  title: string | null;
  content: TextPreview;
}

// === Factory functions ===

export function success<T>(
  command: SuccessEnvelope<T>["command"],
  data: T,
  hints: Hint[] = [],
): SuccessEnvelope<T> {
  return { ok: true, command, data, hints };
}

export function error(
  command: ErrorEnvelope["command"],
  code: string,
  message: string,
  extra?: Partial<Omit<ErrorInfo, "code" | "message">>,
): ErrorEnvelope {
  return { ok: false, command, error: { code, message, ...extra } };
}

export function textPreview(text: string, maxLen = 5000): TextPreview {
  return {
    text: text.length > maxLen ? `${text.substring(0, maxLen)}...` : text,
    totalChars: text.length,
    truncated: text.length > maxLen,
  };
}
