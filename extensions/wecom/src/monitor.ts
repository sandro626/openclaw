/**
 * WeCom Webhook 监听器
 * 处理企业微信推送的消息和事件
 * 支持应用消息和智能机器人消息
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ClawdbotConfig, MarkdownTableMode } from "openclaw/plugin-sdk";
import {
  sendMessage,
  getAccessToken,
  clearAccessTokenCache,
  uploadMedia,
  sendImageMessage,
  sendFileMessage,
  sendVideoMessage,
  sendVoiceMessage,
  sendMarkdownMessage,
  sendTextCardMessage,
} from "./api.js";
import { processBotMentions, parseMentionsFromText } from "./bot-forward.js";
import { createWeComCrypto, WeComCrypto } from "./crypto.js";
import { isOSSConfigured, uploadBufferToOSS } from "./oss.js";
import { getWeComRuntime } from "./runtime.js";
import type {
  ResolvedWeComAccount,
  WeComDecryptedMessage,
  WeComVerifyRequest,
  WeComRobotMessage,
} from "./types.js";

const WECOM_TEXT_LIMIT = 2048;
export const DEFAULT_MEDIA_MAX_MB = 5;

export type WeComRuntimeEnv = {
  log?: (message: string) => void;
  error?: (message: string) => void;
  info?: (message: string) => void;
  debug?: (message: string) => void;
};

export type WeComMonitorOptions = {
  account: ResolvedWeComAccount;
  config: ClawdbotConfig;
  runtime: WeComRuntimeEnv;
  abortSignal: AbortSignal;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

export type WeComMonitorResult = {
  stop: () => void;
};

type WeComCoreRuntime = ReturnType<typeof getWeComRuntime>;

/**
 * 解析 XML 消息（企业微信解密后的消息是 XML 格式）
 */
