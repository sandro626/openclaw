# OpenClaw Extensions 资产清单

## 目标

在不调整 core 的前提下，先把扩展资产统一盘点清楚，并明确哪些扩展属于：

- OpenClaw 主仓扩展
- 业务私有扩展
- 配置目录中的历史副本
- 运行态相关绑定，而不是源码资产

本文是后续扩展迁移到 overlay 目录与部署模板目录的依据。

相关文档：

- [Runtime Unification](/operations/runtime-unification)
- [Runtime Diff Classification](/operations/runtime-diff-classification)
- [Runtime Unification Checklist](/operations/runtime-unification-checklist)
- [Deploy Protection](/operations/deploy-protection)

## 当前现状

### 1. 正式扩展目录

当前仓库的正式扩展位于：

`extensions/*`

这里同时包含：

- OpenClaw 上游已有扩展
- 团队新增或长期维护的扩展

### 2. 配置目录中的扩展副本

当前仓库还存在：

`server-config/extensions/*`

这部分不是纯配置，而是夹带了完整扩展源码、副属技能、依赖目录和环境相关文件。它使 `server-config` 同时承担了：

- 配置模板目录
- 私有扩展仓库
- 临时集成区

这是当前扩展治理最需要先修的边界问题。

### 3. 生产回收快照中的扩展集合

生产回收快照中的扩展集合与本地仓库并不完全一致，说明：

- 生产环境启用的扩展集合与本地维护集合存在漂移
- 某些扩展是上游演进差异
- 某些扩展是本地新增资产
- 某些扩展在源码树与配置树中重复存在

## 第一轮盘点结果

### 本地正式扩展目录中已确认的业务相关扩展

以下扩展应优先视为团队重点治理对象：

- `extensions/feishu`
- `extensions/wecom`
- `extensions/mysql-readonly`
- `extensions/superBrower`
- `extensions/zentao`

其中：

- `feishu` 与 `wecom` 是最核心的企业消息入口
- `mysql-readonly`、`zentao` 更接近业务工具扩展
- `superBrower` 属于团队新增能力，应按私有扩展对待

### `server-config/extensions` 中的扩展副本

当前已确认：

- `server-config/extensions/feishu`
- `server-config/extensions/wecom`

这两套目录不应长期继续作为扩展源码真源。

当前仓库进度：

- `server-config/extensions/wecom` 已退出当前活跃树，并先归档到本地 `.artifacts/ops/archive/server-config-extensions/wecom-<timestamp>/`
- `server-config/extensions/feishu` 已退出当前活跃树，并先归档到本地 `.artifacts/ops/archive/server-config-extensions/feishu-<timestamp>/`

### 生产快照与本地正式扩展的显著差异

第一轮盘点表明：

- 生产快照中扩展集合与本地正式扩展并不完全一致
- Feishu 扩展差异量很大
- 某些扩展的存在与否更像上游版本差异，而不是业务资产差异

因此在扩展治理中要避免两种误判：

- 把上游扩展演进误认成业务私有资产
- 把 `server-config/extensions` 中的副本继续当成正式源码

当前判断补充：

- `wecom` 已具备退休 `server-config` 副本的条件
- `feishu` 的旧 onboarding 逻辑已被当前 `extensions/feishu/src/setup-surface.ts` 接管，仓库层副本可以退休
- `extensions/feishu`、`extensions/mysql-readonly`、`extensions/superBrower`、`extensions/zentao` 当前仍是源码真源
- `overlay/extensions/wecom` 当前保留为显式加载的私有分叉
- `overlay/extensions/feishu` 目前仍是预留接收位，不是活跃构建入口
- `overlay/extensions/mysql-readonly`、`overlay/extensions/superBrower`、`overlay/extensions/zentao` 的过时镜像副本已退休，避免继续形成第二份源码树
- 装配脚本已切换为“显式 `plugins.load.paths`”模式；overlay 下存在可加载目录不再等于默认启用
- 当前默认模板只显式加载 `overlay/extensions/wecom`；`overlay/extensions/feishu` 仍保持预留状态

## 扩展分类规则

### A 类：主仓正式扩展

特征：

