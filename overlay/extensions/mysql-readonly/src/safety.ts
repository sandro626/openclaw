import { MysqlReadonlyError } from "./errors.js";

const ALLOWED_PREFIXES = ["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "WITH"] as const;
const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "REPLACE",
  "GRANT",
  "REVOKE",
  "LOCK",
  "UNLOCK",
  "CALL",
  "HANDLER",
  "LOAD",
  "ANALYZE",
  "OPTIMIZE",
  "REPAIR",
  "RENAME",
  "OUTFILE",
  "DUMPFILE",
  "SET",
  "DO",
  "USE",
];

export function assertReadonlySql(sql: string): string {
  const normalized = sql.trim().replace(/;+$/u, "");
  if (!normalized) {
    throw new MysqlReadonlyError("SQL query must not be empty");
  }
  if (/[#]|--|\/\*/u.test(normalized)) {
    throw new MysqlReadonlyError("SQL comments are not allowed in mysql_readonly");
  }
  if (normalized.includes(";")) {
    throw new MysqlReadonlyError("Multiple SQL statements are not allowed in mysql_readonly");
  }

  const upper = normalized.toUpperCase();
  if (!ALLOWED_PREFIXES.some((prefix) => upper.startsWith(prefix))) {
    throw new MysqlReadonlyError(
      "mysql_readonly only allows SELECT, SHOW, DESCRIBE, DESC, EXPLAIN, or WITH queries",
    );
  }
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "u");
    if (pattern.test(upper)) {
      throw new MysqlReadonlyError(`mysql_readonly rejected forbidden keyword: ${keyword}`);
    }
  }

  return normalized;
}

export function extractReferencedTables(sql: string): string[] {
  const normalized = sql.replace(/`/gu, " ");
  const matches = normalized.matchAll(/\b(?:FROM|JOIN)\s+((?:[A-Za-z0-9_]+\.)?[A-Za-z0-9_]+)/giu);
  const tables = new Set<string>();

  for (const match of matches) {
    const reference = match[1];
    const table = reference.includes(".") ? reference.split(".").at(-1) : reference;
    if (table) {
      tables.add(table);
    }
  }

  return [...tables];
}
