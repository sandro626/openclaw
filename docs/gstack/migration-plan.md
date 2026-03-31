# gstack 到 OpenClaw 的最优迁移方案

## 结论

不要把 `gstack` 当成一个“需要整体搬运的工具”。

`gstack` 的本质是两部分：

1. 一套 persistent browser runtime
2. 一批流程型 `SKILL.md` 工作流

对 OpenClaw 来说，最优方案不是复刻 `gstack` 外壳，而是：

- 保留能力
- 去掉第二套运行时
- 把对话能力收敛到少量可维护的 skill packs
- 把高频方法论吸收到现有业务 agent

最终形态应当是：

- `1` 套浏览器运行时
- `6` 到 `8` 个 `gstack-*` 私有能力包
- `6` 到 `8` 个现有业务 agent 的方法论增强
- `0` 个 `~/.gstack` 运行时依赖

## 为什么不能 1:1 导入

### 1. `gstack` 的 preamble 不适合 OpenClaw

`gstack` 大量 skill 带有统一 preamble，包括：

- update check
- telemetry
- contributor mode
- session tracking
- repo mode
- completeness intro

这些都属于 `gstack` 自己的产品逻辑，不应原样进入 OpenClaw 对话链。

### 2. `browse` 不该成为第二套浏览器运行时

`gstack` 的核心浏览器方案是：

- Bun HTTP server
- localhost daemon
- persistent Chromium
- 项目内状态文件

OpenClaw 现在已经有：

- `extensions/browser`
- `overlay/skills/browser-use`
- `superBrower`

所以最优方案不是再把 `gstack browse` 整套搬进来，而是把缺的能力增量并入现有 browser 体系。

### 3. 很多 gstack skill 本质是“工作流编排”，不是终端用户直接调用的工具

例如：

- `ship`
- `setup-deploy`
- `land-and-deploy`
- `careful`
- `freeze`
- `guard`
- `unfreeze`
- `gstack-upgrade`

这些更适合作为：

- operator-only skill
- repo hook
- 管理员工作流

而不是普通机器人对话技能。

## gstack 能力分层

### A 类：浏览器平台能力

来源：

- `browse`
- `setup-browser-cookies`

最佳落点：

- `extensions/browser` 能力增强
- 辅助 skill 放到 `overlay/skills/gstack-browser-*`

应该迁入的高价值能力：

- 持久化浏览器会话的操作约定
- cookie 导入流程
- 页面前后状态对比
- QA 证据采集流程
- 上传、对话框、截图、snapshot 的 workflow 模板

不应该迁入的部分：

- Bun daemon 外壳
- `~/.gstack/browse.json`
- 第二套浏览器状态目录

### B 类：对话型流程专家

来源：

- `office-hours`
- `autoplan`
- `plan-ceo-review`
- `plan-eng-review`
- `plan-design-review`
- `design-consultation`
- `review`
- `investigate`
- `qa`
- `qa-only`
- `design-review`
- `cso`
- `codex`
- `document-release`
- `retro`

最佳落点：

- `overlay/skills/gstack-*`
- 部分方法论吸收到现有 agent

这里不应该继续保留 `15` 个独立 skill 名。最优收敛是：

1. `gstack-strategy`
2. `gstack-architecture`
3. `gstack-design`
4. `gstack-review`
5. `gstack-investigate`
6. `gstack-qa`
7. `gstack-security`
8. `gstack-release-docs`

### C 类：operator-only 交付流程

来源：

- `ship`
- `setup-deploy`
- `land-and-deploy`
- `canary`
- `benchmark`

最佳落点：

- `overlay/skills/gstack-release-ops`
- `overlay/skills/gstack-deploy-setup`
- operator-only admin skill

这些应默认只给运维/研发角色使用，不直接暴露给普通聊天入口。

### D 类：安全和冻结类控制流

来源：

- `careful`
- `freeze`
- `guard`
- `unfreeze`
- `gstack-upgrade`

最佳落点：

- hook
- repo policy
- admin-only safety skill

这些不建议作为普通用户可调用的聊天技能迁入。

## OpenClaw 里的目标结构

### 1. 插件层

浏览器相关能力优先并入：

- `extensions/browser`

必要时新增 OpenClaw 专用子能力，而不是引入一整套 `gstack` daemon。

### 2. 私有 skill 层

新增 `overlay/skills` 能力包，而不是 27 个原样技能：

