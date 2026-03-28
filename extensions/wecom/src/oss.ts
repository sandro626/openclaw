/**
 * OSS 存储工具模块
 * 用于将媒体文件上传到阿里云 OSS
 */

import crypto from "node:crypto";

/**
 * OSS 配置
 */
export interface OSSConfig {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  endpoint?: string;
  publicUrlPrefix?: string;
  uploadPath?: string;
}

/**
 * 上传结果
 */
export interface OSSUploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

let ossConfig: OSSConfig | null = null;

/**
 * 设置 OSS 配置
 */
export function setOSSConfig(config: OSSConfig | null): void {
  ossConfig = config;
}

/**
 * 获取 OSS 配置
 */
export function getOSSConfig(): OSSConfig | null {
  return ossConfig;
}

/**
 * 检查 OSS 是否已配置
 */
export function isOSSConfigured(): boolean {
  return ossConfig !== null && !!ossConfig.accessKeyId;
}

/**
 * 上传 Buffer 到 OSS
 */
export async function uploadBufferToOSS(
  buffer: Buffer,
  filename: string,
  contentType?: string,
): Promise<OSSUploadResult | null> {
  if (!ossConfig) {
    return null;
  }

  const key = generateKey(filename);
  const mime = contentType || detectMimeType(filename);
  const endpoint = ossConfig.endpoint || `oss-${ossConfig.region}.aliyuncs.com`;

  try {
    await putObject(key, buffer, mime, endpoint);

    return {
      key,
      url: getPublicUrl(key, endpoint),
      size: buffer.length,
      contentType: mime,
    };
  } catch (err) {
    console.error("[WeCom OSS] Upload failed:", err);
    return null;
  }
}

/**
 * 从 URL 下载并上传到 OSS
 */
export async function uploadUrlToOSS(
  url: string,
  filename?: string,
): Promise<OSSUploadResult | null> {
  if (!ossConfig) {
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || undefined;

    // 推断文件名
    let finalFilename = filename;
    if (!finalFilename) {
      const urlPath = new URL(url).pathname;
      finalFilename = urlPath.split("/").pop() || `file-${Date.now()}`;
    }

    return uploadBufferToOSS(buffer, finalFilename, contentType);
  } catch (err) {
    console.error("[WeCom OSS] Upload from URL failed:", err);
    return null;
  }
}

/**
 * 生成对象 key
 */
function generateKey(filename: string): string {
  const ext = filename.includes(".") ? "." + filename.split(".").pop() : "";
  const baseName = filename.replace(ext, "");
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString("hex");
  const sanitized = sanitizeFilename(baseName);

  const prefix = ossConfig?.uploadPath ? ossConfig.uploadPath.replace(/\/$/, "") : "wecom";
  return `${prefix}/${timestamp}-${random}/${sanitized}${ext}`;
}

/**
 * 获取公开访问 URL
 */
function getPublicUrl(key: string, endpoint: string): string {
  if (ossConfig?.publicUrlPrefix) {
    const prefix = ossConfig.publicUrlPrefix.replace(/\/$/, "");
    return `${prefix}/${key}`;
  }
  return `https://${ossConfig!.bucket}.${endpoint}/${key}`;
}

/**
 * PUT 对象到 OSS
 */
async function putObject(
  key: string,
  buffer: Buffer,
  contentType: string,
  endpoint: string,
): Promise<void> {
  if (!ossConfig) {
    throw new Error("OSS not configured");
  }

  const date = new Date().toUTCString();
  const resource = `/${ossConfig.bucket}/${key}`;

  // 构建签名字符串
  const stringToSign = [
    "PUT",
    "",
    contentType,
    date,
    `x-oss-object-acl:public-read`,
    resource,
  ].join("\n");

  // 计算签名
  const signature = crypto
    .createHmac("sha1", ossConfig.accessKeySecret)
    .update(stringToSign)
    .digest("base64");

  const authorization = `OSS ${ossConfig.accessKeyId}:${signature}`;
  const url = `https://${ossConfig.bucket}.${endpoint}/${key}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      Date: date,
      "Content-Type": contentType,
      "x-oss-object-acl": "public-read",
      "Content-Length": String(buffer.length),
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OSS upload failed: ${response.status} ${errorText}`);
  }
}

/**
 * 清理文件名
 */
function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[^\p{L}\p{N}._-]+/gu, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 100) || "file"
  );
}

/**
 * 检测 MIME 类型
 */
function detectMimeType(filename: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : "";
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    txt: "text/plain",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}
