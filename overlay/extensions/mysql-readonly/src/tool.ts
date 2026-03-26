import { Type } from "@sinclair/typebox";
import type { AnyAgentTool, PluginLogger } from "openclaw/plugin-sdk";
import { stringEnum } from "../../../src/agents/schema/typebox.js";
import { createMysqlReadonlyClient } from "./client.js";
import type { MysqlReadonlyConfig } from "./config-schema.js";
import { MysqlReadonlyError } from "./errors.js";
import { mysqlReadonlyErrorResult, mysqlReadonlyJsonResult } from "./result.js";
import { assertReadonlySql, extractReferencedTables } from "./safety.js";

const MYSQL_READONLY_ACTIONS = ["list_tables", "describe_table", "query"] as const;

const MysqlReadonlyToolSchema = Type.Object(
  {
    action: stringEnum(MYSQL_READONLY_ACTIONS, {
      description: `Action to perform: ${MYSQL_READONLY_ACTIONS.join(", ")}`,
    }),
    database: Type.Optional(
      Type.String({ description: "Optional database override for this query" }),
    ),
    table: Type.Optional(Type.String({ description: "Table name for describe_table action" })),
    sql: Type.Optional(Type.String({ description: "Read-only SQL query" })),
  },
  { additionalProperties: false },
);

type MysqlReadonlyAction = (typeof MYSQL_READONLY_ACTIONS)[number];

type MysqlReadonlyParams = {
  action: MysqlReadonlyAction;
  database?: string;
  table?: string;
  sql?: string;
};

export function createMysqlReadonlyTool(params: {
  config: MysqlReadonlyConfig;
  logger: PluginLogger;
}): AnyAgentTool {
  const client = createMysqlReadonlyClient(params);
  const allowedTables = new Set(params.config.allowedTables.map((table) => table.toLowerCase()));
  const hasAllowlist = allowedTables.size > 0;

  return {
    name: "mysql_readonly",
    label: "MySQL Readonly",
    description: "Query a MySQL database with a read-only user.",
    parameters: MysqlReadonlyToolSchema,
    async execute(_toolCallId, rawParams) {
      const toolParams = rawParams as MysqlReadonlyParams;
      try {
        switch (toolParams.action) {
          case "list_tables":
            return mysqlReadonlyJsonResult(
              await listTables(client, params.config, toolParams.database),
            );
          case "describe_table":
            if (!toolParams.table?.trim()) {
              throw new MysqlReadonlyError("table is required for describe_table");
            }
            validateDatabaseName(toolParams.database);
            validateTableName(toolParams.table);
            assertAllowedTable(toolParams.table, allowedTables, hasAllowlist);
            return mysqlReadonlyJsonResult(
              await runQuery(
                client,
                params.config,
                `DESCRIBE \`${toolParams.table}\``,
                toolParams.database,
              ),
            );
          case "query":
            if (!toolParams.sql?.trim()) {
              throw new MysqlReadonlyError("sql is required for query");
            }
            validateDatabaseName(toolParams.database);
            assertQueryTablesAllowed(toolParams.sql, allowedTables, hasAllowlist);
            return mysqlReadonlyJsonResult(
              await runQuery(
                client,
                params.config,
                assertReadonlySql(toolParams.sql),
                toolParams.database,
              ),
            );
          default:
            toolParams.action satisfies never;
            throw new MysqlReadonlyError(
              `Unsupported mysql_readonly action: ${String(toolParams.action)}`,
            );
        }
      } catch (error) {
        return mysqlReadonlyErrorResult(error);
      }
    },
  } as AnyAgentTool;
}

async function listTables(
  client: MysqlReadonlyToolClient,
  config: MysqlReadonlyConfig,
  database?: string,
) {
  const result = await runQuery(client, config, "SHOW TABLES", database);
  if (config.allowedTables.length === 0) {
    return result;
  }

  const allowedTables = new Set(config.allowedTables.map((table) => table.toLowerCase()));
  const rows = result.rows.filter((row) =>
    Object.values(row).some(
      (value) => typeof value === "string" && allowedTables.has(value.toLowerCase()),
    ),
  );

  return {
    ...result,
    rowCount: rows.length,
    truncated: false,
    rows,
  };
}

async function runQuery(
  client: MysqlReadonlyToolClient,
  config: MysqlReadonlyConfig,
  sql: string,
  database?: string,
) {
  validateDatabaseName(database);
  const resolvedDatabase = database ?? config.database;
  const rows = await client.queryRows(sql, resolvedDatabase);
  const truncated = rows.length > config.maxRows;
  const items = truncated ? rows.slice(0, config.maxRows) : rows;
  return {
    database: resolvedDatabase,
    sql,
    rowCount: items.length,
    truncated,
    maxRows: config.maxRows,
    rows: items,
  };
}

type MysqlReadonlyToolClient = Pick<ReturnType<typeof createMysqlReadonlyClient>, "queryRows">;

function validateDatabaseName(database: string | undefined) {
  if (database === undefined) {
    return;
  }
  if (!/^[A-Za-z0-9_]+$/u.test(database)) {
    throw new MysqlReadonlyError("database must contain only letters, numbers, and underscores");
  }
}

function validateTableName(table: string) {
  if (!/^[A-Za-z0-9_]+$/u.test(table)) {
    throw new MysqlReadonlyError("table must contain only letters, numbers, and underscores");
  }
}

function assertAllowedTable(table: string, allowedTables: Set<string>, hasAllowlist: boolean) {
  if (!hasAllowlist) {
    return;
  }
  if (!allowedTables.has(table.toLowerCase())) {
    throw new MysqlReadonlyError(`table is not in the mysql_readonly allowlist: ${table}`);
  }
}

function assertQueryTablesAllowed(sql: string, allowedTables: Set<string>, hasAllowlist: boolean) {
  if (!hasAllowlist) {
    return;
  }

  const referencedTables = extractReferencedTables(sql);
  if (referencedTables.length === 0) {
    throw new MysqlReadonlyError(
      "mysql_readonly could not determine referenced tables; use explicit FROM or JOIN with allowed tables only",
    );
  }

  for (const table of referencedTables) {
    assertAllowedTable(table, allowedTables, true);
  }
}
