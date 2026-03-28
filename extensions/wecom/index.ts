/**
 * WeCom (企业微信) Channel Plugin for OpenClaw
 *
 * 企业微信应用消息推送集成 + 智能机器人集成
 * 应用文档: https://developer.work.weixin.qq.com/document/path/90665
 * 机器人文档: https://developer.work.weixin.qq.com/document/path/100719
 */

import type { OpenClawPluginApi } from "./api.js";
import { emptyPluginConfigSchema } from "./api.js";
import { wecomPlugin } from "./src/channel.js";
import { setWeComRuntime } from "./src/runtime.js";

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
    console.error("==================================");

    setWeComRuntime(api.runtime);
    api.registerChannel({ plugin: wecomPlugin });
  },
};

export default plugin;
