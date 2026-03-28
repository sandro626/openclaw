/**
 * WeCom Channel Plugin
 * 企业微信渠道插件核心实现
 * 支持应用和智能机器人两种模式
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  buildChannelConfigSchema,
  DmPolicySchema,
  GroupPolicySchema,
  DEFAULT_ACCOUNT_ID,
  normalizePluginHttpPath,
  registerPluginHttpRoute,
  type ChannelPlugin,
  type OpenClawConfig,
} from "../api.js";
import { clearAccessTokenCache } from "./api.js";
import {
  handleWeComWebhookRequest,
  registerWeComWebhookTarget,
  DEFAULT_MEDIA_MAX_MB,
} from "./monitor.js";
import { setOSSConfig, isOSSConfigured, uploadUrlToOSS, uploadBufferToOSS } from "./oss.js";
import { registerWeComRobotWebhookTarget } from "./robot.js";
import { getWeComRuntime } from "./runtime.js";
import type {
  WeComConfig,
  WeComRobotConfig,
  ResolvedWeComAccount,
  WeComMessageType,
} from "./types.js";

// WeCom channel metadata
const meta = {
  id: "wecom",
  label: "企业微信",
  selectionLabel: "企业微信 (WeCom)",
  detailLabel: "WeCom Bot",
  docsPath: "/channels/wecom",
  docsLabel: "wecom",
  blurb: "企业微信应用消息推送 API 集成 - 企业内部 AI 助手，支持智能机器人",
  systemImage: "building.2.fill",
};

/**
 * WeCom 配置 Schema (Zod)
 */
const WeComGroupSchema = z
  .object({
    requireMention: z.boolean().optional(),
  })
  .strict();

// OSS 配置 Schema
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
  .optional();

// 通讯录配置 Schema
const ContactsConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    contactsSecret: z.string().optional(),
  })
  .optional();

// 微盘配置 Schema
const WeDriveConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    defaultSpaceId: z.string().optional(),
    uploadPath: z.string().optional(),
    maxFileSize: z.number().optional(),
  })
  .optional();

// 智能机器人配置 Schema
const WeComRobotConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: z.string().optional(),
    robotKey: z.string().optional(),
    webhookPath: z.string().optional(),
    token: z.string().optional(),
    encodingAESKey: z.string().optional(),
    corpId: z.string().optional(),
    dmPolicy: DmPolicySchema.optional().default("open"),
    allowFrom: z.array(z.string()).optional(),
    groupPolicy: GroupPolicySchema.optional().default("open"),
    groupAllowFrom: z.array(z.string()).optional(),
    streamEnabled: z.boolean().optional().default(false),
  })
  .optional();

const WeComConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: z.string().optional(),
    corpId: z.string(),
    agentId: z.number(),
    agentSecret: z.string(),
    token: z.string().optional(),
    encodingAESKey: z.string().optional(),
    webhookUrl: z.string().optional(),
    webhookPath: z.string().optional(),
    dmPolicy: DmPolicySchema.optional().default("pairing"),
    allowFrom: z.array(z.string()).optional(),
    groupPolicy: GroupPolicySchema.optional().default("allowlist"),
    groupAllowFrom: z.array(z.string()).optional(),
    groups: z.record(z.string(), z.object({ requireMention: z.boolean().optional() })).optional(),
    mediaMaxMb: z.number().optional(),
    textChunkLimit: z.number().optional(),
    proxy: z.string().optional(),
    oss: OSSConfigSchema,
    contacts: ContactsConfigSchema,
    wedrive: WeDriveConfigSchema,
    // 智能机器人账户
    robots: z.record(z.string(), WeComRobotConfigSchema).optional(),
  })
  .strict();

/**
 * 解析 WeCom 账户配置
 */
function resolveWeComAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string;
}): ResolvedWeComAccount {
  const { cfg, accountId } = params;
  const config = (cfg.channels?.wecom ?? {}) as WeComConfig;

  const effectiveAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
  const useAccountPath = Boolean(
    (cfg.channels?.wecom as WeComConfig | undefined)?.accounts?.[effectiveAccountId],
  );

  let accountConfig: WeComConfig;

  if (useAccountPath) {
    const accounts = (cfg.channels?.wecom as WeComConfig | undefined)?.accounts;
    accountConfig = (accounts?.[effectiveAccountId] ?? {}) as WeComConfig;
  } else {
    accountConfig = config;
  }

  return {
    accountId: effectiveAccountId,
    name: accountConfig.name,
    enabled: accountConfig.enabled ?? true,
    config: accountConfig,
    // Fallback to channel-level corpId if account-level is not set
    corpId: accountConfig.corpId ?? config.corpId ?? "",
    agentId: accountConfig.agentId ?? 0,
    agentSecret: accountConfig.agentSecret ?? "",
    token: accountConfig.token,
    encodingAESKey: accountConfig.encodingAESKey,
    webhookUrl: accountConfig.webhookUrl,
    webhookPath: accountConfig.webhookPath,
  };
}

/**
 * 列出所有 WeCom 账户 ID (包括应用和机器人)
 */
function listWeComAccountIds(cfg: OpenClawConfig): string[] {
  const config = (cfg.channels?.wecom ?? {}) as WeComConfig;
  const ids: string[] = [];

  // 主应用账户
  if (config.corpId && config.agentId) {
    ids.push(DEFAULT_ACCOUNT_ID);
  }

  // 多应用账户
  const accounts = config.accounts;
  if (accounts) {
    for (const id of Object.keys(accounts)) {
      const account = accounts[id];
      if (account && typeof account === "object" && (account.corpId || account.agentId)) {
        ids.push(id);
      }
    }
  }

  // 智能机器人账户
  const robots = config.robots;
  if (robots) {
    for (const id of Object.keys(robots)) {
      const robot = robots[id];
      if (robot && typeof robot === "object" && robot.enabled !== false) {
        ids.push(id);
      }
    }
  }

  return ids;
}

/**
 * 列出所有智能机器人账户 ID
 */
function listWeComRobotAccountIds(cfg: OpenClawConfig): string[] {
  const config = (cfg.channels?.wecom ?? {}) as WeComConfig;
  const ids: string[] = [];

  const robots = config.robots;
  if (robots) {
    for (const id of Object.keys(robots)) {
      const robot = robots[id];
      if (robot && typeof robot === "object" && robot.enabled !== false) {
        ids.push(id);
      }
    }
  }

  return ids;
}

/**
 * 检查账户是否为机器人账户
 */
function isRobotAccount(cfg: OpenClawConfig, accountId: string): boolean {
  const config = (cfg.channels?.wecom ?? {}) as WeComConfig;
  const robots = config.robots;
  return robots ? accountId in robots : false;
}

/**
 * 解析默认 WeCom 账户 ID
 */
