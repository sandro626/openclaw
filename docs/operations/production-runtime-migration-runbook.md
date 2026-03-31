# Production Runtime Migration Runbook

本页把服务器 runtime 迁移收敛成一条可执行 runbook，目标是在不丢失 sessions、memory 和历史工作区内容的前提下，把生产环境统一到当前仓库已经确定的三层模型。

相关文档：

- [Deployment Assembly](/operations/deployment-assembly)
- [Agents Asset Inventory](/operations/agents-asset-inventory)
- [Workspace Migration](/operations/workspace-migration)
- [Deploy Protection](/operations/deploy-protection)

## 适用范围

本 runbook 面向当前生产服务器的这类状态：

- runtime 根在 `~/.openclaw/`
- 服务器真实 `openclaw.json` 可能比仓库模板更新
- 服务器配置可能存在重复 agent 条目
- 仍可能存在 `workspace-<agentId>` 风格旧目录作为观察期保留副本

开始执行之前，先用只读审计命令生成一份当前 runtime 布局报告：

```bash
pnpm ops:audit-runtime-layout -- \
  --runtime-root "$HOME/.openclaw" \
  --config-path "$HOME/.openclaw/openclaw.json" \
  --write-file .artifacts/ops/prod-runtime-layout.json
```

这一步不会修改服务器数据，但会给出：

- 当前配置的原始 agent 条目数
- 当前生产唯一 agent 清单
- 配置中的重复 agent id
- 已在规范路径下看到 `memory/` 的 agent
- 仍需要从 `workspace-*` 旧目录核对的 agent
- 应迁移的 legacy workspace
- 应归档的历史 workspace 与历史 agent sessions

## 当前生产 agent

当前生产 agent 应按服务器真实配置与仓库模板共同对齐到以下 `22` 个唯一 id：

- `main`
- `cto`
- `dev`
- `tester`
- `ops`
- `pc-pm`
- `pc-ai-pythondev`
- `pc-backend`
- `pc-frontend`
- `pc-pctester`
- `pc-ceo_assistant`
- `pc-code_reviewer`
- `pc-devops`
- `pc-ip_expert`
- `pc-yz-app-pm`
- `pc-yz-app-javadev`
- `pc-yz-app-appdev`
- `pc-yz-app-aidev`
- `yz-app-pm`
- `yz-app-javadev`
- `yz-app-appdev`
- `yz-app-aidev`

补充说明：

- 当前服务器 `agents.list` 原始配置共有 `26` 条
- 去重后为 `22` 个唯一 agent
- 重复条目当前仅有 `yz-app-pm`、`yz-app-javadev`、`yz-app-appdev`、`yz-app-aidev`
- 这 `4` 个 `yz-app-*` 是需要保留的真实用户，后续只允许去重重复配置，不允许把 agent 本身当成历史项清理

## Provider 切换补充清单

这一步专门约束模型 provider 的 live 切换，避免把“配置已更新”和“网关实际已生效”混为一谈。

### 1. 先验证 key 和 endpoint 是否匹配

不要直接把新的 API key 写进 live 并重启。先对官方接口做一轮显式探测：

- Anthropic-compatible CN: `https://api.minimaxi.com/anthropic/v1/messages`
- Anthropic-compatible Global: `https://api.minimax.io/anthropic/v1/messages`

当前 OpenClaw 内置 MiniMax API-key 流程按 Anthropic-compatible 接口运行，因此生产模板和 live 配置也应使用这条接口，而不是混用另一条兼容面。

MiniMax 经验规则：

- CN key 往往只在 `api.minimaxi.com` 成功
- Global key 往往只在 `api.minimax.io` 成功

如果一边 `200`、另一边 `401`，优先判定为 endpoint 区域不匹配，而不是模型版本问题。

### 2. live 配置必须显式写 provider

不要只依赖：

- `agents.defaults.model.primary`
- agent 自己的 `model.primary`
- 或插件内部默认 provider catalog

生产 `openclaw.json` 必须显式保留：

- `models.providers.minimax.baseUrl`
- `models.providers.minimax.api`
- `models.providers.minimax.authHeader`
- `models.providers.minimax.models`

