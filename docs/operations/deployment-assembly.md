# Overlay 部署装配流程

## 目标

把 `core`、`overlay`、`runtime` 的职责明确拆开，并把部署动作固定成一条可重复链路：

1. 升级 `core`
2. 装配 `overlay`
3. 渲染 runtime 配置
4. 补种 workspace 静态骨架
5. 重启并验证

相关文档：

- [Runtime Unification](/operations/runtime-unification)
- [Runtime Unification Checklist](/operations/runtime-unification-checklist)
- [Deploy Protection](/operations/deploy-protection)
- [Workspace Migration](/operations/workspace-migration)
- [Production Runtime Migration Runbook](/operations/production-runtime-migration-runbook)

## 目录分工

### Core

主程序本体，尽量接近 upstream：

- `src/`
- `extensions/`
- `skills/`
- `apps/`

### Overlay

私有业务资产，不直接并回 core：

- `overlay/extensions/`
- `overlay/skills/`
- `overlay/patches/`
- `overlay/scripts/`

### Runtime Templates

运行配置与 workspace 骨架模板：

- `runtime-templates/config/`
- `runtime-templates/state/`
- `runtime-templates/agents/base.json`
- `runtime-templates/agents/environments/<env>.json`
- `runtime-templates/agents/bindings/base.json`
- `runtime-templates/agents/bindings/environments/<env>.json`
- `runtime-templates/agents/skill-resolution.json`
- `runtime-templates/agents/<agentId>/config.patch.json`
- `runtime-templates/agents/workspace-skeleton/`

agent 模板规则：

- `runtime-templates/agents/base.json` 与 `environments/<env>.json` 承载 `agents.defaults` 和运行环境下的 agent 激活列表
- `runtime-templates/agents/bindings/base.json` 与 `bindings/environments/<env>.json` 承载 channel -> agent 路由绑定
- `runtime-templates/agents/skill-resolution.json` 显式记录 server alias、host 提供的外部 skill、server-local runtime-only skill，以及仅在配置中可见但尚未找回源码的 skill id
- 每个 `overlay/agents/<agentId>/` 必须显式对应一个 `runtime-templates/agents/<agentId>/config.patch.json`
- 没有默认配置的 agent 也保留空对象补丁 `{}`，避免靠缺文件表达“未配置”

### Runtime

真实运行态，永不作为源码目录：

- `~/.openclaw/openclaw.json`
- `~/.openclaw/openclaw-feishu-accounts.json`
- `~/.openclaw/credentials/*.json`
- `~/.openclaw/exec-approvals.json`
- `~/.openclaw/update-check.json`
- `~/.openclaw/workspace/<agentId>`
- `~/.openclaw/agents/*/sessions/`
- `~/.openclaw/memory/*.sqlite`

### Root Exceptions

以下根目录可以存在，但不属于 `core -> overlay -> runtime` 三层真源本体：

- `runtime-templates/`: 模板层，不是真运行态
- `deploy/`: 部署与装配辅助目录
- `server-config/`: 只保留迁移入口说明，不再承载真源
- `.artifacts/`: 本地装配产物、归档和临时整理区
- `Swabble/`: 并列维护的独立子项目，不纳入当前三层资产治理范围

## 装配脚本

### 1. 生成部署 bundle

```bash
pnpm ops:assemble -- --output-root .artifacts/ops/prod --environment prod
```

脚本：

- 每次先清空 `--output-root`，避免旧 bundle 残留继续伪装成活跃 overlay 资产
- 复制 `overlay/extensions`、`overlay/skills`、`overlay/patches`、`overlay/scripts`
- 基于 `runtime-templates/config/*` 渲染 `openclaw.json`
- 保留 `runtime-templates/state/*` 作为 host-local state example，不写入 bundle runtime 真数据
- 基于 `runtime-templates/extensions/base.json` 与 `runtime-templates/extensions/environments/<env>.json` 渲染插件加载路径和 `plugins.entries` 补丁
- 基于 `runtime-templates/skills/base.json` 与 `runtime-templates/skills/environments/<env>.json` 渲染 `skills.entries` 补丁
- 基于 `runtime-templates/agents/base.json` 与 `runtime-templates/agents/environments/<env>.json` 渲染 `agents.defaults` 和 `agents.list`
- 基于 `runtime-templates/agents/bindings/base.json` 与 `runtime-templates/agents/bindings/environments/<env>.json` 渲染顶层 `bindings[]`
- 用 `runtime-templates/agents/skill-resolution.json` 审计 agent `skills` 中的 canonical id、host-provided skill、server-local skill 与 config-only skill
- 基于 `runtime-templates/agents/*/config.patch.json` 渲染 agent 配置补丁
- 自动生成共享技能目录的 `skills.load.extraDirs`
- 输出 `manifest.json`

扩展装配细节：

- `overlay/extensions/*` 会整体复制到 bundle
- 只有在 `runtime-templates/extensions/*.json` 明确列入 `plugins.load.paths` 的 overlay 扩展才会成为活跃加载路径
- 带 `openclaw.plugin.json` 或 `package.json` 的 overlay 目录仍会被记录到 manifest，便于核对哪些目录已具备可加载形态
- 纯占位目录会被复制到 bundle，但不会加入加载路径

模型 provider 装配细节：

- provider 的 `baseUrl`、`api`、`authHeader` 等运行值，应通过 `runtime-templates/config/*` 显式渲染，不要依赖插件内部默认值
- MiniMax 这类分区 provider，必须把 endpoint 也纳入模板
- 当前 live 规则应固定为：
  - CN key -> `https://api.minimaxi.com/anthropic`
  - Global key -> `https://api.minimax.io/anthropic`
