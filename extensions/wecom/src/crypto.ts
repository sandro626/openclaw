/**
 * WeCom 加密解密工具
 * 企业微信消息加密/解密实现
 *
 * 文档: https://developer.work.weixin.qq.com/document/path/90668
 */

import crypto from "node:crypto";

const WECOM_TOKEN = "wecom";
const WECOM_AES_KEY = Buffer.from("0123456789abcdefghijkmnopqrstuvwxyz1234567890abc", "utf8");
const WECOM_CORP_ID = "ww1234567890abcdef";

/**
 * 企业微信消息加解密类
 */
export class WeComCrypto {
  private token: string;
  private encodingAESKey: Buffer;
  private corpId: string;

  constructor(token: string, encodingAESKey: string, corpId: string) {
    this.token = token;
    // encodingAESKey 需要补齐 base64
    const key = encodingAESKey + "=";
    this.encodingAESKey = Buffer.from(key, "base64");
    this.corpId = corpId;
  }

  /**
   * 验证签名
   */
  verifySignature(msgSignature: string, timestamp: string, nonce: string, data: string): boolean {
    const signature = this.sha1Sort(this.token, timestamp, nonce, data);
    return signature === msgSignature;
  }

  /**
   * 解密消息 - 返回解析后的字段
   */
  decrypt(encryptedMsg: string): { message: string; appId: string } {
    const encrypted = Buffer.from(encryptedMsg, "base64");

    // AES-256-CBC 解密
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      this.encodingAESKey,
      this.encodingAESKey.slice(0, 16),
    );
    decipher.setAutoPadding(false);

    let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // 去除 PKCS7 填充
    const pad = decrypted[decrypted.length - 1];
    decrypted = decrypted.subarray(0, decrypted.length - pad);

    // 解析格式: random(16) + msg_len(4) + msg + appId
    const msgLen = decrypted.readUInt32BE(0);
    const message = decrypted.subarray(4, 4 + msgLen).toString("utf8");
    const appId = decrypted.subarray(4 + msgLen).toString("utf8");

    return { message, appId };
  }

  /**
   * 解密 echostr 并按文档逻辑返回（用于 URL 验证）
   * 文档：content = rand_msg[16:], msg = content[4:msg_len+4]
   */
  decryptEchoStr(encryptedMsg: string): string {
    const encrypted = Buffer.from(encryptedMsg, "base64");

    // AES-256-CBC 解密
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      this.encodingAESKey,
      this.encodingAESKey.slice(0, 16),
    );
    decipher.setAutoPadding(false);

    let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // 去除 PKCS7 填充
    const pad = decrypted[decrypted.length - 1];
    decrypted = decrypted.subarray(0, decrypted.length - pad);

    // 按文档逻辑：去掉前16字节random
    const content = decrypted.subarray(16);

    // 读取4字节 msg_len（网络字节序/大端序）
    const msgLen = content.readUInt32BE(0);

    // 截取 msg_len 长度的 msg
    const msg = content.subarray(4, 4 + msgLen).toString("utf8");

    return msg;
  }

  /**
   * 加密消息
   */
  encrypt(message: string): string {
    const content = Buffer.from(message);
    const msgLen = Buffer.alloc(4);
    msgLen.writeUInt32BE(content.length, 0);
    const appId = Buffer.from(this.corpId);

    const plain = Buffer.concat([msgLen, content, appId]);

    // PKCS7 填充
    const blockSize = 32;
    const padLen = blockSize - (plain.length % blockSize);
    const pad = Buffer.alloc(padLen, padLen);
    const padded = Buffer.concat([plain, pad]);

    // AES-256-CBC 加密
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      this.encodingAESKey,
      this.encodingAESKey.slice(0, 16),
    );
    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);

    return encrypted.toString("base64");
  }

  /**
   * 生成签名
   */
  private sha1Sort(...args: string[]): string {
    const sorted = args.sort().join("");
    return crypto.createHash("sha1").update(sorted).digest("hex");
  }
}

/**
 * 创建加密实例
 */
export function createWeComCrypto(
  token?: string,
  encodingAESKey?: string,
  corpId?: string,
): WeComCrypto {
  return new WeComCrypto(
    token || WECOM_TOKEN,
    encodingAESKey || WECOM_AES_KEY.toString(),
    corpId || WECOM_CORP_ID,
  );
}

/**
 * 生成随机字符串
 */
export function randomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
