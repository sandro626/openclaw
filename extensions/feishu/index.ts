import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { registerFeishuBitableTools } from "./src/bitable.js";
import { feishuPlugin } from "./src/channel.js";
import { registerFeishuDocTools } from "./src/docx.js";
import { registerFeishuDriveTools } from "./src/drive.js";
import { registerFeishuPermTools } from "./src/perm.js";
import { setFeishuRuntime } from "./src/runtime.js";
import { registerFeishuWikiTools } from "./src/wiki.js";

export { monitorFeishuProvider } from "./src/monitor.js";
export {
  sendMessageFeishu,
  sendCardFeishu,
  updateCardFeishu,
  editMessageFeishu,
  getMessageFeishu,
} from "./src/send.js";
export {
  uploadImageFeishu,
  uploadFileFeishu,
  sendImageFeishu,
  sendFileFeishu,
  sendMediaFeishu,
  uploadMediaToOSS,
  isOSSUploadAvailable,
  type OSSMediaResult,
} from "./src/media.js";
export {
  setOSSConfig,
  getOSSConfig,
  isOSSConfigured,
  uploadBufferToOSS,
  uploadUrlToOSS,
  type OSSConfig,
  type OSSUploadResult,
} from "./src/oss.js";
export { probeFeishu } from "./src/probe.js";
export {
  addReactionFeishu,
  removeReactionFeishu,
  listReactionsFeishu,
  FeishuEmoji,
} from "./src/reactions.js";
export {
  extractMentionTargets,
  extractMessageBody,
  isMentionForwardRequest,
  formatMentionForText,
  formatMentionForCard,
  formatMentionAllForText,
  formatMentionAllForCard,
  buildMentionedMessage,
  buildMentionedCardContent,
  type MentionTarget,
} from "./src/mention.js";
export { feishuPlugin } from "./src/channel.js";

// Personal account OAuth support
export {
  generateOAuthUrl,
  exchangeCodeForToken,
  refreshUserToken,
  getUserInfo,
  resolveUserAccessToken,
  sendUserMessage,
  completeOAuthFlow,
  type FeishuUserTokenResponse,
  type FeishuUserInfo,
  type FeishuPersonalTokens,
} from "./src/user-oauth.js";
export {
  listPersonalAccountIds,
  resolvePersonalAccountConfig,
  resolveFeishuPersonalAccount,
  listEnabledPersonalAccounts,
  findPersonalAccountByOpenId,
} from "./src/accounts.js";
export {
  sendMessageAsPersonalUser,
} from "./src/send.js";
export {
  feishuPersonalOnboardingAdapter,
  refreshPersonalAccountTokens,
} from "./src/personal-onboarding.js";

const plugin = {
  id: "feishu",
  name: "Feishu",
  description: "Feishu/Lark channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setFeishuRuntime(api.runtime);
    api.registerChannel({ plugin: feishuPlugin });
    registerFeishuDocTools(api);
    registerFeishuWikiTools(api);
    registerFeishuDriveTools(api);
    registerFeishuPermTools(api);
    registerFeishuBitableTools(api);
  },
};

export default plugin;
