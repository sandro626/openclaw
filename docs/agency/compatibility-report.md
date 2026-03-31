# Agency 与 OpenClaw 兼容性评估报告

## 结论

`agency-agents-main` 里的内容不能整体当作 OpenClaw skill 直接用于本仓库，但其中大多数可以在适配后作为 OpenClaw agent 使用。

更准确地说：

- 作为 `overlay/skills/*`：不适合批量直接迁入
- 作为 `overlay/agents/*`：大多数可迁
- 作为当前仓库的正式资产：应优先转换成静态 agent 骨架，而不是直接写入服务器 runtime

## 评估依据

本次判断主要基于以下来源仓库文件：

- `README.md`
- `integrations/openclaw/README.md`
- `scripts/convert.sh`
- `scripts/install.sh`
- `project-management/project-manager-senior.md`
- `integrations/mcp-memory/backend-architect-with-memory.md`

这些证据说明，对方仓库本身就把内容视为角色 agent，而不是工具技能。

## 核心判断

### 1. 这批资产本质上是 agent，不是 skill

对方仓库的 OpenClaw 集成路径是：

1. `scripts/convert.sh --tool openclaw`
2. 生成 `SOUL.md`、`AGENTS.md`、`IDENTITY.md`
3. `scripts/install.sh --tool openclaw`
4. 复制到 `~/.openclaw/agency-agents/`
5. 调用 `openclaw agents add`

这说明它的目标模型是：

- 角色人格
- 工作方法
- 行为边界
- 交付流程

而不是：

- `SKILL.md`
- 工具调用契约
- 可复用脚本能力包

因此，正确迁移目标是 OpenClaw agent workspace，不是 skill。

### 2. 不能直接使用对方的 OpenClaw 安装脚本

对方仓库的 `scripts/install.sh --tool openclaw` 会直接把生成结果写入本机 `~/.openclaw` runtime。

这和本仓库当前的治理原则冲突：

- 仓库内资产必须先进入 `overlay/agents/*`
- 运行态只能通过模板渲染和部署链路进入 runtime
- 不允许直接把第三方内容写进 live runtime 作为长期真源

因此，对方仓库可以作为“输入源”，不能作为“正式安装器”。

### 3. 对方仓库自带的 OpenClaw 转换结果，和我们当前 fork 仍有差异

对方的 `convert_openclaw()` 会输出：

- `SOUL.md`
- `AGENTS.md`
- `IDENTITY.md`

但本仓库当前 `overlay/agents/<id>/workspace/` 的白名单静态文件是：

- `AGENTS.md`
- `IDENTITY.md`
- `BOOTSTRAP.md`
- `TOOLS.md`
- `USER.md`

当前白名单不包含 `SOUL.md`。所以不能把对方生成结果原样塞进 `overlay/agents/*`，还需要一个适配步骤。

## 源仓库规模快照

按主业务目录统计，源仓库大约包含 `178` 个角色 markdown 文件：

| 目录                 | 数量 |
| -------------------- | ---- |
| `academic`           | 5    |
| `design`             | 8    |
| `engineering`        | 26   |
| `game-development`   | 20   |
| `marketing`          | 29   |
| `paid-media`         | 7    |
| `product`            | 5    |
| `project-management` | 6    |
| `sales`              | 8    |
| `spatial-computing`  | 6    |
| `specialized`        | 28   |
| `strategy`           | 16   |
| `support`            | 6    |
| `testing`            | 8    |

这说明：

- 这是一个大型角色 agent 库
- 不适合无筛选地一次性导入
- 更适合分批迁入并和现有 agent 体系做重叠消解

## 兼容性分级

### 高兼容

这些目录更接近纯角色定义、工作方法和交付标准，较少依赖固定目录结构或强绑定工具生态：

- `marketing`
- `paid-media`
- `product`
- `sales`
- `support`
- `testing`
- `strategy`

这类内容更适合优先转换为 OpenClaw agent。

### 中兼容

这些目录通常可以迁，但需要先做工具映射、路径改造或角色重叠清理：

- `design`
- `engineering`
- `game-development`
- `project-management`
- `spatial-computing`
- `specialized`
- `academic`

其中最常见的问题是：

