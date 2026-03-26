# 安装 WeCom 插件

## 方式一: 本地插件 (推荐)

插件已包含在 Clawdbot 主目录中，只需启用即可。

### 1. 启用插件

```bash
clawdbot plugins enable wecom
```

### 2. 配置企业微信

```bash
clawdbot config set channels.wecom.corpId "ww1234567890abcdef"
clawdbot config set channels.wecom.agentId 1000002
clawdbot config set channels.wecom.agentSecret "your_agent_secret"
clawdbot config set channels.wecom.token "your_token"
clawdbot config set channels.wecom.encodingAESKey "your_aes_key"
clawdbot config set channels.wecom.webhookUrl "https://your-domain.com/wecom/webhook"
clawdbot config set channels.wecom.webhookPath "/wecom/webhook"
```

### 3. 配置访问控制

```bash
# 设置白名单
clawdbot config set channels.wecom.dmPolicy "allowlist"
clawdbot config set channels.wecom.allowFrom '["zhangsan", "lisi"]'
```

### 4. 重启 Gateway

```bash
clawdbot gateway restart
```

---

## 方式二: 手动配置

编辑 `~/.clawdbot/clawdbot.json`:

```json5
{
  plugins: {
    enabled: true,
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
      agentSecret: "your_agent_secret",
      token: "your_token",
      encodingAESKey: "your_aes_key",
      webhookUrl: "https://your-domain.com/wecom/webhook",
      webhookPath: "/wecom/webhook",
      dmPolicy: "allowlist",
      allowFrom: ["zhangsan", "lisi"],
    },
  },
}
```

---

## 企业微信后台配置

### 1. 创建应用

1. 登录 https://work.weixin.qq.com/
2. 进入 **应用管理** → **应用** → **创建应用**
3. 填写应用信息，上传 logo

### 2. 获取凭证

在应用详情页找到:

- **企业ID**: corpId
- **AgentId**: agentId
- **Secret**: agentSecret

### 3. 设置接收消息

1. 进入应用 → **接收消息**
2. 启用 **API 接收**
3. 配置以下参数:

| 参数           | 值                                      |
| -------------- | --------------------------------------- |
| URL            | `https://your-domain.com/wecom/webhook` |
| Token          | 自定义字符串 (如 `wecom_token_2024`)    |
| EncodingAESKey | 随机生成 (43 位字符)                    |

4. 保存配置

---

## Webhook 配置要求

### 公网访问

企业微信需要能访问你的服务器:

1. **公网 IP** 或 **域名**
2. **HTTPS** 证书 (企业微信要求)
3. **端口** 通常 443 (HTTPS)

### 内网部署

如果服务器在内网，可以使用:

- **ngrok** (临时测试)
- **frp** (内网穿透)
- **企业微信代理**

示例 (ngrok):

```bash
ngrok http 18789
# 使用生成的 HTTPS URL 配置企业微信
```

---

## 验证安装

### 1. 检查插件状态

```bash
clawdbot plugins list
```

应看到 `wecom` 插件已启用。

### 2. 检查渠道状态

```bash
clawdbot channels status
```

应显示 WeCom 渠道配置正确。

### 3. 测试消息

在企业微信中向应用发送消息 "ping"，应收到回复。

---

## 故障排除

### 插件未加载

```bash
# 检查插件目录
ls -la ~/.clawdbot/extensions/wecom/

# 检查插件日志
clawdbot logs --follow | grep wecom
```

### Webhook 验证失败

1. 检查 URL 是否可访问: `curl https://your-domain.com/wecom/webhook`
2. 验证 Token 和 AES Key 配置一致
3. 检查服务器时间: `date` (误差需 < 5 分钟)

### 消息发送失败

1. 检查 Access Token: 查看 Gateway 日志
2. 验证 corpId、agentId、agentSecret 正确
3. 确认应用未禁用

### 签名验证错误

```bash
# 重新生成并同步配置
clawdbot config set channels.wecom.token "new_token"
# 同时在企业微信后台更新
```

---

## 卸载插件

```bash
clawdbot plugins disable wecom
clawdbot config unset channels.wecom
```
