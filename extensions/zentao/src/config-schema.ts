import { z } from "zod";

export const zentaoModeSchema = z.enum(["read-only", "read-write"]);
export const zentaoApiVersionSchema = z.literal("v1");
export const zentaoCredentialSchema = z
  .object({
    account: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

export const zentaoWriteGuardsSchema = z
  .object({
    requireReason: z.boolean().optional(),
    requireScopeMatch: z.boolean().optional(),
    confirmBeforeDestructive: z.boolean().optional(),
  })
  .strict()
  .default({
    requireReason: true,
    requireScopeMatch: true,
    confirmBeforeDestructive: true,
  });

export const zentaoConfigSchema = z
  .object({
    baseUrl: z.string().url().startsWith("https://"),
    apiVersion: zentaoApiVersionSchema.default("v1"),
    account: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    accountsByAgent: z.record(z.string().min(1), zentaoCredentialSchema).default({}),
    verifyTls: z.boolean().default(true),
    requestTimeoutMs: z.number().int().positive().default(15000),
    mode: zentaoModeSchema.default("read-only"),
    allowedProducts: z.array(z.number().int().positive()).default([]),
    allowedProjects: z.array(z.number().int().positive()).default([]),
    allowedExecutions: z.array(z.number().int().positive()).default([]),
    writeGuards: zentaoWriteGuardsSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasGlobalAccount = typeof value.account === "string";
    const hasGlobalPassword = typeof value.password === "string";
    if (hasGlobalAccount !== hasGlobalPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "account and password must be configured together",
        path: hasGlobalAccount ? ["password"] : ["account"],
      });
    }
  });

export type ZentaoConfig = z.infer<typeof zentaoConfigSchema>;
export type ZentaoCredential = z.infer<typeof zentaoCredentialSchema>;
