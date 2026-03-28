---
name: dev-openclaw
description: "OpenClaw 本地开发到服务器部署技能。用于： (1) 同步本地代码到服务器 (2) 管理服务器 Gateway (3) 修改配置 Schema (4) 排查部署问题。包含 dist/extensions 同步规则、rsync 注意事项、Gateway 管理命令。"
metadata: { "openclaw": { "emoji": "🚀", "requires": { "anyBins": ["rsync", "ssh"] } } }
---

# OpenClaw 本地开发部署

将本地开发的 OpenClaw 代码部署到服务器的完整流程。

## 部署变量

建议先约定以下变量，再执行部署命令：

| 配置项         | 示例                                                          |
| -------------- | ------------------------------------------------------------- |
| 部署主机       | `export OPENCLAW_DEPLOY_HOST=user@gateway-host`               |
| 安装根目录     | `export OPENCLAW_INSTALL_ROOT=/usr/lib/node_modules/openclaw` |
| runtime 根目录 | `export OPENCLAW_HOME=$HOME/.openclaw`                        |
| Gateway 日志   | `export OPENCLAW_GATEWAY_LOG=/tmp/openclaw-gateway.log`       |
| Gateway 端口   | `export OPENCLAW_GATEWAY_PORT=18789`                          |
| 装配输出目录   | `export OPENCLAW_BUNDLE_ROOT=.artifacts/ops/prod`             |

---

## ⚠️ 关键注意事项

### 1. 现在要同步的是 core 和 overlay bundle，不是只推源码目录

- **core build** - `dist/` 等构建产物
- **overlay bundle** - `pnpm ops:assemble` 生成的 overlay、rendered-config、manifest

只同步 `dist/` 或只同步 `overlay/` 都会导致运行态不完整。

### 2. 不要再把业务扩展手工塞回 core

`overlay/extensions/*`、`overlay/skills/*` 应通过 bundle 装配和配置加载，不要再手工复制回 core 源目录。

### 3. 禁止使用 rsync --delete

同以前一样，发布时不要用 `--delete` 去碰 runtime 根。

### 4. 保护服务器数据

**禁止删除**以下目录：

- `${OPENCLAW_HOME}/agents/<agentId>/sessions/` - 会话数据
- `${OPENCLAW_HOME}/agents/<agentId>/memory/` - 记忆数据
- `${OPENCLAW_HOME}/workspace/<agentId>/` - 工作空间
- `${OPENCLAW_HOME}/openclaw.json` - 真实运行配置

---

## 完整部署流程

### 步骤 1: 本地构建

```bash
pnpm build
```

### 步骤 2: 生成 overlay-aware bundle

```bash
pnpm ops:assemble -- --output-root "$OPENCLAW_BUNDLE_ROOT" --environment prod --allow-unresolved-env
```

### 步骤 3: 发布 core 构建产物

```bash
rsync -av --no-i-r dist/ "$OPENCLAW_DEPLOY_HOST:$OPENCLAW_INSTALL_ROOT/dist/"
```

### 步骤 4: 发布 overlay bundle

```bash
rsync -av --no-i-r "$OPENCLAW_BUNDLE_ROOT"/ "$OPENCLAW_DEPLOY_HOST:$OPENCLAW_INSTALL_ROOT/.ops-bundle/"
```

### 步骤 5: 下发渲染后的配置并补种静态 workspace

```bash
ssh "$OPENCLAW_DEPLOY_HOST" "install -d \"$OPENCLAW_HOME\" \"$OPENCLAW_HOME/workspace\""
ssh "$OPENCLAW_DEPLOY_HOST" "cp \"$OPENCLAW_INSTALL_ROOT/.ops-bundle/rendered-config/openclaw.json\" \"$OPENCLAW_HOME/openclaw.json\""
ssh "$OPENCLAW_DEPLOY_HOST" "cd \"$OPENCLAW_INSTALL_ROOT\" && pnpm ops:seed-workspaces -- --workspace-root \"$OPENCLAW_HOME/workspace\""
```

### 步骤 6: 重启 Gateway

```bash
ssh "$OPENCLAW_DEPLOY_HOST" "pkill -9 -f 'openclaw.*gateway' 2>/dev/null || true; sleep 2; nohup openclaw gateway run --bind loopback --port ${OPENCLAW_GATEWAY_PORT:-18789} --force > ${OPENCLAW_GATEWAY_LOG:-/tmp/openclaw-gateway.log} 2>&1 &"
```

### 步骤 7: 验证部署

```bash
ssh "$OPENCLAW_DEPLOY_HOST" "ps aux | grep openclaw-gateway | grep -v grep"
ssh "$OPENCLAW_DEPLOY_HOST" "tail -30 ${OPENCLAW_GATEWAY_LOG:-/tmp/openclaw-gateway.log}"
ssh "$OPENCLAW_DEPLOY_HOST" "openclaw doctor"
```

