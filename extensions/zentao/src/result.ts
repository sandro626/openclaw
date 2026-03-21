import type { ZentaoToolResult } from "./types.js";

export function zentaoJsonResult(payload: unknown): ZentaoToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function zentaoErrorResult(error: unknown): ZentaoToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return zentaoJsonResult({ error: message });
}
