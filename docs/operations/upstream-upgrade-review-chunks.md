# Upstream Upgrade Review Chunks

本页把 `Group 1: Upstream Sync` 再拆成可审查的 review 子块，避免一次性看完 `1000+` 个 upstream 文件。

总摘要见：

- `/operations/upstream-upgrade-group1-summary`

前置步骤：

```bash
git fetch upstream --tags --prune
```

查看摘要：

```bash
pnpm -s ops:list-upstream-upgrade-review-chunks --summary-only
```

导出每个子块的文件清单：

```bash
pnpm -s ops:list-upstream-upgrade-review-chunks --write-dir .artifacts/ops/upstream-upgrade-review-chunks
```

只看某一块：

```bash
pnpm -s ops:list-upstream-upgrade-review-chunks --chunk browser-runtime
pnpm -s ops:list-upstream-upgrade-review-chunks --chunk browser-runtime --format paths
```

## 当前子块

当前 `upstream-sync` 被拆成 6 块：

1. `browser-runtime`
2. `provider-and-channel-surfaces`
3. `memory-runtime-stack`
4. `agent-gateway-runtime`
5. `contracts-tests-and-apps`
6. `misc-upstream`

当前基线下，`misc-upstream` 应保持为 `0`。如果它重新出现，说明分类规则需要补充，而不是直接把这些文件当杂项跳过。

## Chunk 1: Browser Runtime

主要包含：

- `extensions/browser/**`
- 与 browser bundled plugin 直接耦合的测试夹具

审查重点：

- 浏览器插件 runtime 生命周期
- CDP / Playwright / session 路径行为
- Browser routes、snapshot、storage、downloads 这些行为变化

## Chunk 2: Provider And Channel Surfaces

主要包含：

- 除 `browser`、`memory-core`、本地 fork 扩展外的大多数 `extensions/**`
- `src/plugin-sdk/**`
- `src/plugins/**`
- Plugin SDK facade / bundled channel metadata 这类生成辅助脚本

审查重点：

- provider / channel surface 是否变更公共约定
- plugin-sdk 子路径是否新增或改变
- bundled plugin/runtime contracts 是否变化

## Chunk 3: Memory Runtime Stack

主要包含：

- `packages/memory-host-sdk/**`
- `extensions/memory-core/**`
- `src/plugin-sdk/memory-*`
- `src/plugins/memory-*`

审查重点：

- memory host SDK 边界
- memory-core runtime 和 host engine 行为
- embeddings / storage / query runtime 兼容性

## Chunk 4: Agent Gateway Runtime

主要包含：

- `src/agents/**`
- `src/gateway/**`
- `src/auto-reply/**`
- `src/config/**`
- `src/commands/**`
- `src/flows/**`
- `src/infra/**`
- `src/channels/**`
- 其他 agent/gateway 直接耦合的 `src/**` 目录

审查重点：

- agent run loop、tool display、subagent、session 行为
- gateway server methods、bindings、approvals、archives
- config migration / doctor / channel setup / CLI runtime

## Chunk 5: Contracts Tests And Apps

主要包含：

- `apps/**`
- `test/**`
- `ui/**`
- `docs/cli/mcp.md`
- `CHANGELOG.md`
- `scripts/e2e/**`
- `scripts/test-*`

审查重点：

- contract tests 是否引入新的行为前提
- app side generated models 是否跟 gateway schema 同步
- E2E / live test harness 是否依赖新 runtime 约定

## 推荐顺序

推荐审查顺序：

1. `browser-runtime`
2. `provider-and-channel-surfaces`
3. `memory-runtime-stack`
4. `agent-gateway-runtime`
5. `contracts-tests-and-apps`

原因：

- `browser` 和 `provider/plugin-sdk` 的 surface 最大，先看最容易影响 fork 接缝的地方
- `memory` 是独立能力栈，和三层治理耦合较低，单独审查更清楚
- `agent/gateway` 变化面最广，但放在 provider surface 之后更容易判断行为影响
- apps/tests/docs 最后看，作为“是否跟上前面能力变化”的验证层

当前已完成的子块 review：

- `/operations/upstream-upgrade-group1-summary`
- `/operations/upstream-upgrade-browser-runtime-review`
- `/operations/upstream-upgrade-provider-channel-review`
- `/operations/upstream-upgrade-memory-runtime-review`
- `/operations/upstream-upgrade-agent-gateway-review`
- `/operations/upstream-upgrade-contracts-tests-apps-review`

## 与提交分组的关系

- 本页只用于拆 `Group 1: Upstream Sync`
- 不要把这些 review chunk 当成最终提交组
- 最终提交边界仍按 `/operations/upstream-upgrade-commit-plan` 的 4 组执行