function parseXmlMessage(xmlString: string): WeComDecryptedMessage | null {
  console.error("[WeCom Debug] Parsing XML message, length:", xmlString.length);
  console.error("[WeCom Debug] XML preview:", xmlString.substring(0, 300));

  // 简单的 XML 解析，提取各字段
  const extractField = (tagName: string): string | undefined => {
    const patterns = [
      new RegExp(`<${tagName}><!\\[CDATA\\[([^\\]]+)\\]\\]><\\/${tagName}>`),
      new RegExp(`<${tagName}><!\\[CDATA\\[([^\\]]+)\\]\\]></${tagName}>`, "s"),
      new RegExp(`<${tagName}>([^<]+)<\\/${tagName}>`),
    ];
    for (const pattern of patterns) {
      const match = xmlString.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  };

  const ToUserName = extractField("ToUserName");
  const FromUserName = extractField("FromUserName");
  const CreateTimeStr = extractField("CreateTime");
  const MsgType = extractField("MsgType");
  const Content = extractField("Content");
  const MsgId = extractField("MsgId");
  const AgentIDStr = extractField("AgentID");
  const ChatId = extractField("ChatId");

  // 图片消息字段
  const PicUrl = extractField("PicUrl");
  const MediaId = extractField("MediaId") || extractField("mediaId");

  // 语音消息字段
  const Format = extractField("Format");
  const VoiceText = extractField("Recognition") || extractField("VoiceText");

  // 视频消息字段
  const ThumbMediaId = extractField("ThumbMediaId");

  // 文件消息字段
  const FileName = extractField("FileName");
  const FileSizeStr = extractField("FileSize");

  // 位置消息字段
  const Location_XStr = extractField("Location_X");
  const Location_YStr = extractField("Location_Y");
  const ScaleStr = extractField("Scale");
  const Label = extractField("Label");

  // 链接消息字段
  const Title = extractField("Title");
  const Description = extractField("Description");
  const Url = extractField("Url");

  // 事件字段
  const Event = extractField("Event");
  const EventKey = extractField("EventKey");

  if (!ToUserName || !FromUserName || !MsgType) {
    console.error("[WeCom Debug] XML parse FAILED - missing required fields");
    console.error("[WeCom Debug] ToUserName:", ToUserName);
    console.error("[WeCom Debug] FromUserName:", FromUserName);
    console.error("[WeCom Debug] MsgType:", MsgType);
    return null;
  }

  const message: WeComDecryptedMessage = {
    ToUserName,
    FromUserName,
    CreateTime: CreateTimeStr ? parseInt(CreateTimeStr, 10) : Date.now(),
    MsgType,
    Content,
    MsgId: MsgId ?? "",
    AgentID: AgentIDStr ? parseInt(AgentIDStr, 10) : 0,
  };

  if (ChatId) message.ChatId = ChatId;
  if (PicUrl) message.PicUrl = PicUrl;
  if (MediaId) message.MediaId = MediaId;
  if (Format) message.Format = Format;
  if (VoiceText) message.VoiceText = VoiceText;
  if (ThumbMediaId) message.ThumbMediaId = ThumbMediaId;
  if (FileName) message.FileName = FileName;
  if (FileSizeStr) message.FileSize = parseInt(FileSizeStr, 10);
  if (Location_XStr) message.Location_X = parseFloat(Location_XStr);
  if (Location_YStr) message.Location_Y = parseFloat(Location_YStr);
  if (ScaleStr) message.Scale = parseInt(ScaleStr, 10);
  if (Label) message.Label = Label;
  if (Title) message.Title = Title;
  if (Description) message.Description = Description;
  if (Url) message.Url = Url;
  if (Event) message.Event = Event;
  if (EventKey) message.EventKey = EventKey;

  console.error("[WeCom Debug] Parsed message:", JSON.stringify(message));
  return message;
}

/**
 * 尝试解析 JSON 格式的机器人消息（解密后可能是JSON）
 * 支持两种格式：
 * 1. 有 sender 字段的格式
 * 2. 有 from 字段的格式（智能机器人回调）
 *
 * 注意：解密后的消息可能有二进制前缀，需要找到 JSON 的起始位置
 */
function tryParseRobotMessage(decryptedMessage: string): WeComRobotMessage | null {
  try {
    // 查找 JSON 的起始位置（可能前面有二进制数据）
    // 查找 {"msgid" 模式，这是机器人消息的特征开始
    let jsonStart = decryptedMessage.indexOf('{"msgid"');
    if (jsonStart === -1) {
      // 回退：查找任何 { 后面跟着 "
      jsonStart = decryptedMessage.indexOf('{"');
    }
    if (jsonStart === -1) {
      return null;
    }

    const jsonStr = decryptedMessage.substring(jsonStart);
    console.error("[WeCom Debug] tryParseRobotMessage: found JSON at position", jsonStart);
    console.error("[WeCom Debug] tryParseRobotMessage: JSON preview:", jsonStr.substring(0, 100));

    const json = JSON.parse(jsonStr);

    // 验证是否是机器人消息格式
    // 格式1: 有 sender 字段
    if (json.msgtype && json.sender && json.response_url) {
      console.error("[WeCom Debug] Detected robot message format (with sender)");
      return json as WeComRobotMessage;
    }

    // 格式2: 有 from 字段（智能机器人回调格式）
    // 转换为统一格式
    if (json.msgtype && json.from && json.response_url) {
      console.error("[WeCom Debug] Detected robot message format (with from), converting...");
      const convertedMessage: any = {
        msgtype: json.msgtype,
        msgid: json.msgid || "",
        chattype: json.chattype || "single",
        chatid: json.chatid,
        sender: {
          userid: json.from.userid || "",
          name: json.from.name,
        },
        response_url: json.response_url,
        query: json.query,
      };

      // 添加消息内容字段
      if (json.text) convertedMessage.text = json.text;
      if (json.image) convertedMessage.image = json.image;
      if (json.voice) convertedMessage.voice = json.voice;
      if (json.video) convertedMessage.video = json.video;
      if (json.file) convertedMessage.file = json.file;
      if (json.mixed) convertedMessage.mixed = json.mixed;

      console.error("[WeCom Debug] Converted message:", JSON.stringify(convertedMessage));
      return convertedMessage as WeComRobotMessage;
    }

    return null;
  } catch (err) {
    console.error("[WeCom Debug] tryParseRobotMessage failed:", err);
    return null;
  }
}

/**
 * 机器人名称到 Agent ID 的映射
 */
const ROBOT_NAME_TO_AGENT_MAP: Record<string, string> = {
  // 中文名称
  ceo: "main",
  ceo助手: "main",
  cto: "cto",
  cto助手: "cto",
  开发工程师: "dev",
  "开发-元宝": "dev",
  元宝: "dev",
  测试工程师: "tester",
  "测试-宝气": "tester",
  宝气: "tester",
  运维工程师: "ops",
  "运维-智宝": "ops",
  智宝: "ops",
};

/**
 * 解析消息中的 @mentions
 * 支持格式: @名称、<@名称>、@账号ID
 */
function parseRobotMentions(
  text: string,
  config: ClawdbotConfig,
): Array<{ raw: string; agentId: string; accountId: string }> {
  const mentions: Array<{ raw: string; agentId: string; accountId: string }> = [];

  // 从 config 中获取 bindings 映射
  const bindings = (config as any).bindings || [];
  const channelConfig = (config as any).channels?.wecom || {};
  const robots = channelConfig.robots || {};

  // 构建 accountId -> agentId 映射
  const accountToAgent: Record<string, string> = {};
  for (const binding of bindings) {
    if (binding.match?.channel === "wecom" && binding.match?.accountId && binding.agentId) {
      accountToAgent[binding.match.accountId] = binding.agentId;
    }
  }

  // 匹配 @mentions 的正则: @名称 或 <@名称> 或 @accountId
  const mentionPatterns = [
    /<@([^>]+)>/g, // <@名称> 格式
    /@([\u4e00-\u9fa5\w-]+)/g, // @名称 格式 (支持中文、字母、数字、下划线、横线)
  ];

  for (const pattern of mentionPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const rawMention = match[0];
      const mentionName = match[1].toLowerCase().trim();

      // 先尝试直接匹配 accountId
      if (accountToAgent[mentionName]) {
        mentions.push({
          raw: rawMention,
          agentId: accountToAgent[mentionName],
          accountId: mentionName,
        });
        continue;
      }

      // 尝试通过名称映射
      const agentId = ROBOT_NAME_TO_AGENT_MAP[mentionName];
      if (agentId) {
        // 反向查找 accountId
        let accountId = mentionName;
        for (const [accId, agtId] of Object.entries(accountToAgent)) {
          if (agtId === agentId) {
            accountId = accId;
            break;
          }
        }
        mentions.push({
          raw: rawMention,
          agentId,
          accountId,
        });
      }
    }
  }

  // 去重
  const seen = new Set<string>();
  return mentions.filter((m) => {
    if (seen.has(m.agentId)) return false;
    seen.add(m.agentId);
    return true;
  });
}

/**
 * 格式化机器人消息内容
 */
function formatRobotMessageContent(message: WeComRobotMessage): string {
  const { msgtype } = message;

  switch (msgtype) {
    case "text":
      return (message as any).text?.content || "";

    case "image":
      const imgUrl = (message as any).image?.pic_url || "";
      const imgMedia = (message as any).image?.media_id || "";
      return `[图片]${imgUrl ? ` ${imgUrl}` : ""}${imgMedia ? ` (MediaId: ${imgMedia})` : ""}`;

    case "voice":
      const voiceMedia = (message as any).voice?.media_id || "";
      const voiceText = (message as any).voice?.voice_text || "";
      return `[语音]${voiceText ? ` 识别文本: ${voiceText}` : ""}${voiceMedia ? ` (MediaId: ${voiceMedia})` : ""}`;

    case "video":
      const videoMedia = (message as any).video?.media_id || "";
      return `[视频]${videoMedia ? ` (MediaId: ${videoMedia})` : ""}`;

    case "file":
      const fileName = (message as any).file?.filename || "未知文件";
      const fileSize = (message as any).file?.filesize
        ? ` (${((message as any).file.filesize / 1024).toFixed(1)}KB)`
        : "";
      return `[文件] ${fileName}${fileSize}`;

    case "mixed":
      return (message as any).mixed?.content || "";

    default:
      return `[${msgtype}]`;
  }
}

