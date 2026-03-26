import { z } from "zod";

export const superBrowerSiteFieldSchema = z
  .object({
    name: z.string().min(1),
    selectors: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const superBrowerSignalSchema = z
  .object({
    type: z
      .enum([
        "text",
        "url",
        "title",
        "cookie",
        "localStorage",
        "sessionStorage",
        "request",
        "response",
      ])
      .default("text"),
    key: z.string().min(1).optional(),
    status: z.number().int().optional(),
    value: z.string().min(1),
  })
  .strict();

export const superBrowerSiteProfileSchema = z
  .object({
    id: z.string().min(1),
    urlPatterns: z.array(z.string().min(1)).default([]),
    fieldConfigs: z.array(superBrowerSiteFieldSchema).default([]),
    agreementSelectors: z.array(z.string().min(1)).default([]),
    submitSelectors: z.array(z.string().min(1)).default([]),
    otpSelectors: z.array(z.string().min(1)).default([]),
    otpMode: z.enum(["single", "digits"]).default("digits"),
    successSignals: z.array(superBrowerSignalSchema).default([]),
    failureSignals: z.array(superBrowerSignalSchema).default([]),
    postLoginCandidates: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const superBrowerPlannerSchema = z
  .object({
    enabled: z.boolean().default(false),
    baseUrl: z.string().min(1).default("https://api.minimax.io/anthropic"),
    apiKeyEnv: z.string().min(1).default("MINIMAX_API_KEY"),
    model: z.string().min(1).default("MiniMax-M2.7"),
    maxTokens: z.number().int().positive().default(2048),
    maxSteps: z.number().int().positive().default(8),
    temperature: z.number().min(0).max(1).default(0.1),
  })
  .strict();

export const superBrowerConfigSchema = z
  .object({
    cdpUrl: z.string().min(1).optional(),
    chromePath: z.string().min(1).optional(),
    headless: z.boolean().default(true),
    connectTimeoutMs: z.number().int().positive().default(15_000),
    actionTimeoutMs: z.number().int().positive().default(10_000),
    snapshotMaxLength: z.number().int().positive().default(4_000),
    launchArgs: z.array(z.string().min(1)).default([]),
    planner: superBrowerPlannerSchema.optional(),
    siteProfiles: z.array(superBrowerSiteProfileSchema).default([]),
  })
  .strict();

export type SuperBrowerConfig = z.infer<typeof superBrowerConfigSchema>;
export type SuperBrowerSiteProfile = z.infer<typeof superBrowerSiteProfileSchema>;
export type SuperBrowerPlannerConfig = z.infer<typeof superBrowerPlannerSchema>;
