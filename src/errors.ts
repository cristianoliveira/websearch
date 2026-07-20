// === AXI typed errors ===
// Domain errors that domain/infrastructure code throws.
// Composition root maps them to exit codes and structured output.

export class UsageError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly invalidValue?: string,
    public readonly validValues?: string[],
  ) {
    super(message);
    this.name = "UsageError";
  }
}

export class MissingCredentialError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly envVar: string,
    public readonly signupUrl: string,
  ) {
    super(message);
    this.name = "MissingCredentialError";
  }
}

export class OperationalError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "OperationalError";
  }
}

// === Operational error codes ===

export const OpCode = {
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT",
  INVALID_PROVIDER_RESPONSE: "INVALID_PROVIDER_RESPONSE",
  EXTRACTION_FAILED: "EXTRACTION_FAILED",
  CONTENT_FETCH_PARTIAL: "CONTENT_FETCH_PARTIAL",
} as const;

export type OpCode = (typeof OpCode)[keyof typeof OpCode];