/**
 * 处理机器人消息（通过 response_url 回复）
 */
async function processRobotMessage(
  robotMessage: WeComRobotMessage,
  target: WebhookTarget,
): Promise<void> {
  const core = getWeComRuntime();
  const { account, config, runtime } = target;

  const chatType = robotMessage.chattype; // "single" | "group"
  const isGroup = chatType === "group";
  const chatId = isGroup ? robotMessage.chatid! : robotMessage.sender.userid;
  const senderId = robotMessage.sender.userid;
  const responseUrl = robotMessage.response_url;

  const senderName = robotMessage.sender.name || senderId;
  console.error(`[WeCom Robot] Processing ${chatType} message from ${senderName} (${senderId})`);
  console.error(`[WeCom Robot] Response URL:`, responseUrl?.substring(0, 100));

  // 格式化消息内容
  const text = formatRobotMessageContent(robotMessage);

  // 解析 @mentions - 支持机器人间通信
  const mentions = parseRobotMentions(text, config);
  if (mentions.length > 0) {
    console.error(`[WeCom Robot] Detected mentions: ${JSON.stringify(mentions)}`);
  }
  const rawContent = (robotMessage as any).text?.content;
  console.error(`[WeCom Robot] Formatted message content length: ${text.length}`);
  console.error(`[WeCom Robot] Raw text.content length: ${rawContent?.length ?? "undefined"}`);
  console.error(
    `[WeCom Robot] Raw text.content hex: ${rawContent ? Buffer.from(rawContent).toString("hex") : "undefined"}`,
  );
  console.error(`[WeCom Robot] Formatted text hex: ${Buffer.from(text).toString("hex")}`);
  console.error(`[WeCom Robot] Robot message keys: ${Object.keys(robotMessage).join(", ")}`);

  if (!text.trim()) {
    console.error("[WeCom Robot] Empty content, skipping");
    return;
  }

  // 解析路由 - 使用 "wecom-bot" channel
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "wecom-bot",
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "dm",
      id: chatId,
    },
  });

  console.error(
    `[WeCom Robot] Agent route resolved: agentId=${route.agentId}, accountId=${route.accountId}`,
  );

  // 构建上下文
  const fromLabel = isGroup ? `group:${chatId}` : `user:${senderId}`;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);

  // 生成 session key
  const accountAwareSessionKey = isGroup
    ? `wecom-bot:${account.accountId}:group:${chatId}`
    : `wecom-bot:${account.accountId}:dm:${senderId}`;

  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: accountAwareSessionKey,
  });

  // 如果有 @mentions 或消息中提到其他机器人，添加 subagent 调用指令
  let processedText = text;
  let targetAgents: string[] = [];

  // 1. 从 @mentions 中获取目标 agent
  if (mentions.length > 0) {
    targetAgents = mentions.map((m) => m.agentId).filter((id) => id !== route.agentId);
  }

  // 2. 通过关键词匹配识别目标 agent（企业微信不会传递@其他机器人的信息）
  const keywordToAgent: Record<string, string> = {
    cto: "cto",
    CTO: "cto",
    cto助手: "cto",
    CTO助手: "cto",
    dev: "dev",
    开发: "dev",
    开发工程师: "dev",
    元宝: "dev",
    tester: "tester",
    测试: "tester",
    测试工程师: "tester",
    宝气: "tester",
    ops: "ops",
    运维: "ops",
    运维工程师: "ops",
    智宝: "ops",
  };

  for (const [keyword, agentId] of Object.entries(keywordToAgent)) {
    if (text.includes(keyword) && agentId !== route.agentId && !targetAgents.includes(agentId)) {
      targetAgents.push(agentId);
      console.error(`[WeCom Robot] Detected keyword "${keyword}" -> agent ${agentId}`);
    }
  }

  if (targetAgents.length > 0) {
    const subagentInstructions = targetAgents
      .map((agentId) => {
        return `- 使用 spawn_subagent 工具调用 ${agentId} agent 来处理相关任务`;
      })
      .join("\n");

    processedText = `[系统指令：你需要调用以下 subagent 来协助完成任务]
${subagentInstructions}

注意：调用 spawn_subagent 时，将用户的完整请求传递给对应的 agent。

用户消息:
${text}`;
    console.error(
      `[WeCom Robot] Added subagent instructions for agents: ${targetAgents.join(", ")}`,
    );
  }

  const body = core.channel.reply.formatAgentEnvelope({
    channel: "WeCom Robot",
    from: fromLabel,
    timestamp: Date.now(),
    previousTimestamp,
    envelope: envelopeOptions,
    body: processedText,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: text,
    CommandBody: text,
    From: isGroup
      ? `wecom-bot:${account.accountId}:group:${chatId}`
      : `wecom-bot:${account.accountId}:${senderId}`,
    To: `wecom-bot:${account.accountId}:${chatId}`,
    SessionKey: accountAwareSessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    SenderId: senderId,
    Provider: "wecom-bot",
    Surface: "wecom-robot",
    MessageSid: robotMessage.msgid,
    OriginatingChannel: "wecom-bot",
    OriginatingTo: `wecom-bot:${account.accountId}:${chatId}`,
    // 机器人回复URL
    RobotResponseUrl: responseUrl,
    // @mentions 解析结果 - 用于机器人间通信
    Mentions: mentions.length > 0 ? mentions : undefined,
    MentionedAgents: mentions.length > 0 ? mentions.map((m) => m.agentId) : undefined,
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

  // 处理回复 - 通过 response_url 发送
  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg: config,
    channel: "wecom-bot",
    accountId: account.accountId,
  });

  console.error("[WeCom Robot] Starting dispatchReplyWithBufferedBlockDispatcher...");
  console.error("[WeCom Robot] Message body for agent:", text.substring(0, 200));

  // 在CEO agent处理之前，先根据原始消息中的@提及触发子代理
  // 这样CTO等机器人可以并行处理，而不是等CEO回复后才转发
  if (mentions.length > 0) {
    console.error(
      `[WeCom Robot] Original message has ${mentions.length} mentions, spawning subagents...`,
    );
    // 异步触发子代理，不阻塞CEO的处理
    processBotMentions({
      cfg: config,
      runtime,
      text, // 使用原始消息文本
      currentAgentId: route.agentId,
      currentAccountId: account.accountId,
      currentSessionKey: accountAwareSessionKey,
      chatId,
      isGroup,
      responseUrl,
      senderId,
      log: (msg) => console.error(`[WeCom Bot-Forward] ${msg}`),
    }).catch((err) => {
      console.error(`[WeCom Bot-Forward] Error spawning subagents: ${err}`);
    });
  }

  console.error(
    "[WeCom Robot] Context payload:",
    JSON.stringify({
      SessionKey: accountAwareSessionKey,
      AccountId: route.accountId,
      ChatType: isGroup ? "group" : "direct",
      SenderId: senderId,
      Body: body.substring(0, 200),
    }),
  );

  // Collect agent reply text for bot-to-bot mention detection
  let agentReplyText = "";

  let dispatchResult;
  try {
    dispatchResult = await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg: config,
      dispatcherOptions: {
        deliver: async (payload, info) => {
          console.error(
            `[WeCom Robot] Deliver called with kind=${info?.kind}, text length=${payload.text?.length || 0}`,
          );
          console.error(
            `[WeCom Robot] Payload text content: ${payload.text?.substring(0, 500) || "(empty)"}`,
          );
          // Collect the agent's reply text for mention detection
          if (payload.text) {
            agentReplyText += payload.text + "\n";
          }

          // Parse @mentions from this payload to get robotKeys for mentioned_list
          const mentions = parseMentionsFromText(payload.text || "", config, account.accountId);
          const mentionedRobotKeys = mentions
            .map((m) => m.robotKey)
            .filter((k): k is string => !!k);

          console.error(
            `[WeCom Robot] Parsed mentions from payload: ${mentions.length}, robotKeys: ${mentionedRobotKeys.join(", ")}`,
          );

          await deliverRobotReplyViaResponseUrl({
            payload,
            responseUrl,
            runtime,
            core,
            statusSink: target.statusSink,
            tableMode,
            mentionedRobotKeys: mentionedRobotKeys.length > 0 ? mentionedRobotKeys : undefined,
          });
        },
        onError: (err, info) => {
          console.error(
            `[WeCom Robot] onError called with kind=${info?.kind}, error=${String(err)}`,
          );
          runtime.error?.(`WeCom Robot reply failed: ${String(err)}`);
        },
        onSkip: (payload, info) => {
          console.error(
            `[WeCom Robot] onSkip called with kind=${info?.kind}, reason=${info?.reason}`,
          );
        },
        onReplyStart: () => {
          console.error("[WeCom Robot] onReplyStart called - agent is starting");
        },
      },
    });
  } catch (dispatchError) {
    console.error(
      "[WeCom Robot] dispatchReplyWithBufferedBlockDispatcher threw error:",
      dispatchError,
    );
    throw dispatchError;
  }

  console.error("[WeCom Robot] dispatchResult:", JSON.stringify(dispatchResult));

  // Debug: Log if nothing was delivered
  if (dispatchResult.counts.final === 0 && dispatchResult.counts.block === 0) {
    console.error("[WeCom Robot] WARNING: Agent produced no text/block replies!");
    console.error("[WeCom Robot] This usually means the agent response was filtered or empty.");
  }

  // Process bot mentions from AGENT REPLY - forward to other bots via subagent
  // This enables bot-to-bot communication when agent mentions another bot
  console.error(
    "[WeCom Robot] Agent reply text collected (length=" + agentReplyText.length + "):",
    agentReplyText.substring(0, 500),
  );
  if (agentReplyText.trim()) {
    console.error(
      "[WeCom Robot] Checking agent reply for bot mentions:",
      agentReplyText.substring(0, 200),
    );
    await processBotMentions({
      cfg: config,
      runtime,
      text: agentReplyText,
      currentAgentId: route.agentId,
      currentAccountId: account.accountId,
      currentSessionKey: accountAwareSessionKey,
      chatId,
      isGroup,
      responseUrl, // 传递 response_url 给子代理用于回复
      senderId, // 传递发送者ID用于fallback私聊
      log: (msg) => console.error(`[WeCom Bot-Forward] ${msg}`),
    });
  }
}

