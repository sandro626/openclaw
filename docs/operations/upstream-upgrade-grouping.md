# Upstream Upgrade Grouping

本页用于给 `2026.3.24 -> 2026.3.27` 这次升级后的工作区差异做分组，避免把 upstream 同步、三层架构改造和本地 fork 补丁混在一起。

配套命令：

- 先执行 `git fetch upstream --tags --prune`
- `pnpm ops:list-upstream-upgrade-groups --summary-only`
- `pnpm ops:list-upstream-upgrade-groups --write-dir .artifacts/ops/upstream-upgrade-groups`
- `pnpm ops:list-upstream-upgrade-groups --group upstream-sync`
- `pnpm -s ops:list-upstream-upgrade-groups --group upstream-sync --format paths`

摘要里的 `Unique paths` 才是 4 个分组实际会覆盖的文件总数。`Tracked entries` 和 `Untracked entries` 只是当前工作树相对基线的原始条目统计。

## 结论

当前升级后的工作区差异应拆成 4 组：

1. 纯 upstream 同步
2. `core -> overlay -> runtime-templates` 三层架构改造
3. 本地 fork / core 补丁
4. 杂项清理与构建辅助调整

不要把这 4 组压成一个提交，否则后续审查和继续向 upstream 收敛都会失真。

## Group 1: 纯 Upstream 同步

这部分属于 `upstream/main` 自身演进，不应算进三层架构改造。

典型目录：

- `src/agents/**`
- `src/plugin-sdk/**`
- `src/plugins/**`
- `src/infra/**`
- `src/gateway/**`
- `src/commands/**`
- `extensions/browser/**`
- `extensions/discord/**`
- `extensions/telegram/**`
- `extensions/matrix/**`
- `apps/android/**`
- `apps/macos/**`
- `docs/.generated/**`
- `docs/channels/**`
- `docs/plugins/**`
- `docs/tools/**`

这组的判断标准是：

- upstream 已经改了
- 我们本地没有额外设计意图
- 即使没有 overlay/runtime 三层规划，这些变更也会随 upstream 升级一起进入仓库

## Group 2: 三层架构改造

这部分是我们本地明确为 `/docs/operations` 规划引入的结构化改造，应长期保留。

核心目录：

- `runtime-templates/**`
- `overlay/**`
- `deploy/README.md`
- `server-config/**/README.md`

核心文档：

- `docs/development/DEPLOY-LOCAL-TO-SERVER.md`
- `docs/operations/deployment-assembly.md`
- `docs/operations/overlay-agents-migration.md`
- `docs/operations/DEPLOY-protection.md`
- `docs/operations/agents-asset-inventory.md`
- `docs/operations/extensions-asset-inventory.md`
- `docs/operations/first-batch-asset-migration.md`
- `docs/operations/layering-strategy.md`
- `docs/operations/runtime-diff-classification.md`
- `docs/operations/runtime-unification-checklist.md`
- `docs/operations/runtime-unification.md`
- `docs/operations/skills-asset-inventory.md`
- `docs/operations/workspace-migration.md`

核心脚本：

- `scripts/assemble-runtime-bundle.mjs`
- `scripts/check-repo-layering.mjs`
- `scripts/seed-agent-workspaces.mjs`
- `scripts/audit-overlay-agents.mjs`
- `scripts/lib/overlay-agent-static-files.mjs`

这组的判断标准是：

- 直接服务于 `core/upstream -> overlay -> runtime` 分层
- 不依赖具体 upstream 功能改动才能成立
- 未来即使继续升 upstream，也仍应作为本地长期层保留

## Group 3: 本地 Fork / Core 补丁

这部分不属于三层架构本体，但仍是当前仓库要保留的本地差异。后续要么继续保留，要么单独向 upstream 收敛。

主要是 4 组本地扩展面：

- `extensions/wecom/**`
- `extensions/mysql-readonly/**`
- `extensions/superBrower/**`
- `extensions/zentao/**`

以及相关接缝：

- `overlay/extensions/wecom/**`
- `overlay/skills/mysql-readonly/SKILL.md`
- `overlay/skills/superBrower/SKILL.md`
- `overlay/skills/zentao/SKILL.md`
- `overlay/skills/browser-use/SKILL.md`
- `overlay/skills/dev-openclaw/SKILL.md`
- `overlay/skills/feishu-suite/README.md`
- `overlay/skills/ops-workflows/README.md`
- `src/plugin-sdk/wecom.ts`

这组不应被描述成“目录治理”，因为它们是运行能力本身的 fork。

## Group 4: 杂项清理与构建辅助调整

这部分体量小，但和升级可落地直接相关。它们不属于架构层，也不是大块业务 fork，应独立看。

文件包括：

- `.gitignore`
- `.oxfmtrc.jsonc`
- `docs/install/hetzner.md`
- `skills/gh-issues/SKILL.md`
- `scripts/docker/install-sh-e2e/run.sh`
- `scripts/copy-bundled-plugin-metadata.mjs`
- `scripts/stage-bundled-plugin-runtime-deps.mjs`
- `src/plugins/stage-bundled-plugin-runtime-deps.test.ts`
- `src/plugins/copy-bundled-plugin-metadata.test.ts`
- `src/generated/bundled-channel-entries.generated.ts`
- `src/plugins/bundled-plugin-metadata.generated.ts`
- `src/generated/bundled-plugin-entries.generated.ts`
- `package.json`
- `pnpm-lock.yaml`
- `scripts/lib/plugin-sdk-entrypoints.json`
- `src/config/types.gateway.ts`

其中最关键的是 `scripts/stage-bundled-plugin-runtime-deps.mjs` 这条构建链：

- 需要同时兼容 upstream 新的临时目录安装方式
- 也需要保留本地已有的缓存恢复和离线优先能力

## 建议提交顺序

最合理的提交顺序是：

1. Upstream 同步基线
2. 三层架构改造
3. 本地 fork / core 补丁
4. 构建辅助与杂项清理

不建议把 Group 2 和 Group 3 混成一个提交。前者是结构治理，后者是功能 fork，审查标准不同。

更细的落地步骤见 `/operations/upstream-upgrade-commit-plan`。

`Group 1` 的 review 切片见 `/operations/upstream-upgrade-review-chunks`。

`Group 2` 和 `Group 3` 的边界说明见 `/operations/upstream-upgrade-layering-fork-boundary`。

`Group 4` 的 build 补丁边界见 `/operations/upstream-upgrade-build-cleanups`。

## 审查重点

审查 Group 2 时，重点看：

- 是否符合 `/operations/deployment-assembly`
- 是否维持 `overlay` 静态层和 `runtime-templates` 模板层边界
- 是否避免 runtime 真数据回流到 repo

审查 Group 3 时，重点看：

- 哪些能力必须继续 fork
- 哪些能力已经能回归 upstream
- 哪些扩展仍然存在双真源或应继续收敛

审查 Group 4 时，重点看：

- 构建链是否稳定
- 插件 runtime deps staging 是否兼容 upstream 新增插件
- 生成文件和 lockfile 是否和升级后的基线一致
