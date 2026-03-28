# Upstream Upgrade Group 1 Summary

本页汇总 `Group 1: upstream-sync` 的 review 结论，作为后续整合、提交切分、以及本地 fork 面审查的总入口。

当前基线：

- `baseRef = upstream/main`
- `baseRefResolved = ced88298d86fb7ddb011b26acce911a0791ffb3e`

当前规模：

- `1123` 个路径
- `5` 个有效 review 子块
- `misc-upstream = 0`

已完成的子块 review：

- `/operations/upstream-upgrade-browser-runtime-review`
- `/operations/upstream-upgrade-provider-channel-review`
- `/operations/upstream-upgrade-memory-runtime-review`
- `/operations/upstream-upgrade-agent-gateway-review`
- `/operations/upstream-upgrade-contracts-tests-apps-review`

## 总体判断

这次 `Group 1` 不是常规的 upstream 维护性升级，而是 upstream 在把 OpenClaw 往“能力平台 + 统一运行时控制面”继续推进。

最明显的 5 条主线是：

1. browser 已经成为默认 bundled platform surface，而不是附属工具。
2. provider/channel/plugin surface 正在通过 `plugin-sdk`、facades、bundled runtime、contract tests 标准化。
3. memory 正在从内部功能继续抽成独立 capability/runtime stack。
4. agent、gateway、approvals、conversation bindings、MCP bridge 正在收敛成统一 control plane。
5. apps/tests/docs/generators 正在把这些行为补成显式契约，而不是依赖隐式兼容。

换句话说，`Group 1` 的主要增量不是“功能更多了”，而是 upstream 把越来越多的 surface 变成了：

- 有公共 seam
- 有生成物
- 有 contract
- 有跨端模型
- 有 operator-facing runtime 约束

## 5 个子块的归纳

### 1. Browser Runtime

browser 现在是默认启用的 bundled plugin，而且同时有：

- tool surface
- gateway method
- CLI
- runtime service

它已经接近内置 browser automation platform。对本地最直接的碰撞面是：

- `extensions/superBrower/**`
- `overlay/skills/browser-use/**`

### 2. Provider And Channel Surfaces

上游正在把 extension/public seam 收成标准形态：

- `openclaw/plugin-sdk/<subpath>`
- facade/barrel
- bundled capability runtime
- config UI hints
- provider/channel contracts

对本地最重要的含义是：任何长期保留的 fork 扩展，都应该尽量贴公共 seam，而不是继续依赖私有隐形边界。

### 3. Memory Runtime Stack

memory 的长期归属已经更清楚了：

- host/runtime contract 在 `packages/memory-host-sdk/**`
- runtime facade 在 `extensions/memory-core/**`
- core bridge 在 `src/plugin-sdk/memory-*`、`src/plugins/memory-*`

这意味着本地 `overlay/skills/memory/**` 应继续停留在“工作流/文档/运维层”，不要再和 upstream capability runtime 混层。

### 4. Agent Gateway Runtime

upstream 现在把下面几块明显往统一控制面收：

- agent orchestration
- provider/model implicit discovery
- plugin approvals
- channel setup / doctor / config metadata
- current conversation bindings
- MCP channel bridge

这对本地的意义不是冲突，而是提醒我们：后续 overlay/runtime 设计应尽量顺着这些 runtime seam，对齐而不是绕开。

### 5. Contracts Tests And Apps

这一块说明 upstream 已经开始用显式契约封住前面几块行为：

- channel/provider/plugin contract helpers
- `openclaw mcp serve` 的文档与 Docker E2E
- bundled channel config metadata generator
- app side GatewayModels / session key tests
- UI approvals / skills / tool cards regression tests

这意味着后续任何 fork 或私有改动，只看本地 build/pass 已经不够，还要看是否已经与这些共享 contract 偏离。

## 对本地三层设计的影响

`core -> overlay -> runtime-templates/runtime` 这套分层并没有被 `Group 1` 推翻，反而更有理由保留。

原因是：

1. upstream 越来越强调公共 runtime seam。  
   这让我们把私有资产压到 `overlay/**`、把运行时值压到 `runtime-templates/**` 的做法更合理。

2. upstream 的变化主要发生在 core/runtime/platform surface。  
   这说明我们应该把本地差异限制在明确的 overlay 和少量 fork 面，而不是把业务定制散进 core。

3. app/tests/docs/generator 都在显式化。  
   这要求我们后续任何私有差异都要更清楚地分层，否则升级成本会越来越高。

## 需要重点盯住的本地碰撞面

真正需要重点审的，不是整棵 `Group 1`，而是这些会和本地设计直接相撞的接缝：

1. `browser` vs `superBrower` / `browser-use`
2. `memory-core` / `memory-host-sdk` vs `overlay/skills/memory`
3. plugin approvals / exec approvals / MCP bridge vs 现有私有 operator 流程
4. bundled channel config metadata / setup flow / model picker vs 本地运行模板装配
5. provider discovery / runtime contracts vs 本地 provider 默认值和私有接入方式
6. app-side session key / Gateway model contract vs 服务器 runtime 的历史命名和会话规则

## 对后续整合的建议

`Group 1` 后续整合时，不要把它和 layering 改造混在一起看。最稳的顺序仍然是：

1. 先把 `Group 1` 当纯 upstream baseline 理解清楚。
2. 再把 `Group 2: layering` 叠加回去。
3. 最后逐块审 `Group 3: local-forks` 是否仍然需要保留。

如果后面要继续向 upstream 收敛，本页列出的 6 个碰撞面应该是第一批目标，而不是泛泛地“继续清 diff”。
