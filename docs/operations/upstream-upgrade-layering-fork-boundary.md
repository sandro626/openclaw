# Upstream Upgrade Layering And Local Fork Boundary

本页用于明确 `Group 2: layering` 和 `Group 3: local-forks` 的边界，避免把三层架构改造和本地功能 fork 混成一类。

当前基线：

- `baseRef = upstream/main`
- `baseRefResolved = ced88298d86fb7ddb011b26acce911a0791ffb3e`

当前摘要：

- `Group 2: layering = 364`
- `Group 3: local-forks = 109`

## 结论

这两组不是同一种本地差异：

- `Group 2` 是 `core/upstream -> overlay -> runtime-templates/runtime` 这套分层本身，应长期保留。
- `Group 3` 是当前仍需保留的功能 fork，应单独审查，并持续寻找向 upstream 收敛或退休的机会。

不能把 `Group 3` 伪装成目录治理，也不能把 `Group 2` 理解成“只是文档和脚本”。

## Group 2: Layering

### 这组真正承载的是什么

按当前文件分布，`Group 2` 的主体是：

- `overlay/skills/**`
- `overlay/agents/**`
- `runtime-templates/**`
- `server-config/**/README.md`
- `scripts/assemble-runtime-bundle.mjs`
- `scripts/check-repo-layering.mjs`
- `scripts/seed-agent-workspaces.mjs`
- `scripts/audit-overlay-agents.mjs`
- `docs/operations/**`

本质上，这组负责 4 件事：

1. 定义私有静态资产层 `overlay/**`
2. 定义运行模板层 `runtime-templates/**`
3. 明确 `server-config/**` 已退休，不再承载真源
4. 用装配脚本和 hook 把边界强制下来

### 这组里哪些是必须长期保留的

这些属于三层架构原语，不应视为临时改稿：

- `runtime-templates/**`
- `overlay/agents/**`
- `overlay/skills/**`
- `overlay/extensions/README.md`
- `overlay/README.md`
- `server-config/**/README.md`
- `scripts/assemble-runtime-bundle.mjs`
- `scripts/check-repo-layering.mjs`
- `scripts/seed-agent-workspaces.mjs`
- `scripts/audit-overlay-agents.mjs`
- `scripts/lib/overlay-agent-static-files.mjs`

即使后面继续升级 upstream，这些也仍应作为本地长期层存在。

### 这组里哪些是配套审计/决策文档

这些同样属于本地运营文档，但不是 runtime 原语：

- `docs/operations/deployment-assembly.md`
- `docs/operations/layering-strategy.md`
- `docs/operations/runtime-unification*.md`
- `docs/operations/*-asset-inventory.md`
- `docs/operations/workspace-migration.md`
- `docs/operations/upstream-upgrade-*.md`
- `docs/development/DEPLOY-LOCAL-TO-SERVER.md`

它们不直接参与运行，但用于：

- 固定真源定义
- 固定迁移顺序
- 记录 upgrade 审计结论

因此它们不该和 `Group 3` 一起被描述成“功能 fork”。

## Group 3: Local Forks

### 这组真正承载的是什么

`Group 3` 当前几乎全部集中在 4 组扩展：

- `extensions/wecom/**`
- `extensions/mysql-readonly/**`
- `extensions/superBrower/**`
- `extensions/zentao/**`

以及少量直接耦合的接缝：

- `overlay/extensions/wecom/**`
- `overlay/skills/mysql-readonly/SKILL.md`
- `overlay/skills/superBrower/SKILL.md`
- `overlay/skills/zentao/SKILL.md`
- `overlay/skills/browser-use/SKILL.md`
- `overlay/skills/dev-openclaw/SKILL.md`
- `overlay/skills/feishu-suite/README.md`
- `overlay/skills/ops-workflows/README.md`
- `src/plugin-sdk/wecom.ts`

这组的本质是“本地扩展能力差异”，不是分层治理。

### 逐项判断

#### 1. `wecom`

当前判断：必须继续保留。

原因：

