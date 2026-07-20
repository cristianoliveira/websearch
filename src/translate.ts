import type { OpCode as OpCodeType } from "./errors.ts";
import { OpCode } from "./errors.ts";

// === Secret redaction ===
// Strips common secret patterns from text before it enters any output.
// Never block on presence/absence of secrets; redact and pass through.

const SECRET_PATTERNS: [RegExp, string][] = [
  // Bearer tokens
  [/Bearer\s+[\w\-.]+/gi, "Bearer [REDACTED]"],
  // API keys in query strings
  [/[?&](api_?key|token|secret|auth|access_token)=[^&\s]+/gi, "?$1=[REDACTED]"],
  // x-api-key headers
  [/x-api-key:\s*[^\r\n]+/gi, "x-api-key: [REDACTED]"],
  // Authorization headers (non-bearer)
  [/Authorization:\s*[^\r\n]+/gi, "Authorization: [REDACTED]"],
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// === Bounded upstream body ===
// Truncates provider response body for internal debug context.
// Never expose full body in normal error output.

export function boundedBody(body: string, maxBytes = 500): string {
  if (!body) return "";
  if (body.length <= maxBytes) return body;
  return `${body.substring(0, maxBytes)}... [truncated, ${body.length} total bytes]`;
}

// === HTTP status → OpCode mapping ===

export function fetchErrorToOpCode(statusOrError: number | Error): OpCodeType {
  if (typeof statusOrError === "number") {
    if (statusOrError === 401 || statusOrError === 403) return OpCode.AUTHENTICATION_FAILED;
    if (statusOrError === 429) return OpCode.RATE_LIMITED;
    if (statusOrError >= 500) return OpCode.PROVIDER_UNAVAILABLE;
    if (statusOrError >= 400) return OpCode.INVALID_PROVIDER_RESPONSE;
    return OpCode.PROVIDER_UNAVAILABLE;
  }

  // Error objects: classify by type/name
  if (statusOrError.name === "AbortError" || statusOrError.name === "TimeoutError") {
    return OpCode.PROVIDER_TIMEOUT;
  }
  if (statusOrError instanceof TypeError) {
    return OpCode.PROVIDER_UNAVAILABLE;
  }
  return OpCode.PROVIDER_UNAVAILABLE;
}
