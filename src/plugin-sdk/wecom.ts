// Private helper surface for the bundled wecom plugin.
// Keep this list additive and scoped to symbols used under extensions/wecom.

export { buildChannelConfigSchema } from "../channels/plugins/config-schema.js";
export type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
export type { OpenClawConfig } from "../config/config.js";
export type { MarkdownTableMode } from "../config/types.js";
export { DmPolicySchema, GroupPolicySchema } from "../config/zod-schema.core.js";
export { callGateway } from "../gateway/call.js";
export { emptyPluginConfigSchema } from "../plugins/config-schema.js";
export { registerPluginHttpRoute } from "../plugins/http-registry.js";
export type { PluginRuntime } from "../plugins/runtime/types.js";
export type { OpenClawPluginApi } from "../plugins/types.js";
export { DEFAULT_ACCOUNT_ID } from "../routing/session-key.js";
export type { RuntimeEnv } from "../runtime.js";
export { normalizePluginHttpPath } from "./webhook-ingress.js";