/**
 * 通过 response_url 发送机器人回复
 */
async function deliverRobotReplyViaResponseUrl(params: {
  payload: { text?: string; mediaUrls?: string[] };
  responseUrl: string;
  runtime: WeComRuntimeEnv;
  core: WeComCoreRuntime;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
  tableMode?: MarkdownTableMode;
  mentionedRobotKeys?: string[]; // 要@的机器人的aibotid列表
}): Promise<void> {
  const { payload, responseUrl, runtime, core, statusSink, tableMode, mentionedRobotKeys } = params;

  // 处理文本
  let text = core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode ?? "code");

  if (!text.trim()) {
    return;
  }

  // 智能机器人支持更长的文本
  const WECOM_ROBOT_TEXT_LIMIT = 4096;
  const chunks = core.channel.text.chunkMarkdownText(text, WECOM_ROBOT_TEXT_LIMIT);
  const lastChunk = chunks[chunks.length - 1];

  try {
    // 智能机器人只支持 markdown 格式
    // 如果有要@的机器人，添加 mentioned_list
    const markdownPayload: { content: string; mentioned_list?: string[] } = {
      content: lastChunk,
    };

    if (mentionedRobotKeys && mentionedRobotKeys.length > 0) {
      markdownPayload.mentioned_list = mentionedRobotKeys;
    }

    const response = {
      msgtype: "markdown",
      markdown: markdownPayload,
    };

    console.error("[WeCom Robot] Sending reply via response_url");
    console.error("[WeCom Robot] Reply content:", JSON.stringify(response).substring(0, 500));

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
 * 读取 XML Body 并提取 Encrypt 字段
 * 也支持未加密的 JSON 格式（智能机器人流式模式）
 */
async function readXmlBody(
  req: IncomingMessage,
  maxBytes = 1024 * 1024,
): Promise<{
  ok: boolean;
  encrypt?: string;
  rawJson?: string; // 未加密的 JSON 内容（智能机器人流式模式）
  error?: string;
}> {
  // 添加调用栈日志
  console.error("[WeCom Debug] ===== readXmlBody CALLED! =====");
  console.error("[WeCom Debug] Call stack:", new Error().stack);
  console.error("[WeCom Debug] ======================================");

  const chunks: Buffer[] = [];
  let total = 0;

  return new Promise((resolve) => {
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        resolve({ ok: false, error: "payload too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw.trim()) {
          resolve({ ok: false, error: "empty payload" });
          return;
        }

        // 调试日志：打印原始内容
        console.error("[WeCom Debug] Raw body:", raw.substring(0, 1000));
        console.error("[WeCom Debug] Full body length:", raw.length);

        // 尝试解析为 JSON 格式 (智能机器人可能使用 JSON 格式)
        if (raw.trim().startsWith("{") || raw.includes('{"msgid"')) {
          try {
            // 查找 JSON 起始位置（可能有二进制前缀）
            const jsonStart =
              raw.indexOf('{"msgid"') !== -1 ? raw.indexOf('{"msgid"') : raw.indexOf("{");
            const jsonStr = jsonStart !== -1 ? raw.substring(jsonStart) : raw;
            const json = JSON.parse(jsonStr);

            if (json.encrypt) {
              console.error("[WeCom Debug] Detected JSON format with encrypt field");
              resolve({ ok: true, encrypt: json.encrypt });
              return;
            }

            // 检查是否是智能机器人消息格式（有 response_url 或 msgtype）
            if (json.response_url || json.msgtype) {
              console.error("[WeCom Debug] Detected unencrypted robot JSON (stream mode)");
              resolve({ ok: true, rawJson: jsonStr });
              return;
            }
          } catch {
            // JSON 解析失败，继续尝试 XML
          }
        }

        // 提取 <Encrypt><![CDATA[...]]></Encrypt> 中的内容
        const encryptMatch = raw.match(/<Encrypt><!\[CDATA\[(.+?)\]\]><\/Encrypt>/);
        if (encryptMatch && encryptMatch[1]) {
          resolve({ ok: true, encrypt: encryptMatch[1] });
        } else {
          // 尝试不带 CDATA 的格式
          const simpleMatch = raw.match(/<Encrypt>(.+?)<\/Encrypt>/);
          if (simpleMatch && simpleMatch[1]) {
            resolve({ ok: true, encrypt: simpleMatch[1] });
          } else {
            resolve({ ok: false, error: "Encrypt field not found" });
          }
        }
      } catch (err) {
        resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    });

    req.on("error", (err) => {
      resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
    });
  });
}