这样代码升级后，provider 解析才能继续指向正确 endpoint，而不是悄悄回退到错误默认值。

其中 MiniMax API-key 的 Anthropic-compatible 路线应固定为：

- `models.providers.minimax.api = "anthropic-messages"`
- `models.providers.minimax.authHeader = false`

否则请求会退化成 `Authorization: Bearer ...`，而不是 MiniMax Anthropic-compatible 接口接受的 `x-api-key`。

### 3. 更新 key 后必须重启网关

如果 MiniMax key 来自 systemd drop-in 或 service env：

1. 先备份现有 drop-in
2. 更新 key
3. `systemctl daemon-reload`
4. `systemctl restart openclaw-gateway.service`

不要假设 `openclaw agent` 的一次性 shell 注入就等于 live 服务已切换成功。

### 4. 构建产物必须整树同步

如果本地已经重编译过 provider/plugin：

- 同步整棵 `dist/`
- 不要只同步 `dist/extensions/minimax/`

原因是 bundled 插件可能依赖 `dist/` 根目录的共享 chunk。只同步局部目录，live 端可能在：

- `openclaw plugins list`
- `openclaw channels status --probe`

时才暴露 `Cannot find module '../../provider-catalog-*.js'` 一类错误。

### 5. live smoke 最少覆盖三类对象

provider 切换后，至少执行：

- 一个基础 agent，例如 `main`
- 一个业务 `pc-*` agent
- 一个用户 `yz-app-*` agent

并确认：

- `provider=minimax`
- `model=MiniMax-M2.7`
- 返回正常文本，不再是 `401 invalid api key`

## 最新服务器核查结果

### 1. memory 已全部对位到规范路径

最新只读审计结果：

- `Configured agent rows = 26`
- `Prod agents = 22`
- `Duplicate configured agent ids = 4`
- `Normalized memory ready = 22`
- `Needs legacy memory review = 0`
- `Historical agent sessions to archive = 0`

这说明活跃运行态的数据已经在新环境可用，当前剩余问题主要是 legacy 观察期副本和重复配置条目，而不是 active memory 还未迁到规范路径。

### 2. legacy workspace 当前处于观察期保留

当前仍可见的 legacy `workspace-*` 目录，默认视为观察期保留副本，不再默认归档 `yz-app-*` 或 `pc-yz-app-*`：

- `workspace-pc-ai-pythondev`
- `workspace-pc-backend`
- `workspace-pc-ceo_assistant`
- `workspace-pc-code_reviewer`
- `workspace-pc-devops`
- `workspace-pc-frontend`
- `workspace-pc-ip_expert`
- `workspace-pc-pctester`
- `workspace-pc-yz-app-aidev`
- `workspace-pc-yz-app-appdev`
- `workspace-pc-yz-app-javadev`
- `workspace-pc-yz-app-pm`
- `workspace-yz-app-javadev`
- `workspace-yz-app-pm`

这里要分清两件事：

- `workspace-pc-pythondev` 只是 `pc-ai-pythondev` 的旧别名路径，可继续视为历史残留，不代表单独的活跃 agent
- `workspace-pc-ai-pythondev`、`workspace-pc-yz-app-*`、`workspace-yz-app-*` 对应的是当前仍保留的 agent，后续如需清理，应清理旧副本目录本身，而不是把这些 agent 当成历史项归档

### 3. 当前配置层的剩余动作

当前需要继续收口的是：

- 把仓库模板固定到 `22` 个唯一 agent
- 保留 `yz-app-*` 这 `4` 个用户
- 后续在服务器配置中只去重重复的 `yz-app-*` 条目，不删 canonical agent

## 迁移目标

本次迁移完成后，生产服务器应满足：

- 活跃工作区统一位于 `~/.openclaw/workspace/<agentId>`
- `overlay/agents` 只通过补种静态骨架生效，不再携带 runtime 数据
- legacy `workspace-*` 目录不再继续写入
- 当前生产 agent 的 sessions 保留在 `~/.openclaw/agents/<agentId>/sessions/`
- 历史 agent 的 sessions 和旧工作区进入独立归档目录
- 发布改成 `ops:assemble` + `ops:seed-workspaces` 链路

