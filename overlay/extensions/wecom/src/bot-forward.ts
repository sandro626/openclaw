/**
 * WeCom Bot-to-bot communication via Subagent mechanism.
 *
 * Similar to Feishu, WeCom doesn't push bot-sent messages to other bots,
 * so when one bot @mentions another bot, the mentioned bot won't receive the event.
 *
 * This module detects mentions of other bots in incoming messages
 * and uses OpenClaw's Subagent mechanism to invoke the target bot's agent.
 */

import type { ClawdbotConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import { callGateway } from "openclaw/plugin-sdk";

/**
 * Mention target info
 */
export type WeComMentionTarget = {
  name: string;
  accountId: string;
  agentId: string;
  robotKey?: string; // aibotid for @mention in mentioned_list
};

/**
 * Build a mapping from accountId to agentId based on bindings configuration.
 */
export function buildAccountIdToAgentIdMap(cfg: ClawdbotConfig): Map<string, string> {
  const map = new Map<string, string>();
  const bindings = cfg.bindings ?? [];

  for (const binding of bindings) {
    if (!binding || typeof binding !== "object") continue;

    const channel = binding.match?.channel;
    // Support both "wecom" and "wecom-bot" channels
    if (channel !== "wecom" && channel !== "wecom-bot") continue;

    const accountId = binding.match?.accountId;
    const agentId = binding.agentId;

    if (accountId && agentId) {
      map.set(accountId, agentId);
    }
  }

  return map;
}

/**
 * Build a mapping from robot name to accountId from WeCom config.
 * Supports both 'robots' and 'accounts' configurations.
 */
export function buildRobotNameToAccountIdMap(cfg: ClawdbotConfig): Map<string, string> {
  const map = new Map<string, string>();
  const wecomConfig = (cfg.channels?.wecom as any) || {};

  // First, check robots configuration
  const robots = wecomConfig.robots || {};
  for (const [accountId, robotConfig] of Object.entries(robots)) {
    if (!robotConfig || typeof robotConfig !== "object") continue;

    const name = (robotConfig as any).name;
    if (name && typeof name === "string") {
      // Map lowercase name to accountId for case-insensitive matching
      map.set(name.toLowerCase(), accountId);
      // Also map the original case
      map.set(name, accountId);
    }
  }

  // Also check accounts configuration (for WeCom applications that can also be robots)
  const accounts = wecomConfig.accounts || {};
  for (const [accountId, accountConfig] of Object.entries(accounts)) {
    if (!accountConfig || typeof accountConfig !== "object") continue;

    const name = (accountConfig as any).name;
    if (name && typeof name === "string") {
      // Map lowercase name to accountId for case-insensitive matching
      map.set(name.toLowerCase(), accountId);
      // Also map the original case
      map.set(name, accountId);
    }
  }

  return map;
}

/**
 * Build a mapping from robot name to full robot info (accountId, robotKey).
 * Supports both 'robots' and 'accounts' configurations.
 */
export function buildRobotNameToInfoMap(
  cfg: ClawdbotConfig,
): Map<string, { accountId: string; robotKey: string; name: string }> {
  const map = new Map<string, { accountId: string; robotKey: string; name: string }>();
  const wecomConfig = (cfg.channels?.wecom as any) || {};

  // First, check robots configuration
  const robots = wecomConfig.robots || {};
  for (const [accountId, robotConfig] of Object.entries(robots)) {
    if (!robotConfig || typeof robotConfig !== "object") continue;

    const config = robotConfig as any;
    const name = config.name;
    const robotKey = config.robotKey;

    if (name) {
      // Map lowercase name for case-insensitive matching
      map.set(name.toLowerCase(), { accountId, robotKey: robotKey || "", name });
      // Also map original case
      map.set(name, { accountId, robotKey: robotKey || "", name });
    }
  }

  // Also check accounts configuration (for WeCom applications)
  const accounts = wecomConfig.accounts || {};
  for (const [accountId, accountConfig] of Object.entries(accounts)) {
    if (!accountConfig || typeof accountConfig !== "object") continue;

    const config = accountConfig as any;
    const name = config.name;
    const robotKey = config.robotKey;

    if (name) {
      // Map lowercase name for case-insensitive matching
      map.set(name.toLowerCase(), { accountId, robotKey: robotKey || "", name });
      // Also map original case
      map.set(name, { accountId, robotKey: robotKey || "", name });
    }
  }

  return map;
}

/**
 * Build a mapping from agentId to accountIds from bindings.
 */
export function buildAgentIdToAccountIdsMap(cfg: ClawdbotConfig): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const bindings = cfg.bindings ?? [];

  for (const binding of bindings) {
    if (!binding || typeof binding !== "object") continue;

    const channel = binding.match?.channel;
    if (channel !== "wecom" && channel !== "wecom-bot") continue;

    const accountId = binding.match?.accountId;
    const agentId = binding.agentId;

    if (accountId && agentId) {
      const existing = map.get(agentId) || [];
      if (!existing.includes(accountId)) {
        existing.push(accountId);
        map.set(agentId, existing);
      }
    }
  }

  return map;
}