- `runtime-templates/extensions/base.json` 当前只显式加载 `overlay/extensions/wecom`
- `overlay/extensions/wecom/**` 仍是运行时默认私有分叉
- `extensions/wecom/**` 保留为 upstream 基线和对照面
- `src/plugin-sdk/wecom.ts` 是这个 fork 的公共 seam

这意味着 `wecom` 目前是唯一明确允许的“双目录对位”例外：

- `extensions/wecom/**` 不是活跃 runtime 真源
- `overlay/extensions/wecom/**` 才是当前显式加载的 runtime fork

所以它应继续保留在 `Group 3`，不能并入 `Group 2`。

细化策略见 `/operations/upstream-upgrade-wecom-fork-strategy`。

#### 2. `mysql-readonly`

当前判断：继续保留，但属于“单真源私有扩展”，后续可继续向公共 seam 收敛。

原因：

- 插件源码真源在 `extensions/mysql-readonly/**`
- `runtime-templates/extensions/base.json` 只负责配置模板，不负责 overlay 加载
- `overlay/skills/mysql-readonly/SKILL.md` 只是操作/调用说明，不是第二份源码

它属于业务工具扩展，但当前已经收口成单真源，不再存在 overlay 镜像源码。后续可以继续向 upstream 的 provider/tool contracts 靠拢，但不应再回流到 overlay 源码层。

#### 3. `zentao`

当前判断：继续保留，但同样属于“单真源私有扩展”。

原因：

- 插件源码真源在 `extensions/zentao/**`
- runtime 配置在 `runtime-templates/extensions/**`
- overlay 层只保留 `SKILL.md` 等操作说明

它和 `mysql-readonly` 类似，应继续作为本地业务扩展存在，但尽量贴近 upstream 的 plugin-sdk、contracts、config surface。

#### 4. `superBrower`

当前判断：短期继续保留，但它是 `Group 3` 里最优先的收敛/退休候选。

原因：

- upstream 已新增默认启用的 `browser` bundled platform
- `extensions/superBrower/**` 与上游 browser runtime 在浏览器自动化能力上已有明显重叠
- 当前 `superBrower` 已经退回 `extensions/superBrower/**` 单真源，overlay 镜像副本已退休
- `overlay/skills/browser-use/SKILL.md` 和 `overlay/skills/superBrower/SKILL.md` 现在更像操作层，而不是能力真源

因此：

- 短期内它仍是功能 fork
- 但中期最值得继续审的是它能否缩成 site profile / workflow / policy 层，而把通用 browser runtime 让回 upstream

## 对提交与后续收敛的意义

### Group 2 不应继续拆散

`Group 2` 可以内部区分“运行原语”和“审计文档”，但提交和审查上仍应作为同一类本地长期层处理。

原因是：

- 它们共同定义了 repo 的三层结构
- hook、模板、目录、迁移文档必须一起存在才有意义

### Group 3 应继续按能力面收敛

后续不该泛泛地说“减少 local-forks”，而应按扩展逐项推进：

1. `wecom`
   当前先保留，除非未来明确切回 bundled `extensions/wecom/**`
2. `mysql-readonly`
   保持单真源，优先向 upstream contracts / public seams 收敛
3. `zentao`
   保持单真源，优先向 upstream contracts / public seams 收敛
4. `superBrower`
   作为最高优先级的能力收敛候选，重点评估与 upstream `browser` 的职责重叠

## 推荐的下一步

如果继续处理，最合理的顺序是：

1. 保持 `Group 2` 原样进入 layering 提交，不再继续拆目录。
2. 单独开 `Group 3` 的收敛计划，不和 layering 混提。
3. 在 `Group 3` 里优先审 `superBrower`，其次是 `mysql-readonly` / `zentao` 的公共 seam 收敛。
4. `wecom` 只在确认切换策略前保持现状，不做“顺手统一”。

`superBrower` 的细化收敛判断见 `/operations/upstream-upgrade-superbrower-convergence`。

`mysql-readonly` 和 `zentao` 的单真源业务工具判断见 `/operations/upstream-upgrade-business-tool-forks`。
