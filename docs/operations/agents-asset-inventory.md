# OpenClaw Agents 资产清单

## 目标

在不调整 core 的前提下，先把 agent 相关资产拆清楚，明确以下几类内容分别属于哪里：

- agent 静态定义
- workspace 静态骨架
- 运行态配置
- sessions
- memory 文件
- memory 索引

本文的目的，是避免继续把 agent 资产、运行数据与业务工作区混在一起。

相关文档：

- [Runtime Unification](/operations/runtime-unification)
- [Workspace Migration](/operations/workspace-migration)
- [Runtime Diff Classification](/operations/runtime-diff-classification)
- [Deploy Protection](/operations/deploy-protection)
- [Overlay Agents Migration](/operations/overlay-agents-migration)
- [Production Runtime Migration Runbook](/operations/production-runtime-migration-runbook)

## 当前现状

### 1. agent 静态定义与运行态分离不彻底

生产环境中的 agent 目录位于：

`~/.openclaw/agents/<agentId>/`

但这里实际混放了：

- agent 运行配置
- auth 配置
- model 配置
- sessions

这意味着 agent 目录当前更接近运行态目录，而不是纯静态定义目录。

补充说明：

- 仓库中的 `overlay/agents` 已收口为静态骨架层
- 仓库中的 `server-config/agents` 已退出当前活跃树，只保留归档说明，不再承担真源职责
- 服务器 runtime 的当前 agent / workspace / legacy sessions 盘点，建议统一由 `pnpm ops:audit-runtime-layout` 生成，而不是继续手工维护多份清单

### 2. workspace 承担了过多职责

生产环境中的 workspace 目录位于：

`~/.openclaw/workspace/`

这里同时存在：

- 根工作区文件
- 各 agent 子工作区
- 业务文档
- 测试脚本
- 技能副本
- 依赖目录
- memory 文件

这说明 workspace 当前同时承担了：

- agent 静态骨架
- 业务项目目录
- 运行输出目录
- 技能试验区

### 3. memory 已经分散在多层

生产环境中可见：

- workspace 下的 `memory/`
- 某些 agent workspace 下的 `memory/`
- 某些 workspace 下的 `MEMORY.md`
- `~/.openclaw/memory/*.sqlite` 索引文件
- 个别 agent 目录下仍保留 `workspace/` 与 `memory/` 风格残留

这意味着 memory 的文件层和检索层目前并没有统一的归属边界。

## 第一轮盘点结果

### 生产环境可见的 agent 类型

当前已确认生产环境中存在多类 agent：

- 通用主 agent，例如 `main`
- 功能型 agent，例如 `dev`、`ops`
- 专业角色 agent，例如 `pc-frontend`、`pc-backend`、`pc-code_reviewer`、`pc-pctester`
- 业务角色 agent，例如 `pc-ceo_assistant`、`pc-ip_expert` 等

说明当前 agent 体系已从单一主 agent 演化为多 agent 协作体系。

### workspace 中已存在按 agent 划分的目录

当前生产环境已确认存在大量以 agent 命名的 workspace 子目录，例如：

- `pc-frontend`
- `pc-backend`
- `pc-code_reviewer`
- `pc-pctester`
- `pc-devops`
- `pc-ceo_assistant`

这些目录通常已经包含：

- `AGENTS.md`
- `IDENTITY.md`
- `BOOTSTRAP.md`
- `TOOLS.md`
- 其他骨架文件

说明 agent 的静态工作区模板已经部分形成，但仍与其他运行态内容混放。

### 部分 agent 已有 memory 目录，部分没有

当前生产环境中，不是所有 agent workspace 都具备一致的 memory 结构：

- 某些 agent 下已有 `memory/`
- 某些 agent 下已有 `MEMORY.md`
- 某些 agent 仍缺少统一 memory 结构

这也是后续 memory 治理必须单独处理的原因。

### agent 目录中仍存在 workspace 风格残留

盘点表明，至少个别 agent 目录下仍存在 `workspace/` 风格子目录。这说明过去曾存在多套 agent 工作区布局，没有完全收敛。

## 最新核查快照

### 本地仓库状态

按当前仓库核查结果：

- `pnpm check:repo-layering` 已通过
- `skills/*` 与 `overlay/skills/*` 已不存在同名双真源
- `extensions/*` 与 `overlay/extensions/*` 只剩 `feishu`、`wecom` 这两个文档允许的重叠
- `server-config/*` 已退场为 README-only
- `overlay/agents/*/workspace/` 当前只保留白名单静态骨架文件
- `runtime-templates/agents/environments/prod.json` 当前已收口为 `22` 个生产唯一 agent，并显式保留 `pc-ai-pythondev`、`pc-yz-app-*`、`yz-app-*`

说明本地仓库的三层边界已经基本收口，后续重点转向服务器 runtime 对位与迁移。

### 服务器 runtime 与仓库模板的最新对位

最新一次按服务器真实 `openclaw.json` 的核查结果：

- 服务器原始 `agents.list` 当前有 `26` 条配置项
- 去重后为 `22` 个唯一 agent
- 重复 id 目前仅有 `yz-app-pm`、`yz-app-javadev`、`yz-app-appdev`、`yz-app-aidev`
- 这 `4` 个 `yz-app-*` 是需要保留的真实用户，不应被当成历史 agent 清理
- 仓库中的 `runtime-templates/agents/environments/prod.json` 现在以 `22` 个唯一 agent 作为 canonical 真源，不再把重复条目原样带回仓库

当前生产唯一 agent 包括：