/**
 * Webhook 目标注册
 */
type WebhookTarget = {
  account: ResolvedWeComAccount;
  agentId: number;
  config: ClawdbotConfig;
  runtime: WeComRuntimeEnv;
  core: WeComCoreRuntime;
  token: string;
  encodingAESKey: string;
  corpId: string;
  mediaMaxMb: number;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

const webhookTargets = new Map<string, WebhookTarget[]>();

/**
 * 注册 Webhook 目标
 */
export function registerWeComWebhookTarget(path: string, target: WebhookTarget): () => void {
  const normalizedPath = normalizePath(path);
  const normalizedTarget = { ...target };
  const existing = webhookTargets.get(normalizedPath) ?? [];
  const next = [...existing, normalizedTarget];
  webhookTargets.set(normalizedPath, next);

  return () => {
    const updated = (webhookTargets.get(normalizedPath) ?? []).filter(
      (entry) => entry !== normalizedTarget,
    );
    if (updated.length > 0) {
      webhookTargets.set(normalizedPath, updated);
    } else {
      webhookTargets.delete(normalizedPath);
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
 * 处理 Webhook 请求
 */
export async function handleWeComWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  console.error("==================================");
  console.error("== WeCom HTTP HANDLER CALLED! ==========");
  console.error("==================================");

  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalizePath(url.pathname);
  const targets = webhookTargets.get(path);

  // Debug: 记录请求信息
  console.error("[WeCom Debug] Request method:", req.method);
  console.error("[WeCom Debug] Request pathname:", url.pathname);
  console.error("[WeCom Debug] Normalized path:", path);
  console.error("[WeCom Debug] Targets found:", targets?.length || 0);
  console.error("[WeCom Debug] All registered paths:", Array.from(webhookTargets.keys()));

  if (!targets || targets.length === 0) {
    console.error("[WeCom Debug] No targets found for path:", path);
    return false;
  }

  const target = targets[0]; // 使用第一个注册的目标
  console.error("[WeCom Debug] Using target corpId:", target.corpId, "agentId:", target.agentId);

  // GET 请求用于 URL 验证
  if (req.method === "GET") {
    const msg_signature = url.searchParams.get("msg_signature");
    const timestamp = url.searchParams.get("timestamp");
    const nonce = url.searchParams.get("nonce");
    const echostr = url.searchParams.get("echostr");

    if (!msg_signature || !timestamp || !nonce || !echostr) {
      res.statusCode = 400;
      res.end("Missing required parameters");
      return true;
    }

    const crypto = createWeComCrypto(target.token, target.encodingAESKey, target.corpId);

    // 1. 验证签名
    const valid = crypto.verifySignature(msg_signature, timestamp, nonce, echostr);
    if (!valid) {
      // 签名验证失败 - 记录详细日志
      const computedSignature = (crypto as any).sha1Sort(target.token, timestamp, nonce, echostr);
      console.error("[WeCom URL验证失败] 签名不匹配:", {
        received: msg_signature,
        computed: computedSignature,
        token: target.token,
        timestamp,
        nonce,
        echostrPreview: echostr.substring(0, 50),
      });
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify(
          {
            error: "Invalid signature",
            received: msg_signature,
            computed: computedSignature,
            token: target.token,
            timestamp,
            nonce,
            echostr: echostr.substring(0, 50) + "...",
          },
          null,
          2,
        ),
      );
      return true;
    }

    // 2. 解密 echostr 得到明文消息（按文档逻辑）
    let replyEchoStr: string;
    try {
      replyEchoStr = crypto.decryptEchoStr(echostr);
      console.error("[WeCom URL验证成功] 返回:", replyEchoStr, "长度:", replyEchoStr.length);
    } catch (err) {
      console.error("[WeCom URL验证失败] 解密失败:", err);
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify(
          {
            error: "Decryption failed",
            message: err instanceof Error ? err.message : String(err),
            echostr: echostr.substring(0, 50) + "...",
          },
          null,
          2,
        ),
      );
      return true;
    }

    // 3. 原样返回明文消息内容
    res.statusCode = 200;
    res.end(replyEchoStr);
    return true;
  }

  // POST 请求处理消息
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, POST");
    res.end("Method Not Allowed");
    return true;
  }

  // 读取请求体（可能是加密 XML 或未加密 JSON）
  const body = await readXmlBody(req);

  // 检查是否是未加密的 JSON 格式（智能机器人流式模式）
  // 这种格式不需要 msg_signature 等参数
  if (body.ok && body.rawJson) {
    console.error("[WeCom Debug] Detected unencrypted JSON format (smart robot stream mode)");
    const robotMessage = tryParseRobotMessage(body.rawJson);
    if (robotMessage) {
      console.error("[WeCom Debug] Parsed as robot message from unencrypted JSON");
      target.statusSink?.({ lastInboundAt: Date.now() });

      // 立即返回成功
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ errcode: 0, errmsg: "ok" }));

      // 异步处理机器人消息
      processRobotMessage(robotMessage, target).catch((err) => {
        console.error("[WeCom Debug] processRobotMessage FAILED:", err);
        target.runtime.error?.(`WeCom robot message processing failed: ${String(err)}`);
      });

      return true;
    }
  }

  const msg_signature = url.searchParams.get("msg_signature");
  const timestamp = url.searchParams.get("timestamp");
  const nonce = url.searchParams.get("nonce");
  if (!msg_signature || !timestamp || !nonce) {
    res.statusCode = 400;
    res.end("Missing required parameters");
    return true;
  }

  if (!body.ok || !body.encrypt) {
    res.statusCode = body.error === "payload too large" ? 413 : 400;
    res.end(body.error ?? "invalid payload");
    return true;
  }

  const encrypted = body.encrypt;

  // 验证签名
  const crypto = createWeComCrypto(target.token, target.encodingAESKey, target.corpId);
  console.error("[WeCom Debug] Verifying signature...");
  console.error("[WeCom Debug] msg_signature:", msg_signature?.substring(0, 20) + "...");
  console.error("[WeCom Debug] encrypted length:", encrypted.length);

  if (!crypto.verifySignature(msg_signature, timestamp, nonce, encrypted)) {
    console.error("[WeCom Debug] Signature verification FAILED!");
    res.statusCode = 403;
    res.end("Invalid signature");
    return true;
  }
  console.error("[WeCom Debug] Signature verification OK");

  // 解密消息
  let decrypted: { message: string; appId: string };
  try {
    console.error("[WeCom Debug] Decrypting message...");
    decrypted = crypto.decrypt(encrypted);
    console.error("[WeCom Debug] Decrypted successfully, appId:", decrypted.appId);
    console.error("[WeCom Debug] Decrypted message preview:", decrypted.message.substring(0, 500));
  } catch (err) {
    console.error("[WeCom Debug] Decrypt FAILED:", err);
    res.statusCode = 400;
    res.end("Decryption failed");
    return true;
  }

  target.statusSink?.({ lastInboundAt: Date.now() });

  // 首先尝试解析为机器人消息（JSON格式）
  const robotMessage = tryParseRobotMessage(decrypted.message);
  if (robotMessage) {
    console.error("[WeCom Debug] Detected robot message, routing to robot handler...");
    // 异步处理机器人消息
    processRobotMessage(robotMessage, target).catch((err) => {
      console.error("[WeCom Debug] processRobotMessage FAILED:", err);
      target.runtime.error?.(`WeCom robot message processing failed: ${String(err)}`);
    });

    // 立即返回成功
    res.statusCode = 200;
    res.end("success");
    return true;
  }

  // 解析应用消息（企业微信解密后是 XML 格式）
  let message: WeComDecryptedMessage | null;
  try {
    message = parseXmlMessage(decrypted.message);
    if (!message) {
      console.error("[WeCom Debug] Message parse returned null");
      res.statusCode = 400;
      res.end("Invalid message format");
      return true;
    }
  } catch (err) {
    console.error("[WeCom Debug] XML parse FAILED:", err);
    res.statusCode = 400;
    res.end("Invalid message format");
    return true;
  }

  // 异步处理消息
  console.error("[WeCom Debug] Calling processMessage...");
  processMessage(message, target).catch((err) => {
    console.error("[WeCom Debug] processMessage FAILED:", err);
    target.runtime.error?.(`WeCom message processing failed: ${String(err)}`);
  });

  // 立即返回成功
  res.statusCode = 200;
  res.end("success");
  return true;
}

