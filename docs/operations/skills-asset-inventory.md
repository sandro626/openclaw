# OpenClaw Skills 资产清单

## 目标

在不调整 core 的前提下，先把技能资产统一盘点清楚，并明确哪些技能属于：

- OpenClaw 主仓技能
- 团队私有业务技能
- 配置目录中的历史副本
- 第三方整包或外部项目镜像
- 运行态工作区中的临时技能

本文是后续技能迁移到 overlay 与 runtime 模板目录的依据。

相关文档：

- [Runtime Unification](/operations/runtime-unification)
- [Runtime Diff Classification](/operations/runtime-diff-classification)
- [Extensions Asset Inventory](/operations/extensions-asset-inventory)
- [Deploy Protection](/operations/deploy-protection)

## 当前现状

### 1. 主仓技能目录

当前仓库的主技能目录位于：

`skills/*`

这里既包含上游通用技能，也包含团队后续新增的长期技能。

### 2. 配置目录中的技能集合

当前仓库还存在：

`server-config/skills/*`

这里已经不是单纯的模板目录，而是混入了：

- 业务专属技能
- 飞书与企业办公相关技能
- 自动化工作流技能
- 第三方整包技能
- 带 `.git` 的外部项目镜像

这说明 `server-config/skills` 当前承担了“私有技能仓库”的角色，不应长期继续保留这种状态。

### 3. 运行态工作区中的技能副本

从生产环境盘点看，workspace 下已经存在技能样式目录，例如：

- 工作区内自带 `SKILL.md` 的业务目录
- 直接放在 workspace 下的技能副本
- 混在工作区中的业务脚本和模板

这些内容说明技能资产与运行态工作区已经发生混放。

## 第一轮盘点结果

### 本地主仓中的团队相关技能

当前主技能目录中，以下更接近团队私有或业务相关能力：

- `skills/browser-use`
- `skills/dev-openclaw`
- `skills/mysql-readonly`
- `skills/superBrower`
- `skills/zentao`

它们不一定都应该保留在主仓技能目录中，后续需要明确是否迁入 overlay。

### `server-config/skills` 中的重点业务技能

当前已确认一批明显业务化、企业化或环境化的技能集合，例如：

- `agent-council`
- `agent-orchestrator`
- `aliyun-oss-upload`
- `automation-workflows`
- `chandao`
- `dingtalk-feishu-cn`
- `feishu-contacts`
- `feishu-doc-guide`
- `feishu-doc-manager`
- `lark-integration`
- `manage-platform-test`
- `memory`
- `memory-lite`
- `ppt-creator`
- `proactive-agent`
- `self-improving-agent`
- `weather-cn`

这些技能大多不适合作为主仓通用技能，应优先视为 overlay 资产候选。

### `server-config/skills` 中存在第三方整包与外部镜像

盘点已确认：

- 某些技能目录自带 `.git`
- 某些技能本身像完整外部项目而不是轻量 skill
- 某些技能包含大量脚本、模板、文档和独立生命周期

这类内容不应长期继续散落在 `server-config/skills` 中，应单独归类为：

- 私有技能整包
- 外部依赖镜像
- 待归档资产

### 运行态工作区中存在技能形态资产

生产 workspace 中已经出现：

- 直接带 `SKILL.md` 的业务目录
- 工作区中的模板、脚本、输出产物混放

这意味着当前需要把“技能源码”和“技能运行输出”彻底区分开。

## 技能分类规则

### A 类：主仓通用技能

特征：

- 能力通用
- 对 OpenClaw 用户群体有普适价值
- 不依赖单一企业环境

目标位置：

- `skills/<name>`

### B 类：私有业务技能

特征：

- 与企业流程、办公系统、私有平台、专属工作流强绑定
- 不适合作为主仓通用技能

目标位置：

- `overlay/skills/<name>`

### C 类：配置目录中的历史技能副本

特征：

- 当前位于 `server-config/skills/*`
- 事实上承担了技能源码真源职责

处理方式：

- 迁出 `server-config`
- 根据归属合并进主仓技能或 overlay 技能

### D 类：外部整包或第三方镜像

特征：

- 自带 `.git`
- 包含独立安装脚本或完整项目结构
- 版本节奏独立于主仓

处理方式：

- 不继续混放在配置目录中
- 单独记录来源
- 视情况独立仓库化或归档

### E 类：运行态技能副本

特征：

- 位于 workspace
- 和输出文件、运行脚本、实验产物混放

处理方式：

- 从运行态目录中剥离出技能源码
- 仅保留真正的运行输出在 workspace

## 目标目录规划

### 1. 主仓通用技能

`skills/*`

用途：

- OpenClaw 主仓技能
- 团队决定保留在主仓的长期技能

### 2. 私有 overlay 技能

`overlay/skills/*`

用途：

- 团队私有业务技能
- 环境特定技能
- 不准备随主仓一同升级的技能

### 3. 技能运行态模板

`runtime-templates/skills/*`

用途：

- 技能启用模板
- 技能配置样例
- 技能环境变量示例

这里不放：

- 技能源码
- 真实 API key
- 工作区输出文件

## 迁移原则

### 不把 `server-config/skills` 继续当真源

后续必须明确：

- 哪些技能保留在 `skills/*`
- 哪些技能迁移到 `overlay/skills/*`
- 哪些技能只保留模板
- 哪些技能应归档

### 技能源码与工作区输出分离

如果某个技能在 workspace 中直接写文档、脚本、产物，应分开管理：

- 技能定义与模板在源码层
- 运行输出在 workspace

### 第三方整包单独治理

对于自带 `.git` 或明显是外部项目镜像的技能：

- 不直接按普通 skill 对待
- 先记录来源和用途
- 再决定是独立仓库化、子模块化，还是归档

## 建议的第一批治理对象

建议按以下顺序推进：

1. 飞书相关技能组
2. memory 相关技能组
3. 自动化工作流技能组
4. 测试/办公/报表类业务技能组
5. 第三方整包技能组

原因：

- 飞书和 memory 直接影响现网协作方式
- 自动化与测试类技能与当前业务交付强相关
- 第三方整包是后续升级和维护风险最大的部分

## 验收标准

完成技能资产治理第一阶段后，至少应满足：

- 每个技能都能说清楚真源目录
- `server-config/skills` 不再承担正式源码真源职责
- 业务技能与通用技能边界明确
- 运行态 workspace 中不再承担技能源码仓库职责

## 后续文档

在本文之后，建议继续维护一份技能迁移映射表，字段至少包括：

- 技能名
- 当前路径
- 目标路径
- 分类
- 是否带外部来源
- 是否影响现网
