export type MysqlReadonlyToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details?: unknown;
};

export function mysqlReadonlyJsonResult(payload: unknown): MysqlReadonlyToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function mysqlReadonlyErrorResult(error: unknown): MysqlReadonlyToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return mysqlReadonlyJsonResult({ error: message });
}
