import mysql from "mysql2/promise";
import type { PluginLogger } from "../api.js";
import type { MysqlReadonlyConfig } from "./config-schema.js";

export type MysqlReadonlyClient = {
  queryRows(sql: string, database?: string): Promise<unknown[]>;
  end(): Promise<void>;
};

export function createMysqlReadonlyClient(params: {
  config: MysqlReadonlyConfig;
  logger: PluginLogger;
}): MysqlReadonlyClient {
  const pool = mysql.createPool({
    host: params.config.host,
    port: params.config.port,
    user: params.config.user,
    password: params.config.password,
    database: params.config.database,
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 0,
    multipleStatements: false,
    connectTimeout: params.config.connectTimeoutMs,
    ssl: params.config.ssl ? {} : undefined,
  });

  return {
    async queryRows(sql: string, database?: string) {
      const connection = await pool.getConnection();
      try {
        if (database && database !== params.config.database) {
          await connection.changeUser({ database });
        }
        try {
          await connection.query("SET SESSION max_execution_time = ?", [
            params.config.queryTimeoutMs,
          ]);
        } catch (error) {
          params.logger.debug?.(
            `mysql-readonly: max_execution_time unsupported: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        const [rows] = await connection.query({
          sql,
          timeout: params.config.queryTimeoutMs,
          rowsAsArray: false,
        });
        return Array.isArray(rows) ? rows : [];
      } finally {
        connection.release();
      }
    },
    async end() {
      await pool.end();
    },
  };
}