- `overlay/skills/gstack-strategy`
- `overlay/skills/gstack-architecture`
- `overlay/skills/gstack-design`
- `overlay/skills/gstack-review`
- `overlay/skills/gstack-investigate`
- `overlay/skills/gstack-qa`
- `overlay/skills/gstack-security`
- `overlay/skills/gstack-release-ops`
- `overlay/skills/gstack-release-docs`
- `overlay/skills/gstack-browser-login`

### 3. agent 方法论层

高频能力应直接吸收到现有 agent：

| 现有 agent         | 应吸收的 gstack 能力                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `pc-ceo_assistant` | `office-hours`, `plan-ceo-review`, `document-release` 的高管摘要视角 |
| `pc-pm`            | `autoplan`, `plan-design-review`, `design-consultation`              |
| `cto`              | `plan-eng-review`, `review`, `cso`                                   |
| `dev`              | `review`, `investigate`, `codex`, `qa`                               |
| `ops`              | `ship`, `canary`, `benchmark`, `retro` 的运营/交付变体               |
| `pc-code_reviewer` | `review`, `codex`                                                    |
| `pc-pctester`      | `qa`, `qa-only`, `design-review`                                     |

### 4. runtime 层

运行态只保留：

- 浏览器登录态
- review 基线
- deploy 目标
- 历史会话
- 证据截图和输出

不引入：

- `~/.gstack/*`
- gstack telemetry
- gstack contributor logs

## 分阶段迁移

### Phase 0: 清点与去重

先把 `27` 个 top-level gstack skill 逐项映射，不做导入。

输出物：

- 一份完整映射矩阵
- 一份重叠清单

### Phase 1: 浏览器能力收敛

先处理最底层能力：

1. 核查 OpenClaw `browser` 已有能力
2. 找出 `gstack browse` 的缺口
3. 只迁“增量”

这一阶段完成后，OpenClaw 不应出现第二套浏览器 runtime。

### Phase 2: skill packs 落地

把 gstack 流程能力收敛成少量 `overlay/skills/gstack-*`。

优先顺序：

1. `gstack-review`
2. `gstack-qa`
3. `gstack-strategy`
4. `gstack-investigate`
5. `gstack-security`

### Phase 3: 吸收到现有 agent

把高频方法论补进现有 agent workspace：

- `pc-ceo_assistant`
- `pc-pm`
- `cto`
- `dev`
- `ops`
- `pc-code_reviewer`
- `pc-pctester`

这样用户对话时直接调用现有机器人，不需要记住一堆新的 `gstack-*` 账户。

### Phase 4: staging 验证

在 `staging` 只接：

- `1` 个浏览器能力增强
- `2` 到 `3` 个 `gstack-*` skill packs
- `2` 个吸收后的现有业务 agent

验证项：

- 路由是否正确
- 技能是否能被 agent 调用
- 浏览器能力是否不与现有 `browser` 冲突
- 不会把 runtime 数据回流到 repo

### Phase 5: live 渐进接入

先从这几类 live 接入：

1. `pc-ceo_assistant`
2. `pc-pm`
3. `cto`
4. `pc-pctester`

原因：

- 对话价值最高
- 与现有角色天然对位
- 比直接开放 operator workflow 更安全

## 最优迁移顺序

如果目标是“尽快给机器人可用，而且长期可维护”，顺序应是：

1. `browse` 能力缺口分析
2. `review + investigate + qa`
3. `office-hours + plan-ceo-review + plan-eng-review`
4. `document-release + retro`
5. `ship + canary + setup-deploy + land-and-deploy`
6. `careful/freeze/guard` 的 admin 化

## 不做的事情

以下方案不是最优，不建议采用：

- 把 `gstack` 27 个 skill 原样复制进 `overlay/skills`
- 在 OpenClaw runtime 里再起一套 `gstack browse` daemon
- 让普通聊天入口直接调用 `ship`、`freeze`、`guard`
- 把 `gstack` telemetry / contributor mode 搬到 OpenClaw
- 继续新增一批与现有 `pc-*`、`ops`、`dev` 重叠的账户

## 推荐的最终形态

最终建议收敛成：

- `1` 套浏览器平台
- `8` 个左右的 `gstack-*` 私有技能
- `7` 个现有业务 agent 的方法论增强
- `1` 组 operator-only 运维流程技能

这套形态最符合 OpenClaw 现在的架构，也最适合“给机器人和人对话使用”。
