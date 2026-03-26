/**
 * WeCom Intelligent Robot (智能机器人)
 * 企业微信群聊机器人支持
 * 文档: https://developer.work.weixin.qq.com/document/path/100719
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { ClawdbotConfig, MarkdownTableMode } from "openclaw/plugin-sdk";
import { getWeComRuntime } from "./runtime.js";
import type { WeComRobotConfig, WeComRobotMessage, WeComRobotResponse } from "./types.js";

export type WeComRuntimeEnv = {
  log?: (message: string) => void;
  error?: (message: string) => void;
  info?: (message: string) => void;
  debug?: (message: string) => void;
};

export type WeComRobotTarget = {
  account: {
    accountId: string;
    name?: string;
    enabled: boolean;
    config: WeComRobotConfig;
  };
  config: ClawdbotConfig;
  runtime: WeComRuntimeEnv;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

type WeComCoreRuntime = ReturnType<typeof getWeComRuntime>;

// 机器人 Webhook 目标注册
const robotWebhookTargets = new Map<string, WeComRobotTarget[]>();

/**
 * 注册智能机器人 Webhook 目标
 */
export function registerWeComRobotWebhookTarget(
  path: string,
  target: WeComRobotTarget,
): () => void {
  const normalizedPath = normalizePath(path);
  const normalizedTarget = { ...target };
  const existing = robotWebhookTargets.get(normalizedPath) ?? [];
  const next = [...existing, normalizedTarget];
  robotWebhookTargets.set(normalizedPath, next);

  console.error(`[WeCom Robot] Registered webhook path: ${normalizedPath}`);

  return () => {
    const updated = (robotWebhookTargets.get(normalizedPath) ?? []).filter(
      (entry) => entry !== normalizedTarget,
    );
    if (updated.length > 0) {
      robotWebhookTargets.set(normalizedPath, updated);
    } else {
      robotWebhookTargets.delete(normalizedPath);
    }
  };
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

/**
 * 处理智能机器人 Webhook 请求
 */
export async function handleWeComRobotWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalizePath(url.pathname);
  const targets = robotWebhookTargets.get(path);

  console.error("[WeCom Robot] Request path:", path);
  console.error("[WeCom Robot] Targets found:", targets?.length || 0);
  console.error("[WeCom Robot] All registered paths:", Array.from(robotWebhookTargets.keys()));

  if (!targets || targets.length === 0) {
    return false;
  }

  const target = targets[0];

  // 只处理 POST 请求
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return true;
  }

  // 企微智能机器人的回调消息都是加密的（XML或JSON格式）
  // 这些加密消息应该由monitor.ts处理，它会解密后路由到机器人处理器
  // robot.ts只处理直接的、未加密的机器人API调用（如果有）
  // 为了避免读取body导致monitor.ts无法读取，我们直接返回false
  // 让monitor.ts处理所有加密回调
  console.error("[WeCom Robot] Letting monitor.ts handle encrypted callback for path:", path);
  return false;

  // 读取 JSON Body
  let body: WeComRobotMessage;
  try {
    const chunks: Buffer[] = [];
    let total = 0;

    body = await new Promise((resolve, reject) => {
      req.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > 1024 * 1024) {
          reject(new Error("Payload too large"));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });

      req.on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8");
          console.error("[WeCom Robot] Raw body:", raw.substring(0, 500));

          // 检查是否是加密的XML格式（企微回调使用XML）
          // 如果是XML，返回null让monitor.ts处理
          if (raw.trim().startsWith("<")) {
            console.error("[WeCom Robot] Detected XML format, falling back to monitor.ts");
            resolve(null as any);
            return;
          }

          const parsed = JSON.parse(raw);

          // 检查是否是加密的JSON格式 {"encrypt":"..."}
          // 这种格式需要由monitor.ts解密处理
          if (parsed.encrypt && !parsed.msgtype) {
            console.error(
              "[WeCom Robot] Detected encrypted JSON format, falling back to monitor.ts",
            );
            resolve(null as any);
            return;
          }

          resolve(parsed as WeComRobotMessage);
        } catch (err) {
          reject(err);
        }
      });

      req.on("error", reject);
    });
  } catch (err) {
    console.error("[WeCom Robot] Failed to parse body:", err);
    // 返回false让请求传递给monitor.ts处理
    return false;
  }

  // 如果body为null（XML格式），让monitor.ts处理
  if (!body) {
    console.error("[WeCom Robot] Body is null (XML format), falling back to monitor.ts");
    return false;
  }

  console.error("[WeCom Robot] Received message:", JSON.stringify(body, null, 2));

  target.statusSink?.({ lastInboundAt: Date.now() });

  // 立即返回成功
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ errcode: 0, errmsg: "ok" }));

  // 异步处理消息
  processRobotMessage(body, target).catch((err) => {
    console.error("[WeCom Robot] Message processing failed:", err);
    target.runtime.error?.(`WeCom Robot message processing failed: ${String(err)}`);
  });

  return true;
}