- 应该长期随 OpenClaw 主仓构建
- 属于产品级扩展或团队决定长期维护的扩展
- 应放在 `extensions/*`

### B 类：业务私有扩展

特征：

- 与企业内部系统、业务流程、私有接入有关
- 不适合作为上游主仓通用能力
- 应放在 overlay 层管理

推荐目标路径：

- `overlay/extensions/<name>`

### C 类：配置侧扩展副本

特征：

- 当前位于 `server-config/extensions/*`
- 实际上是源码副本，不应继续混在配置目录

处理方式：

- 迁出 `server-config`
- 合并回正式扩展目录或迁入 overlay 目录

### D 类：运行态绑定

特征：

- 与账号、agent、workspace、enable 状态、token 或 endpoint 绑定有关
- 不是扩展源码

处理方式：

- 不进入扩展源码目录
- 收敛到 runtime 配置模板或实际运行配置

## 目标目录规划

后续扩展应按以下结构管理：

### 1. 主仓扩展

`extensions/*`

用途：

- OpenClaw 主仓扩展
- 团队决定继续直接放在主仓维护的扩展

### 2. 私有 overlay 扩展

`overlay/extensions/*`

用途：

- 团队自有业务扩展
- 尚不准备并入主仓的扩展
- 与企业环境强绑定的扩展

### 3. 运行态模板

`runtime-templates/extensions/*`

用途：

- 扩展启用列表模板
- 扩展配置模板
- 环境变量示例

这里不放：

- 扩展源码
- 真实 token
- 真实账号映射

### 4. 部署入口

`deploy/*`

用途：

- 将主仓扩展、overlay 扩展与 runtime 模板组装到目标环境

## 迁移原则

### 不直接删除 `server-config/extensions`

正确做法应为：

1. 盘点
2. 分类
3. 迁移到正式目标路径
4. 调整部署入口
5. 验证运行
6. 最后才清理旧副本

`wecom` 和 `feishu` 已完成这条链路的仓库层收口；后续重点转向 `server-config/skills` 和运行态模板。

### 先统一真源，再统一部署

如果某个扩展同时存在于：

- `extensions/<name>`
- `server-config/extensions/<name>`

必须先明确哪一份是后续真源，再处理部署。

如果某个扩展同时存在于：

- `extensions/<name>`
- `overlay/extensions/<name>`

也必须先明确：

- 当前构建和安装入口是哪一份
- overlay 是占位接收位、私有分叉，还是已经完成切换的正式真源

在未完成切换前，不要把同名 `overlay/extensions/<name>` 当成第二份活跃源码。

如果 overlay 下的同名目录既没有独立业务分叉，也没有进入当前 runtime 加载链路，应优先直接退休，而不是长期保留镜像源码。

### 扩展源码与扩展配置分离

后续每个扩展都要能区分：

- 源码在哪
- 构建产物从哪来
- 配置模板在哪
- 生产运行配置从哪渲染

## 建议的第一批治理对象

建议按以下顺序推进：

1. `feishu`
2. `wecom`
3. `mysql-readonly`
4. `zentao`
5. `superBrower`

原因：

- `feishu` 与 `wecom` 直接影响现网入口
- `mysql-readonly` 与 `zentao` 明显属于业务专用能力
- `superBrower` 是团队新增资产，应尽早确定归属

## 验收标准

完成扩展资产治理第一阶段后，至少应满足：

- 每个扩展都能说清楚其真源目录
- `server-config/extensions` 不再承担正式源码真源职责
- 私有业务扩展有明确 overlay 落点
- 扩展源码、扩展模板、运行态配置三者边界清楚

当前补充：

- `server-config/extensions/wecom` 已不再承担活跃真源职责
- `server-config/extensions/feishu` 已不再承担活跃真源职责
- 当前活跃 overlay 扩展只剩 `wecom`；`feishu` 保留为预留接收位
- `mysql-readonly`、`superBrower`、`zentao` 已收口回 `extensions/*` 单真源

## 后续文档

在本文之后，建议继续补两份文档：

- `skills-asset-inventory`
- `agents-asset-inventory`

这样才能把非 core 资产完整收拢到统一目录结构中。
