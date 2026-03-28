# Upstream Upgrade Commit Plan

本页把升级后的工作区差异，收敛成可执行的提交切分顺序。

配套工具：

- 先执行 `git fetch upstream --tags --prune`
- `pnpm ops:list-upstream-upgrade-groups --summary-only`
- `pnpm ops:list-upstream-upgrade-groups --write-dir .artifacts/ops/upstream-upgrade-groups`
- `pnpm -s ops:list-upstream-upgrade-groups --group upstream-sync --format paths`

当前默认按 4 组分类：

1. `upstream-sync`
2. `layering`
3. `local-forks`
4. `build-cleanups`

看摘要时，以 `Unique paths` 为准。4 个分组的文件数加总应与它一致。

如果只需要拆 `Group 1` 的审查负担，不要新增提交组，直接用 `/operations/upstream-upgrade-review-chunks` 里的 review 子块。

如果需要判断 `Group 2` 和 `Group 3` 哪些应长期保留、哪些应继续向 upstream 收敛，先看 `/operations/upstream-upgrade-layering-fork-boundary`。

如果需要判断 `Group 4` 哪些是本地 build 补丁、哪些只是生成物跟随项，先看 `/operations/upstream-upgrade-build-cleanups`。

不要跳过 `Group 1` 直接提交后 3 组。否则后续很难判断某个差异到底来自 upstream，还是来自本地架构改造。

## 推荐顺序

推荐提交顺序：

1. `Group 1: Upstream Sync`
2. `Group 2: Layering`
3. `Group 3: Local Forks`
4. `Group 4: Build Cleanups`

这 4 组的审查标准不同，拆开后才能判断哪些应长期保留，哪些后续应继续向 upstream 收敛。

## Group 1: Upstream Sync

提交目的：

- 把仓库基线提升到最新 `upstream/main`
- 不混入本地三层规划或私有 fork 语义

包含内容：

- `src/**`、`apps/**`、`docs/**`、`extensions/**` 等纯 upstream 演进
- 不落在 `overlay/**`、`runtime-templates/**`、`docs/operations/**` 的内容

审查重点：

- 是否只是同步 upstream
- 是否没有夹带本地架构层行为

建议提交消息：

- `Merge upstream 2026.3.27 baseline`

## Group 2: Layering

提交目的：

- 固化 `core/upstream -> overlay -> runtime-templates` 三层结构
- 让部署、补种、hook、资产目录都能按 `docs/operations` 执行

包含内容：

- `overlay/**`
- `runtime-templates/**`
- `server-config/**/README.md`
- `deploy/README.md`
- `docs/operations/**`
- `docs/development/DEPLOY-LOCAL-TO-SERVER.md`
- `scripts/assemble-runtime-bundle.mjs`
- `scripts/check-repo-layering.mjs`
- `scripts/seed-agent-workspaces.mjs`
- `scripts/audit-overlay-agents.mjs`
- `scripts/lib/overlay-agent-static-files.mjs`

审查重点：

- 是否保持 `overlay` 为静态版本层
- 是否保持 `runtime-templates` 为模板层
- 是否避免 runtime 真数据回流进 repo

建议提交消息：

- `Operations: add overlay and runtime template layering`

## Group 3: Local Forks

提交目的：

- 单独承载当前仍需保留的私有扩展能力
- 不把功能 fork 伪装成目录治理

包含内容：

- `extensions/wecom/**`
- `extensions/mysql-readonly/**`
- `extensions/superBrower/**`
- `extensions/zentao/**`
- `overlay/extensions/wecom/**`
- 与这些扩展直接耦合的 overlay skill 说明和 `src/plugin-sdk/wecom.ts`

审查重点：

- 哪些 fork 现在必须继续存在
- 哪些后续应继续向 upstream 收敛

建议提交消息：

- `Plugins: retain local fork surfaces after upstream upgrade`

## Group 4: Build Cleanups

提交目的：

- 让升级后的构建链、生成物和辅助检查保持可运行

包含内容：

- `package.json`
- `pnpm-lock.yaml`
- `scripts/stage-bundled-plugin-runtime-deps.mjs`
- `scripts/lib/plugin-sdk-entrypoints.json`
- `src/generated/bundled-channel-entries.generated.ts`
- `src/plugins/bundled-plugin-metadata.generated.ts`
- `src/generated/bundled-plugin-entries.generated.ts`
- 其他构建辅助与小块清理项

审查重点：

- 构建链是否对齐升级后的 upstream
- 插件 runtime 依赖 staging 是否稳定
- 生成物是否和新基线一致

建议先跑：

- `pnpm ops:verify-build-cleanups`

建议提交消息：

- `Build: align plugin staging and generated metadata`

## 使用方式

先看汇总：

```bash
pnpm ops:list-upstream-upgrade-groups --summary-only
```

再把每组文件清单写到工件目录，按组核对：

```bash
pnpm ops:list-upstream-upgrade-groups --write-dir .artifacts/ops/upstream-upgrade-groups
```

如果要只看某一组：

```bash
pnpm ops:list-upstream-upgrade-groups --group upstream-sync
```

如果要导出某一组的纯路径清单：

```bash
pnpm -s ops:list-upstream-upgrade-groups --group upstream-sync --format paths
```

如果后续要用 `scripts/committer` 按组提交，可以直接把路径清单作为单个多行参数传入：

```bash
scripts/committer "Merge upstream 2026.3.27 baseline" "$(pnpm -s ops:list-upstream-upgrade-groups --group upstream-sync --format paths)"
```

也可以直接走封装脚本：

```bash
scripts/commit-upstream-upgrade-group.sh --dry-run upstream-sync
scripts/commit-upstream-upgrade-group.sh upstream-sync
```

或者走 npm script：

```bash
pnpm ops:commit-upstream-upgrade-group -- --dry-run upstream-sync
```

生成内容包括：

- `.artifacts/ops/upstream-upgrade-groups/summary.json`
- `.artifacts/ops/upstream-upgrade-groups/upstream-sync.txt`
- `.artifacts/ops/upstream-upgrade-groups/layering.txt`
- `.artifacts/ops/upstream-upgrade-groups/local-forks.txt`
- `.artifacts/ops/upstream-upgrade-groups/build-cleanups.txt`

如果后续继续升级 upstream，不要手工维护这份文件列表，优先更新 `scripts/list-upstream-upgrade-groups.mjs` 的分类规则，然后重新生成工件。