/**
 * Build dynamic keyword to agentId mapping from config.
 * Uses robot names and accountIds from configuration.
 */
export function buildDynamicKeywordToAgentMap(cfg: ClawdbotConfig): Map<string, string> {
  const map = new Map<string, string>();

  const accountIdToAgentId = buildAccountIdToAgentIdMap(cfg);
  const nameToAccountId = buildRobotNameToAccountIdMap(cfg);

  // Map robot names to agentIds
  for (const [name, accountId] of nameToAccountId) {
    const agentId = accountIdToAgentId.get(accountId);
    if (agentId) {
      map.set(name.toLowerCase(), agentId);
    }
  }

  // Map accountIds to agentIds
  for (const [accountId, agentId] of accountIdToAgentId) {
    map.set(accountId.toLowerCase(), agentId);
  }

  return map;
}

/**
 * Parse mention targets from message text.
 * Uses dynamic mapping from config instead of hardcoded keywords.
 */
export function parseMentionsFromText(
  text: string,
  cfg: ClawdbotConfig,
  currentAccountId: string,
): WeComMentionTarget[] {
  const targets: WeComMentionTarget[] = [];
  const accountIdToAgentId = buildAccountIdToAgentIdMap(cfg);
  const nameToAccountId = buildRobotNameToAccountIdMap(cfg);
  const nameToInfo = buildRobotNameToInfoMap(cfg);
  const keywordToAgent = buildDynamicKeywordToAgentMap(cfg);

  // Get current agentId to exclude it
  const currentAgentId = accountIdToAgentId.get(currentAccountId);

  // Build reverse mapping: agentId -> accountId
  const agentIdToAccountId = new Map<string, string>();
  for (const [accId, agtId] of accountIdToAgentId) {
    agentIdToAccountId.set(agtId, accId);
  }

  const seen = new Set<string>();

  // 1. Match @mentions patterns
  const patterns = [
    /<@([^>]+)>/g, // <@name> format
    /@([\u4e00-\u9fa5\w-]+)/g, // @name format (supports Chinese)
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const mentionName = match[1].trim();
      const mentionNameLower = mentionName.toLowerCase();

      // Skip if already processed
      if (seen.has(mentionNameLower)) continue;

      // Try to find robot info by name
      const robotInfo = nameToInfo.get(mentionName) || nameToInfo.get(mentionNameLower);

      if (robotInfo && robotInfo.accountId !== currentAccountId) {
        const agentId = accountIdToAgentId.get(robotInfo.accountId);
        if (agentId && agentId !== currentAgentId) {
          seen.add(mentionNameLower);
          targets.push({
            name: robotInfo.name,
            accountId: robotInfo.accountId,
            agentId,
            robotKey: robotInfo.robotKey,
          });
        }
      }

      // Also try dynamic keyword mapping
      const dynamicAgentId = keywordToAgent.get(mentionNameLower);
      if (dynamicAgentId && dynamicAgentId !== currentAgentId && !seen.has(dynamicAgentId)) {
        const targetAccountId = agentIdToAccountId.get(dynamicAgentId);
        if (targetAccountId && targetAccountId !== currentAccountId) {
          // Get robotKey for this accountId
          const info =
            nameToInfo.get(targetAccountId) || nameToInfo.get(targetAccountId.toLowerCase());
          seen.add(dynamicAgentId);
          targets.push({
            name: mentionName,
            accountId: targetAccountId,
            agentId: dynamicAgentId,
            robotKey: info?.robotKey,
          });
        }
      }
    }
  }

  // 2. Keyword matching using dynamic mapping from config
  for (const [keyword, agentId] of keywordToAgent) {
    // Only match whole words or keywords in text
    if (text.includes(keyword) && agentId !== currentAgentId && !seen.has(agentId)) {
      const targetAccountId = agentIdToAccountId.get(agentId);
      if (targetAccountId && targetAccountId !== currentAccountId) {
        // Get robotKey for this accountId
        const info =
          nameToInfo.get(targetAccountId) || nameToInfo.get(targetAccountId.toLowerCase());
        seen.add(agentId);
        targets.push({
          name: keyword,
          accountId: targetAccountId,
          agentId,
          robotKey: info?.robotKey,
        });
      }
    }
  }

  return targets;
}

/**
 * Forward a message to another bot via Subagent mechanism using callGateway.
 */
