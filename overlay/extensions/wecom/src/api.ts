/**
 * WeCom API 客户端
 * 企业微信 API 调用封装
 */

import type {
  ResolvedWeComAccount,
  WeComApiResponse,
  WeComSendParams,
  WeComAccessTokenResponse,
  WeComMediaUploadResponse,
} from "./types.js";

// Access Token 缓存
const accessTokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * WeCom API 错误
 */
export class WeComApiError extends Error {
  constructor(
    public code: number,
    public message: string,
  ) {
    super(`WeCom API error [${code}]: ${message}`);
    this.name = "WeComApiError";
  }

  static isTokenExpired(error: unknown): error is WeComApiError {
    return error instanceof WeComApiError && error.code === 40014;
  }

  static isInvalidCredential(error: unknown): error is WeComApiError {
    return error instanceof WeComApiError && (error.code === 40013 || error.code === 40014);
  }
}

/**
 * 获取 Access Token
 */
export async function getAccessToken(
  corpId: string,
  agentSecret: string,
  fetcher?: typeof fetch,
): Promise<string> {
  const cacheKey = `${corpId}:${agentSecret}`;
  const cached = accessTokenCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(agentSecret)}`;

  const fetchImpl = fetcher || fetch;
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new WeComApiError(-1, `HTTP ${response.status}`);
  }

  const data = (await response.json()) as WeComAccessTokenResponse;

  if (data.errcode !== 0) {
    throw new WeComApiError(data.errcode, data.errmsg);
  }

  if (!data.access_token) {
    throw new WeComApiError(-1, "No access token in response");
  }

  // 缓存 token，提前 5 分钟过期
  const expiresIn = (data.expires_in || 7200) * 1000 - 300000;
  accessTokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn,
  });

  return data.access_token;
}

/**
 * 清除 Access Token 缓存
 */
export function clearAccessTokenCache(corpId?: string, agentSecret?: string): void {
  if (corpId && agentSecret) {
    accessTokenCache.delete(`${corpId}:${agentSecret}`);
  } else {
    accessTokenCache.clear();
  }
}

/**
 * 发送消息
 */
export async function sendMessage(
  accessToken: string,
  params: WeComSendParams,
  fetcher?: typeof fetch,
): Promise<{
  messageId: string;
  invalidUsers?: string[];
  invalidParties?: string[];
  invalidTags?: string[];
}> {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(accessToken)}`;

  const fetchImpl = fetcher || fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new WeComApiError(-1, `HTTP ${response.status}`);
  }

  const data = (await response.json()) as WeComApiResponse<{
    msgid?: string;
    invaliduser?: string;
    invalidparty?: string;
    invalidtag?: string;
  }>;

  if (data.errcode !== 0) {
    throw new WeComApiError(data.errcode, data.errmsg);
  }

  const msgid = data.msgid;
  const invaliduser = data.invaliduser;
  const invalidparty = data.invalidparty;
  const invalidtag = data.invalidtag;

  return {
    messageId: typeof msgid === "string" ? msgid : typeof msgid === "number" ? String(msgid) : "",
    invalidUsers: typeof invaliduser === "string" ? invaliduser.split("|").filter(Boolean) : [],
    invalidParties: typeof invalidparty === "string" ? invalidparty.split("|").filter(Boolean) : [],
    invalidTags: typeof invalidtag === "string" ? invalidtag.split("|").filter(Boolean) : [],
  };
}

/**
 * 发送群聊消息 (appchat)
 * 文档: https://developer.work.weixin.qq.com/document/path/100719
 */
