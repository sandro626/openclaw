import { SuperBrowerError } from "./errors.js";

export function superBrowerJsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    details: value,
  };
}

export function superBrowerErrorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return superBrowerJsonResult({
    success: false,
    error: message,
    type: error instanceof SuperBrowerError ? error.name : "Error",
  });
}
