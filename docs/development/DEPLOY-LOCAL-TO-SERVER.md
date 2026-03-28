# 本地开发部署到服务器

将本地开发的 OpenClaw 代码部署到服务器的流程和注意事项。

## 推荐流程：按 core / overlay / runtime 装配

优先使用新的装配式部署，而不是把业务扩展重新同步回 core 目录。

### 1. 本地构建 core

```bash
pnpm build
```

### 2. 生成 overlay-aware 部署 bundle

```bash
pnpm ops:assemble -- --output-root .artifacts/ops/prod --environment prod
```

这一步会：

- 复制 `overlay/extensions/`
- 复制 `overlay/skills/`
- 渲染 `runtime-templates/config/*`
- 生成可直接发布的 `rendered-config/openclaw.json`

### 3. 发布程序与 overlay

推荐发布对象：

- core 程序目录
- `.artifacts/ops/prod/overlay/`
- `.artifacts/ops/prod/rendered-config/openclaw.json`

不推荐再把业务扩展直接覆盖到 core 的 `extensions/` 下。

### 4. 补种 workspace 静态骨架

```bash
ssh user@gateway-host 'cd /srv/openclaw && pnpm ops:seed-workspaces -- --workspace-root ~/.openclaw/workspace'
```

这一步只补种静态文件，不会覆盖 `memory/`、sessions 或其他运行态输出。

### 5. 重启并验证

```bash
ssh user@gateway-host "pkill -9 -f 'openclaw.*gateway' 2>/dev/null; sleep 2; nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &"
ssh user@gateway-host "tail -30 /tmp/openclaw-gateway.log"
```

更完整的分层说明见 `/operations/deployment-assembly`。

## 服务器信息

- **网关主机**: `ssh user@gateway-host`
- **Gateway 日志**: `/tmp/openclaw-gateway.log`
- **Gateway 端口**: `18789`
- **npm 安装路径**: `/usr/lib/node_modules/openclaw/`
- **配置文件**: `${OPENCLAW_CONFIG_PATH:-~/.openclaw/openclaw.json}`

## 旧流程：直接同步 core 目录

以下方式仅适合临时调试或过渡期，不再是首选。

### 完整部署（推荐）

```bash
# 1. 本地构建
pnpm build

# 2. 同步 dist（核心代码）
rsync -av --no-i-r dist/ user@gateway-host:/usr/lib/node_modules/openclaw/dist/

# 3. 同步 extensions（插件/频道扩展）
rsync -av --no-i-r extensions/ user@gateway-host:/usr/lib/node_modules/openclaw/extensions/

# 4. 重启 Gateway
ssh user@gateway-host "pkill -9 -f 'openclaw.*gateway' 2>/dev/null; sleep 2; nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &"

# 5. 验证
ssh user@gateway-host "ps aux | grep openclaw-gateway | grep -v grep"
ssh user@gateway-host "tail -30 /tmp/openclaw-gateway.log"
```

### 仅更新核心代码

如果只修改了 `src/` 下的代码（不含扩展）：

```bash
pnpm build
rsync -av --no-i-r dist/ user@gateway-host:/usr/lib/node_modules/openclaw/dist/
# 重启 Gateway...
```

### 仅更新扩展

如果只修改了 `extensions/` 下的代码：

```bash
rsync -av --no-i-r extensions/ user@gateway-host:/usr/lib/node_modules/openclaw/extensions/
# 重启 Gateway...
```

## 关键注意事项

### ⚠️ npm install 会覆盖 dist

运行 `npm i -g openclaw@latest` 会覆盖 `/usr/lib/node_modules/openclaw/dist/`，但**不会覆盖** `extensions/`。

如果执行了 npm install，需要重新同步本地 dist。

### ⚠️ dist 和 extensions 需要同时同步

- **dist/** - 核心代码，包含配置 schema、工具实现等
- **extensions/** - 插件和频道扩展（如 wecom、feishu）

如果只同步 dist，可能会导致插件找不到或配置验证失败。

### ⚠️ 不要使用 rsync --delete

**禁止**使用 `--delete` 参数，这会删除服务器上的文件，可能影响现有配置。

```bash
# ❌ 错误 - 会删除服务器上的其他文件
rsync -av --delete dist/ server:/path/

# ✅ 正确 - 只更新，不删除
rsync -av --no-i-r dist/ server:/path/
```

## 配置 Schema 修改

如果添加了新的配置项（如新的搜索提供商、新的频道配置），需要更新 Zod schema：

### Web 搜索配置

文件: `src/config/zod-schema.agent-runtime.ts`

```typescript
// 添加新的搜索提供商
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
        // ...
      })
      .strict()
      .optional(),
    baidu: z
      .object({
        apiKey: z.string().optional().register(sensitive),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
```

### 类型定义

文件: `src/config/types.tools.ts`

```typescript
// 同步更新类型定义
provider?: "brave" | "perplexity" | "grok" | "gemini" | "kimi" | "tavily" | "baidu";
```

### 帮助文本和标签

- `src/config/schema.help.ts` - 配置项帮助文本
- `src/config/schema.labels.ts` - 配置项标签

## Gateway 管理

### 启动 Gateway

```bash
ssh user@gateway-host "nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &"
```

### 停止 Gateway

```bash
ssh user@gateway-host "pkill -9 -f 'openclaw.*gateway'"
```

### 查看日志

```bash
ssh user@gateway-host "tail -100 /tmp/openclaw-gateway.log"
```

### 检查状态

```bash
ssh user@gateway-host "ps aux | grep openclaw-gateway | grep -v grep"
ssh user@gateway-host "ss -tlnp | grep 18789"
```

## 验证部署

### 检查配置

```bash
ssh user@gateway-host "openclaw doctor"
```

### 检查特定配置项

```bash
ssh user@gateway-host "openclaw config get tools.web.search"
```

### 检查插件/频道

```bash
ssh user@gateway-host "ls /usr/lib/node_modules/openclaw/extensions/"
```

## 常见问题

### 问题: "unknown channel id: xxx"

**原因**: 本地 dist 同步后，extensions 目录中的插件未同步，导致频道未注册。

**解决**: 同步 extensions 目录：

```bash
rsync -av --no-i-r extensions/ user@gateway-host:/usr/lib/node_modules/openclaw/extensions/
```

### 问题: "Invalid input (allowed: ...)"

**原因**: 配置 schema 未包含新添加的选项。

**解决**:

1. 更新 `src/config/zod-schema.agent-runtime.ts`
2. 重新构建: `pnpm build`
3. 同步 dist

### 问题: "Unrecognized keys: xxx"

**原因**: 配置 schema 中未定义该配置项的结构。

**解决**: 在 schema 中添加对应的配置对象定义。

## 回滚

如果部署出现问题，可以恢复 npm 版本：

```bash
ssh user@gateway-host "sudo npm i -g openclaw@latest"
# 然后重新同步 extensions
rsync -av --no-i-r extensions/ user@gateway-host:/usr/lib/node_modules/openclaw/extensions/
```

## 相关文档

- [部署装配流程](/operations/deployment-assembly)
- [部署保护规则](/operations/deploy-protection)