export async function sendAppchatMessage(
  accessToken: string,
  params: import("./types.js").WeComAppchatSendParams,
  fetcher?: typeof fetch,
): Promise<{ messageId: string }> {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/send?access_token=${encodeURIComponent(accessToken)}`;

  const fetchImpl = fetcher || fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new WeComApiError(-1, `HTTP ${response.status}`);
  }

  const data = (await response.json()) as WeComApiResponse<{ msgid?: string }>;

  if (data.errcode !== 0) {
    throw new WeComApiError(data.errcode, data.errmsg);
  }

  const msgid = data.msgid;
  return {
    messageId: typeof msgid === "string" ? msgid : typeof msgid === "number" ? String(msgid) : "",
  };
}

/**
 * 发送图片消息
 */
export async function sendImageMessage(
  accessToken: string,
  params: {
    touser?: string;
    toparty?: string;
    totag?: string;
    agentid: number;
    media_id: string;
    safe?: 0 | 1;
  },
  fetcher?: typeof fetch,
): Promise<{ messageId: string }> {
  const result = await sendMessage(
    accessToken,
    {
      touser: params.touser,
      toparty: params.toparty,
      totag: params.totag,
      msgtype: "image",
      agentid: params.agentid,
      image: { media_id: params.media_id },
      safe: params.safe ?? 0,
    },
    fetcher,
  );
  return { messageId: result.messageId };
}

/**
 * 发送语音消息
 */
export async function sendVoiceMessage(
  accessToken: string,
  params: {
    touser?: string;
    toparty?: string;
    totag?: string;
    agentid: number;
    media_id: string;
    safe?: 0 | 1;
  },
  fetcher?: typeof fetch,
): Promise<{ messageId: string }> {
  const result = await sendMessage(
    accessToken,
    {
      touser: params.touser,
      toparty: params.toparty,
      totag: params.totag,
      msgtype: "voice",
      agentid: params.agentid,
      voice: { media_id: params.media_id },
      safe: params.safe ?? 0,
    },
    fetcher,
  );
  return { messageId: result.messageId };
}

/**
 * 发送视频消息
 */
export async function sendVideoMessage(
  accessToken: string,
  params: {
    touser?: string;
    toparty?: string;
    totag?: string;
    agentid: number;
    media_id: string;
    title?: string;
    description?: string;
    safe?: 0 | 1;
  },
  fetcher?: typeof fetch,
): Promise<{ messageId: string }> {
  const result = await sendMessage(
    accessToken,
    {
      touser: params.touser,
      toparty: params.toparty,
      totag: params.totag,
      msgtype: "video",
      agentid: params.agentid,
      video: {
        media_id: params.media_id,
        title: params.title,
        description: params.description,
      },
      safe: params.safe ?? 0,
    },
    fetcher,
  );
  return { messageId: result.messageId };
}

/**
 * 发送文件消息
 */
export async function sendFileMessage(
  accessToken: string,
  params: {
    touser?: string;
    toparty?: string;
    totag?: string;
    agentid: number;
    media_id: string;
    safe?: 0 | 1;
  },
  fetcher?: typeof fetch,
): Promise<{ messageId: string }> {
  const result = await sendMessage(
    accessToken,
    {
      touser: params.touser,
      toparty: params.toparty,
      totag: params.totag,
      msgtype: "file",
      agentid: params.agentid,
      file: { media_id: params.media_id },
      safe: params.safe ?? 0,
    },
    fetcher,
  );
  return { messageId: result.messageId };
}

/**
 * 发送 Markdown 消息
 */
export async function sendMarkdownMessage(
  accessToken: string,
  params: {
    touser?: string;
    toparty?: string;
    totag?: string;
    agentid: number;
    content: string;
    enable_id_trans?: 0 | 1;
  },
  fetcher?: typeof fetch,
): Promise<{ messageId: string }> {
  const result = await sendMessage(
    accessToken,
    {
      touser: params.touser,
      toparty: params.toparty,
      totag: params.totag,
      msgtype: "markdown",
      agentid: params.agentid,
      markdown: { content: params.content },
      enable_id_trans: params.enable_id_trans ?? 0,
    },
    fetcher,
  );
  return { messageId: result.messageId };
}

/**
 * 发送文本卡片消息
 */
export async function sendTextCardMessage(
  accessToken: string,
  params: {
    touser?: string;
    toparty?: string;
    totag?: string;
    agentid: number;
    title: string;
    description: string;
    url: string;
    btntxt?: string;
  },
  fetcher?: typeof fetch,
): Promise<{ messageId: string }> {
  const result = await sendMessage(
    accessToken,
    {
      touser: params.touser,
      toparty: params.toparty,
      totag: params.totag,
      msgtype: "textcard",
      agentid: params.agentid,
      textcard: {
        title: params.title,
        description: params.description,
        url: params.url,
        btntxt: params.btntxt ?? "详情",
      },
    },
    fetcher,
  );
  return { messageId: result.messageId };
}

/**
 * 发送图文消息
 */
export async function sendNewsMessage(
  accessToken: string,
  params: {
    touser?: string;
    toparty?: string;
    totag?: string;
    agentid: number;
    articles: Array<{
      title: string;
      description: string;
      url: string;
      picurl?: string;
    }>;
  },
  fetcher?: typeof fetch,
): Promise<{ messageId: string }> {
  const result = await sendMessage(
    accessToken,
    {
      touser: params.touser,
      toparty: params.toparty,
      totag: params.totag,
      msgtype: "news",
      agentid: params.agentid,
      news: { articles: params.articles },
    },
    fetcher,
  );
  return { messageId: result.messageId };
}

/**
 * 上传临时素材
 */
export async function uploadMedia(
  accessToken: string,
  type: "image" | "voice" | "video" | "file",
  media: Buffer,
  filename?: string,
  fetcher?: typeof fetch,
): Promise<{ mediaId: string; createdAt: string }> {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${encodeURIComponent(accessToken)}&type=${type}`;

  const formData = new FormData();
  formData.append(
    "media",
    new Blob([new Uint8Array(media)]),
    filename || `media.${type === "image" ? "jpg" : type}`,
  );

  const fetchImpl = fetcher || fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new WeComApiError(-1, `HTTP ${response.status}`);
  }

  const data = (await response.json()) as WeComMediaUploadResponse;

  if (data.errcode !== 0) {
    throw new WeComApiError(data.errcode, data.errmsg);
  }

  return {
    mediaId: data.media_id,
    createdAt: data.created_at,
  };
}

/**
 * 获取媒体文件
 */
export async function getMedia(
  accessToken: string,
  mediaId: string,
  fetcher?: typeof fetch,
): Promise<ArrayBuffer> {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/media/get?access_token=${encodeURIComponent(accessToken)}&media_id=${encodeURIComponent(mediaId)}`;

  const fetchImpl = fetcher || fetch;
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new WeComApiError(-1, `HTTP ${response.status}`);
  }

  return response.arrayBuffer();
}

/**
 * 解析代理 fetch
 */
export function resolveWeComProxyFetch(proxyUrl?: string): typeof fetch | undefined {
  if (!proxyUrl) return undefined;

  // 如果配置了代理，返回带代理的 fetch
  // 注意：需要安装 node-fetch 或 undici 等支持代理的库
  return undefined;
}

// 导出微盘 API
export * as WeDriveApi from "./wedrive.js";

// 导出通讯录 API
export * as ContactsApi from "./contacts.js";