- `main`、`cto`、`dev`、`tester`、`ops`
- `pc-pm`、`pc-backend`、`pc-frontend`、`pc-pctester`
- `pc-ceo_assistant`、`pc-code_reviewer`、`pc-devops`、`pc-ip_expert`
- `pc-ai-pythondev`
- `pc-yz-app-pm`、`pc-yz-app-javadev`、`pc-yz-app-appdev`、`pc-yz-app-aidev`
- `yz-app-pm`、`yz-app-javadev`、`yz-app-appdev`、`yz-app-aidev`

这说明：

- 当前生产运行态和仓库模板已经能按 `22` 个唯一 agent 对位
- 服务器配置层的剩余问题，主要是 `yz-app-*` 的重复配置项需要后续去重，而不是这些 agent 需要退休
- 服务器活跃 runtime 下的历史 agent sessions 已在迁移窗口中归档，不再作为当前生产清单的一部分

### 服务器上仍存在的 host-local skill 源目录

服务器 `root` 用户下仍可见一批 `.claude/skills/*` 目录，例如：

- `attendance-video-fix`
- `message-exception-audit`
- `video-fix`
- `yz-build`
- `yz-code-review`
- `yz-dev`
- `yz-dev-java`
- `yz-service`
- `yz-test-java`

当前进度：

- `yz-build`、`yz-dev-java`、`yz-test-java` 已回迁到 `overlay/skills/*`
- 其余 `attendance-video-fix`、`message-exception-audit`、`video-fix`、`yz-code-review`、`yz-dev`、`yz-service` 仍是服务器侧私有 skill，后续需要逐项判断是回迁、归档还是退休

## agent 资产分类规则

### A 类：agent 静态定义资产

特征：

- 可以进入源码仓库
- 用于定义 agent 身份、职责和骨架
- 不包含真实运行数据

典型内容：

- `AGENTS.md`
- `IDENTITY.md`
- workspace 骨架模板
- 默认引导文件

目标位置：

- `overlay/agents/<agentId>/`

### B 类：运行态模板

特征：

- 用于渲染实际运行环境
- 不应包含真实 secrets 与真实会话数据

典型内容：

- agent 列表模板
- channel 到 agent 绑定模板
- workspace 命名模板
- memory 启用模板

目标位置：

- `runtime-templates/agents/*`

当前仓库口径：

- `runtime-templates/agents/base.json` 承载共享 `agents.defaults`
- `runtime-templates/agents/environments/<env>.json` 承载环境下的 agent 激活列表
- `runtime-templates/agents/bindings/base.json` 与 `bindings/environments/<env>.json` 承载 channel -> agent 路由绑定
- `runtime-templates/agents/skill-resolution.json` 显式记录 server alias、外部内置 skill、server-local runtime-only skill，以及当前仅在服务器配置中可见但尚未找回源码的 skill id
- `runtime-templates/agents/<agentId>/config.patch.json` 承载每个 agent 的非敏感默认补丁

### C 类：运行态真实数据

特征：

- 随线上运行持续变化
- 不能直接进入源码仓库

典型内容：

- sessions
- 真实 workspace 输出
- memory 文件
- memory 索引
- auth 配置
- 临时生成文件

目标位置：

- 生产 runtime 目录

### D 类：历史残留与布局漂移

特征：

- 旧版目录布局
- 重复 workspace
- agent 目录中残留的旧工作区结构

处理方式：

- 保留证据
- 迁移后统一清理

## 目标目录规划

### 1. agent 静态定义

`overlay/agents/<agentId>/`

用途：

- agent 身份定义
- 骨架模板
- 默认静态文件

### 2. agent 运行态模板

`runtime-templates/agents/*`

用途：

- 多环境 agent 列表模板
- agent 绑定关系模板
- workspace 规范模板

### 3. 生产运行态

运行态仍保留在独立 runtime 目录中，例如：

- `~/.openclaw/agents/<agentId>/`
- `~/.openclaw/workspace/<agentId>`
- `~/.openclaw/memory/*`

这些目录不应直接当成源码目录使用。

## 迁移原则

### 静态定义与运行态数据分离

后续每个 agent 都要能回答四个问题：

- 静态定义在哪里
- 运行配置模板在哪里
- 实际 workspace 在哪里
- 实际 sessions 和 memory 在哪里

### workspace 不是源码仓库

workspace 应只承担工作区与运行输出职责，不再作为：

- 技能源码库
- agent 模板仓库
- 业务脚本长期真源

### sessions 与 memory 永不入库

以下内容必须继续视为运行态数据：

- `sessions/*.jsonl`
- `sessions/sessions.json`
- `memory/*.md`
- `MEMORY.md`
- `~/.openclaw/memory/*.sqlite`

### 历史布局先保留证据，再清理

对于 agent 目录中残留的旧 `workspace/`、旧 memory 布局或重复骨架：

- 先记录
- 再迁移
- 最后清理

## 建议的第一批治理对象

建议按以下顺序推进：

1. `main`
2. `pc-code_reviewer`
3. `pc-pctester`
4. `pc-frontend`
5. `pc-backend`

原因：

- `main` 是运行态总入口
- `pc-code_reviewer`、`pc-pctester`、`pc-frontend` 已经暴露出 memory 与路由问题
- `pc-backend` 属于典型专业角色 agent，适合作为模板化对象

## 验收标准

完成 agent 资产治理第一阶段后，至少应满足：

- 每个 agent 的静态定义目录明确
- 每个 agent 的运行模板目录明确
- 每个 agent 的实际 workspace 路径唯一
- sessions 与 memory 被明确排除在源码仓库之外
- 历史布局漂移已被记录，可进入迁移阶段

## 后续建议

在本文之后，建议补一份 agent 映射表，字段至少包括：

- `agentId`
- 静态定义路径
- 模板路径
- 运行 workspace
- sessions 路径
- memory 文件路径
- memory 索引路径
- 绑定的 channel/account
