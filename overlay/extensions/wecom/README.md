# WeCom (企业微信) Plugin for Clawdbot

企业微信 (WeCom) 应用消息推送集成插件，将 Clawdbot 接入企业微信工作台。

## 功能特性

- ✅ 文本消息收发
- ✅ Markdown 格式支持
- ✅ 直接消息 (DM)
- ✅ 群组消息
- ✅ 配对模式 (pairing) 用于授权用户
- ✅ 白名单访问控制
- ✅ Webhook 回调验证
- ✅ 消息加密/解密
- 🚧 媒体文件上传 (开发中)

## 快速开始

### 1. 创建企业微信应用

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/)
2. 进入 **应用管理** → **应用** → **自建应用**
3. 创建应用，获取:
   - `企业ID` (corpId)
   - `应用ID` (agentId)
   - `应用Secret` (agentSecret)

### 2. 配置接收消息

1. 在应用设置中，找到 **接收消息** 设置
2. 设置 **Token** (自定义字符串，如: `wecom_token_2024`)
3. 设置 **EncodingAESKey** (随机生成 43 位字符)
4. 设置 **接收消息 URL**:
   ```
   https://your-gateway-domain.com/wecom/webhook
   ```

### 3. 配置 Clawdbot

```json5
{
  plugins: {
    entries: {
      wecom: {
        enabled: true,
      },
    },
  },
  channels: {
    wecom: {
      corpId: "ww1234567890abcdef",
      agentId: 1000002,
      agentSecret: "your_agent_secret_here",
      token: "wecom_token_2024",
      encodingAESKey: "your_encoding_aes_key_here_43_chars",
      webhookUrl: "https://your-gateway-domain.com/wecom/webhook",
      webhookPath: "/wecom/webhook",
      dmPolicy: "allowlist",
      allowFrom: ["zhangsan", "lisi"],
      groupPolicy: "allowlist",
      groupAllowFrom: ["chat_id_1", "chat_id_2"],
    },
  },
}
```

### 4. 启动 Gateway

```bash
clawdbot gateway
```

## 配置说明

| 参数             | 类型     | 必填 | 说明                                                  |
| ---------------- | -------- | ---- | ----------------------------------------------------- |
| `corpId`         | string   | ✅   | 企业 ID                                               |
| `agentId`        | number   | ✅   | 应用 ID                                               |
| `agentSecret`    | string   | ✅   | 应用 Secret                                           |
| `token`          | string   | ✅   | 回调验证 Token                                        |
| `encodingAESKey` | string   | ✅   | 消息加密 Key                                          |
| `webhookUrl`     | string   | ✅   | 完整的 Webhook URL                                    |
| `webhookPath`    | string   | ✅   | Webhook 路径                                          |
| `dmPolicy`       | string   | ❌   | 直接消息策略: `pairing`/`allowlist`/`open`/`disabled` |
| `allowFrom`      | string[] | ❌   | 允许的用户 ID 白名单                                  |
| `groupPolicy`    | string   | ❌   | 群组策略: `open`/`disabled`/`allowlist`               |
| `groupAllowFrom` | string[] | ❌   | 允许的群组 ID 白名单                                  |
| `textChunkLimit` | number   | ❌   | 文本分块限制 (默认 2048)                              |

## 用户 ID 格式

企业微信使用以下标识符:

| 类型    | 格式      | 示例                  |
| ------- | --------- | --------------------- |
| 成员 ID | `userid`  | `zhangsan`            |
| 群组 ID | `chat_id` | `wrOgQhDgAAYQiP2B...` |

在企业微信管理后台 → **通讯录** 可以查看成员 ID。

## 访问控制策略

### 直接消息 (DM) 策略

```json5
// 配对模式 (默认)
dmPolicy: "pairing"
// 未知用户收到配对代码，需批准

// 白名单模式
dmPolicy: "allowlist"
allowFrom: ["zhangsan", "lisi"]

// 开放模式 (谨慎使用)
dmPolicy: "open"
// 任何用户都可以发送消息

// 禁用
dmPolicy: "disabled"
// 不处理直接消息
```

### 群组策略

```json5
// 白名单模式 (默认)
groupPolicy: "allowlist"
groupAllowFrom: ["chat_id_1", "chat_id_2"]

// 开放模式
groupPolicy: "open"
// 任何群组都可以触发
```

## 配对模式

当 `dmPolicy: "pairing"` 时，未知用户会收到配对代码:

```
您的 WeCom 用户 ID: zhangsan
配对代码: ABC123
请使用以下命令批准:
clawdbot pairing approve wecom ABC123
```

批准后用户可以正常使用。

## 多账户支持

可以配置多个企业微信应用:

```json5
{
  channels: {
    wecom: {
      accounts: {
        main: {
          corpId: "ww1234567890abcdef",
          agentId: 1000002,
          agentSecret: "secret1",
          // ...
        },
        support: {
          corpId: "ww0987654321fedcba",
          agentId: 1000003,
          agentSecret: "secret2",
          // ...
        },
      },
    },
  },
}
```

## API 限制

| 项目         | 限制                     |
| ------------ | ------------------------ |
| 文本消息长度 | 2048 字符                |
| 文件大小     | 20 MB                    |
| 调用频率     | 有限制，参考企业微信文档 |

## 安全建议

1. **使用 HTTPS**: Webhook URL 必须使用 HTTPS
2. **验证签名**: 插件会自动验证消息签名
3. **消息加密**: 企业微信强制使用 AES 加密
4. **白名单**: 建议使用白名单限制访问
5. **定期更新**: 定期更新 agentSecret

## 故障排除

### 消息未接收

1. 检查 Gateway 日志: `clawdbot logs --follow`
2. 验证 Webhook URL 可访问性
3. 确认 token 和 encodingAESKey 正确
4. 检查企业微信应用是否启用

### 签名验证失败

1. 确认 token 与企业微信后台一致
2. 检查服务器时间是否准确
3. 验证 encodingAESKey 是否正确

### Access Token 错误

1. 验证 corpId 和 agentSecret 正确
2. 检查应用是否被禁用
3. 确认 API 调用频率未超限

## 相关链接

- [企业微信 API 文档](https://developer.work.weixin.qq.com/document/path/90665)
- [消息推送](https://developer.work.weixin.qq.com/document/path/90668)
- [应用管理](https://work.weixin.qq.com/)
- [Clawdbot 插件文档](/plugins)

## 许可证

MIT
