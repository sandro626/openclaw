# Overlay Agents 分类与迁位方案

## 目标

`overlay/agents` 要回到“静态骨架层”，但不能丢掉已经存在的历史记录、工作区状态和运行配置。

本方案的目标不是删除历史，而是把这些内容迁到正确的层级：

- 静态骨架留在 `overlay/agents`
- 可渲染模板进入 `runtime-templates`
- 活的运行态进入服务器 runtime
- 历史证据进入备份目录

相关文档：

- [Agents Asset Inventory](/operations/agents-asset-inventory)
- [Runtime Unification](/operations/runtime-unification)
- [Workspace Migration](/operations/workspace-migration)
- [Deploy Protection](/operations/deploy-protection)

## 本次仓库迁位结果

当前仓库已经完成两项直接收口动作：

- `overlay/agents/*/agent/*.json` 已退出当前树
- `overlay/agents/pc-pctester/workspace/SESSION-STATE.md` 与 `workspace/memory/**` 已退出当前树
- `server-config/agents` 已退出当前活跃树，并先归档到本地 `.artifacts/ops/archive/server-config-agents_<timestamp>/`

同时新增了两个长期落点：

- `runtime-templates/agents/<id>/config.patch.json`
- `overlay/agents/<id>/workspace/IDENTITY.md` 与 `BOOTSTRAP.md`

另外，`overlay/agents/<id>/` 与 `runtime-templates/agents/<id>/config.patch.json` 现在要求显式一一对应：

- 有静态骨架就必须有对应模板目录
- 没有默认配置也要显式写成空对象 `{}`，不再依赖“缺文件”等于没配置

这次动作只修正源码层归属，不会覆盖服务器上的真实历史。

## 迁位前快照

基于当前仓库快照，`overlay/agents` 可见两组事实：

### 文件系统中仍存在的内容

- `runtime_auth`: 10
- `runtime_auth_profiles`: 11
- `runtime_config`: 4
- `runtime_models`: 13
- `workspace_memory`: 1
- `workspace_state`: 1
- `workspace_static`: 2

说明当前磁盘上仍以运行配置为主，静态骨架很少，且只有 `pc-pctester` 在 `workspace/` 下保留了实际文件。

### git 状态中仍能看到的历史追踪内容

- `session_history`: 61
- `runtime_auth`: 10
- `runtime_config`: 3
- `runtime_models`: 13
- `workspace_state`: 1
- `workspace_static`: 1

说明虽然当前工作树里多数 `sessions/` 文件已经不存在，但仓库仍保留了明确的历史追踪痕迹。迁位时必须把它们视为“待归档历史”，而不是简单噪音。

## 分类规则

| 路径模式                                         | 分类                   | 真源归属           | 目标位置                                                                           | 处理方式                   |
| ------------------------------------------------ | ---------------------- | ------------------ | ---------------------------------------------------------------------------------- | -------------------------- |
| `overlay/agents/<id>/workspace/AGENTS.md`        | 静态骨架               | overlay            | `overlay/agents/<id>/workspace/`                                                   | 保留                       |
| `overlay/agents/<id>/workspace/IDENTITY.md`      | 静态骨架               | overlay            | `overlay/agents/<id>/workspace/`                                                   | 保留                       |
| `overlay/agents/<id>/workspace/BOOTSTRAP.md`     | 静态骨架               | overlay            | `overlay/agents/<id>/workspace/`                                                   | 保留                       |
| `overlay/agents/<id>/workspace/USER.md`          | 静态骨架               | overlay            | `overlay/agents/<id>/workspace/`                                                   | 保留                       |
| `overlay/agents/<id>/workspace/TOOLS.md`         | 静态骨架               | overlay            | `overlay/agents/<id>/workspace/`                                                   | 保留                       |
| `overlay/agents/<id>/workspace/SESSION-STATE.md` | 工作区运行态           | runtime            | `~/.openclaw/workspace/<id>/SESSION-STATE.md`                                      | 迁出 overlay，保留历史备份 |
| `overlay/agents/<id>/workspace/memory/**`        | workspace 记忆运行态   | runtime            | `~/.openclaw/workspace/<id>/memory/`                                               | 迁出 overlay，保留历史备份 |
| `overlay/agents/<id>/agent/auth.json`            | 运行态 auth            | runtime            | `~/.openclaw/agents/<id>/agent/auth.json`                                          | 不再留 overlay             |
| `overlay/agents/<id>/agent/auth-profiles.json`   | 运行态 auth + 使用状态 | runtime            | `~/.openclaw/agents/<id>/agent/auth-profiles.json`                                 | 不模板化原文件，迁 runtime |
| `overlay/agents/<id>/agent/models.json`          | 混合运行配置           | runtime + template | runtime 实际文件 + `runtime-templates` 脱敏模板                                    | 先拆分再迁位               |
| `overlay/agents/<id>/agent/config.json`          | agent 运行配置         | runtime + template | runtime 实际文件 + `runtime-templates/agents/<id>/config.patch.json`               | 非敏感项模板化             |
| `overlay/agents/<id>/sessions/**`                | 会话历史               | backup + runtime   | `${BACKUP_ROOT}/agents/<id>_<ts>/sessions/` 与 `~/.openclaw/agents/<id>/sessions/` | 先归档，再退出 overlay     |

## 迁位原则