/**
 * 处理智能机器人消息
 */
async function processRobotMessage(
  message: WeComRobotMessage,
  target: WeComRobotTarget,
): Promise<void> {
  const core = getWeComRuntime();
  const { account, config, runtime, statusSink } = target;

  const chatType = message.chattype; // "single" | "group"
  const isGroup = chatType === "group";
  const chatId = isGroup ? message.chatid : message.sender.userid;
  const senderId = message.sender.userid;
  const responseUrl = message.response_url;

  // 检查是否启用流式输出
  const streamEnabled = message.query?.stream === true;

  console.error(`[WeCom Robot] Processing ${chatType} message from ${senderId}`);

  // 格式化消息内容
  const text = formatRobotMessageContent(message);

  if (!text.trim()) {
    console.error("[WeCom Robot] Empty content, skipping");
    return;
  }

  // 解析路由
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "wecom-robot",
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "dm",
      id: chatId,
    },
  });

  // 构建上下文
  const fromLabel = isGroup ? `group:${chatId}` : `user:${senderId}`;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);

  // 生成 session key
  const accountAwareSessionKey = isGroup
    ? `wecom-robot:${account.accountId}:group:${chatId}`
    : `wecom-robot:${account.accountId}:dm:${senderId}`;

  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: accountAwareSessionKey,
  });

  const bodyContent = core.channel.reply.formatAgentEnvelope({
    channel: "WeCom Robot",
    from: fromLabel,
    timestamp: Date.now(),
    previousTimestamp,
    envelope: envelopeOptions,
    body: text,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: bodyContent,
    RawBody: text,
    CommandBody: text,
    From: isGroup
      ? `wecom-robot:${account.accountId}:group:${chatId}`
      : `wecom-robot:${account.accountId}:${senderId}`,
    To: `wecom-robot:${account.accountId}:${chatId}`,
    SessionKey: accountAwareSessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    SenderId: senderId,
    Provider: "wecom-robot",
    Surface: "wecom-robot",
    MessageSid: message.msgid,
    OriginatingChannel: "wecom-robot",
    OriginatingTo: `wecom-robot:${account.accountId}:${chatId}`,
    // 额外的机器人元数据
    RobotMetadata: {
      responseUrl,
      chatId: message.chatid,
      chatType,
      streamEnabled,
    },
  });

  // 记录会话
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: accountAwareSessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime.error?.(`wecom-robot: failed updating session meta: ${String(err)}`);
    },
  });

  // 处理回复
  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg: config,
    channel: "wecom-robot",
    accountId: account.accountId,
  });

  // 使用流式或非流式回复
  if (streamEnabled) {
    await dispatchRobotStreamReply({
      ctx: ctxPayload,
      cfg: config,
      responseUrl,
      runtime,
      core,
      statusSink,
      tableMode,
    });
  } else {
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg: config,
      dispatcherOptions: {
        deliver: async (payload) => {
          await deliverRobotReply({
            payload,
            responseUrl,
            runtime,
            statusSink,
            tableMode,
            config,
          });
        },
        onError: (err) => {
          runtime.error?.(`WeCom Robot reply failed: ${String(err)}`);
        },
      },
    });
  }
}

/**
 * 格式化机器人消息内容
 */
