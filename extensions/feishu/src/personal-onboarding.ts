/**
 * Feishu personal account onboarding adapter.
 *
 * Guides users through OAuth 2.0 authorization flow to bind their personal Feishu account.
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import {
  formatDocsLink,
  type ChannelOnboardingAdapter,
  type WizardPrompter,
} from "openclaw/plugin-sdk";
import {
  generateOAuthUrl,
  completeOAuthFlow,
  type FeishuPersonalTokens,
} from "./user-oauth.js";
import {
  listPersonalAccountIds,
  resolvePersonalAccountConfig,
} from "./accounts.js";
import type { FeishuPersonalAccountConfig } from "./types.js";

const channel = "feishu" as const;

/**
 * Set personal account configuration
 */
function setPersonalAccount(
  cfg: OpenClawConfig,
  accountId: string,
  account: Partial<FeishuPersonalAccountConfig>,
): OpenClawConfig {
  const feishuCfg = (cfg.channels as Record<string, unknown>)?.feishu as
    | Record<string, unknown>
    | undefined;

  const existing = resolvePersonalAccountConfig(cfg, accountId);
  const merged: FeishuPersonalAccountConfig = {
    enabled: account.enabled ?? existing?.enabled ?? true,
    name: account.name ?? existing?.name,
    appId: account.appId ?? existing?.appId ?? "",
    appSecret: account.appSecret ?? existing?.appSecret ?? "",
    accessToken: account.accessToken ?? existing?.accessToken,
    refreshToken: account.refreshToken ?? existing?.refreshToken,
    expiresAt: account.expiresAt ?? existing?.expiresAt,
    openId: account.openId ?? existing?.openId,
    unionId: account.unionId ?? existing?.unionId,
    tenantKey: account.tenantKey ?? existing?.tenantKey,
    redirectUri: account.redirectUri ?? existing?.redirectUri,
  };

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      feishu: {
        ...feishuCfg,
        personalAccounts: {
          ...(feishuCfg?.personalAccounts as Record<string, unknown> | undefined),
          [accountId]: merged,
        },
      },
    },
  };
}

/**
 * Display OAuth setup help
 */
async function displayOAuthHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "Feishu Personal Account OAuth Setup",
      "",
      "To use OpenClaw as your personal Feishu account:",
      "1. Create a Feishu app in Developer Console (https://open.feishu.cn/app)",
      "2. Enable OAuth permissions: contact:user.base:readonly, im:message, offline_access",
      "3. Configure redirect URI: http://localhost:3000/oauth/feishu/callback",
      "4. Copy App ID and App Secret",
      "",
      `Docs: ${formatDocsLink("/channels/feishu", "channels/feishu")}`,
    ].join("\n"),
    "Feishu Personal Account",
  );
}

/**
 * Prompt for OAuth app credentials
 */
async function promptOAuthCredentials(
  prompter: WizardPrompter,
  existing: FeishuPersonalAccountConfig | null,
): Promise<{ appId: string; appSecret: string; redirectUri: string }> {
  const appId = String(
    await prompter.text({
      message: "Feishu App ID (cli_xxx)",
      initialValue: existing?.appId ?? "",
      validate: (value) => (value?.trim() ? undefined : "Required"),
    }),
  ).trim();

  const appSecret = String(
    await prompter.text({
      message: "Feishu App Secret",
      initialValue: existing?.appSecret ?? "",
      validate: (value) => (value?.trim() ? undefined : "Required"),
    }),
  ).trim();

  const redirectUri = String(
    await prompter.text({
      message: "OAuth Redirect URI",
      initialValue: existing?.redirectUri ?? "http://localhost:3000/oauth/feishu/callback",
      validate: (value) => {
        const raw = String(value ?? "").trim();
        if (!raw) return "Required";
        try {
          new URL(raw);
          return undefined;
        } catch {
          return "Invalid URL";
        }
      },
    }),
  ).trim();

  return { appId, appSecret, redirectUri };
}

/**
 * Prompt user to complete OAuth authorization
 */
async function promptOAuthAuthorization(
  prompter: WizardPrompter,
  params: {
    appId: string;
    appSecret: string;
    redirectUri: string;
    domain: "feishu" | "lark";
  },
): Promise<FeishuPersonalTokens> {
  const { appId, appSecret, redirectUri, domain } = params;

  // Generate authorization URL
  const authUrl = generateOAuthUrl({
    appId,
    redirectUri,
    state: `openclaw-${Date.now()}`,
    domain,
    scopes: [
      "contact:user.base:readonly",
      "offline_access",
      "im:message",
      "im:message:send_as_bot",
    ],
  });

  await prompter.note(
    [
      "Authorization Required",
      "",
      "Please visit the following URL to authorize your Feishu account:",
      "",
      authUrl,
      "",
      "After authorization, you will be redirected to the callback URL.",
      "Copy the 'code' parameter from the URL.",
    ].join("\n"),
    "OAuth Authorization",
  );

  // Prompt for authorization code
  const code = String(
    await prompter.text({
      message: "Enter the authorization code from redirect URL",
      placeholder: "code=xxx",
      validate: (value) => (value?.trim() ? undefined : "Required"),
    }),
  ).trim();

  // Exchange code for tokens
  await prompter.note("Exchanging authorization code for tokens...", "Please wait");

  const tokens = await completeOAuthFlow({
    appId,
    appSecret,
    code,
    redirectUri,
    domain,
  });

  return tokens;
}

