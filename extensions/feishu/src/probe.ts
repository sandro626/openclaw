import { createFeishuClient, type FeishuClientCredentials } from "./client.js";
import type { FeishuProbeResult } from "./types.js";

export async function probeFeishu(creds?: FeishuClientCredentials): Promise<FeishuProbeResult> {
  if (!creds?.appId || !creds?.appSecret) {
    return {
      ok: false,
      error: "missing credentials (appId, appSecret)",
    };
  }

  try {
    const client = createFeishuClient(creds);
    // Use bot/v3/info API to get bot information
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK generic request method
    const response = await (client as any).request({
      method: "GET",
      url: "/open-apis/bot/v3/info",
      data: {},
    });

    if (response.code !== 0) {
      return {
        ok: false,
        appId: creds.appId,
        error: `API error: ${response.msg || `code ${response.code}`}`,
      };
    }

    const bot = response.bot || response.data?.bot || response;
    console.error(`[Feishu Debug] probeFeishu: response.bot=${JSON.stringify(response.bot)}, response.data=${JSON.stringify(response.data)}, final bot=${JSON.stringify(bot)}`);
    const botName = bot?.bot_name || bot?.app_name;
    console.error(`[Feishu Debug] probeFeishu: extracted botName=${botName}`);
    return {
      ok: true,
      appId: creds.appId,
      botName,
      botOpenId: bot?.open_id,
      botUserId: bot?.user_id,
    };
  } catch (err) {
    return {
      ok: false,
      appId: creds.appId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
