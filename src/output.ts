import { encode } from "@toon-format/toon";
import type { Envelope } from "./contracts.ts";

// === Rendering boundary ===
// Domain values are format-independent. This module is the only place where
// format encoding (TOON, JSON) happens. Human output is kept separate.

export type RenderFormat = "toon" | "json" | "human";

/** Render an envelope as TOON (default structured format). */
export function renderTOON(envelope: Envelope): string {
  return encode(envelope, { delimiter: "," });
}

/** Render an envelope as JSON (compatibility format). */
export function renderJSON(envelope: Envelope): string {
  return JSON.stringify(envelope);
}