function formatRobotMessageContent(message: WeComRobotMessage): string {
  const { msgtype } = message;
  const msg = message as Record<string, any>;

  switch (msgtype) {
    case "text":
      return msg.text?.content || "";

    case "image":
      const imgUrl = msg.image?.pic_url || "";
      const imgMedia = msg.image?.media_id || "";
      return `[图片]${imgUrl ? ` ${imgUrl}` : ""}${imgMedia ? ` (MediaId: ${imgMedia})` : ""}`;

    case "voice":
      const voiceMedia = msg.voice?.media_id || "";
      const voiceText = msg.voice?.voice_text || "";
      return `[语音]${voiceText ? ` 识别文本: ${voiceText}` : ""}${voiceMedia ? ` (MediaId: ${voiceMedia})` : ""}`;

    case "video":
      const videoMedia = msg.video?.media_id || "";
      const videoThumb = msg.video?.thumb_media_id || "";
      return `[视频]${videoMedia ? ` (MediaId: ${videoMedia})` : ""}${videoThumb ? ` 缩略图: ${videoThumb}` : ""}`;

    case "file":
      const fileName = msg.file?.filename || "未知文件";
      const fileSize = msg.file?.filesize ? ` (${(msg.file.filesize / 1024).toFixed(1)}KB)` : "";
      const fileMedia = msg.file?.media_id || "";
      return `[文件] ${fileName}${fileSize}${fileMedia ? ` (MediaId: ${fileMedia})` : ""}`;

    case "mixed":
      // 混合消息 - 解析文本内容
      const mixedContent = msg.mixed?.content || "";
      return mixedContent;

    default:
      return `[${msgtype}]`;
  }
}

/**
 * 发送机器人回复
 */
async function deliverRobotReply(params: {
  payload: { text?: string; mediaUrls?: string[] };
  responseUrl: string;
  runtime: WeComRuntimeEnv;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
  tableMode?: MarkdownTableMode;
  config?: ClawdbotConfig;
}): Promise<void> {
  const { payload, responseUrl, runtime, statusSink, tableMode, config } = params;
  const core = getWeComRuntime();

  // 处理文本
  let text = core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode ?? "code");

  if (!text.trim()) {
    return;
  }

  // 解析文本中的 @mentions 并构建 mentioned_list
  let mentioned_list: string[] | undefined;
  if (config) {
    const { resolveMentionsFromResponse, buildRobotResponseWithMentions } =
      await import("./robot-mention.js");
    const mentions = resolveMentionsFromResponse(text, config);
    if (mentions.length > 0) {
      const result = buildRobotResponseWithMentions(text, mentions);
      text = result.content;
      mentioned_list = result.mentioned_list;
      console.error(
        `[WeCom Robot] Resolved ${mentions.length} mention(s): ${mentions.map((m) => m.name).join(", ")}`,
      );
    }
  }

  // 检查是否需要分块
  const WECOM_ROBOT_TEXT_LIMIT = 4096; // 智能机器人支持更长的文本
  const chunks = core.channel.text.chunkMarkdownText(text, WECOM_ROBOT_TEXT_LIMIT);

  // 发送最后一个块作为回复（智能机器人通常只发送一条回复）
  const lastChunk = chunks[chunks.length - 1];

  try {
    const response: WeComRobotResponse = {
      msgtype: "text",
      text: {
        content: lastChunk,
        // Only include mentioned_list if there are mentions (WeCom expects non-empty array)
        ...(mentioned_list && mentioned_list.length > 0 ? { mentioned_list } : {}),
      },
    };

    console.error("[WeCom Robot] Sending reply to:", responseUrl);
    console.error("[WeCom Robot] Reply content:", JSON.stringify(response));

    const httpResponse = await fetch(responseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(response),
    });

    if (!httpResponse.ok) {
      const errorText = await httpResponse.text();
      throw new Error(`HTTP ${httpResponse.status}: ${errorText}`);
    }

    const result = await httpResponse.json();
    console.error("[WeCom Robot] Reply result:", JSON.stringify(result));

    statusSink?.({ lastOutboundAt: Date.now() });
  } catch (err) {
    runtime.error?.(`WeCom Robot reply failed: ${String(err)}`);
    throw err;
  }
}