/**
 * 格式化消息内容为文本表示
 */
function formatMessageContent(message: WeComDecryptedMessage): string {
  const {
    MsgType,
    Content,
    PicUrl,
    MediaId,
    Format,
    VoiceText,
    FileName,
    FileSize,
    Label,
    Location_X,
    Location_Y,
    Title,
    Description,
    Url,
  } = message;

  switch (MsgType) {
    case "text":
      return Content || "";

    case "image":
      return `[图片]${PicUrl ? ` ${PicUrl}` : ""}${MediaId ? ` (MediaId: ${MediaId})` : ""}`;

    case "voice":
      const voiceInfo = Format ? ` [${Format}]` : "";
      const voiceText = VoiceText ? ` 识别文本: ${VoiceText}` : "";
      return `[语音]${voiceInfo}${voiceText}${MediaId ? ` (MediaId: ${MediaId})` : ""}`;

    case "video":
      return `[视频]${MediaId ? ` (MediaId: ${MediaId})` : ""}`;

    case "file":
      const sizeInfo = FileSize ? ` (${(FileSize / 1024).toFixed(1)}KB)` : "";
      return `[文件] ${FileName || "未知文件"}${sizeInfo}${MediaId ? ` (MediaId: ${MediaId})` : ""}`;

    case "location":
      const coords = Location_X && Location_Y ? ` (${Location_X}, ${Location_Y})` : "";
      return `[位置]${Label ? ` ${Label}` : ""}${coords}`;

    case "link":
      return `[链接] ${Title || ""}${Description ? ` - ${Description}` : ""}${Url ? ` ${Url}` : ""}`;

    case "event":
      return `[事件] ${message.Event || "unknown"}${message.EventKey ? ` - ${message.EventKey}` : ""}`;

    default:
      return `[${MsgType}] ${Content || ""}`;
  }
}