- 假设 Jira、Feishu、GitHub 等外部平台已经存在
- 假设 Claude Code、Cursor、Windsurf 等特定终端环境存在
- 假设固定项目目录，比如 `ai/memory-bank/*`、`ai/agents/*`
- 把 memory 语义写死为 `remember` / `recall` / `rollback`

### 低兼容

不建议原样迁入的内容主要是：

- `integrations/mcp-memory/*`
- 强绑定固定路径和私有工程约定的角色
- 强绑定特定客户端或 IDE 行为的角色

这些内容更适合当参考模板，而不是直接导入成生产 agent。

## 与当前 OpenClaw agent 体系的关系

本仓库当前生产模板已经有一套稳定 agent 体系，包含：

- 通用控制面，例如 `main`、`cto`、`dev`、`ops`
- 专业角色，例如 `pc-backend`、`pc-frontend`、`pc-devops`
- 业务角色，例如 `pc-ceo_assistant`
- 应用协作角色，例如 `yz-app-*`

因此，Agency 里的很多角色并不需要“一对一新增”为新 agent，而应先判断是否应被现有角色吸收。

典型例子：

- `engineering/engineering-backend-architect.md`
  更适合作为 `pc-backend` 的能力补充，而不是马上新建第二个 backend agent
- `engineering/engineering-code-reviewer.md`
  更适合作为 `pc-code_reviewer` 的提示增强
- `engineering/engineering-devops-automator.md`
  更适合作为 `pc-devops` 的补充
- `product/product-manager.md` 与 `project-management/*`
  更适合作为 `pc-pm` 或 `yz-app-pm` 的补充
- `testing/*`
  更适合作为 `pc-pctester` 的补充

## 主要不兼容点

### 1. `SOUL.md` 差异

Agency 自带转换会生成 `SOUL.md`，但本仓库当前 `overlay/agents` 静态白名单没有它。

因此需要把 `SOUL.md` 里的内容重新分配到：

- `IDENTITY.md`
- `AGENTS.md`
- `BOOTSTRAP.md`

### 2. 固定路径依赖

例如 `project-management/project-manager-senior.md` 明确依赖：

- `ai/memory-bank/site-setup.md`
- `ai/memory-bank/tasks/[project-slug]-tasklist.md`
- `ai/agents/pm.md`

这类路径在本仓库不是 canonical 结构，必须改造后才可用。

### 3. 非 canonical memory 语义

例如 `integrations/mcp-memory/backend-architect-with-memory.md` 仍然围绕 MCP-memory 风格语义组织。

而本仓库当前 canonical memory 已统一为：

- `memory-core`
- 文件系统真源
- `agents.defaults.memorySearch`

所以这类角色如果要迁入，必须改成 canonical memory 口径。

### 4. 外部工具耦合

源仓库很多角色会提到：

- Claude Code
- Cursor
- Windsurf
- Gemini CLI
- Qwen Code
- Kimi Code

这些内容并不意味着完全不能用，但必须先判断：

- 能否映射到 OpenClaw 现有工具
- 不能映射的是否需要删掉
- 是否应该拆成 `TOOLS.md` 说明，而不是保留在角色主提示里

## 推荐结论

### 应做

- 把 `agency-agents-main` 视为“角色来源库”
- 优先把高兼容目录转换成 OpenClaw agent
- 对和现有 `pc-*`、`yz-app-*` 重叠的角色，优先做合并吸收
- 对真正 net-new 的角色，再新增 agent

### 不应做

- 不要把这 `178` 个角色一口气全部做成 live agent
- 不要把它们原样放进 `overlay/skills/*`
- 不要直接运行对方的 `scripts/install.sh --tool openclaw` 写入 runtime
- 不要把 MCP-memory 风格和固定目录假设直接带入当前 canonical 体系

## 推荐的第一批方向

更适合优先迁入的方向是：

- 设计类
- 市场类
- 销售类
- 支持类
- 测试类
- 策略类

这些角色与当前 `pc-*` 技术角色重叠较少，迁入后更容易形成补充，而不是冲突。

下一步应转入 [Agency OpenClaw Agent Conversion](/agency/openclaw-agent-conversion)，按本仓库的 `overlay -> runtime-templates -> runtime` 结构落地。

对于和现有 `pc-*`、`yz-app-*` 高度重叠的角色，则继续按 [Agency Second Phase Overlap Resolution](/agency/second-phase-overlap-resolution) 做吸收，而不是新增平行 live agent。