/**
 * 发送流式机器人回复
 */
async function dispatchRobotStreamReply(params: {
  ctx: any;
  cfg: ClawdbotConfig;
  responseUrl: string;
  runtime: WeComRuntimeEnv;
  core: WeComCoreRuntime;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
  tableMode?: MarkdownTableMode;
}): Promise<void> {
  const { ctx, cfg, responseUrl, runtime, core, statusSink, tableMode } = params;

  // 收集流式内容
  let accumulatedText = "";

  // 使用流式分发器
  await core.channel.reply.dispatchStreamReply({
    ctx,
    cfg,
    onChunk: async (chunk: string) => {
      accumulatedText += chunk;
      // 暂存但不立即发送，等待完成
    },
    onComplete: async () => {
      // 流式完成，发送最终回复
      const text = core.channel.text.convertMarkdownTables(accumulatedText, tableMode ?? "code");

      if (!text.trim()) {
        return;
      }

      try {
        // 发送 Markdown 格式回复（智能机器人支持）
        const response: WeComRobotResponse = {
          msgtype: "markdown",
          markdown: {
            content: text,
          },
        };

        console.error("[WeCom Robot] Sending stream reply to:", responseUrl);

        const httpResponse = await fetch(responseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(response),
        });

        if (!httpResponse.ok) {
          const errorText = await httpResponse.text();
          throw new Error(`HTTP ${httpResponse.status}: ${errorText}`);
        }

        statusSink?.({ lastOutboundAt: Date.now() });
      } catch (err) {
        runtime.error?.(`WeCom Robot stream reply failed: ${String(err)}`);
        throw err;
      }
    },
    onError: (err: Error) => {
      runtime.error?.(`WeCom Robot stream error: ${String(err)}`);
    },
  });
}

/**
 * 发送图片消息回复
 */
export async function sendRobotImageReply(params: {
  responseUrl: string;
  mediaId: string;
}): Promise<void> {
  const { responseUrl, mediaId } = params;

  const response: WeComRobotResponse = {
    msgtype: "image",
    image: {
      media_id: mediaId,
    },
  };

  const httpResponse = await fetch(responseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(response),
  });

  if (!httpResponse.ok) {
    const errorText = await httpResponse.text();
    throw new Error(`HTTP ${httpResponse.status}: ${errorText}`);
  }
}

/**
 * 发送文件消息回复
 */
export async function sendRobotFileReply(params: {
  responseUrl: string;
  mediaId: string;
}): Promise<void> {
  const { responseUrl, mediaId } = params;

  const response: WeComRobotResponse = {
    msgtype: "file",
    file: {
      media_id: mediaId,
    },
  };

  const httpResponse = await fetch(responseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(response),
  });

  if (!httpResponse.ok) {
    const errorText = await httpResponse.text();
    throw new Error(`HTTP ${httpResponse.status}: ${errorText}`);
  }
}

/**
 * 发送语音消息回复
 */
export async function sendRobotVoiceReply(params: {
  responseUrl: string;
  mediaId: string;
}): Promise<void> {
  const { responseUrl, mediaId } = params;

  const response: WeComRobotResponse = {
    msgtype: "voice",
    voice: {
      media_id: mediaId,
    },
  };

  const httpResponse = await fetch(responseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(response),
  });

  if (!httpResponse.ok) {
    const errorText = await httpResponse.text();
    throw new Error(`HTTP ${httpResponse.status}: ${errorText}`);
  }
}

/**
 * 发送 Markdown 消息回复
 */
export async function sendRobotMarkdownReply(params: {
  responseUrl: string;
  content: string;
}): Promise<void> {
  const { responseUrl, content } = params;

  const response: WeComRobotResponse = {
    msgtype: "markdown",
    markdown: {
      content,
    },
  };

  const httpResponse = await fetch(responseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(response),
  });

  if (!httpResponse.ok) {
    const errorText = await httpResponse.text();
    throw new Error(`HTTP ${httpResponse.status}: ${errorText}`);
  }
}

/**
 * 列出所有注册的机器人路径
 */
export function listRobotWebhookPaths(): string[] {
  return Array.from(robotWebhookTargets.keys());
}
