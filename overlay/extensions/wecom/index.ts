/**
 * WeCom (企业微信) Channel Plugin for Clawdbot
 *
 * 企业微信应用消息推送集成 + 智能机器人集成
 * 应用文档: https://developer.work.weixin.qq.com/document/path/90665
 * 机器人文档: https://developer.work.weixin.qq.com/document/path/100719
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { wecomPlugin } from "./src/channel.js";
import { handleWeComWebhookRequest } from "./src/monitor.js";
import { handleWeComRobotWebhookRequest } from "./src/robot.js";
import { setWeComRuntime } from "./src/runtime.js";

/**
 * 统一 HTTP 处理器 - 处理应用和机器人 Webhook
 */
async function unifiedWebhookHandler(
  req: Parameters<NonNullable<OpenClawPluginApi["registerHttpHandler"]>>[0],
  res: Parameters<NonNullable<OpenClawPluginApi["registerHttpHandler"]>>[1],
): Promise<boolean> {
  // 先尝试机器人处理器
  const robotHandled = await handleWeComRobotWebhookRequest(req, res);
  if (robotHandled) {
    return true;
  }

  // 回退到应用处理器
  return handleWeComWebhookRequest(req, res);
}

const plugin = {
  id: "wecom",
  name: "WeCom",
  description: "WeCom (企业微信) channel plugin - 企业微信应用消息推送 + 智能机器人",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    console.error("==================================");
    console.error("== WeCom PLUGIN REGISTERING! =========");
    console.error("== runtime:", !!api.runtime);
    console.error("== registerChannel:", !!api.registerChannel);
    console.error("== registerHttpHandler:", !!api.registerHttpHandler);
    console.error("==================================");

    setWeComRuntime(api.runtime);
    api.registerChannel({ plugin: wecomPlugin });
    api.registerHttpHandler(unifiedWebhookHandler);

    console.error("== WeCom HTTP Handler REGISTERED! ====");
    console.error("== (Supporting both App & Robot Webhooks) ====");
  },
};

export default plugin;