## 执行顺序

### Phase 1: 迁移前冻结

1. 暂停会导致 workspace/memory 写入的自动任务。
2. 暂停批量消息回放或任何会触发 agent 自动工作的操作。
3. 确认不会有第二条发布链同时写 `~/.openclaw/`。

如果使用 systemd，可以在窗口期内停 gateway：

```bash
sudo systemctl stop openclaw-gateway.service
```

## Phase 2: 运行态备份

先在服务器上定义统一备份根：

```bash
export OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
export BACKUP_ROOT="${BACKUP_ROOT:-$HOME/openclaw-backups/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$BACKUP_ROOT"
```

至少备份这些内容：

```bash
tar -C "$OPENCLAW_HOME" -czf "$BACKUP_ROOT/runtime-config-and-state.tgz" \
  openclaw.json \
  agents \
  workspace \
  memory \
  credentials \
  exec-approvals.json \
  update-check.json
```

单独把 legacy workspace 目录归档出来：

```bash
find "$OPENCLAW_HOME" -maxdepth 1 -type d -name 'workspace-*' -print0 \
  | tar --null -czf "$BACKUP_ROOT/legacy-workspaces.tgz" --files-from -
```

如果 `find ... | tar` 在当前环境不方便，直接逐个目录 `tar` 也可以，但不要跳过任何 `workspace-*`。

## Phase 3: 建立迁移映射

对每个 legacy 目录明确归属：

- 对应当前生产唯一 agent 的，进入 `migrate` 或观察期保留
- 只对应已经不在当前配置里的历史 agent 的，进入 `archive`

本次默认映射应按下表起步：

| Legacy Directory              | Target                        |
| ----------------------------- | ----------------------------- |
| `workspace-pc-backend`        | `workspace/pc-backend`        |
| `workspace-pc-ceo_assistant`  | `workspace/pc-ceo_assistant`  |
| `workspace-pc-code_reviewer`  | `workspace/pc-code_reviewer`  |
| `workspace-pc-devops`         | `workspace/pc-devops`         |
| `workspace-pc-frontend`       | `workspace/pc-frontend`       |
| `workspace-pc-ip_expert`      | `workspace/pc-ip_expert`      |
| `workspace-pc-pctester`       | `workspace/pc-pctester`       |
| `workspace-pc-ai-pythondev`   | `workspace/pc-ai-pythondev`   |
| `workspace-pc-yz-app-pm`      | `workspace/pc-yz-app-pm`      |
| `workspace-pc-yz-app-javadev` | `workspace/pc-yz-app-javadev` |
| `workspace-pc-yz-app-appdev`  | `workspace/pc-yz-app-appdev`  |
| `workspace-pc-yz-app-aidev`   | `workspace/pc-yz-app-aidev`   |
| `workspace-yz-app-pm`         | `workspace/yz-app-pm`         |
| `workspace-yz-app-javadev`    | `workspace/yz-app-javadev`    |
| `workspace-yz-app-appdev`     | `workspace/yz-app-appdev`     |
| `workspace-yz-app-aidev`      | `workspace/yz-app-aidev`      |

以下默认归档，不并入当前生产：

- `workspace-pc-pythondev`，这是 `pc-ai-pythondev` 的旧别名目录，不再作为独立 agent 目录保留

## Phase 4: 先补种静态骨架

在服务器上先把当前仓库装配出的静态骨架补进目标工作区：

```bash
pnpm ops:seed-workspaces -- --workspace-root "$OPENCLAW_HOME/workspace"
```

如果只想先处理生产 agent，可以显式传 `--agent-ids`：

```bash
pnpm ops:seed-workspaces -- \
  --workspace-root "$OPENCLAW_HOME/workspace" \
  --agent-ids main,cto,dev,tester,ops,pc-pm,pc-ai-pythondev,pc-backend,pc-frontend,pc-pctester,pc-ceo_assistant,pc-code_reviewer,pc-devops,pc-ip_expert,pc-yz-app-pm,pc-yz-app-javadev,pc-yz-app-appdev,pc-yz-app-aidev,yz-app-pm,yz-app-javadev,yz-app-appdev,yz-app-aidev
```

