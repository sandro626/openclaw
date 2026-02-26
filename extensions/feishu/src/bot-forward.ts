/**
 * Bot-to-bot communication via Subagent mechanism.
 *
 * Feishu doesn't push bot-sent messages to other bots, so when one bot
 * @mentions another bot, the mentioned bot won't receive the event.
 *
 * This module detects when a bot's outgoing message @mentions another bot
 * and uses OpenClaw's Subagent mechanism to invoke the target bot's agent.
 */

import type { ClawdbotConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import { callGateway } from "openclaw/plugin-sdk";
import { listFeishuAccountIds } from "./accounts.js";
import type { MentionTarget } from "./mention.js";

/**
 * Build a mapping from accountId to agentId based on bindings configuration.
 */
export function buildAccountIdToAgentIdMap(cfg: ClawdbotConfig): Map<string, string> {
  const map = new Map<string, string>();
  const bindings = cfg.bindings ?? [];

  for (const binding of bindings) {
    if (!binding || typeof binding !== "object") continue;

    const channel = binding.match?.channel;
    if (channel !== "feishu") continue;

    const accountId = binding.match?.accountId;
    const agentId = binding.agentId;

    if (accountId && agentId) {
      map.set(accountId, agentId);
    }
  }

  return map;
}

/**
 * Build a mapping from bot name to accountId.
 * Uses the account's name field from configuration.
 */
export function buildBotNameToAccountIdMap(cfg: ClawdbotConfig): Map<string, string> {
  const map = new Map<string, string>();
  const accounts = (cfg.channels?.feishu as any)?.accounts;

  if (!accounts || typeof accounts !== "object") {
    return map;
  }

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
 * Resolve agentId for a mention target.
 * First tries to match by name, then falls back to open_id matching.
 */
export function resolveMentionTargetAgentId(params: {
  cfg: ClawdbotConfig;
  target: MentionTarget;
  accountIdToAgentId: Map<string, string>;
  nameToAccountId: Map<string, string>;
  botOpenIds: Map<string, string>; // accountId -> openId
}): string | null {
  const { target, accountIdToAgentId, nameToAccountId } = params;

  // Try name-based matching first (most reliable)
  const name = target.name?.trim();
  if (name) {
    const accountId = nameToAccountId.get(name) || nameToAccountId.get(name.toLowerCase());
    if (accountId) {
      const agentId = accountIdToAgentId.get(accountId);
      if (agentId) {
        return agentId;
      }
    }
  }

  // Fallback: try to match by open_id
  // This requires knowing the open_id of each bot
  for (const [accountId, openId] of params.botOpenIds) {
    if (openId === target.openId) {
      const agentId = accountIdToAgentId.get(accountId);
      if (agentId) {
        return agentId;
      }
    }
  }

  return null;
}

/**
 * Detect if mention targets include other bots and return their agentIds.
 */
export function detectBotMentions(params: {
  cfg: ClawdbotConfig;
  mentionTargets: MentionTarget[];
  currentAccountId: string;
  botOpenIds: Map<string, string>;
}): Array<{ target: MentionTarget; agentId: string; accountId: string }> {
  const { cfg, mentionTargets, currentAccountId, botOpenIds } = params;

  if (!mentionTargets || mentionTargets.length === 0) {
    return [];
  }

  const accountIdToAgentId = buildAccountIdToAgentIdMap(cfg);
  const nameToAccountId = buildBotNameToAccountIdMap(cfg);

  const results: Array<{ target: MentionTarget; agentId: string; accountId: string }> = [];

  for (const target of mentionTargets) {
    const agentId = resolveMentionTargetAgentId({
      cfg,
      target,
      accountIdToAgentId,
      nameToAccountId,
      botOpenIds,
    });

    if (agentId) {
      // Find the accountId for this agentId
      let targetAccountId: string | undefined;
      for (const [accId, aId] of accountIdToAgentId) {
        if (aId === agentId) {
          targetAccountId = accId;
          break;
        }
      }

      // Skip if the target is the current bot itself
      if (targetAccountId && targetAccountId !== currentAccountId) {
        results.push({
          target,
          agentId,
          accountId: targetAccountId,
        });
      }
    }
  }

  return results;
}

/**
 * Forward a message to another bot via Subagent mechanism using callGateway.
 * This uses the gateway's agent method to spawn a subagent.
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
  replyToMessageId?: string;
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
    log,
  } = params;

  // Check if subagent spawning is allowed for this agent
  const agentConfig = (cfg.agents?.list ?? []).find(
    (a) => a.id?.toLowerCase() === currentAgentId.toLowerCase()
  );
  const subagentConfig = agentConfig?.subagents;
  const allowAgents: string[] = subagentConfig?.allowAgents ?? [];

  // Check if target agent is allowed
  const allowAny = allowAgents.some((a: string) => a.trim() === "*");
  const normalizedTarget = targetAgentId.toLowerCase();
  const allowSet = new Set(
    allowAgents
      .filter((a: string) => a.trim() && a.trim() !== "*")
      .map((a: string) => a.toLowerCase())
  );

  if (!allowAny && !allowSet.has(normalizedTarget)) {
    log(
      `feishu: bot forward skipped, ${currentAgentId} not allowed to spawn ${targetAgentId}`
    );
    return { success: false, error: "Agent not allowed to spawn target" };
  }

  const task = `[Forwarded from ${currentAgentId}] ${message}`;
  const label = `${targetName}-subagent`;

  // Build session key for the subagent
  const crypto = await import("node:crypto");
  const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;

  log(
    `feishu: spawning subagent ${targetAgentId} for bot-to-bot communication via gateway`
  );

  try {
    // Use gateway agent method to spawn subagent
    const result = await callGateway<{ runId: string }>({
      config: cfg,
      method: "agent",
      params: {
        message: task,
        sessionKey: childSessionKey,
        channel: "feishu",
        to: `chat:${chatId}`,
        accountId: currentAccountId,
        idempotencyKey: crypto.randomUUID(),
        deliver: false,
        lane: "subagent",
        label,
        spawnedBy: currentSessionKey,
        groupId: chatId,
        groupChannel: "feishu",
      },
      timeoutMs: 10_000,
    });

    if (result?.runId) {
      log(
        `feishu: subagent ${targetAgentId} spawned successfully, runId=${result.runId}`
      );
      return { success: true };
    } else {
      log(`feishu: subagent ${targetAgentId} spawn returned no runId`);
      return { success: false, error: "No runId returned" };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`feishu: failed to spawn subagent ${targetAgentId}: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Process outgoing message for bot mentions and forward to target bots.
 * This is the main entry point for bot-to-bot communication.
 */
export async function processBotMentions(params: {
  cfg: ClawdbotConfig;
  runtime?: RuntimeEnv;
  text: string;
  mentionTargets?: MentionTarget[];
  currentAgentId: string;
  currentAccountId: string;
  currentSessionKey?: string;
  chatId: string;
  replyToMessageId?: string;
  botOpenIds: Map<string, string>;
  log: (msg: string) => void;
}): Promise<void> {
  const {
    cfg,
    mentionTargets,
    currentAgentId,
    currentAccountId,
    botOpenIds,
    log,
  } = params;

  if (!mentionTargets || mentionTargets.length === 0) {
    return;
  }

  const botMentions = detectBotMentions({
    cfg,
    mentionTargets,
    currentAccountId,
    botOpenIds,
  });

  if (botMentions.length === 0) {
    return;
  }

  log(
    `feishu: detected ${botMentions.length} bot mention(s), forwarding via subagent`
  );

  // Extract message body (strip @mentions for cleaner task description)
  let messageBody = params.text;
  for (const mention of mentionTargets) {
    // Remove @name patterns
    messageBody = messageBody.replace(
      new RegExp(`@${mention.name}\\s*`, "gi"),
      ""
    );
  }
  messageBody = messageBody.trim();

  // Forward to each mentioned bot
  for (const { target, agentId, accountId } of botMentions) {
    await forwardToBotSubagent({
      cfg,
      runtime: params.runtime,
      currentAgentId,
      currentAccountId,
      currentSessionKey: params.currentSessionKey,
      targetAgentId: agentId,
      targetAccountId: accountId,
      targetName: target.name,
      message: messageBody,
      chatId: params.chatId,
      replyToMessageId: params.replyToMessageId,
      log,
    });
  }
}
