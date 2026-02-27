/**
 * Feishu User OAuth 2.0 implementation for personal account support.
 *
 * This module enables OpenClaw to act as an individual Feishu user,
 * allowing it to send/receive messages with user identity instead of bot identity.
 *
 * OAuth 2.0 Flow:
 * 1. Generate authorization URL → User visits and authorizes
 * 2. Feishu redirects back with authorization code
 * 3. Exchange code for user_access_token and refresh_token
 * 4. Use token to call APIs on behalf of the user
 *
 * @see https://open.feishu.cn/document/authentication-management/access-token/get-user-access-token
 */

import type { FeishuDomain } from "./types.js";

// OAuth configuration
const FEISHU_OAUTH_BASE = "https://open.feishu.cn/open-apis/authen/v1";
const LARK_OAUTH_BASE = "https://open.larksuite.com/open-apis/authen/v1";
const TOKEN_ENDPOINT = "/authen/v2/oauth/token";
const USER_INFO_ENDPOINT = "/authen/v1/user_info";

/**
 * Resolve OAuth base URL based on domain.
 */
function resolveOAuthBaseUrl(domain: FeishuDomain): string {
  if (domain === "lark") {
    return "https://open.larksuite.com/open-apis";
  }
  return "https://open.feishu.cn/open-apis";
}

/**
 * Feishu user access token response.
 */
export type FeishuUserTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number; // Usually 7200 seconds (2 hours)
  refresh_token: string;
  scope: string;
};

/**
 * Feishu user info response.
 */
export type FeishuUserInfo = {
  open_id: string;
  union_id: string;
  name: string;
  en_name: string;
  avatar_url: string;
  email: string;
  mobile: string;
  tenant_key: string;
};

/**
 * Feishu OAuth token exchange error.
 */
export type FeishuOAuthError = {
  error: string;
  error_description: string;
};

/**
 * Personal account token storage.
 */
export type FeishuPersonalTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  openId: string;
  unionId?: string;
  tenantKey?: string;
  name?: string;
};

/**
 * Generate Feishu OAuth authorization URL.
 *
 * @param params - OAuth parameters
 * @returns Authorization URL for user to visit
 */
export function generateOAuthUrl(params: {
  appId: string;
  redirectUri: string;
  state?: string;
  scopes?: string[];
  domain?: FeishuDomain;
}): string {
  const { appId, redirectUri, state, scopes, domain = "feishu" } = params;

  const baseUrl = domain === "lark"
    ? "https://open.larksuite.com/open-apis/authen/v1/authorize"
    : "https://open.feishu.cn/open-apis/authen/v1/authorize";

  // Default scopes: basic user info + offline access for refresh token
  // Note: im:message:send_as_user is a special permission that may not be available
  // for all apps. It requires prior approval from Feishu and configuration in admin panel.
  const defaultScopes = [
    "contact:user.base:readonly", // Basic user info
    "offline_access", // For refresh_token
    "im:message", // Send/receive messages
    "im:message:send_as_bot", // Send as bot
  ];
  const scopeStr = (scopes ?? defaultScopes).join(" ");

  const url = new URL(baseUrl);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopeStr);
  if (state) {
    url.searchParams.set("state", state);
  }

  return url.toString();
}

/**
 * Exchange authorization code for user access token.
 *
 * @param params - Token exchange parameters
 * @returns Token response with access_token and refresh_token
 */
export async function exchangeCodeForToken(params: {
  appId: string;
  appSecret: string;
  code: string;
  redirectUri?: string;
  domain?: FeishuDomain;
}): Promise<FeishuUserTokenResponse> {
  const { appId, appSecret, code, redirectUri, domain = "feishu" } = params;

  const baseUrl = resolveOAuthBaseUrl(domain);
  const url = `${baseUrl}${TOKEN_ENDPOINT}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json() as {
    code: number;
    msg: string;
    data?: FeishuUserTokenResponse;
  };

  if (data.code !== 0 || !data.data) {
    throw new Error(`Feishu OAuth token exchange failed: ${data.msg} (code: ${data.code})`);
  }

  return data.data;
}

/**
 * Refresh user access token using refresh_token.
 *
 * Note: refresh_token can only be used once and returns new tokens.
 *
 * @param params - Refresh parameters
 * @returns New token response
 */
export async function refreshUserToken(params: {
  appId: string;
  appSecret: string;
  refreshToken: string;
  domain?: FeishuDomain;
}): Promise<FeishuUserTokenResponse> {
  const { appId, appSecret, refreshToken, domain = "feishu" } = params;

  const baseUrl = resolveOAuthBaseUrl(domain);
  const url = `${baseUrl}${TOKEN_ENDPOINT}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: appId,
      client_secret: appSecret,
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json() as {
    code: number;
    msg: string;
    data?: FeishuUserTokenResponse;
  };

  if (data.code !== 0 || !data.data) {
    throw new Error(`Feishu OAuth token refresh failed: ${data.msg} (code: ${data.code})`);
  }

  return data.data;
}