- 不要把 `401 invalid api key` 直接判断成“key 一定错了”；先核对 endpoint 和 key 区域是否匹配

入口脚本：

- `scripts/assemble-runtime-bundle.mjs`

结构约束：

- `pnpm check:repo-layering`
- `git-hooks/pre-commit` 会通过 `pnpm check` 间接执行它

### 2. 补种 agent workspace 静态骨架

```bash
pnpm ops:seed-workspaces -- --workspace-root ~/.openclaw/workspace
```

脚本：

- 先从 `runtime-templates/agents/workspace-skeleton/` 补种基础文件
- 再从 `overlay/agents/<agentId>/workspace/` 应用安全白名单覆盖
- 只处理静态文件
- 自动确保 `memory/` 目录存在
- `missing` 模式下，overlay 文件会覆盖本轮刚从 skeleton 补种出来的同名文件，但不会覆盖 runtime 中原本已存在的静态文件

入口脚本：

- `scripts/seed-agent-workspaces.mjs`

## 关键规则

### 插件融合

插件不应再被手工塞回 core 的 `extensions/` 目录。优先通过以下方式加载：

1. `plugins.load.paths`
2. `~/.openclaw/extensions`
3. `<workspace>/.openclaw/extensions`

这样升级 core 时，overlay 插件仍保持独立。

如果某个扩展当前仍以 `extensions/<name>` 作为构建入口，同名 `overlay/extensions/<name>` 只能被视为接收位或私有分叉候选，不能继续作为第二份活跃源码。

另外要区分两种启用方式：

- bundled 插件来自 `extensions/*`，会被默认发现；通常只需要配置 `plugins.entries.<id>` 或对应 channel 开关
- overlay 私有插件不会因为目录存在就自动启用；只有显式进入 `plugins.load.paths`，或被部署到 runtime 插件目录后才会生效

插件的连接参数、启用开关和 guardrails，应通过 `runtime-templates/extensions/*` 渲染到 `plugins.entries.*`，不要把真实连接信息留在 `config.example.json` 之外的源码层。

### 构建产物同步

部署时不要只同步单个 `dist/extensions/<id>` 目录。

`tsdown` 生成的 bundled 插件经常依赖 `dist/` 根下的共享 chunk 文件。如果只覆盖单个 extension 目录，live 端可能在重启后报：

- `Cannot find module '../../provider-catalog-*.js'`
- 或其他类似的共享 chunk 缺失错误

当前推荐规则：

1. 源码树更新到目标版本
2. 本地 `pnpm build`
3. 服务器原地同步整棵 `dist/`
4. 再同步必要的源码/模板文件
5. 重启 gateway 后执行 smoke

如果这一步漏做，`openclaw agent` 可能看起来还能偶发成功，但 `openclaw plugins list`、`openclaw channels status --probe` 会先暴露插件装载失败。

### 技能融合

共享技能包可以走 `skills.load.extraDirs`，但这只是最低优先级的补充入口。

技能的运行态密钥、站点账号、验证码和默认禁用状态，应通过 `runtime-templates/skills/*` 渲染到 `skills.entries.*`，不要再写回 `overlay/skills/*/SKILL.md`。

已经在 `skills/*` 作为正式真源维护的通用技能，不应再复制一份到 `overlay/skills/*`。否则会同时形成主仓技能和 overlay 技能两套来源。

如果你要覆盖同名 bundled skill，不要只放在 `extraDirs`，应部署到：

- `~/.openclaw/skills`
- 或 `<workspace>/skills`

### agent 骨架融合

`overlay/agents` 只应承载静态骨架，不应继续混放：

- `sessions/`
- `memory/`
- `agent/auth.json`
- `agent/models.json`

当前脚本会对白名单以外的内容保持忽略，不会把这些运行态文件补种到 workspace。

## 推荐发布顺序

```bash
# 1. 更新 core 并构建
git fetch upstream
git merge upstream/main
pnpm build

# 2. 生成 overlay-aware 部署 bundle
pnpm ops:assemble -- --output-root .artifacts/ops/prod --environment prod

# 3. 渲染后的配置与 overlay 一起发布
#    这里的同步目标应是程序目录和 overlay 目录，
#    不是整个 runtime 根目录

# 3.1. 如果构建输出有变化，同步整棵 dist/
#      不要只 rsync 单个 dist/extensions/<id>

# 4. 补种静态 workspace 骨架
pnpm ops:seed-workspaces -- --workspace-root ~/.openclaw/workspace

# 5. 重启 gateway 并做 smoke test
```

推荐 smoke 最少覆盖：

- `openclaw plugins list`
- `openclaw models list`
- `openclaw channels status --probe`
- `openclaw agent --agent main ...`
- 一个业务 agent smoke，例如 `pc-ceo_assistant`
- 一个 `yz-app-*` 用户 agent smoke

## 禁止事项

- 不要把 overlay 业务扩展重新复制回 core `extensions/`
- 不要把真实 `openclaw.json` 当成唯一模板来源
- 不要在部署时覆盖 `~/.openclaw/workspace*/`
- 不要在部署时覆盖 `sessions/` 和 `memory/*.sqlite`

## 当前仓库里的过渡状态

当前仓库已把 `overlay/agents/*/agent/*.json` 和 runtime workspace 状态退出当前树，同时 `server-config/agents`、`server-config/extensions`、`server-config/skills` 以及 `server-config` 根下的 runtime 真文件都已退休为归档入口说明。后续重点转向服务器 runtime 对位和 deploy 链路固化。