## 快速命令参考

### 一键部署脚本

```bash
pnpm build && \
pnpm ops:assemble -- --output-root "$OPENCLAW_BUNDLE_ROOT" --environment prod --allow-unresolved-env && \
rsync -av --no-i-r dist/ "$OPENCLAW_DEPLOY_HOST:$OPENCLAW_INSTALL_ROOT/dist/" && \
rsync -av --no-i-r "$OPENCLAW_BUNDLE_ROOT"/ "$OPENCLAW_DEPLOY_HOST:$OPENCLAW_INSTALL_ROOT/.ops-bundle/" && \
ssh "$OPENCLAW_DEPLOY_HOST" "cp \"$OPENCLAW_INSTALL_ROOT/.ops-bundle/rendered-config/openclaw.json\" \"$OPENCLAW_HOME/openclaw.json\"" && \
ssh "$OPENCLAW_DEPLOY_HOST" "pkill -9 -f 'openclaw.*gateway' 2>/dev/null || true; sleep 2; nohup openclaw gateway run --bind loopback --port ${OPENCLAW_GATEWAY_PORT:-18789} --force > ${OPENCLAW_GATEWAY_LOG:-/tmp/openclaw-gateway.log} 2>&1 &"
```

### 仅更新核心代码

```bash
pnpm build
rsync -av --no-i-r dist/ "$OPENCLAW_DEPLOY_HOST:$OPENCLAW_INSTALL_ROOT/dist/"
# 重启 Gateway...
```

### 仅更新 overlay bundle

```bash
pnpm ops:assemble -- --output-root "$OPENCLAW_BUNDLE_ROOT" --environment prod --allow-unresolved-env
rsync -av --no-i-r "$OPENCLAW_BUNDLE_ROOT"/ "$OPENCLAW_DEPLOY_HOST:$OPENCLAW_INSTALL_ROOT/.ops-bundle/"
# 重启 Gateway...
```

---

## Gateway 管理

### 启动

```bash
ssh "$OPENCLAW_DEPLOY_HOST" "nohup openclaw gateway run --bind loopback --port ${OPENCLAW_GATEWAY_PORT:-18789} --force > ${OPENCLAW_GATEWAY_LOG:-/tmp/openclaw-gateway.log} 2>&1 &"
```

### 停止

```bash
ssh "$OPENCLAW_DEPLOY_HOST" "pkill -9 -f 'openclaw.*gateway'"
```

### 查看日志

```bash
ssh "$OPENCLAW_DEPLOY_HOST" "tail -100 ${OPENCLAW_GATEWAY_LOG:-/tmp/openclaw-gateway.log}"
# 或实时查看
ssh "$OPENCLAW_DEPLOY_HOST" "tail -f ${OPENCLAW_GATEWAY_LOG:-/tmp/openclaw-gateway.log}"
```

### 检查状态

```bash
ssh "$OPENCLAW_DEPLOY_HOST" "ps aux | grep openclaw-gateway | grep -v grep"
ssh "$OPENCLAW_DEPLOY_HOST" "ss -tlnp | grep ${OPENCLAW_GATEWAY_PORT:-18789}"
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

**原因**: core 已更新，但 overlay bundle 未一起发布，导致插件或频道扩展未加载。

**解决**:

```bash
pnpm ops:assemble -- --output-root "$OPENCLAW_BUNDLE_ROOT" --environment prod --allow-unresolved-env
rsync -av --no-i-r "$OPENCLAW_BUNDLE_ROOT"/ "$OPENCLAW_DEPLOY_HOST:$OPENCLAW_INSTALL_ROOT/.ops-bundle/"
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
ssh "$OPENCLAW_DEPLOY_HOST" "sudo npm i -g openclaw@latest"

# 重新发布当前稳定 bundle
pnpm ops:assemble -- --output-root "$OPENCLAW_BUNDLE_ROOT" --environment prod --allow-unresolved-env
rsync -av --no-i-r "$OPENCLAW_BUNDLE_ROOT"/ "$OPENCLAW_DEPLOY_HOST:$OPENCLAW_INSTALL_ROOT/.ops-bundle/"

# 重启 Gateway
ssh "$OPENCLAW_DEPLOY_HOST" "pkill -9 -f 'openclaw.*gateway' 2>/dev/null || true; sleep 2; nohup openclaw gateway run --bind loopback --port ${OPENCLAW_GATEWAY_PORT:-18789} --force > ${OPENCLAW_GATEWAY_LOG:-/tmp/openclaw-gateway.log} 2>&1 &"
```

---

## 相关文档

- `docs/operations/deployment-assembly.md`
- `docs/operations/deploy-protection.md`