/**
 * 处理解密后的消息
 */
async function processMessage(
  message: WeComDecryptedMessage,
  target: WebhookTarget,
): Promise<void> {
  const { MsgType, FromUserName, ToUserName, ChatId, Content, MsgId, AgentID } = message;

  console.error("[WeCom Debug] processMessage called");
  console.error("[WeCom Debug] MsgType:", MsgType);
  console.error("[WeCom Debug] FromUserName:", FromUserName);
  console.error("[WeCom Debug] Content:", Content);

  // 处理事件消息
  if (MsgType === "event") {
    console.error("[WeCom Debug] Processing event:", message.Event, message.EventKey);
    target.runtime.debug?.(`WeCom event received: ${message.Event}`);
    // 事件消息不转发给AI，只记录
    return;
  }

  const isGroup = !!ChatId;
  const chatId = ChatId || FromUserName;
  const senderId = FromUserName;

  // 获取格式化的消息文本
  const text = formatMessageContent(message);

  if (!text.trim()) {
    console.error("[WeCom Debug] Empty content, skipping");
    return;
  }

  console.error(
    "[WeCom Debug] Processing message from:",
    senderId,
    "type:",
    MsgType,
    "content:",
    text,
  );

  const { account, config, runtime, core, mediaMaxMb } = target;

  // 检查发送者权限
  const dmPolicy = account.config.dmPolicy ?? "pairing";
  const configAllowFrom = (account.config.allowFrom ?? []).map((v) => String(v));

  if (!isGroup) {
    if (dmPolicy === "disabled") {
      runtime.debug?.(`Blocked WeCom DM from ${senderId} (dmPolicy=disabled)`);
      return;
    }

    if (dmPolicy !== "open") {
      const allowed = configAllowFrom.includes(senderId) || configAllowFrom.includes("*");
      if (!allowed) {
        if (dmPolicy === "pairing") {
          const { code, created } = await core.channel.pairing.upsertPairingRequest({
            channel: "wecom",
            id: senderId,
            meta: {},
          });

          if (created) {
            runtime.debug?.(`WeCom pairing request for ${senderId}`);
            // 可以发送配对消息给用户
          }
        }
        return;
      }
    }
  }

  // 解析路由
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "wecom",
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "dm",
      id: chatId,
    },
  });

  // 构建上下文 - 包含accountId以区分不同的WeCom应用
  const fromLabel = isGroup ? `group:${chatId}` : `user:${senderId}`;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);

  // 生成包含accountId的sessionKey，确保不同WeCom应用的会话独立
  const accountAwareSessionKey = isGroup
    ? `wecom:${account.accountId}:group:${chatId}`
    : `wecom:${account.accountId}:dm:${senderId}`;

  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: accountAwareSessionKey,
  });

  const body = core.channel.reply.formatAgentEnvelope({
    channel: "WeCom",
    from: fromLabel,
    timestamp: message.CreateTime * 1000,
    previousTimestamp,
    envelope: envelopeOptions,
    body: text,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: text,
    CommandBody: text,
    From: isGroup
      ? `wecom:${account.accountId}:group:${chatId}`
      : `wecom:${account.accountId}:${senderId}`,
    To: `wecom:${account.accountId}:${chatId}`,
    SessionKey: accountAwareSessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    SenderId: senderId,
    Provider: "wecom",
    Surface: "wecom",
    MessageSid: MsgId,
    OriginatingChannel: "wecom",
    OriginatingTo: `wecom:${account.accountId}:${chatId}`,
  });

  // 记录会话 - 使用包含accountId的sessionKey
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: accountAwareSessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime.error?.(`wecom: failed updating session meta: ${String(err)}`);
    },
  });

  // 处理回复
  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg: config,
    channel: "wecom",
    accountId: account.accountId,
  });

  console.error("[WeCom] Starting dispatchReplyWithBufferedBlockDispatcher...");

  const { queuedFinal, counts } = await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher(
    {
      ctx: ctxPayload,
      cfg: config,
      dispatcherOptions: {
        deliver: async (payload, info) => {
          console.error(
            `[WeCom] Deliver called with kind=${info?.kind}, text length=${payload.text?.length || 0}`,
          );
          await deliverWeComReply({
            payload,
            account,
            chatId,
            runtime,
            core,
            config,
            statusSink: target.statusSink,
            tableMode,
          });
        },
        onError: (err, info) => {
          console.error(`[WeCom] onError called with kind=${info?.kind}, error=${String(err)}`);
          runtime.error?.(`WeCom reply failed: ${String(err)}`);
        },
      },
    },
  );

  console.error("[WeCom] dispatch complete:", JSON.stringify({ queuedFinal, counts }));
}

