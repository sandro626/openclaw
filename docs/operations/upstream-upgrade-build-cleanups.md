# Upstream Upgrade Build Cleanups

本页记录 `Group 4: build-cleanups` 的处理原则。

当前基线：

- `baseRef = upstream/main`
- `baseRefResolved = ced88298d86fb7ddb011b26acce911a0791ffb3e`

## 结论

`Group 4` 不属于三层架构，也不属于本地业务 fork。  
它是“升级后为了让构建链、生成物、辅助脚本继续稳定工作而必须保留的一小组本地补丁”。

这组应继续单独保留，原因有两个：

1. 它直接决定升级后的 build 是否能稳定落地。
2. 它混杂了源码补丁和生成物跟随项，不能和 `Group 2` / `Group 3` 用同一标准审查。

## 当前内容

当前 `Group 4` 主要由 3 类内容组成。

### 1. 本地构建辅助补丁

这些是需要长期维护的本地 build helper：

- `scripts/stage-bundled-plugin-runtime-deps.mjs`
- `scripts/copy-bundled-plugin-metadata.mjs`
- `scripts/lib/plugin-sdk-entrypoints.json`
- `package.json`
- `pnpm-lock.yaml`

其中最关键的是：

- `scripts/stage-bundled-plugin-runtime-deps.mjs`
  当前承载了持久缓存、离线优先安装、临时目录原子安装这些本地 build 补丁
- `scripts/copy-bundled-plugin-metadata.mjs`
  当前承载了 bundled skill 复制、`node_modules` 技能重定位、manifest 重写

### 2. 生成物跟随项

这些文件本身不是策略，但它们必须和上面的 helper 保持一致：

- `src/generated/bundled-channel-entries.generated.ts`
- `src/generated/bundled-plugin-entries.generated.ts`
- `src/plugins/bundled-plugin-metadata.generated.ts`

它们不应被单独手工维护，应该跟随生成/检查命令更新。

### 3. 小块环境与卫生跟随项

这类文件不是构建主逻辑，但在升级后为了让工作区、脚本、环境提示保持一致，需要一起保留：

- `.gitignore`
- `.oxfmtrc.jsonc`
- `docs/install/hetzner.md`
- `skills/gh-issues/SKILL.md`
- `scripts/docker/install-sh-e2e/run.sh`
- `scripts/commit-upstream-upgrade-group.sh`
- `scripts/list-upstream-upgrade-groups.mjs`
- `scripts/list-upstream-upgrade-review-chunks.mjs`
- `src/config/types.gateway.ts`

## 审查标准

`Group 4` 的审查重点不是“功能值不值得保留”，而是：

1. 构建补丁是否仍然必要
2. 生成物是否和当前 helper 保持一致
3. 这些小块调整是否仍然服务于升级后的基线，而不是变成历史噪音

## 当前建议

### 1. 保留本地构建补丁

当前 `scripts/stage-bundled-plugin-runtime-deps.mjs` 和 `scripts/copy-bundled-plugin-metadata.mjs` 仍有明确价值，不应直接回退。

### 2. 继续把生成物当跟随项

`src/generated/*` 和 `src/plugins/bundled-plugin-metadata.generated.ts` 应继续视为 helper 的产物，而不是独立的决策面。

### 3. 用一条窄验证链校验这组

当前仓库已新增：

- `pnpm ops:verify-build-cleanups`

它串起了这组最关键的验证：

- `pnpm check:bundled-channel-config-metadata`
- `pnpm check:bundled-plugin-metadata`
- `pnpm plugin-sdk:check-exports`
- `pnpm test -- src/plugins/stage-bundled-plugin-runtime-deps.test.ts src/plugins/copy-bundled-plugin-metadata.test.ts`
- `pnpm build`

这比直接跑全量 `pnpm check` 更聚焦，也比只看单个生成文件更可靠。

## 推荐的下一步

如果继续推进升级收口：

1. 先把 `Group 4` 作为独立 build 补丁组保留
2. 用 `pnpm ops:verify-build-cleanups` 作为这组的最小验证入口
3. 后续只在 upstream 真正覆盖这些 helper 时，再考虑逐步回退本地补丁
