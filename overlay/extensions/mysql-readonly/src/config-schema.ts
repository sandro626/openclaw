import { z } from "zod";

export const mysqlReadonlyConfigSchema = z
  .object({
    host: z.string().min(1),
    port: z.number().int().positive().default(3306),
    user: z.string().min(1),
    password: z.string().min(1),
    database: z.string().min(1),
    allowedTables: z.array(z.string().min(1)).default([]),
    connectTimeoutMs: z.number().int().positive().default(10_000),
    queryTimeoutMs: z.number().int().positive().default(15_000),
    maxRows: z.number().int().positive().default(200),
    ssl: z.boolean().default(false),
  })
  .strict();

export type MysqlReadonlyConfig = z.infer<typeof mysqlReadonlyConfigSchema>;
