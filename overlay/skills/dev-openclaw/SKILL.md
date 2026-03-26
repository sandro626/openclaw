---
name: dev-openclaw
description: "OpenClaw 本地开发到服务器部署技能。用于： (1) 同步本地代码到服务器 (2) 管理服务器 Gateway (3) 修改配置 Schema (4) 排查部署问题。包含 dist/extensions 同步规则、rsync 注意事项、Gateway 管理命令。"
metadata: { "openclaw": { "emoji": "🚀", "requires": { "anyBins": ["rsync", "ssh"] } } }
---

# OpenClaw 本地开发部署

将本地开发的 OpenClaw 代码部署到服务器的完整流程。

## 服务器信息

| 配置项       | 值                                |
| ------------ | --------------------------------- |
| 生产服务器   | `ssh root@8.155.165.162`          |
| Gateway 日志 | `/tmp/openclaw-gateway.log`       |
| Gateway 端口 | `18789`                           |
| npm 安装路径 | `/usr/lib/node_modules/openclaw/` |
| 配置文件     | `/root/.openclaw/openclaw.json`   |

---

## ⚠️ 关键注意事项

### 1. dist 和 extensions 必须同时同步

- **dist/** - 核心代码（配置 schema、工具实现、CLI 逻辑）
- **extensions/** - 插件和频道扩展（wecom、feishu 等）

**只同步 dist 会导致插件找不到，配置验证失败！**

### 2. npm install 会覆盖 dist

运行 `npm i -g openclaw@latest` 会覆盖 `dist/`，但**不会覆盖** `extensions/`。

执行 npm install 后，必须重新同步本地 dist。

### 3. 禁止使用 rsync --delete

```bash
# ❌ 错误 - 会删除服务器上的其他文件
rsync -av --delete dist/ server:/path/

# ✅ 正确 - 只更新，不删除
rsync -av --no-i-r dist/ server:/path/
```

### 4. 保护服务器数据

**禁止删除**以下目录：

- `/root/.openclaw/agents/{agent_id}/sessions/` - 会话数据
- `/root/.openclaw/agents/{agent_id}/memory/` - 记忆数据
- `/root/.openclaw/agents/{agent_id}/workspace/` - 工作空间

---

## 完整部署流程

### 步骤 1: 本地构建

```bash
pnpm build
```

### 步骤 2: 同步 dist（核心代码）

```bash
rsync -av --no-i-r /home/zhongle/dev/openclaw-main/dist/ root@8.155.165.162:/usr/lib/node_modules/openclaw/dist/
```

### 步骤 3: 同步 extensions（插件/频道）

```bash
rsync -av --no-i-r /home/zhongle/dev/openclaw-main/extensions/ root@8.155.165.162:/usr/lib/node_modules/openclaw/extensions/
```

### 步骤 4: 重启 Gateway

```bash
ssh root@8.155.165.162 "pkill -9 -f 'openclaw.*gateway' 2>/dev/null; sleep 2; nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &"
```

### 步骤 5: 验证部署

```bash
# 检查进程
ssh root@8.155.165.162 "ps aux | grep openclaw-gateway | grep -v grep"

# 检查日志
ssh root@8.155.165.162 "tail -30 /tmp/openclaw-gateway.log"

# 运行 doctor
ssh root@8.155.165.162 "openclaw doctor"
```

---

## 快速命令参考

### 一键部署脚本

```bash
# 完整部署
pnpm build && \
rsync -av --no-i-r dist/ root@8.155.165.162:/usr/lib/node_modules/openclaw/dist/ && \
rsync -av --no-i-r extensions/ root@8.155.165.162:/usr/lib/node_modules/openclaw/extensions/ && \
ssh root@8.155.165.162 "pkill -9 -f 'openclaw.*gateway' 2>/dev/null; sleep 2; nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &"
```

### 仅更新核心代码

```bash
pnpm build
rsync -av --no-i-r dist/ root@8.155.165.162:/usr/lib/node_modules/openclaw/dist/
# 重启 Gateway...
```

### 仅更新扩展

```bash
rsync -av --no-i-r extensions/ root@8.155.165.162:/usr/lib/node_modules/openclaw/extensions/
# 重启 Gateway...
```

---

## Gateway 管理

### 启动

```bash
ssh root@8.155.165.162 "nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &"
```

### 停止

```bash
ssh root@8.155.165.162 "pkill -9 -f 'openclaw.*gateway'"
```

### 查看日志

```bash
ssh root@8.155.165.162 "tail -100 /tmp/openclaw-gateway.log"
# 或实时查看
ssh root@8.155.165.162 "tail -f /tmp/openclaw-gateway.log"
```

### 检查状态

```bash
ssh root@8.155.165.162 "ps aux | grep openclaw-gateway | grep -v grep"
ssh root@8.155.165.162 "ss -tlnp | grep 18789"
```

---

## 配置 Schema 修改

添加新配置项（如新搜索提供商、新频道配置）需要更新以下文件：

### 1. Zod Schema（主要）

文件: `src/config/zod-schema.agent-runtime.ts`

```typescript
// 示例：添加新搜索提供商
export const ToolsWebSearchSchema = z
  .object({
    provider: z
      .union([
        z.literal("brave"),
        z.literal("perplexity"),
        z.literal("grok"),
        z.literal("gemini"),
        z.literal("kimi"),
        z.literal("tavily"), // 新增
        z.literal("baidu"), // 新增
      ])
      .optional(),
    // 添加提供商特定配置
    tavily: z
      .object({
        apiKey: z.string().optional().register(sensitive),
        searchDepth: z.enum(["basic", "advanced"]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
```

### 2. 类型定义

文件: `src/config/types.tools.ts`

```typescript
provider?: "brave" | "perplexity" | "grok" | "gemini" | "kimi" | "tavily" | "baidu";
```

### 3. 帮助文本

文件: `src/config/schema.help.ts`

```typescript
"tools.web.search.tavily.apiKey": "Tavily API key (fallback: TAVILY_API_KEY env var).",
```

### 4. 标签

文件: `src/config/schema.labels.ts`

```typescript
"tools.web.search.tavily.apiKey": "Tavily Search API Key",
```

---

## 常见问题排查

### "unknown channel id: xxx"

**原因**: 本地 dist 同步后，extensions 目录未同步，导致频道未注册。

**解决**:

```bash
rsync -av --no-i-r extensions/ root@8.155.165.162:/usr/lib/node_modules/openclaw/extensions/
```

### "Invalid input (allowed: ...)"

**原因**: 配置 schema 未包含新添加的枚举值。

**解决**:

1. 更新 `src/config/zod-schema.agent-runtime.ts`
2. 重新构建: `pnpm build`
3. 同步 dist

### "Unrecognized keys: xxx"

**原因**: 配置 schema 中未定义该配置项的结构。

**解决**: 在 schema 中添加对应的配置对象定义。

### Gateway 无法启动

**排查步骤**:

1. 检查日志: `tail -100 /tmp/openclaw-gateway.log`
2. 运行 doctor: `openclaw doctor`
3. 检查端口占用: `ss -tlnp | grep 18789`
4. 验证配置: `openclaw config get tools.web.search`

---

## 回滚

如果部署出现问题，恢复 npm 版本：

```bash
ssh root@8.155.165.162 "sudo npm i -g openclaw@latest"

# 重新同步 extensions
rsync -av --no-i-r extensions/ root@8.155.165.162:/usr/lib/node_modules/openclaw/extensions/

# 重启 Gateway
ssh root@8.155.165.162 "pkill -9 -f 'openclaw.*gateway' 2>/dev/null; sleep 2; nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &"
```

---

## 相关文档

- [部署保护规则](/docs/operations/DEPLOY-protection.md)
- [Agent Memory](~/.claude/projects/-home-zhongle-dev-openclaw-main/memory/MEMORY.md)