function resolveDefaultWeComAccountId(cfg: OpenClawConfig): string {
  const ids = listWeComAccountIds(cfg);
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

/**
 * WeCom Channel Plugin
 * 包含标准 outbound 方法以及扩展方法:
 * - sendTextCard: 发送文本卡片
 * - sendNews: 发送图文消息
 * - sendMarkdown: 发送 Markdown 消息
 * - wedrive*: 微盘相关方法
 * - getDepartment*: 通讯录相关方法
 * - getUser*, searchUser*: 成员管理方法
 * - getTag*: 标签管理方法
 * - sendWithMentions: @成员功能
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const wecomPlugin: ChannelPlugin<ResolvedWeComAccount> & Record<string, any> = {
  id: "wecom",
  meta: {
    ...meta,
    quickstartAllowFrom: true,
  },
  pairing: {
    idLabel: "userId",
    normalizeAllowEntry: (entry) => {
      return entry.replace(/^wecom:(user:)?/i, "");
    },
    notifyApproval: async ({ cfg, id }) => {
      // 发送批准通知
      // TODO: 实现发送消息功能
    },
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: true,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.wecom"] },
  configSchema: buildChannelConfigSchema(WeComConfigSchema),
  config: {
    listAccountIds: (cfg) => listWeComAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveWeComAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultWeComAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      const wecomConfig = (cfg.channels?.wecom ?? {}) as WeComConfig;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            wecom: {
              ...wecomConfig,
              enabled,
            },
          },
        };
      }

      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          wecom: {
            ...wecomConfig,
            accounts: {
              ...wecomConfig.accounts,
              [accountId]: {
                ...(wecomConfig.accounts?.[accountId] as object | undefined),
                enabled,
              },
            },
          },
        },
      };
    },
    deleteAccount: ({ cfg, accountId }) => {
      const wecomConfig = (cfg.channels?.wecom ?? {}) as WeComConfig;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        const {
          corpId,
          agentId,
          agentSecret,
          token,
          encodingAESKey,
          webhookUrl,
          webhookPath,
          ...rest
        } = wecomConfig;
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            wecom: rest,
          },
        };
      }

      const accounts = { ...wecomConfig.accounts };
      delete accounts[accountId];

      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          wecom: {
            ...wecomConfig,
            accounts: Object.keys(accounts).length > 0 ? accounts : undefined,
          },
        },
      };
    },
    isConfigured: (account) => {
      return Boolean(account.corpId && account.agentId && account.agentSecret);
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.corpId && account.agentId && account.agentSecret),
      tokenSource: "config",
    }),
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      return (account.config.allowFrom ?? []).map((entry) => String(entry));
    },
    formatAllowFrom: ({ allowFrom }) => {
      return allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/^wecom:(user:)?/i, ""));
    },
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(
        (cfg.channels?.wecom as WeComConfig | undefined)?.accounts?.[resolvedAccountId],
      );
      const basePath = useAccountPath
        ? `channels.wecom.accounts.${resolvedAccountId}.`
        : "channels.wecom.";

      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: "openclaw pairing approve wecom <code>",
        normalizeEntry: (raw) => raw.replace(/^wecom:(user:)?/i, ""),
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const warnings: string[] = [];
      const defaultGroupPolicy = (cfg.channels?.defaults as { groupPolicy?: string } | undefined)
        ?.groupPolicy;
      const groupPolicy = account.config.groupPolicy ?? defaultGroupPolicy ?? "allowlist";

      if (groupPolicy === "open") {
        warnings.push(
          '- WeCom groups: groupPolicy="open" allows any member in groups to trigger. ' +
            'Set channels.wecom.groupPolicy="allowlist" + channels.wecom.groupAllowFrom to restrict senders.',
        );
      }

      return warnings;
    },
  },
  groups: {
    resolveRequireMention: ({ cfg, accountId, groupId }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const groups = account.config.groups;

      if (!groups) return false;

      const groupConfig = groups[groupId] ?? groups["*"];
      return groupConfig?.requireMention ?? false;
    },
  },
  messaging: {
    normalizeTarget: (target) => {
      const trimmed = target.trim();
      if (!trimmed) return null;
      return trimmed.replace(/^wecom:(group|user):/i, "").replace(/^wecom:/i, "");
    },
    targetResolver: {
      looksLikeId: (id) => {
        const trimmed = id?.trim();
        if (!trimmed) return false;
        // WeCom user IDs are typically alphanumeric
        // Group IDs start with chat_id or similar
        return /^[a-zA-Z0-9_:-]+$/.test(trimmed) || /^wecom:/i.test(trimmed);
      },
      hint: "<userId|chatId>",
    },
  },
  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },
  setup: {
    resolveAccountId: ({ accountId }) => accountId ?? DEFAULT_ACCOUNT_ID,
    applyAccountName: ({ cfg, accountId, name }) => {
      const wecomConfig = (cfg.channels?.wecom ?? {}) as WeComConfig;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            wecom: {
              ...wecomConfig,
              name,
            },
          },
        };
      }

      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          wecom: {
            ...wecomConfig,
            accounts: {
              ...wecomConfig.accounts,
              [accountId]: {
                ...(wecomConfig.accounts?.[accountId] as object | undefined),
                name,
              },
            },
          },
        },
      };
    },
    validateInput: ({ accountId, input }) => {
      const typedInput = input as {
        corpId?: string;
        agentId?: number;
        agentSecret?: string;
        token?: string;
        encodingAESKey?: string;
      };

      if (!typedInput.corpId) {
        return "WeCom requires corpId (企业ID).";
      }

      if (!typedInput.agentId) {
        return "WeCom requires agentId (应用ID).";
      }

      if (!typedInput.agentSecret) {
        return "WeCom requires agentSecret (应用Secret).";
      }

      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const typedInput = input as {
        name?: string;
        corpId?: string;
        agentId?: number;
        agentSecret?: string;
        token?: string;
        encodingAESKey?: string;
        webhookUrl?: string;
        webhookPath?: string;
        dmPolicy?: WeComConfig["dmPolicy"];
        allowFrom?: string[];
      };

      const wecomConfig = (cfg.channels?.wecom ?? {}) as WeComConfig;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            wecom: {
              ...wecomConfig,
              enabled: true,
              ...(typedInput.name ? { name: typedInput.name } : {}),
              ...(typedInput.corpId ? { corpId: typedInput.corpId } : {}),
              ...(typedInput.agentId ? { agentId: typedInput.agentId } : {}),
              ...(typedInput.agentSecret ? { agentSecret: typedInput.agentSecret } : {}),
              ...(typedInput.token ? { token: typedInput.token } : {}),
              ...(typedInput.encodingAESKey ? { encodingAESKey: typedInput.encodingAESKey } : {}),
              ...(typedInput.webhookUrl ? { webhookUrl: typedInput.webhookUrl } : {}),
              ...(typedInput.webhookPath ? { webhookPath: typedInput.webhookPath } : {}),
              ...(typedInput.dmPolicy ? { dmPolicy: typedInput.dmPolicy } : {}),
              ...(typedInput.allowFrom ? { allowFrom: typedInput.allowFrom } : {}),
            },
          },
        };
      }

      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          wecom: {
            ...wecomConfig,
            enabled: true,
            accounts: {
              ...wecomConfig.accounts,
              [accountId]: {
                ...(wecomConfig.accounts?.[accountId] as object | undefined),
                enabled: true,
                ...(typedInput.name ? { name: typedInput.name } : {}),
                ...(typedInput.corpId ? { corpId: typedInput.corpId } : {}),
                ...(typedInput.agentId ? { agentId: typedInput.agentId } : {}),
                ...(typedInput.agentSecret ? { agentSecret: typedInput.agentSecret } : {}),
                ...(typedInput.token ? { token: typedInput.token } : {}),
                ...(typedInput.encodingAESKey ? { encodingAESKey: typedInput.encodingAESKey } : {}),
                ...(typedInput.webhookUrl ? { webhookUrl: typedInput.webhookUrl } : {}),
                ...(typedInput.webhookPath ? { webhookPath: typedInput.webhookPath } : {}),
                ...(typedInput.dmPolicy ? { dmPolicy: typedInput.dmPolicy } : {}),
                ...(typedInput.allowFrom ? { allowFrom: typedInput.allowFrom } : {}),
              },
            },
          },
        },
      };
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getWeComRuntime().channel.text.chunkMarkdownText(text, limit),
    textChunkLimit: 2048,
    sendPayload: async ({
      to,
      payload,
      accountId,
      cfg,
      robotResponseUrl,
      robotSenderId,
      robotChatId,
    }) => {
      const runtime = getWeComRuntime();
      const account = resolveWeComAccount({ cfg, accountId });

      // 如果有 robotResponseUrl，尝试使用智能机器人的 response_url 回复
      // 注意: response_url 只能使用一次，如果失败需要fallback到应用API发送私聊
      if (robotResponseUrl) {
        console.error("[WeCom] Using robotResponseUrl for delivery");
        const text = payload.text ?? "";
        let lastMessageId = "";
        let responseUrlFailed = false;

        if (text.trim()) {
          const tableMode = runtime.channel.text.resolveMarkdownTableMode({
            cfg,
            channel: "wecom",
            accountId: accountId ?? undefined,
          });
          const convertedText = runtime.channel.text.convertMarkdownTables(
            text,
            tableMode ?? "code",
          );
          const chunkMode = runtime.channel.text.resolveChunkMode(cfg, "wecom", accountId);
          const chunks = runtime.channel.text.chunkMarkdownTextWithMode(
            convertedText,
            2048,
            chunkMode,
          );

          for (const chunk of chunks) {
            const response = await fetch(robotResponseUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                msgtype: "markdown",
                markdown: { content: chunk },
              }),
            });
            const responseText = await response.text();
            console.error(
              `[WeCom] Robot response_url delivery response: ${response.status} ${responseText}`,
            );

            // Parse response to check for WeCom error codes
            try {
              const result = JSON.parse(responseText);
              const errcode = Number(result.errcode);
              if (errcode && errcode !== 0) {
                console.error(
                  `[WeCom] Robot response_url delivery failed with errcode: ${errcode}, errmsg: ${result.errmsg}`,
                );
                // errcode 60140 = invalid response code (response_url已被使用或过期)
                // 需要fallback到应用API
                if (errcode === 60140) {
                  console.error("[WeCom] response_url已失效(可能已被使用)，将fallback到应用API");
                  responseUrlFailed = true;
                  break;
                }
                throw new Error(`Robot response_url delivery failed: ${result.errmsg || errcode}`);
              }
            } catch (parseErr) {
              if (!response.ok) {
                throw new Error(`Robot response_url delivery failed: ${response.status}`);
              }
            }
            lastMessageId = `robot-${Date.now()}`;
          }
        }

        // 如果response_url成功，直接返回
        if (!responseUrlFailed) {
          return {
            channel: "wecom",
            messageId: lastMessageId,
            chatId: to,
          };
        }
        // 否则继续使用应用API fallback发送私聊
        console.error("[WeCom] Falling back to application API for delivery");
        if (robotChatId) {
          console.error(`[WeCom] Sending to group chat via appchat API: ${robotChatId}`);
        } else if (robotSenderId) {
          console.error(`[WeCom] Sending private message to sender: ${robotSenderId}`);
        }
      }

      // 使用应用 API (access_token) 发送
      // 如果是fallback且有robotChatId，则使用appchat API发送群聊消息
      // 如果是fallback且有robotSenderId，则发送私聊消息
      // 注意：智能机器人的response_url只能用一次
      // 应用API发送可能因权限问题失败，静默处理
      const isGroupChat = Boolean(robotChatId);
      const targetUser = isGroupChat
        ? robotChatId!
        : robotSenderId || to.replace(/^(user:|group:)/, "");

      try {
        const {
          getAccessToken,
          sendMessage,
          sendAppchatMessage,
          uploadMedia,
          sendImageMessage,
          sendFileMessage,
          sendVideoMessage,
          sendVoiceMessage,
        } = await import("./api.js");
        const accessToken = await getAccessToken(account.corpId, account.agentSecret);

        let lastMessageId = "";

        // 处理媒体文件
        const mediaUrls = payload.mediaUrls ?? [];
        const mediaMaxMb = account.config.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB;
        const maxBytes = mediaMaxMb * 1024 * 1024;

        for (const mediaUrl of mediaUrls) {
          try {
            let mediaBuffer: Buffer;
            let filename: string;
            let contentType: string;

            // 检查是否是本地文件路径
            const isLocalFile = mediaUrl.startsWith("/") || mediaUrl.startsWith("file://");
            const filePath = mediaUrl.startsWith("file://") ? mediaUrl.slice(7) : mediaUrl;

            if (isLocalFile && existsSync(filePath)) {
              // 从本地文件读取
              console.error(`[WeCom] Reading local file: ${filePath}`);
              mediaBuffer = await readFile(filePath);
              filename = filePath.split("/").pop() || "media";

              // 根据扩展名推断 MIME 类型
              const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : "";
              const mimeTypes: Record<string, string> = {
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                png: "image/png",
                gif: "image/gif",
                webp: "image/webp",
                mp3: "audio/mpeg",
                wav: "audio/wav",
                ogg: "audio/ogg",
                mp4: "video/mp4",
                webm: "video/webm",
                mov: "video/quicktime",
                pdf: "application/pdf",
                txt: "text/plain",
                doc: "application/msword",
                docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                xls: "application/vnd.ms-excel",
                xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              };
              contentType = mimeTypes[ext || ""] || "application/octet-stream";
            } else {
              // 从 URL 下载
              const mediaResponse = await fetch(mediaUrl);
              if (!mediaResponse.ok) {
                console.error(`[WeCom] Failed to fetch media: ${mediaUrl}`);
                continue;
              }

              const contentLength = mediaResponse.headers.get("content-length");
              if (contentLength && parseInt(contentLength, 10) > maxBytes) {
                console.error(`[WeCom] Media file too large: ${mediaUrl}`);
                continue;
              }

              mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
              contentType = mediaResponse.headers.get("content-type") || "application/octet-stream";
              try {
                filename = new URL(mediaUrl).pathname.split("/").pop() || "media";
              } catch {
                filename = "media";
              }
            }

            // 检查文件大小
            if (mediaBuffer.length > maxBytes) {
              console.error(`[WeCom] Media file too large: ${mediaBuffer.length} bytes`);
              continue;
            }

            // 检测媒体类型
            let mediaType: "image" | "voice" | "video" | "file" = "file";
            if (contentType.startsWith("image/")) {
              mediaType = "image";
            } else if (contentType.startsWith("audio/")) {
              mediaType = "voice";
            } else if (contentType.startsWith("video/")) {
              mediaType = "video";
            }

            // 上传到 OSS (如果配置了)
            let ossUrl: string | undefined;
            if (isOSSConfigured()) {
              const ossResult = await uploadBufferToOSS(mediaBuffer, filename, contentType);
              if (ossResult) {
                ossUrl = ossResult.url;
                console.error(`[WeCom] Media uploaded to OSS: ${ossUrl}`);
              }
            }

            // 上传到企业微信
            const uploadResult = await uploadMedia(accessToken, mediaType, mediaBuffer, filename);

            // 发送消息
            const sendParams = {
              touser: to,
              agentid: account.agentId,
              media_id: uploadResult.mediaId,
            };

            switch (mediaType) {
              case "image":
                const imgResult = await sendImageMessage(accessToken, sendParams);
                lastMessageId = imgResult.messageId;
                break;
              case "voice":
                const voiceResult = await sendVoiceMessage(accessToken, sendParams);
                lastMessageId = voiceResult.messageId;
                break;
              case "video":
                const videoResult = await sendVideoMessage(accessToken, {
                  ...sendParams,
                  title: filename,
                });
                lastMessageId = videoResult.messageId;
                break;
              default:
                const fileResult = await sendFileMessage(accessToken, sendParams);
                lastMessageId = fileResult.messageId;
            }

            // 如果有 OSS URL，发送下载链接
            if (ossUrl && mediaType === "file") {
              const linkText = `📎 文件下载链接: ${ossUrl}`;
              await sendMessage(accessToken, {
                touser: targetUser,
                msgtype: "text",
                agentid: account.agentId,
                text: { content: linkText },
                safe: 0,
              });
            }
          } catch (err) {
            console.error(`[WeCom] Error sending media ${mediaUrl}:`, err);
          }
        }

        // 处理文本
        const text = payload.text ?? "";
        if (text.trim()) {
          const tableMode = runtime.channel.text.resolveMarkdownTableMode({
            cfg,
            channel: "wecom",
            accountId: accountId ?? undefined,
          });
          const convertedText = runtime.channel.text.convertMarkdownTables(
            text,
            tableMode ?? "code",
          );

          // 分块发送
          const chunkMode = runtime.channel.text.resolveChunkMode(cfg, "wecom", accountId);
          const chunks = runtime.channel.text.chunkMarkdownTextWithMode(
            convertedText,
            2048,
            chunkMode,
          );

          for (const chunk of chunks) {
            if (isGroupChat) {
              // 首先尝试使用 appchat API 发送群聊消息
              try {
                console.error(`[WeCom] Attempting appchat API delivery to group: ${targetUser}`);
                const result = await sendAppchatMessage(accessToken, {
                  chatid: targetUser,
                  msgtype: "text",
                  text: { content: chunk },
                  safe: 0,
                });
                lastMessageId = result.messageId;
              } catch (appchatError) {
                // appchat API 失败（通常是权限问题：群聊由其他机器人创建）
                // Fallback 到私聊发送给发送者
                const errorMsg =
                  appchatError instanceof Error ? appchatError.message : String(appchatError);
                console.error(
                  `[WeCom] Appchat API failed (${errorMsg}), falling back to private message`,
                );

                if (robotSenderId) {
                  console.error(`[WeCom] Sending private message to sender: ${robotSenderId}`);
                  const result = await sendMessage(accessToken, {
                    touser: robotSenderId,
                    msgtype: "text",
                    agentid: account.agentId,
                    text: { content: `[群聊回复] ${chunk}` },
                    safe: 0,
                  });
                  lastMessageId = result.messageId;
                } else {
                  throw new Error("Appchat failed and no senderId for private message fallback");
                }
              }
            } else {
              // 使用 message API 发送私聊消息
              const result = await sendMessage(accessToken, {
                touser: targetUser,
                msgtype: "text",
                agentid: account.agentId,
                text: { content: chunk },
                safe: 0,
              });
              lastMessageId = result.messageId;
            }
          }
        }

        return {
          channel: "wecom",
          messageId: lastMessageId,
          chatId: isGroupChat && robotSenderId ? `user:${robotSenderId}` : targetUser,
        };
      } catch (fallbackError) {
        // 所有fallback都失败
        console.error(`[WeCom] All fallback methods failed: ${fallbackError}`);
        return {
          channel: "wecom",
          messageId: "",
          chatId: targetUser,
          error: "Message could not be delivered (response_url expired, all fallbacks failed)",
        };
      }
    },
    sendText: async ({
      to,
      text,
      accountId,
      cfg,
      robotResponseUrl,
      robotSenderId,
      robotChatId,
    }) => {
      const runtime = getWeComRuntime();
      const account = resolveWeComAccount({ cfg, accountId });

      // 如果有 robotResponseUrl，尝试使用智能机器人的 response_url 回复
      // 注意: response_url 只能使用一次，如果失败需要fallback到应用API发送私聊
      if (robotResponseUrl) {
        console.error("[WeCom] Using robotResponseUrl for text delivery");
        let lastMessageId = "";
        let responseUrlFailed = false;

        const tableMode = runtime.channel.text.resolveMarkdownTableMode({
          cfg,
          channel: "wecom",
          accountId: accountId ?? undefined,
        });
        const convertedText = runtime.channel.text.convertMarkdownTables(text, tableMode ?? "code");
        const chunkMode = runtime.channel.text.resolveChunkMode(cfg, "wecom", accountId);
        const chunks = runtime.channel.text.chunkMarkdownTextWithMode(
          convertedText,
          2048,
          chunkMode,
        );

        for (const chunk of chunks) {
          const response = await fetch(robotResponseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              msgtype: "markdown",
              markdown: { content: chunk },
            }),
          });
          const responseText = await response.text();
          console.error(
            `[WeCom] Robot response_url text delivery response: ${response.status} ${responseText}`,
          );

          // Parse response to check for WeCom error codes
          try {
            const result = JSON.parse(responseText);
            const errcode = Number(result.errcode);
            if (errcode && errcode !== 0) {
              console.error(
                `[WeCom] Robot response_url text delivery failed with errcode: ${errcode}, errmsg: ${result.errmsg}`,
              );
              // errcode 60140 = invalid response code (response_url已被使用或过期)
              // 需要fallback到应用API
              if (errcode === 60140) {
                console.error("[WeCom] response_url已失效(可能已被使用)，将fallback到应用API");
                responseUrlFailed = true;
                break;
              }
              throw new Error(
                `Robot response_url text delivery failed: ${result.errmsg || errcode}`,
              );
            }
          } catch (parseErr) {
            if (!response.ok) {
              throw new Error(`Robot response_url text delivery failed: ${response.status}`);
            }
          }
          lastMessageId = `robot-${Date.now()}`;
        }

        // 如果response_url成功，直接返回
        if (!responseUrlFailed) {
          return {
            channel: "wecom",
            messageId: lastMessageId,
            chatId: to,
          };
        }
        // 否则继续使用应用API fallback发送私聊
        console.error("[WeCom] Falling back to application API for text delivery");
        if (robotChatId) {
          console.error(`[WeCom] Sending to group chat via appchat API: ${robotChatId}`);
        } else if (robotSenderId) {
          console.error(`[WeCom] Sending private message to sender: ${robotSenderId}`);
        }
      }

      // 使用应用 API (access_token) 发送
      // 策略：先尝试 appchat API 发送群聊，如果失败则 fallback 到私聊
      const isGroupChat = Boolean(robotChatId);
      const targetUser = isGroupChat
        ? robotChatId!
        : robotSenderId || to.replace(/^(user:|group:)/, "");

      // 注意：智能机器人的response_url只能用一次
      // 应用API发送可能因权限问题失败，需要多级fallback
      try {
        const { getAccessToken, sendMessage, sendAppchatMessage } = await import("./api.js");
        const accessToken = await getAccessToken(account.corpId, account.agentSecret);

        const tableMode = runtime.channel.text.resolveMarkdownTableMode({
          cfg,
          channel: "wecom",
          accountId: accountId ?? undefined,
        });
        const convertedText = runtime.channel.text.convertMarkdownTables(text, tableMode ?? "code");

        const chunkMode = runtime.channel.text.resolveChunkMode(cfg, "wecom", accountId);
        const chunks = runtime.channel.text.chunkMarkdownTextWithMode(
          convertedText,
          2048,
          chunkMode,
        );

        let lastMessageId = "";
        let deliveryMethod = "";

        for (const chunk of chunks) {
          if (isGroupChat) {
            // 首先尝试使用 appchat API 发送群聊消息
            try {
              console.error(`[WeCom] Attempting appchat API delivery to group: ${targetUser}`);
              const result = await sendAppchatMessage(accessToken, {
                chatid: targetUser,
                msgtype: "text",
                text: { content: chunk },
                safe: 0,
              });
              lastMessageId = result.messageId;
              deliveryMethod = "appchat";
            } catch (appchatError) {
              // appchat API 失败（通常是权限问题：群聊由其他机器人创建）
              // Fallback 到私聊发送给发送者
              const errorMsg =
                appchatError instanceof Error ? appchatError.message : String(appchatError);
              console.error(
                `[WeCom] Appchat API failed (${errorMsg}), falling back to private message`,
              );

              if (robotSenderId) {
                console.error(`[WeCom] Sending private message to sender: ${robotSenderId}`);
                const result = await sendMessage(accessToken, {
                  touser: robotSenderId,
                  msgtype: "text",
                  agentid: account.agentId,
                  text: { content: `[群聊回复] ${chunk}` },
                  safe: 0,
                });
                lastMessageId = result.messageId;
                deliveryMethod = "private-message";
              } else {
                throw new Error("Appchat failed and no senderId for private message fallback");
              }
            }
          } else {
            // 使用 message API 发送私聊消息
            const result = await sendMessage(accessToken, {
              touser: targetUser,
              msgtype: "text",
              agentid: account.agentId,
              text: { content: chunk },
              safe: 0,
            });
            lastMessageId = result.messageId;
            deliveryMethod = "private-message";
          }
        }

        return {
          channel: "wecom",
          messageId: lastMessageId,
          chatId:
            deliveryMethod === "private-message"
              ? `user:${robotSenderId || targetUser}`
              : targetUser,
        };
      } catch (fallbackError) {
        // 所有fallback都失败
        console.error(`[WeCom] All fallback methods failed: ${fallbackError}`);
        return {
          channel: "wecom",
          messageId: "",
          chatId: targetUser,
          error: "Message could not be delivered (response_url expired, all fallbacks failed)",
        };
      }
    },
    sendMedia: async ({ to, text, mediaUrl, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken, sendTextCardMessage } = await import("./api.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);

      let lastMessageId = "";
      const mediaMaxMb = account.config.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB;
      const maxBytes = mediaMaxMb * 1024 * 1024;

      // 检测是否是本地文件路径
      const isLocalFile = !mediaUrl.startsWith("http://") && !mediaUrl.startsWith("https://");

      try {
        let filename: string;
        let ossResult: { url: string; size: number; key: string; contentType: string } | null =
          null;

        if (isLocalFile) {
          // 处理本地文件
          const fs = await import("node:fs");
          const path = await import("node:path");

          if (!fs.existsSync(mediaUrl)) {
            throw new Error(`Local file not found: ${mediaUrl}`);
          }

          const stats = fs.statSync(mediaUrl);
          if (stats.size > maxBytes) {
            throw new Error(`File too large: ${stats.size} bytes (max: ${maxBytes})`);
          }

          filename = path.basename(mediaUrl);
          const buffer = fs.readFileSync(mediaUrl);

          // 上传到OSS
          if (isOSSConfigured()) {
            ossResult = await uploadBufferToOSS(buffer, filename);
            console.error(`[WeCom] Uploaded local file to OSS: ${ossResult?.url}`);
          } else {
            throw new Error("OSS not configured, cannot send local file");
          }

          // 发送链接卡片
          if (ossResult) {
            const cardTitle = text || filename;
            const cardDesc = `文件大小: ${(ossResult.size / 1024).toFixed(1)} KB`;

            const result = await sendTextCardMessage(accessToken, {
              touser: to,
              agentid: account.agentId,
              title: cardTitle,
              description: cardDesc,
              url: ossResult.url,
              btntxt: "下载文件",
            });

            lastMessageId = result.messageId;
            console.error(`[WeCom] Sent local file via OSS: ${ossResult.url}`);
          }
        } else {
          // 处理远程URL
          const urlPath = new URL(mediaUrl).pathname;
          filename = decodeURIComponent(urlPath.split("/").pop() || "file");

          // 优先使用 OSS 上传
          if (isOSSConfigured()) {
            ossResult = await uploadUrlToOSS(mediaUrl, filename);

            if (ossResult) {
              // 发送链接卡片
              const cardTitle = text || filename;
              const cardDesc = `文件大小: ${(ossResult.size / 1024).toFixed(1)} KB`;

              const result = await sendTextCardMessage(accessToken, {
                touser: to,
                agentid: account.agentId,
                title: cardTitle,
                description: cardDesc,
                url: ossResult.url,
                btntxt: "下载文件",
              });

              lastMessageId = result.messageId;
              console.error(`[WeCom] Sent media via OSS: ${ossResult.url}`);
              return {
                channel: "wecom",
                messageId: lastMessageId,
                chatId: to,
              };
            }
          }

          // OSS 未配置或上传失败，回退到企业微信临时素材
          const {
            uploadMedia,
            sendImageMessage,
            sendFileMessage,
            sendVideoMessage,
            sendVoiceMessage,
          } = await import("./api.js");

          // 1. 下载媒体文件
          const fetchImpl = fetch;
          const mediaResponse = await fetchImpl(mediaUrl);

          if (!mediaResponse.ok) {
            throw new Error(`Failed to fetch media: HTTP ${mediaResponse.status}`);
          }

          const contentLength = mediaResponse.headers.get("content-length");
          if (contentLength && parseInt(contentLength, 10) > maxBytes) {
            throw new Error(`Media file too large: ${contentLength} bytes (max: ${maxBytes})`);
          }

          const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());

          if (mediaBuffer.length > maxBytes) {
            throw new Error(`Media file too large: ${mediaBuffer.length} bytes (max: ${maxBytes})`);
          }

          // 2. 检测媒体类型
          const contentType =
            mediaResponse.headers.get("content-type") || "application/octet-stream";

          let mediaType: "image" | "voice" | "video" | "file" = "file";
          if (contentType.startsWith("image/")) {
            mediaType = "image";
          } else if (contentType.startsWith("audio/")) {
            mediaType = "voice";
          } else if (contentType.startsWith("video/")) {
            mediaType = "video";
          }

          // 3. 上传到企业微信
          const uploadResult = await uploadMedia(accessToken, mediaType, mediaBuffer, filename);

          // 4. 发送消息
          const sendParams = {
            touser: to,
            agentid: account.agentId,
            media_id: uploadResult.mediaId,
          };

          switch (mediaType) {
            case "image":
              const imgResult = await sendImageMessage(accessToken, sendParams);
              lastMessageId = imgResult.messageId;
              break;
            case "voice":
              const voiceResult = await sendVoiceMessage(accessToken, sendParams);
              lastMessageId = voiceResult.messageId;
              break;
            case "video":
              const videoResult = await sendVideoMessage(accessToken, {
                ...sendParams,
                title: text || filename,
              });
              lastMessageId = videoResult.messageId;
              break;
            default:
              const fileResult = await sendFileMessage(accessToken, sendParams);
              lastMessageId = fileResult.messageId;
          }
        }
      } catch (err) {
        console.error("[WeCom] sendMedia error:", err);
        throw err;
      }

      return {
        channel: "wecom",
        messageId: lastMessageId,
        chatId: to,
      };
    },
    /**
     * 发送文本卡片消息（链接卡片）
     */
    sendTextCard: async ({ to, title, description, url, buttonText, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });

      const { getAccessToken, sendTextCardMessage } = await import("./api.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);

      const result = await sendTextCardMessage(accessToken, {
        touser: to,
        agentid: account.agentId,
        title: title || "链接",
        description: description || "",
        url: url || "",
        btntxt: buttonText || "查看详情",
      });

      return {
        channel: "wecom",
        messageId: result.messageId,
        chatId: to,
      };
    },
    /**
     * 发送图文消息（多条图文卡片）
     */
    sendNews: async ({ to, articles, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });

      const { getAccessToken, sendNewsMessage } = await import("./api.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);

      // 确保文章格式正确
      const formattedArticles = (articles || []).map((article) => ({
        title: article.title || "",
        description: article.description || "",
        url: article.url || "",
        picurl: article.picurl || article.picUrl || "",
      }));

      const result = await sendNewsMessage(accessToken, {
        touser: to,
        agentid: account.agentId,
        articles: formattedArticles,
      });

      return {
        channel: "wecom",
        messageId: result.messageId,
        chatId: to,
      };
    },
    /**
     * 发送 Markdown 消息
     */
    sendMarkdown: async ({ to, content, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });

      const { getAccessToken, sendMarkdownMessage } = await import("./api.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);

      const result = await sendMarkdownMessage(accessToken, {
        touser: to,
        agentid: account.agentId,
        content: content || "",
      });

      return {
        channel: "wecom",
        messageId: result.messageId,
        chatId: to,
      };
    },
    // ===================== 微盘 (WeDrive) 功能 =====================
    /**
     * 获取微盘空间列表
     */
    wedriveGetSpaces: async ({ userId, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { getSpaceList } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return getSpaceList(accessToken, { userId });
    },
    /**
     * 获取微盘文件列表
     */
    wedriveGetFileList: async ({
      userId,
      spaceId,
      fatherId,
      sortType,
      start,
      limit,
      accountId,
      cfg,
    }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { getFileList } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return getFileList(accessToken, { userId, spaceId, fatherId, sortType, start, limit });
    },
    /**
     * 获取微盘文件信息
     */
    wedriveGetFileInfo: async ({ userId, fileId, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { getFileInfo } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return getFileInfo(accessToken, { userId, fileId });
    },
    /**
     * 上传文件到微盘
     */
    wedriveUploadFile: async ({
      userId,
      spaceId,
      fatherId,
      fileName,
      fileContent,
      accountId,
      cfg,
    }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { uploadFile } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return uploadFile(accessToken, { userId, spaceId, fatherId, fileName, fileContent });
    },
    /**
     * 下载微盘文件
     */
    wedriveDownloadFile: async ({ userId, fileId, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { downloadFile } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return downloadFile(accessToken, { userId, fileId });
    },
    /**
     * 在微盘创建文件夹
     */
    wedriveCreateFolder: async ({ userId, spaceId, fatherId, folderName, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { createFolder } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return createFolder(accessToken, { userId, spaceId, fatherId, folderName });
    },
    /**
     * 重命名微盘文件/文件夹
     */
    wedriveRenameFile: async ({ userId, fileId, newName, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { renameFile } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return renameFile(accessToken, { userId, fileId, newName });
    },
    /**
     * 移动微盘文件
     */
    wedriveMoveFiles: async ({ userId, fatherId, replace, fileIds, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { moveFiles } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return moveFiles(accessToken, { userId, fatherId, replace, fileIds });
    },
    /**
     * 删除微盘文件
     */
    wedriveDeleteFiles: async ({ userId, fileIds, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { deleteFiles } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return deleteFiles(accessToken, { userId, fileIds });
    },
    /**
     * 分享微盘文件
     */
    wedriveShareFile: async ({ userId, fileId, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { shareFile } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return shareFile(accessToken, { userId, fileId });
    },
    /**
     * 设置微盘文件权限
     */
    wedriveSetFileAuth: async ({ userId, fileId, auth, authSuccessor, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { setFileAuth } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return setFileAuth(accessToken, { userId, fileId, auth, authSuccessor });
    },
    /**
     * 添加微盘文件权限
     */
    wedriveAddFileAcl: async ({ userId, fileId, aclList, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { addFileAcl } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return addFileAcl(accessToken, { userId, fileId, aclList });
    },
    /**
     * 删除微盘文件权限
     */
    wedriveDelFileAcl: async ({ userId, fileId, authInfo, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { delFileAcl } = await import("./wedrive.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return delFileAcl(accessToken, { userId, fileId, authInfo });
    },
    // ===================== 通讯录 (Contacts) 功能 =====================
    /**
     * 获取部门列表
     */
    getDepartmentList: async ({ departmentId, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { getDepartmentList: doGetDepartmentList } = await import("./contacts.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return doGetDepartmentList(accessToken, departmentId);
    },
    /**
     * 获取成员详情
     */
    getUser: async ({ userId, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { getUser: doGetUser } = await import("./contacts.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return doGetUser(accessToken, userId);
    },
    /**
     * 获取部门成员列表
     */
    getDepartmentUsers: async ({ departmentId, fetchChild, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { getDepartmentUserList } = await import("./contacts.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return getDepartmentUserList(accessToken, departmentId, fetchChild);
    },
    /**
     * 搜索成员
     */
    searchUser: async ({ query, departmentId, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { searchUser: doSearchUser, findUserByName } = await import("./contacts.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);

      // 如果是按名称搜索
      if (query && !departmentId) {
        return findUserByName(accessToken, query);
      }

      return doSearchUser(accessToken, {
        name: query,
        department: departmentId ? [departmentId] : undefined,
      });
    },
    /**
     * 根据手机号/邮箱获取用户ID
     */
    getUserIdByPhone: async ({ mobile, email, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { getUserIdByPhone: doGetUserId } = await import("./contacts.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return doGetUserId(accessToken, { mobile, email });
    },
    /**
     * 获取标签列表
     */
    getTagList: async ({ accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { getTagList } = await import("./contacts.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return getTagList(accessToken);
    },
    /**
     * 获取标签成员
     */
    getTagMembers: async ({ tagId, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { getTagMembers } = await import("./contacts.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return getTagMembers(accessToken, tagId);
    },
    /**
     * 获取所有成员（遍历所有部门）
     */
    getAllUsers: async ({ accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { getAllUsers } = await import("./contacts.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return getAllUsers(accessToken);
    },
    /**
     * 根据部门名称查找部门
     */
    findDepartmentByName: async ({ name, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken } = await import("./api.js");
      const { findDepartmentByName: doFindDept } = await import("./contacts.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);
      return doFindDept(accessToken, name);
    },
    /**
     * 解析消息中的 @成员
     */
    parseMentions: async ({ content }) => {
      const { parseMentions } = await import("./contacts.js");
      return parseMentions(content);
    },
    /**
     * 格式化 @成员 列表
     */
    formatMentions: async ({ userIds }) => {
      const { formatMentionList } = await import("./contacts.js");
      // 构造简单的用户对象列表
      const users = userIds.map((id: string) => ({ userid: id, name: id, department: [] }));
      return formatMentionList(users);
    },
    /**
     * 发送消息并 @指定成员
     */
    sendWithMentions: async ({ to, content, mentionUserIds, mentionAll, accountId, cfg }) => {
      const account = resolveWeComAccount({ cfg, accountId });
      const { getAccessToken, sendMessage } = await import("./api.js");
      const accessToken = await getAccessToken(account.corpId, account.agentSecret);

      // 构建 mention 列表
      let textContent = content;
      if (mentionUserIds && mentionUserIds.length > 0) {
        const mentions = mentionUserIds.map((id: string) => `<@${id}>`).join("");
        textContent = mentions + content;
      }
      if (mentionAll) {
        textContent = "<@all>" + textContent;
      }

      const result = await sendMessage(accessToken, {
        touser: to,
        msgtype: "text",
        agentid: account.agentId,
        text: { content: textContent },
        safe: 0,
      });

      return {
        channel: "wecom",
        messageId: result.messageId,
        chatId: to,
      };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: ({ account }) => {
      const issues: Array<{ level: "error" | "warning"; message: string }> = [];

      if (!account) {
        return issues;
      }

      if (!account.corpId) {
        issues.push({ level: "error", message: "WeCom corpId not configured" });
      }

      if (!account.agentId) {
        issues.push({ level: "error", message: "WeCom agentId not configured" });
      }

      if (!account.agentSecret) {
        issues.push({ level: "error", message: "WeCom agentSecret not configured" });
      }

      return issues;
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      tokenSource: snapshot.tokenSource ?? "none",
      running: snapshot.running ?? false,
      mode: snapshot.mode ?? null,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) => {
      // 尝试获取 access token 来验证配置
      try {
        const { getAccessToken } = await import("./api.js");
        await getAccessToken(account.corpId, account.agentSecret);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => {
      const configured = Boolean(account.corpId && account.agentId && account.agentSecret);
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured,
        tokenSource: "config",
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        mode: "webhook",
        probe,
        lastInboundAt: runtime?.lastInboundAt ?? null,
        lastOutboundAt: runtime?.lastOutboundAt ?? null,
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const { account, cfg, runtime, abortSignal } = ctx;
      const core = getWeComRuntime();
      const wecomConfig = (cfg.channels?.wecom ?? {}) as WeComConfig;

      ctx.log?.info(`[${account.accountId}] starting WeCom provider`);

      // 初始化 OSS 配置 - 优先使用账户级配置，回退到渠道级配置
      const ossConfig = account.config.oss ?? wecomConfig.oss;
      if (
        ossConfig?.enabled !== false &&
        ossConfig?.accessKeyId &&
        ossConfig?.accessKeySecret &&
        ossConfig?.bucket &&
        ossConfig?.region
      ) {
        setOSSConfig({
          accessKeyId: ossConfig.accessKeyId,
          accessKeySecret: ossConfig.accessKeySecret,
          bucket: ossConfig.bucket,
          region: ossConfig.region,
          endpoint: ossConfig.endpoint,
          publicUrlPrefix: ossConfig.publicUrlPrefix,
          uploadPath: ossConfig.uploadPath,
        });
        ctx.log?.info(
          `[${account.accountId}] OSS storage enabled: bucket=${ossConfig.bucket}, region=${ossConfig.region}`,
        );
      } else {
        setOSSConfig(null);
        ctx.log?.info(
          `[${account.accountId}] OSS storage disabled (enabled=${ossConfig?.enabled}, configured=${!!(ossConfig?.accessKeyId && ossConfig?.bucket)})`,
        );
      }

      const unregisters: (() => void)[] = [];

      // 注册所有应用账户的 webhooks (不仅是当前账户)
      // 这样当消息发送到任何应用时都能正确处理
      const allAccounts = wecomConfig.accounts;
      if (allAccounts) {
        for (const [accountId, accountConfig] of Object.entries(allAccounts)) {
          if (!accountConfig || typeof accountConfig !== "object") continue;
          if (accountConfig.enabled === false) continue;

          const appPath = accountConfig.webhookPath;
          const appToken = accountConfig.token;
          const appAESKey = accountConfig.encodingAESKey;
          const appCorpId = accountConfig.corpId || wecomConfig.corpId || "";
          const appAgentId = accountConfig.agentId || 0;
          const appAgentSecret = accountConfig.agentSecret || "";

          if (appPath && appToken && appAESKey) {
            const normalizedAppPath = normalizePluginHttpPath(appPath, appPath);
            if (!normalizedAppPath) {
              ctx.log?.warn?.(`[${accountId}] Skipping invalid app webhook path: ${appPath}`);
              continue;
            }
            const resolvedAccount: ResolvedWeComAccount = {
              accountId,
              name: accountConfig.name,
              enabled: accountConfig.enabled ?? true,
              config: accountConfig,
              corpId: appCorpId,
              agentId: appAgentId,
              agentSecret: appAgentSecret,
              token: appToken,
              encodingAESKey: appAESKey,
              webhookPath: normalizedAppPath,
            };

            const unregisterTarget = registerWeComWebhookTarget(normalizedAppPath, {
              account: resolvedAccount,
              agentId: appAgentId,
              config: cfg,
              runtime: {
                log: ctx.log?.info
                  ? (msg) => ctx.log?.info?.(`[wecom:${accountId}] ${msg}`)
                  : undefined,
                error: ctx.log?.error
                  ? (msg) => ctx.log?.error?.(`[wecom:${accountId}] ${msg}`)
                  : undefined,
                debug: ctx.log?.debug
                  ? (msg) => ctx.log?.debug?.(`[wecom:${accountId}] ${msg}`)
                  : undefined,
              },
              core,
              token: appToken,
              encodingAESKey: appAESKey,
              corpId: appCorpId,
              mediaMaxMb: accountConfig.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB,
              statusSink: ctx.statusSink,
            });
            unregisters.push(unregisterTarget);
            const unregisterRoute = registerPluginHttpRoute({
              path: normalizedAppPath,
              auth: "plugin",
              replaceExisting: true,
              pluginId: meta.id,
              accountId,
              log: (message) => ctx.log?.info?.(message),
              handler: handleWeComWebhookRequest,
            });
            unregisters.push(unregisterRoute);
            ctx.log?.info(`[${accountId}] Registered app webhook: ${normalizedAppPath}`);
          }
        }
      }

      // 注册智能机器人 webhooks
      const robots = wecomConfig.robots;
      if (robots) {
        for (const [robotId, robotConfig] of Object.entries(robots)) {
          if (!robotConfig || robotConfig.enabled === false) continue;

          const robotPath = robotConfig.webhookPath;
          const robotToken = robotConfig.token || wecomConfig.token;
          const robotAESKey = robotConfig.encodingAESKey || wecomConfig.encodingAESKey;
          // Fallback to channel-level corpId if not set in robot config or account
          const robotCorpId = robotConfig.corpId || wecomConfig.corpId || "";

          if (robotPath && robotToken && robotAESKey) {
            const normalizedRobotPath = normalizePluginHttpPath(robotPath, robotPath);
            if (!normalizedRobotPath) {
              ctx.log?.warn?.(`[${robotId}] Skipping invalid robot webhook path: ${robotPath}`);
              continue;
            }
            // 机器人使用专用的机器人注册函数
            const unregisterTarget = registerWeComRobotWebhookTarget(normalizedRobotPath, {
              account: {
                accountId: robotId,
                name: robotConfig.name,
                enabled: robotConfig.enabled ?? true,
                config: robotConfig,
                // 机器人没有 corpId/agentId/agentSecret，使用渠道级别的值或空值
                corpId: robotCorpId,
                agentId: 0,
                agentSecret: "",
                token: robotToken,
                encodingAESKey: robotAESKey,
                webhookPath: normalizedRobotPath,
              },
              agentId: 0, // 机器人没有 agentId
              config: cfg,
              runtime: {
                log: ctx.log?.info
                  ? (msg) => ctx.log?.info?.(`[wecom-robot:${robotId}] ${msg}`)
                  : undefined,
                error: ctx.log?.error
                  ? (msg) => ctx.log?.error?.(`[wecom-robot:${robotId}] ${msg}`)
                  : undefined,
                debug: ctx.log?.debug
                  ? (msg) => ctx.log?.debug?.(`[wecom-robot:${robotId}] ${msg}`)
                  : undefined,
              },
              core,
              token: robotToken,
              encodingAESKey: robotAESKey,
              corpId: robotCorpId,
              mediaMaxMb: DEFAULT_MEDIA_MAX_MB,
              statusSink: ctx.statusSink,
            });
            unregisters.push(unregisterTarget);
            const unregisterRoute = registerPluginHttpRoute({
              path: normalizedRobotPath,
              auth: "plugin",
              replaceExisting: true,
              pluginId: meta.id,
              accountId: robotId,
              log: (message) => ctx.log?.info?.(message),
              handler: handleWeComWebhookRequest,
            });
            unregisters.push(unregisterRoute);
            ctx.log?.info(
              `[${account.accountId}] Registered robot webhook: ${normalizedRobotPath} (robotId: ${robotId})`,
            );
          }
        }
      }

      // 如果没有任何注册，返回空
      if (unregisters.length === 0) {
        return { unregister: () => {} };
      }

      // 返回一个 Promise，等待 abort 信号
      return new Promise<{ unregister: () => void }>((resolve) => {
        abortSignal.addEventListener(
          "abort",
          () => {
            for (const unregister of unregisters) {
              unregister();
            }
            resolve({ unregister: () => {} });
          },
          { once: true },
        );
      });
    },
    logoutAccount: async ({ accountId, cfg }) => {
      const nextCfg = { ...cfg } as OpenClawConfig;
      const wecomConfig = (cfg.channels?.wecom ?? {}) as WeComConfig;
      const nextWecom = { ...wecomConfig };

      let cleared = false;
      let changed = false;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        if (
          nextWecom.corpId ||
          nextWecom.agentId ||
          nextWecom.agentSecret ||
          nextWecom.token ||
          nextWecom.encodingAESKey
        ) {
          delete nextWecom.corpId;
          delete nextWecom.agentId;
          delete nextWecom.agentSecret;
          delete nextWecom.token;
          delete nextWecom.encodingAESKey;
          cleared = true;
          changed = true;
        }
      }

      const accounts = nextWecom.accounts ? { ...nextWecom.accounts } : undefined;
      if (accounts && accountId in accounts) {
        const entry = accounts[accountId];
        if (entry && typeof entry === "object") {
          const nextEntry = { ...entry } as Record<string, unknown>;
          if ("corpId" in nextEntry || "agentId" in nextEntry || "agentSecret" in nextEntry) {
            cleared = true;
            delete nextEntry.corpId;
            delete nextEntry.agentId;
            delete nextEntry.agentSecret;
            delete nextEntry.token;
            delete nextEntry.encodingAESKey;
            changed = true;
          }
          if (Object.keys(nextEntry).length === 0) {
            delete accounts[accountId];
            changed = true;
          } else {
            accounts[accountId] = nextEntry as typeof entry;
          }
        }
      }

      if (accounts) {
        if (Object.keys(accounts).length === 0) {
          delete nextWecom.accounts;
          changed = true;
        } else {
          nextWecom.accounts = accounts;
        }
      }

      if (changed) {
        if (Object.keys(nextWecom).length > 0) {
          nextCfg.channels = { ...nextCfg.channels, wecom: nextWecom };
        } else {
          const nextChannels = { ...nextCfg.channels };
          delete (nextChannels as Record<string, unknown>).wecom;
          if (Object.keys(nextChannels).length > 0) {
            nextCfg.channels = nextChannels;
          } else {
            delete nextCfg.channels;
          }
        }
        await getWeComRuntime().config.writeConfigFile(nextCfg);
      }

      // 清除 access token 缓存
      const { clearAccessTokenCache: clearCache } = await import("./api.js");
      clearCache();

      const resolved = resolveWeComAccount({ cfg: changed ? nextCfg : cfg, accountId });
      const loggedOut = !resolved.corpId && !resolved.agentId;

      return { cleared, envToken: false, loggedOut };
    },
  },
  agentPrompt: {
    messageToolHints: () => [
      "",
      "### 企业微信",
      "",
      "企业微信支持以下消息类型:",
      "",
      "**文本消息**: 标准文本内容，最大 2048 字符",
      "**Markdown**: 支持基本 Markdown 格式",
      "**图片/文件**: 需要先上传临时素材",
      "",
      "企业微信主要用于企业内部沟通，建议:",
      "- 使用简洁明了的语言",
      "- 重要信息使用列表或分段",
      "- 避免发送过长消息",
      "",
      "### 微盘 (WeDrive) 功能",
      "",
      "企业微信微盘支持以下操作:",
      "",
      "**文件管理**:",
      "- `wedriveGetSpaces`: 获取用户可访问的空间列表",
      "- `wedriveGetFileList`: 获取文件列表 (需要 spaceId 和 fatherId)",
      "- `wedriveGetFileInfo`: 获取文件详情",
      "- `wedriveCreateFolder`: 创建文件夹",
      "- `wedriveRenameFile`: 重命名文件/文件夹",
      "- `wedriveMoveFiles`: 移动文件",
      "- `wedriveDeleteFiles`: 删除文件",
      "",
      "**文件传输**:",
      "- `wedriveUploadFile`: 上传文件 (文件内容需要 Base64 编码)",
      "- `wedriveDownloadFile`: 获取文件下载链接",
      "- `wedriveShareFile`: 创建文件分享链接",
      "",
      "**权限管理**:",
      "- `wedriveSetFileAuth`: 设置文件权限",
      "- `wedriveAddFileAcl`: 添加用户/部门权限",
      "- `wedriveDelFileAcl`: 删除用户/部门权限",
      "",
      "**权限值说明**:",
      "- 1: 可下载",
      "- 2: 可编辑",
      "- 4: 可阅读(文档)",
      "- 8: 可创建(目录)",
      "- 可组合使用，如 3=可下载+可编辑",
      "",
      "### 通讯录 (Contacts) 功能",
      "",
      "企业微信通讯录支持以下操作:",
      "",
      "**部门管理**:",
      "- `getDepartmentList`: 获取部门列表 (可指定部门ID获取子部门)",
      "- `findDepartmentByName`: 根据名称模糊搜索部门",
      "",
      "**成员管理**:",
      "- `getUser`: 获取成员详情 (根据 UserID)",
      "- `getDepartmentUsers`: 获取部门成员列表",
      "- `searchUser`: 搜索成员 (按名称/部门)",
      "- `getUserIdByPhone`: 根据手机号/邮箱获取 UserID",
      "- `getAllUsers`: 获取所有成员列表",
      "",
      "**标签管理**:",
      "- `getTagList`: 获取标签列表",
      "- `getTagMembers`: 获取标签成员",
      "",
      "**@成员功能**:",
      "- `parseMentions`: 解析消息中的 @成员 (格式: <@userid>)",
      "- `formatMentions`: 格式化 @成员列表",
      "- `sendWithMentions`: 发送消息并 @指定成员",
      "",
      "**发送消息时 @成员**:",
      '- 发送给特定成员: touser="userid1|userid2"',
      '- 发送给部门: toparty="1|2"',
      '- 发送给标签: totag="1|2"',
      "- 消息中 @成员: 使用 <@userid> 格式",
      "- @所有人: 使用 <@all>",
      "",
      "**常用场景**:",
      "1. 查找运维组: `findDepartmentByName({ name: '运维' })`",
      "2. 获取运维人员: `getDepartmentUsers({ departmentId: 1 })`",
      "3. 发送通知并 @: `sendWithMentions({ to: 'zhangsan', content: '请处理告警', mentionUserIds: ['lisi'] })`",
      "",
      "### 智能机器人 (群聊支持)",
      "",
      "智能机器人可以被添加到群聊中，支持 @提及:",
      "",
      "**消息类型支持**:",
      "- 文本消息 (text)",
      "- 图片消息 (image)",
      "- 语音消息 (voice)",
      "- 视频消息 (video)",
      "- 文件消息 (file)",
      "- 混合消息 (mixed)",
      "- Markdown 消息",
      "",
      "**回复机制**:",
      "- 通过 response_url 回复消息",
      "- 支持流式输出 (streamEnabled)",
      "- 支持 Markdown 格式回复",
      "",
      "**群聊功能**:",
      "- 可被拉入群聊",
      "- 支持 @提及触发",
      "- 支持多人群聊场景",
      "",
      "**配置示例**:",
      "```json",
      "{",
      '  "channels": {',
      '    "wecom": {',
      '      "robots": {',
      '        "ceo": {',
      '          "name": "CEO助手",',
      '          "robotKey": "xxx",',
      '          "webhookPath": "/wecom/webhook",',
      '          "token": "xxx",',
      '          "encodingAESKey": "xxx"',
      "        }",
      "      }",
      "    }",
      "  }",
      "}",
      "```",
    ],
  },
};
