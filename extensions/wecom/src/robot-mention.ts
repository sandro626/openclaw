/**
 * WeCom Robot Mention Utilities
 * 企业微信智能机器人 @提及 功能
 *
 * WeCom 机器人回复支持 mentioned_list 字段来 @成员
 * 文档: https://developer.work.weixin.qq.com/document/path/100719
 */

import type { ClawdbotConfig } from "openclaw/plugin-sdk";

/**
 * Mention target for robot replies
 */
export type RobotMentionTarget = {
  userId: string; // WeCom user ID or robot key (aibotid)
  name: string;
  isRobot?: boolean;
};

/**
 * Robot info from configuration
 */
export type RobotInfo = {
  accountId: string;
  robotKey: string; // aibotid
  name: string;
};

/**
 * Build a mapping from robot name to robot config
 */
export function buildRobotNameMap(cfg: ClawdbotConfig): Map<string, RobotInfo> {
  const map = new Map<string, RobotInfo>();
  const robots = (cfg.channels?.wecom as any)?.robots || {};

  for (const [accountId, robotConfig] of Object.entries(robots)) {
    if (!robotConfig || typeof robotConfig !== "object") continue;

    const config = robotConfig as any;
    const name = config.name;
    const robotKey = config.robotKey;

    if (name && robotKey) {
      // Map lowercase name for case-insensitive matching
      map.set(name.toLowerCase(), { accountId, robotKey, name });
      // Also map original case
      map.set(name, { accountId, robotKey, name });
    }
  }

  return map;
}

/**
 * Build a mapping from accountId to robot config
 */
export function buildAccountIdToRobotMap(cfg: ClawdbotConfig): Map<string, RobotInfo> {
  const map = new Map<string, RobotInfo>();
  const robots = (cfg.channels?.wecom as any)?.robots || {};

  for (const [accountId, robotConfig] of Object.entries(robots)) {
    if (!robotConfig || typeof robotConfig !== "object") continue;

    const config = robotConfig as any;
    const name = config.name;
    const robotKey = config.robotKey;

    if (name && robotKey) {
      map.set(accountId, { accountId, robotKey, name });
    }
  }

  return map;
}

/**
 * Get robot info by name
 */
export function getRobotInfoByName(cfg: ClawdbotConfig, name: string): RobotInfo | undefined {
  const nameMap = buildRobotNameMap(cfg);
  return nameMap.get(name) || nameMap.get(name.toLowerCase());
}

/**
 * Get robot info by accountId
 */
export function getRobotInfoByAccountId(
  cfg: ClawdbotConfig,
  accountId: string,
): RobotInfo | undefined {
  const accountMap = buildAccountIdToRobotMap(cfg);
  return accountMap.get(accountId);
}

/**
 * Parse @mentions from message text and return targets
 * Supports formats:
 * - @名称
 * - <@名称>
 * - <@robotKey>
 */
export function parseRobotMentionsFromText(
  text: string,
  cfg: ClawdbotConfig,
): RobotMentionTarget[] {
  const targets: RobotMentionTarget[] = [];
  const robotNameMap = buildRobotNameMap(cfg);
  const accountMap = buildAccountIdToRobotMap(cfg);

  const seen = new Set<string>();

  // Match @mentions patterns
  const patterns = [
    /<@([^>]+)>/g, // <@name> or <@robotKey> format
    /@([\u4e00-\u9fa5\w-]+)/g, // @name format (supports Chinese)
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const mentionName = match[1].trim();
      const mentionNameLower = mentionName.toLowerCase();

      // Skip if already processed
      if (seen.has(mentionNameLower)) continue;

      // Try to find robot by name
      const robotInfo = robotNameMap.get(mentionName) || robotNameMap.get(mentionNameLower);

      if (robotInfo) {
        seen.add(mentionNameLower);
        targets.push({
          userId: robotInfo.robotKey, // Use robotKey as the userId for mentions
          name: robotInfo.name,
          isRobot: true,
        });
      } else {
        // Try to match by robotKey directly
        for (const info of accountMap.values()) {
          if (info.robotKey === mentionName) {
            seen.add(mentionNameLower);
            targets.push({
              userId: info.robotKey,
              name: info.name,
              isRobot: true,
            });
            break;
          }
        }
      }
    }
  }

  return targets;
}

/**
 * Format @mention for WeCom robot text response
 * Uses the mentioned_list mechanism
 *
 * Note: The actual mention in text content is just plain text like "@CTO助手"
 * The mentioned_list field tells WeCom who to notify
 */
export function formatMentionText(name: string): string {
  return `@${name}`;
}

/**
 * Build robot response with mentions
 * Returns content and mentioned_list for the response
 */
export function buildRobotResponseWithMentions(
  message: string,
  mentions: RobotMentionTarget[],
): { content: string; mentioned_list: string[] } {
  if (mentions.length === 0) {
    return { content: message, mentioned_list: [] };
  }

  // Prepend mentions to message
  const mentionTexts = mentions.map((m) => formatMentionText(m.name));
  const content = `${mentionTexts.join(" ")} ${message}`.trim();

  // Build mentioned_list with userIds (robotKeys for robots)
  const mentioned_list = mentions.map((m) => m.userId);

  return { content, mentioned_list };
}

/**
 * Resolve mention targets from agent response text
 * Detects @mentions in the agent's reply and resolves them to actual targets
 */
export function resolveMentionsFromResponse(
  responseText: string,
  cfg: ClawdbotConfig,
): RobotMentionTarget[] {
  return parseRobotMentionsFromText(responseText, cfg);
}

/**
 * Get robotKey for a given accountId
 */
export function getRobotKeyByAccountId(cfg: ClawdbotConfig, accountId: string): string | undefined {
  const info = getRobotInfoByAccountId(cfg, accountId);
  return info?.robotKey;
}