/**
 * Prompt for account ID and name
 */
async function promptAccountInfo(
  prompter: WizardPrompter,
  existingIds: string[],
): Promise<{ accountId: string; name?: string }> {
  const accountId = String(
    await prompter.text({
      message: "Personal account ID (unique identifier)",
      placeholder: "my-feishu-account",
      initialValue: "personal",
      validate: (value) => {
        const raw = String(value ?? "").trim();
        if (!raw) return "Required";
        if (existingIds.includes(raw)) return "Account ID already exists";
        return undefined;
      },
    }),
  ).trim();

  const name = String(
    await prompter.text({
      message: "Display name (optional)",
      placeholder: "My Feishu Account",
    }),
  ).trim() || undefined;

  return { accountId, name };
}

/**
 * Personal account onboarding adapter
 */
export const feishuPersonalOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const accountIds = listPersonalAccountIds(cfg);
    const configured = accountIds.length > 0;

    return {
      channel,
      configured,
      statusLines: [
        `Feishu Personal: ${configured ? `${accountIds.length} account(s) configured` : "not configured"}`,
      ],
      selectionHint: configured ? "configured" : "needs OAuth setup",
    };
  },
  configure: async ({ cfg, prompter }) => {
    const existingIds = listPersonalAccountIds(cfg);

    await displayOAuthHelp(prompter);

    // Get account info
    const { accountId, name } = await promptAccountInfo(prompter, existingIds);
    const existing = resolvePersonalAccountConfig(cfg, accountId);

    // Get OAuth credentials
    const { appId, appSecret, redirectUri } = await promptOAuthCredentials(
      prompter,
      existing ?? null,
    );

    // Ask for domain
    const domain = await prompter.confirm({
      message: "Use Lark (international) instead of Feishu (China)?",
      initialValue: false,
    });

    // Complete OAuth flow
    const tokens = await promptOAuthAuthorization(prompter, {
      appId,
      appSecret,
      redirectUri,
      domain: domain ? "lark" : "feishu",
    });

    // Save configuration
    const updatedCfg = setPersonalAccount(cfg, accountId, {
      enabled: true,
      name,
      appId,
      appSecret,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      openId: tokens.openId,
      unionId: tokens.unionId,
      tenantKey: tokens.tenantKey,
      redirectUri,
    });

    await prompter.note(
      [
        "Personal Account Configured Successfully!",
        "",
        `Account ID: ${accountId}`,
        `User: ${tokens.name}`,
        `Open ID: ${tokens.openId}`,
        "",
        "You can now send messages as this user using:",
        `  --channel feishu --account ${accountId}`,
      ].join("\n"),
      "Setup Complete",
    );

    return { cfg: updatedCfg };
  },
  dmPolicy: {
    label: "Feishu Personal",
    channel,
    policyKey: "channels.feishu.personalAccounts",
    allowFromKey: "channels.feishu.personalAccounts.*.openId",
    getCurrent: () => "allowlist", // Personal accounts are always allowlist by design
    setPolicy: (cfg) => cfg,
    promptAllowFrom: async ({ cfg }) => cfg,
  },
  disable: (cfg) => {
    const feishu = (cfg.channels as Record<string, unknown>)?.feishu as
      | Record<string, unknown>
      | undefined;
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        feishu: { ...feishu, personalAccounts: undefined },
      },
    };
  },
};

/**
 * CLI command to refresh personal account tokens
 */
export async function refreshPersonalAccountTokens(params: {
  cfg: OpenClawConfig;
  accountId: string;
  log?: (msg: string) => void;
}): Promise<{ updated: boolean; cfg: OpenClawConfig }> {
  const { cfg, accountId, log } = params;
  const account = resolvePersonalAccountConfig(cfg, accountId);

  if (!account) {
    throw new Error(`Personal account "${accountId}" not found`);
  }

  if (!account.refreshToken) {
    throw new Error(`Personal account "${accountId}" has no refresh token`);
  }

  log?.(`Refreshing tokens for personal account "${accountId}"...`);

  const { refreshUserToken } = await import("./user-oauth.js");
  const feishuCfg = (cfg.channels as Record<string, unknown>)?.feishu as
    | Record<string, unknown>
    | undefined;
  const domain = (feishuCfg?.domain as "feishu" | "lark") ?? "feishu";

  const tokenResponse = await refreshUserToken({
    appId: account.appId,
    appSecret: account.appSecret,
    refreshToken: account.refreshToken,
    domain,
  });

  const now = Date.now();
  const updatedCfg = setPersonalAccount(cfg, accountId, {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: now + tokenResponse.expires_in * 1000,
  });

  log?.(`Tokens refreshed successfully. Expires at: ${new Date(now + tokenResponse.expires_in * 1000).toISOString()}`);

  return { updated: true, cfg: updatedCfg };
}