### 1. 先保全，再迁位

任何 `overlay/agents` 下的运行态内容都不能直接删除。必须先确认以下至少一个目标已建立：

- 服务器 runtime 中已有活数据
- 备份目录中已有可恢复快照

### 2. 历史记录优先归档

`sessions/*.jsonl*`、`sessions.json*` 和 `SESSION-STATE.md` 这类内容，即使不再作为活真源，也应先进入备份目录，再退出源码层。

### 3. `models.json` 先拆分，不整包照搬

`models.json` 通常混合了三种信息：

- 模型目录与上下文窗口
- baseUrl 等环境配置
- apiKey 等敏感值

它不能原样迁入模板仓。应拆成：

- 共享模型目录模板
- 环境差异模板
- secret 注入

### 4. `auth-profiles.json` 不作为模板真源

该文件包含 `lastGood`、`usageStats` 等运行时状态，属于 runtime 数据，不应继续放在源码层，也不应直接作为模板保留。

## 分解后的执行任务

### 任务 1：做只读盘点

目标：

- 固定当前 `overlay/agents` 的分类结果
- 为后续迁位提供可重复审计

执行：

- 运行 `pnpm ops:audit-overlay-agents`
- 保存输出作为迁位前清单

产出：

- 当前文件系统分类
- 当前 git 追踪历史分类
- 每个 agent 的问题分布

### 任务 2：确认活真源

目标：

- 确认每个 agent 当前哪份数据仍在服务器生效

逐项确认：

- `~/.openclaw/agents/<id>/agent/*.json`
- `~/.openclaw/agents/<id>/sessions/`
- `~/.openclaw/workspace/<id>/`
- `~/.openclaw/memory/*.sqlite`

完成标准：

- 能回答每个 agent 的活运行配置在哪
- 能回答每个 agent 的活 sessions 在哪

### 任务 3：建立备份落点

目标：

- 给 `overlay/agents` 中的历史内容建立退出通道

推荐落点：

- `${BACKUP_ROOT}/agents/<id>_<timestamp>/sessions/`
- `${BACKUP_ROOT}/agents/<id>_<timestamp>/workspace/`
- `${BACKUP_ROOT}/agents/<id>_<timestamp>/agent/`

完成标准：

- 每个 agent 的历史内容都能在备份目录中找到对应快照

### 任务 4：抽模板

目标：

- 把可复用、可版本化的部分从运行态里剥出来

建议拆法：

- `agent/config.json` -> `runtime-templates/agents/<id>/config.patch.json`
- `models.json` 的非敏感共享部分 -> `runtime-templates/config/*`
- `workspace/AGENTS.md`、`USER.md`、`BOOTSTRAP.md` -> 保留在 `overlay/agents/<id>/workspace/`
- 对没有仓库级默认配置的 agent，仍保留 `runtime-templates/agents/<id>/config.patch.json`，内容使用空对象 `{}` 作为显式占位

不要抽成模板的内容：

- `auth.json`
- `auth-profiles.json`
- `SESSION-STATE.md`
- `workspace/memory/**`
- `sessions/**`

### 任务 5：迁活数据到 runtime

目标：

- 让 overlay 中的运行态退出源码层

迁位目标：

- `agent/*.json` -> `~/.openclaw/agents/<id>/agent/`
- `SESSION-STATE.md` -> `~/.openclaw/workspace/<id>/`
- `workspace/memory/**` -> `~/.openclaw/workspace/<id>/memory/`
- `sessions/**` -> `~/.openclaw/agents/<id>/sessions/`

完成标准：

- `overlay/agents/<id>/agent/` 为空或已不再承载真源
- `overlay/agents/<id>/workspace/` 只剩静态骨架

### 任务 6：最后才清理 overlay

目标：

- 让 `overlay/agents` 回到长期可维护状态

清理后的目标结构：

```text
overlay/agents/<id>/
└── workspace/
    ├── AGENTS.md
    ├── IDENTITY.md
    ├── BOOTSTRAP.md
    ├── USER.md
    └── TOOLS.md
```

如果某个 agent 还需要运行态补种模板，应放到：

```text
runtime-templates/agents/<id>/
```

当前仓库已经完成这一步的源码层收口；服务器 runtime 和备份目录仍需按环境逐台对位。

当前仓库已额外把这条规则固化到校验链路：

- `scripts/check-repo-layering.mjs` 会拦截白名单之外的 `overlay/agents/<id>/workspace/*`
- `scripts/seed-agent-workspaces.mjs` 只会补种 `AGENTS.md`、`IDENTITY.md`、`BOOTSTRAP.md`、`TOOLS.md`、`USER.md`
- `scripts/seed-agent-workspaces.mjs` 在默认 `missing` 模式下会让 overlay 同名文件覆盖本轮刚补出的 skeleton 文件，但不会覆盖 runtime 里原本已存在的静态文件

## 本轮建议的先后顺序

按风险从低到高，建议这样执行：

1. `ops:audit-overlay-agents`
2. 服务器活真源确认
3. 备份落点建立
4. `config.json` / `models.json` 模板抽取
5. `SESSION-STATE.md` 与 `workspace/memory/**` 迁 runtime
6. `sessions/**` 退出 overlay
7. `overlay/agents` 收口为静态骨架

这样可以保证在任何阶段都不会因为“清理 overlay”而丢掉历史记录。
