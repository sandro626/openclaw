import { z } from "zod";
export { z };

const DmPolicySchema = z.enum(["open", "pairing", "allowlist"]);
const GroupPolicySchema = z.enum(["open", "allowlist", "disabled"]);
const FeishuDomainSchema = z.union([
  z.enum(["feishu", "lark"]),
  z.string().url().startsWith("https://"),
]);
const FeishuConnectionModeSchema = z.enum(["websocket", "webhook"]);

const ToolPolicySchema = z
  .object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  })
  .strict()
  .optional();

const DmConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    systemPrompt: z.string().optional(),
  })
  .strict()
  .optional();

const MarkdownConfigSchema = z
  .object({
    mode: z.enum(["native", "escape", "strip"]).optional(),
    tableMode: z.enum(["native", "ascii", "simple"]).optional(),
  })
  .strict()
  .optional();

// Message render mode: auto (default) = detect markdown, raw = plain text, card = always card
const RenderModeSchema = z.enum(["auto", "raw", "card"]).optional();

// Streaming card mode: when enabled, card replies use Feishu's Card Kit streaming API
// for incremental text display with a "Thinking..." placeholder
const StreamingModeSchema = z.boolean().optional();

const BlockStreamingCoalesceSchema = z
  .object({
    enabled: z.boolean().optional(),
    minDelayMs: z.number().int().positive().optional(),
    maxDelayMs: z.number().int().positive().optional(),
  })
  .strict()
  .optional();

const ChannelHeartbeatVisibilitySchema = z
  .object({
    visibility: z.enum(["visible", "hidden"]).optional(),
    intervalMs: z.number().int().positive().optional(),
  })
  .strict()
  .optional();

/**
 * Dynamic agent creation configuration.
 * When enabled, a new agent is created for each unique DM user.
 */
const DynamicAgentCreationSchema = z
  .object({
    enabled: z.boolean().optional(),
    workspaceTemplate: z.string().optional(),
    agentDirTemplate: z.string().optional(),
    maxAgents: z.number().int().positive().optional(),
  })
  .strict()
  .optional();

/**
 * Personal account configuration (OAuth user identity).
 * Allows OpenClaw to act as an individual Feishu user.
 */
export const FeishuPersonalAccountConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: z.string().optional(), // Display name
    appId: z.string(), // OAuth app ID
    appSecret: z.string(), // OAuth app secret
    // Token storage (can be stored in config or separately)
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    expiresAt: z.number().optional(), // Unix timestamp in ms
    openId: z.string().optional(), // User's Feishu open_id
    unionId: z.string().optional(),
    tenantKey: z.string().optional(),
    // OAuth callback configuration
    redirectUri: z.string().optional(),
  })
  .strict();

/**
 * Feishu tools configuration.
 * Controls which tool categories are enabled.
 *
 * Dependencies:
 * - wiki requires doc (wiki content is edited via doc tools)
 * - perm can work independently but is typically used with drive
 */
const FeishuToolsConfigSchema = z
  .object({
    doc: z.boolean().optional(), // Document operations (default: true)
    wiki: z.boolean().optional(), // Knowledge base operations (default: true, requires doc)
    drive: z.boolean().optional(), // Cloud storage operations (default: true)
    perm: z.boolean().optional(), // Permission management (default: false, sensitive)
    scopes: z.boolean().optional(), // App scopes diagnostic (default: true)
  })
  .strict()
  .optional();

/**
 * Topic session isolation mode for group chats.
 * - "disabled" (default): All messages in a group share one session
 * - "enabled": Messages in different topics get separate sessions
 *
 * When enabled, the session key becomes `chat:{chatId}:topic:{rootId}`
 * for messages within a topic thread, allowing isolated conversations.
 */
const TopicSessionModeSchema = z.enum(["disabled", "enabled"]).optional();

/**
 * OSS storage configuration.
 * When enabled, media files can be uploaded to Aliyun OSS for public access.
 */
const OSSConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    accessKeyId: z.string().optional(),
    accessKeySecret: z.string().optional(),
    bucket: z.string().optional(),
    region: z.string().optional(),
    endpoint: z.string().optional(),
    publicUrlPrefix: z.string().optional(),
    uploadPath: z.string().optional(),
  })
  .strict()
  .optional();