export async function forwardToBotSubagent(params: {
  cfg: ClawdbotConfig;
  runtime?: RuntimeEnv;
  currentAgentId: string;
  currentAccountId: string;
  currentSessionKey?: string;
  targetAgentId: string;
  targetAccountId: string;
  targetName: string;
  message: string;
  chatId: string;
  isGroup: boolean;
  responseUrl?: string; // 智能机器人的 response_url，用于子代理回复
  senderId?: string; // 发送者ID，用于fallback私聊
  log: (msg: string) => void;
}): Promise<{ success: boolean; error?: string }> {
  const {
    cfg,
    currentAgentId,
    currentAccountId,
    currentSessionKey,
    targetAgentId,
    targetAccountId,
    targetName,
    message,
    chatId,
    isGroup,
    responseUrl,
    senderId,
    log,
  } = params;

  // Check if subagent spawning is allowed for this agent
  const agentConfig = (cfg.agents?.list ?? []).find(
    (a) => a.id?.toLowerCase() === currentAgentId.toLowerCase(),
  );
  const subagentConfig = agentConfig?.subagents;
  const allowAgents: string[] = subagentConfig?.allowAgents ?? [];

  // Check if target agent is allowed
  const allowAny = allowAgents.some((a: string) => a.trim() === "*");
  const normalizedTarget = targetAgentId.toLowerCase();
  const allowSet = new Set(
    allowAgents
      .filter((a: string) => a.trim() && a.trim() !== "*")
      .map((a: string) => a.toLowerCase()),
  );

  if (!allowAny && !allowSet.has(normalizedTarget)) {
    log(`wecom: bot forward skipped, ${currentAgentId} not allowed to spawn ${targetAgentId}`);
    return { success: false, error: "Agent not allowed to spawn target" };
  }

  const task = `[Forwarded from ${currentAgentId}] ${message}`;
  const label = `${targetName}-subagent`;

  // Build session key for the subagent
  const crypto = await import("node:crypto");
  const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;

  log(`wecom: spawning subagent ${targetAgentId} for bot-to-bot communication via gateway`);

  try {
    // Use gateway agent method to spawn subagent
    const result = await callGateway<{ runId: string }>({
      config: cfg,
      method: "agent",
      params: {
        message: task,
        sessionKey: childSessionKey,
        channel: "wecom",
        to: isGroup ? `group:${chatId}` : `user:${chatId}`,
        accountId: targetAccountId,
        idempotencyKey: crypto.randomUUID(),
        deliver: true, // 启用投递，让子代理可以回复
        lane: "subagent",
        label,
        spawnedBy: currentSessionKey,
        groupId: isGroup ? chatId : undefined,
        robotResponseUrl: responseUrl, // 传递 response_url 给子代理
        robotSenderId: senderId, // 传递发送者ID用于fallback私聊
        robotChatId: isGroup ? chatId : undefined, // 传递群聊ID用于appchat fallback
      },
      timeoutMs: 15_000,
    });

    if (result?.runId) {
      log(`wecom: subagent ${targetAgentId} spawned successfully, runId=${result.runId}`);
      return { success: true };
    } else {
      log(`wecom: subagent ${targetAgentId} spawn returned no runId`);
      return { success: false, error: "No runId returned" };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`wecom: failed to spawn subagent ${targetAgentId}: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Process incoming message for bot mentions and forward to target bots.
 * This is the main entry point for bot-to-bot communication.
 */
export async function processBotMentions(params: {
  cfg: ClawdbotConfig;
  runtime?: RuntimeEnv;
  text: string;
  currentAgentId: string;
  currentAccountId: string;
  currentSessionKey?: string;
  chatId: string;
  isGroup: boolean;
  responseUrl?: string; // 智能机器人的 response_url，用于子代理回复
  senderId?: string; // 发送者ID，用于fallback私聊
  log: (msg: string) => void;
}): Promise<void> {
  const { cfg, text, currentAgentId, currentAccountId, responseUrl, senderId, log } = params;

  // Parse mentions from text using dynamic config
  const botMentions = parseMentionsFromText(text, cfg, currentAccountId);

  if (botMentions.length === 0) {
    return;
  }

  log(
    `wecom: detected ${botMentions.length} bot mention(s): ${botMentions.map((m) => `${m.name}->${m.agentId}`).join(", ")}`,
  );

  // Extract message body (strip @mentions for cleaner task description)
  let messageBody = text;
  for (const mention of botMentions) {
    // Remove @name patterns
    messageBody = messageBody.replace(new RegExp(`@${mention.name}\\s*`, "gi"), "");
    // Remove <@name> patterns
    messageBody = messageBody.replace(new RegExp(`<@${mention.name}>\\s*`, "gi"), "");
  }
  messageBody = messageBody.trim();

  // Forward to each mentioned bot
  for (const { agentId, accountId, name } of botMentions) {
    await forwardToBotSubagent({
      cfg,
      runtime: params.runtime,
      currentAgentId,
      currentAccountId,
      currentSessionKey: params.currentSessionKey,
      targetAgentId: agentId,
      targetAccountId: accountId,
      targetName: name,
      message: messageBody,
      chatId: params.chatId,
      isGroup: params.isGroup,
      responseUrl,
      senderId,
      log,
    });
  }
}