/**
 * 发送回复
 */
async function deliverWeComReply(params: {
  payload: { text?: string; mediaUrls?: string[] };
  account: ResolvedWeComAccount;
  chatId: string;
  runtime: WeComRuntimeEnv;
  core: WeComCoreRuntime;
  config: ClawdbotConfig;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
  tableMode?: MarkdownTableMode;
}): Promise<void> {
  const { payload, account, chatId, runtime, core, config, statusSink, tableMode } = params;
  const mediaMaxMb = account.config.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB;
  const maxBytes = mediaMaxMb * 1024 * 1024;

  // 获取 access token
  let accessToken: string;
  try {
    accessToken = await getAccessToken(account.corpId, account.agentSecret);
  } catch (err) {
    runtime.error?.(`Failed to get WeCom access token: ${String(err)}`);
    return;
  }

  // 处理媒体
  const mediaUrls = payload.mediaUrls ?? [];
  for (const mediaUrl of mediaUrls) {
    try {
      runtime.debug?.(`Processing media: ${mediaUrl}`);

      let mediaBuffer: Buffer;
      let filename: string;
      let contentType: string;

      // 检查是否是本地文件路径
      const isLocalFile = mediaUrl.startsWith("/") || mediaUrl.startsWith("file://");
      const filePath = mediaUrl.startsWith("file://") ? mediaUrl.slice(7) : mediaUrl;

      if (isLocalFile && existsSync(filePath)) {
        // 从本地文件读取
        runtime.debug?.(`Reading local file: ${filePath}`);
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
          runtime.error?.(`Failed to fetch media: HTTP ${mediaResponse.status}`);
          continue;
        }

        const contentLength = mediaResponse.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > maxBytes) {
          runtime.error?.(`Media file too large: ${contentLength} bytes (max: ${maxBytes})`);
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
        runtime.error?.(`Media file too large: ${mediaBuffer.length} bytes (max: ${maxBytes})`);
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
          runtime.debug?.(`Media uploaded to OSS: ${ossUrl}`);
        }
      }

      // 上传到企业微信
      const uploadResult = await uploadMedia(accessToken, mediaType, mediaBuffer, filename);
      runtime.debug?.(`Media uploaded to WeCom: ${uploadResult.mediaId}`);

      // 发送消息
      const sendParams = {
        touser: chatId,
        agentid: account.agentId,
        media_id: uploadResult.mediaId,
      };

      switch (mediaType) {
        case "image":
          await sendImageMessage(accessToken, sendParams);
          break;
        case "voice":
          await sendVoiceMessage(accessToken, sendParams);
          break;
        case "video":
          await sendVideoMessage(accessToken, { ...sendParams, title: filename });
          break;
        default:
          await sendFileMessage(accessToken, sendParams);
      }

      // 如果有 OSS URL，发送下载链接
      if (ossUrl && mediaType === "file") {
        // 文件类型额外发送下载链接
        const linkText = `📎 文件下载链接: ${ossUrl}`;
        await sendMessage(accessToken, {
          touser: chatId,
          msgtype: "text",
          agentid: account.agentId,
          text: { content: linkText },
          safe: 0,
        });
      }

      statusSink?.({ lastOutboundAt: Date.now() });
    } catch (err) {
      runtime.error?.(`WeCom media send failed: ${String(err)}`);
    }
  }

  // 处理文本
  const text = core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode ?? "code");

  if (!text.trim()) {
    return;
  }

  // 分块发送
  const chunkMode = core.channel.text.resolveChunkMode(config, "wecom", account.accountId);
  const chunks = core.channel.text.chunkMarkdownTextWithMode(text, WECOM_TEXT_LIMIT, chunkMode);

  for (const chunk of chunks) {
    try {
      await sendMessage(accessToken, {
        touser: chatId,
        msgtype: "text",
        agentid: account.agentId,
        text: { content: chunk },
        safe: 0,
      });
      statusSink?.({ lastOutboundAt: Date.now() });
    } catch (err) {
      runtime.error?.(`WeCom message send failed: ${String(err)}`);
    }
  }
}

/**
 * 扩展 WeComCrypto 类添加 sha1Sort 方法
 */
declare module "./crypto.js" {
  interface WeComCrypto {
    sha1Sort(...args: string[]): string;
  }
}

// Monkey patch to add sha1Sort
const originalCreateWeComCrypto = createWeComCrypto;
(WeComCrypto.prototype as any).sha1Sort = function (...args: string[]): string {
  const sorted = args.sort().join("");
  return require("node:crypto").createHash("sha1").update(sorted).digest("hex");
};