export const FeishuGroupSchema = z
  .object({
    requireMention: z.boolean().optional(),
    tools: ToolPolicySchema,
    skills: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    systemPrompt: z.string().optional(),
    topicSessionMode: TopicSessionModeSchema,
  })
  .strict();

/**
 * Per-account configuration.
 * All fields are optional - missing fields inherit from top-level config.
 */
export const FeishuAccountConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: z.string().optional(), // Display name for this account
    appId: z.string().optional(),
    appSecret: z.string().optional(),
    encryptKey: z.string().optional(),
    verificationToken: z.string().optional(),
    domain: FeishuDomainSchema.optional(),
    connectionMode: FeishuConnectionModeSchema.optional(),
    webhookPath: z.string().optional(),
    webhookPort: z.number().int().positive().optional(),
    capabilities: z.array(z.string()).optional(),
    markdown: MarkdownConfigSchema,
    configWrites: z.boolean().optional(),
    dmPolicy: DmPolicySchema.optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    groupPolicy: GroupPolicySchema.optional(),
    groupAllowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    requireMention: z.boolean().optional(),
    groups: z.record(z.string(), FeishuGroupSchema.optional()).optional(),
    historyLimit: z.number().int().min(0).optional(),
    dmHistoryLimit: z.number().int().min(0).optional(),
    dms: z.record(z.string(), DmConfigSchema).optional(),
    textChunkLimit: z.number().int().positive().optional(),
    chunkMode: z.enum(["length", "newline"]).optional(),
    blockStreamingCoalesce: BlockStreamingCoalesceSchema,
    mediaMaxMb: z.number().positive().optional(),
    heartbeat: ChannelHeartbeatVisibilitySchema,
    renderMode: RenderModeSchema,
    streaming: StreamingModeSchema, // Enable streaming card mode (default: true)
    tools: FeishuToolsConfigSchema,
    oss: OSSConfigSchema, // OSS storage configuration (per-account override)
  })
  .strict();

export const FeishuConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    // Top-level credentials (backward compatible for single-account mode)
    appId: z.string().optional(),
    appSecret: z.string().optional(),
    encryptKey: z.string().optional(),
    verificationToken: z.string().optional(),
    domain: FeishuDomainSchema.optional().default("feishu"),
    connectionMode: FeishuConnectionModeSchema.optional().default("websocket"),
    webhookPath: z.string().optional().default("/feishu/events"),
    webhookPort: z.number().int().positive().optional(),
    capabilities: z.array(z.string()).optional(),
    markdown: MarkdownConfigSchema,
    configWrites: z.boolean().optional(),
    dmPolicy: DmPolicySchema.optional().default("pairing"),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    groupPolicy: GroupPolicySchema.optional().default("allowlist"),
    groupAllowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    requireMention: z.boolean().optional().default(true),
    groups: z.record(z.string(), FeishuGroupSchema.optional()).optional(),
    topicSessionMode: TopicSessionModeSchema,
    historyLimit: z.number().int().min(0).optional(),
    dmHistoryLimit: z.number().int().min(0).optional(),
    dms: z.record(z.string(), DmConfigSchema).optional(),
    textChunkLimit: z.number().int().positive().optional(),
    chunkMode: z.enum(["length", "newline"]).optional(),
    blockStreamingCoalesce: BlockStreamingCoalesceSchema,
    mediaMaxMb: z.number().positive().optional(),
    heartbeat: ChannelHeartbeatVisibilitySchema,
    renderMode: RenderModeSchema, // raw = plain text (default), card = interactive card with markdown
    streaming: StreamingModeSchema, // Enable streaming card mode (default: true)
    tools: FeishuToolsConfigSchema,
    // Dynamic agent creation for DM users
    dynamicAgentCreation: DynamicAgentCreationSchema,
    // OSS storage configuration
    oss: OSSConfigSchema,
    // Multi-account configuration (bot/app accounts)
    accounts: z.record(z.string(), FeishuAccountConfigSchema.optional()).optional(),
    // Personal account configuration (OAuth user identity)
    personalAccounts: z.record(z.string(), FeishuPersonalAccountConfigSchema.optional()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.dmPolicy === "open") {
      const allowFrom = value.allowFrom ?? [];
      const hasWildcard = allowFrom.some((entry) => String(entry).trim() === "*");
      if (!hasWildcard) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allowFrom"],
          message:
            'channels.feishu.dmPolicy="open" requires channels.feishu.allowFrom to include "*"',
        });
      }
    }
  });