注意：

- 这一步只负责静态骨架
- 不会替代 sessions
- 不会替代 runtime memory

## Phase 5: 非破坏性复制 legacy memory

对需要迁移的 legacy workspace，只做复制，不做删除：

```bash
mkdir -p "$OPENCLAW_HOME/workspace/pc-code_reviewer"
rsync -a "$OPENCLAW_HOME/workspace-pc-code_reviewer/" "$OPENCLAW_HOME/workspace/pc-code_reviewer/"
```

按这个模式逐个执行：

- `pc-ai-pythondev`
- `pc-backend`
- `pc-ceo_assistant`
- `pc-code_reviewer`
- `pc-devops`
- `pc-frontend`
- `pc-ip_expert`
- `pc-pctester`
- `pc-yz-app-pm`
- `pc-yz-app-javadev`
- `pc-yz-app-appdev`
- `pc-yz-app-aidev`
- `yz-app-pm`
- `yz-app-javadev`
- `yz-app-appdev`
- `yz-app-aidev`

复制时遵守两条规则：

1. 不删除源目录
2. 如果目标目录已经有比源目录更新的文件，先人工比对，不要盲目覆盖

## Phase 6: sessions 与历史 agent 归档

当前生产 `22` 个唯一 agent 的 `sessions/` 保留原位。  
历史 agent 的 `sessions/` 则迁到归档根，例如：

```bash
mkdir -p "$BACKUP_ROOT/archived-agents"
for agent in openclaw-acp-harness pc-yunxiao pctester; do
  if [ -d "$OPENCLAW_HOME/agents/$agent" ]; then
    mv "$OPENCLAW_HOME/agents/$agent" "$BACKUP_ROOT/archived-agents/$agent"
  fi
done
```

如果当前窗口不想直接 `mv`，至少先 `cp -a` 到归档目录，再把原目录留在观察期。

## Phase 7: 发布新的装配 bundle

在本地或发布机生成 bundle：

```bash
pnpm ops:assemble -- --output-root .artifacts/ops/prod-runtime-migration --environment prod
```

发布时只同步：

- `core` 程序目录
- `overlay` 目录
- 渲染后的 `openclaw.json`

不要直接覆盖整个 `~/.openclaw/`。

## Phase 8: 重启与验证

重启 gateway：

```bash
sudo systemctl start openclaw-gateway.service
```

至少验证这些内容：

1. 当前生产 agent 都能启动
2. `22` 个唯一 agent 都已在 `workspace/<agentId>/memory` 下看到内容
3. `workspace-*` 旧目录不再出现新写入
4. `ops:assemble` 渲染出的配置与服务器实际启用的 `22` 个唯一 agent 列表一致
5. `overlay/extensions/wecom` 仍按 `plugins.load.paths` 生效

## Phase 9: 观察期

观察期内：

- 保留 legacy `workspace-*`
- 保留归档出来的历史 agent sessions
- 每天检查一次旧目录是否仍有新写入

如果旧目录仍在写，说明：

- 配置没有完全切换
- 旧进程没有彻底停干净
- 或某个脚本仍在引用历史路径

## Phase 10: 延后清理

只有在观察期结束后，才允许：

- 删除 legacy `workspace-*`
- 删除历史 agent 的旧 runtime 目录
- 清理重复 memory 副本

清理前仍应保留备份。

## 本次迁移的最低成功标准

满足以下条件才算完成：

- 当前生产 `13` 个 agent 全部在 `workspace/<agentId>` 下工作
- `pc-ceo_assistant`、`pc-code_reviewer`、`pc-ip_expert` 不再依赖 legacy memory 目录
- 历史 yz / 实验 agent 的 sessions 已归档
- 部署链改成 `ops:assemble` + `ops:seed-workspaces`
- 旧 `workspace-*` 在观察期内不再出现新写入