/**
 * Get user info using user_access_token.
 *
 * @param params - User info parameters
 * @returns User information
 */
export async function getUserInfo(params: {
  accessToken: string;
  domain?: FeishuDomain;
}): Promise<FeishuUserInfo> {
  const { accessToken, domain = "feishu" } = params;

  const baseUrl = resolveOAuthBaseUrl(domain);
  const url = `${baseUrl}${USER_INFO_ENDPOINT}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  const data = await response.json() as {
    code: number;
    msg: string;
    data?: FeishuUserInfo;
  };

  if (data.code !== 0 || !data.data) {
    throw new Error(`Feishu get user info failed: ${data.msg} (code: ${data.code})`);
  }

  return data.data;
}

/**
 * Resolve a valid user access token.
 *
 * If the token is expired or about to expire, automatically refresh it.
 *
 * @param params - Resolution parameters
 * @returns Valid tokens (possibly refreshed)
 */
export async function resolveUserAccessToken(params: {
  appId: string;
  appSecret: string;
  tokens: FeishuPersonalTokens;
  domain?: FeishuDomain;
  refreshBufferMs?: number; // Refresh if token expires within this time (default: 5 minutes)
}): Promise<FeishuPersonalTokens> {
  const {
    appId,
    appSecret,
    tokens,
    domain = "feishu",
    refreshBufferMs = 5 * 60 * 1000, // 5 minutes
  } = params;

  const now = Date.now();
  const expiresSoon = tokens.expiresAt - now < refreshBufferMs;

  if (!expiresSoon) {
    return tokens;
  }

  // Token expired or about to expire, refresh it
  const newTokenResponse = await refreshUserToken({
    appId,
    appSecret,
    refreshToken: tokens.refreshToken,
    domain,
  });

  const newTokens: FeishuPersonalTokens = {
    accessToken: newTokenResponse.access_token,
    refreshToken: newTokenResponse.refresh_token,
    expiresAt: now + newTokenResponse.expires_in * 1000,
    openId: tokens.openId,
    unionId: tokens.unionId,
    tenantKey: tokens.tenantKey,
    name: tokens.name,
  };

  return newTokens;
}

/**
 * Send a message as a user using user_access_token.
 *
 * @param params - Message parameters
 * @returns Message ID and chat ID
 */
export async function sendUserMessage(params: {
  accessToken: string;
  receiveId: string;
  receiveIdType: "open_id" | "user_id" | "union_id" | "email" | "chat_id";
  msgType: "text" | "post" | "image" | "file" | "audio" | "media" | "sticker" | "interactive";
  content: string | Record<string, unknown>;
  domain?: FeishuDomain;
  uuid?: string;
}): Promise<{ messageId: string }> {
  const {
    accessToken,
    receiveId,
    receiveIdType,
    msgType,
    content,
    domain = "feishu",
    uuid,
  } = params;

  const baseUrl = resolveOAuthBaseUrl(domain);
  const url = `${baseUrl}/im/v1/messages?receive_id_type=${receiveIdType}`;

  const body: Record<string, unknown> = {
    receive_id: receiveId,
    msg_type: msgType,
    content: typeof content === "string" ? content : JSON.stringify(content),
  };
  if (uuid) {
    body.uuid = uuid;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as {
    code: number;
    msg: string;
    data?: { message_id: string };
  };

  if (data.code !== 0 || !data.data) {
    throw new Error(`Feishu send user message failed: ${data.msg} (code: ${data.code})`);
  }

  return { messageId: data.data.message_id };
}

/**
 * Create personal tokens from OAuth flow.
 *
 * This is a helper function that completes the full OAuth flow:
 * 1. Exchange code for tokens
 * 2. Get user info
 * 3. Return complete token info
 */
export async function completeOAuthFlow(params: {
  appId: string;
  appSecret: string;
  code: string;
  redirectUri?: string;
  domain?: FeishuDomain;
}): Promise<FeishuPersonalTokens> {
  const { appId, appSecret, code, redirectUri, domain = "feishu" } = params;

  // Exchange code for tokens
  const tokenResponse = await exchangeCodeForToken({
    appId,
    appSecret,
    code,
    redirectUri,
    domain,
  });

  // Get user info
  const userInfo = await getUserInfo({
    accessToken: tokenResponse.access_token,
    domain,
  });

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    openId: userInfo.open_id,
    unionId: userInfo.union_id,
    tenantKey: userInfo.tenant_key,
    name: userInfo.name,
  };
}
