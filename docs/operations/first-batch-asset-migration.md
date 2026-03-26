# OpenClaw 第一批资产归位清单

## 目标

在不调整 core 的前提下，先处理第一批最关键的非 core 资产，把后续迁移顺序和目标路径固定下来。

本阶段只覆盖以下三块：

- `feishu`
- `wecom`
- `server-config/skills`

本阶段的目标不是立刻大规模搬迁代码，而是先明确：

- 哪些目录是候选真源
- 哪些目录只是历史副本
- 哪些内容要迁入 overlay
- 哪些内容只应保留为 runtime 模板

相关文档：

- [Extensions Asset Inventory](/operations/extensions-asset-inventory)
- [Skills Asset Inventory](/operations/skills-asset-inventory)
- [Agents Asset Inventory](/operations/agents-asset-inventory)
- [Runtime Unification Checklist](/operations/runtime-unification-checklist)

## 第一批范围

### 1. Feishu

当前候选来源：

- `extensions/feishu`
- `server-config/extensions/feishu`
- 生产运行配置中的 Feishu 绑定与启用状态

当前判断：

- `extensions/feishu` 应视为正式扩展主线候选
- `server-config/extensions/feishu` 应视为历史副本候选
- 真实账号绑定与启用状态不属于扩展源码

本阶段动作：

1. 以 `extensions/feishu` 作为后续正式治理入口
2. 把 `server-config/extensions/feishu` 标记为待拆分副本
3. 将运行态账号、agent 绑定、启用配置规划到 `runtime-templates/extensions/`
4. 在 `overlay/extensions/feishu/` 建立私有定制接收位

### 2. WeCom

当前候选来源：

- `extensions/wecom`
- `server-config/extensions/wecom`
- 生产运行配置中的 WeCom 绑定与启用状态

当前判断：

- `extensions/wecom` 应视为正式扩展主线候选
- `server-config/extensions/wecom` 应视为历史副本候选
- 真实企业号配置不属于扩展源码

本阶段动作：

1. 以 `extensions/wecom` 作为后续正式治理入口
2. 把 `server-config/extensions/wecom` 标记为待拆分副本
3. 将 WeCom 运行态模板规划到 `runtime-templates/extensions/`
4. 在 `overlay/extensions/wecom/` 建立私有定制接收位

### 3. `server-config/skills`

当前判断：

- `server-config/skills` 不是单纯模板目录
- 它当前实际承载了大量业务技能、第三方整包和外部镜像
- 这部分必须优先剥离出配置目录

本阶段动作：

1. 把其中业务技能视为 `overlay/skills/` 候选
2. 把其中真正的模板输入规划到 `runtime-templates/skills/`
3. 把带 `.git` 或明显外部整包的目录单独标记为外部来源
4. 暂不删除 `server-config/skills`，等映射完成后再做迁移

## 目标目录

第一批归位完成后，应形成以下明确落点：

- `extensions/feishu`
- `extensions/wecom`
- `overlay/extensions/feishu`
- `overlay/extensions/wecom`
- `overlay/skills/`
- `runtime-templates/extensions/`
- `runtime-templates/skills/`

## 真源判定规则

### 扩展源码

优先原则：

1. 正式扩展目录优先于 `server-config` 中的副本
2. `server-config/extensions/*` 默认为历史副本，除非明确发现正式目录缺失关键能力
3. 运行态配置永远不能倒逼成为源码真源

### 技能源码

优先原则：

1. 通用技能留在 `skills/*`
2. 业务技能迁入 `overlay/skills/*`
3. `server-config/skills/*` 默认为待拆分来源，不再作为长期真源

## 本阶段输出物

本阶段应至少产出：

- `overlay/extensions/feishu/`
- `overlay/extensions/wecom/`
- `overlay/skills/feishu-suite/`
- `overlay/skills/ops-workflows/`
- `overlay/skills/external-bundles/`
- 对应的说明文件

这些目录先作为治理入口，不代表此刻已经完成代码搬迁。

## 下一步执行顺序

### 1. 处理 Feishu / WeCom 扩展

先做内容级映射：

- 主仓正式扩展保留什么
- `server-config` 副本里有哪些私有差异
- 哪些差异应迁入 `overlay/extensions/*`
- 哪些差异应转成 runtime 模板

### 2. 处理 `server-config/skills`

按以下四类拆分：

- 主仓通用技能
- overlay 业务技能
- runtime 模板
- 外部整包或归档资产

### 3. 最后才处理 agent 模板

等扩展和技能的落点稳定后，再把 agent 静态定义和运行态模板补到对应目录。

## 验收标准

第一批归位启动完成后，至少应满足：

- 已为 Feishu / WeCom / 技能建立正式接收位
- 已明确 `server-config` 不再承担长期源码真源职责
- 后续迁移有固定落点，不再临时找目录
