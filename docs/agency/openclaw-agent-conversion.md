# Agency 转为 OpenClaw Agent 的转换方案

## 目标

将 `agency-agents-main` 中适合迁入的角色，转换为本仓库长期可维护的 OpenClaw agent 资产，并保持当前三层结构：

- `core/upstream`
- `overlay`
- `runtime`

转换目标不是“把外部仓库直接装进 runtime”，而是：

1. 外部角色作为输入源
2. 仓库内生成 `overlay/agents/*`
3. 必要的默认配置进入 `runtime-templates/agents/*`
4. 最终通过部署链路进入 live runtime

## 目标落点

### 静态骨架

Agency 角色进入：

```text
overlay/agents/<agentId>/workspace/
```

仅允许保留静态文件：

- `AGENTS.md`
- `IDENTITY.md`
- `BOOTSTRAP.md`
- `TOOLS.md`
- `USER.md`

### 运行模板

每个引入的 agent 都应显式对应：

```text
runtime-templates/agents/<agentId>/config.patch.json
```

如果当前没有仓库级默认项，也应显式写成：

```json
{}
```

## 不要直接复用的安装方式

不使用对方仓库的：

```bash
./scripts/install.sh --tool openclaw
```

原因：

- 它会直接写入 `~/.openclaw`
- 绕过本仓库的 `overlay` 管理
- 绕过模板与部署链路
- 无法保证后续版本化和回滚

因此，对方仓库的 `convert.sh` 只能作为“参考转换逻辑”，不是本仓库的正式导入流程。

## 格式适配规则

Agency 源文件当前会被拆成：

- `SOUL.md`
- `AGENTS.md`
- `IDENTITY.md`

但本仓库当前 `overlay/agents` 白名单不允许 `SOUL.md`，因此转换规则应改为：

### 1. frontmatter -> `IDENTITY.md`

建议映射：

- `name`
- `emoji`
- `vibe`
- 角色一句话定位

### 2. 角色使命与交付 -> `AGENTS.md`

放入：

- 核心职责
- 交付物
- 工作流程
- 成功标准
- 行为边界

### 3. 角色引导 -> `BOOTSTRAP.md`

保持本仓库统一风格，例如：

- 进入会话先读哪些文件
- 该角色的静态上下文在哪里
- live 状态不在 `overlay`

### 4. 工具依赖 -> `TOOLS.md`

当 Agency 角色明确依赖某些可映射到 OpenClaw 的工具时，再增加 `TOOLS.md`，例如：

- `git`
- `build`
- `test`
- `claude-code-task`
- `mysql-readonly`
- `superBrower`
- `zentao`

### 5. 组织或项目特定内容 -> `USER.md`

`USER.md` 不应直接从 Agency 源仓库生成，而应留给你们自己的业务上下文。

## 与当前 agent 体系的重叠处理

不应默认新增 `178` 个 live agent。应先判断是“吸收进现有 agent”，还是“新增 net-new agent”。

### 优先吸收进现有 agent 的类型

建议优先吸收的映射：

| Agency 方向             | 优先落点              |
| ----------------------- | --------------------- |
| Backend Architect       | `pc-backend`          |
| Frontend Developer      | `pc-frontend`         |
| Code Reviewer           | `pc-code_reviewer`    |
| DevOps Automator / SRE  | `pc-devops`           |
| Product / Project roles | `pc-pm` / `yz-app-pm` |
| Testing roles           | `pc-pctester`         |

### 更适合新增 agent 的类型

更适合新建的通常是当前组合里缺少的业务角色，例如：

- 市场策略
- 销售策略
- 付费投放
- 支持运营
- 特定设计角色

对于这类角色，建议先用隔离命名进入 incubating 状态，例如：

```text
overlay/agents/agency-<slug>/
```

等验证后再决定是否改成正式 `pc-*` 或其他长期命名。

## 分阶段迁移方案

### 阶段 1：筛选

先按目录分三类：

- 高兼容，直接迁
- 中兼容，适配后迁
- 低兼容，仅参考

建议第一批优先：

- `marketing`
- `paid-media`
- `sales`
- `support`
- `testing`
- `strategy`

### 阶段 2：重叠消解

对每个候选角色回答两个问题：

1. 是否与当前 `pc-*`、`yz-app-*` 明显重叠
2. 是增强现有角色，还是新增角色更合理

第二阶段当前的吸收矩阵和已落地的现有角色增强，见 [Agency Second Phase Overlap Resolution](/agency/second-phase-overlap-resolution)。

### 阶段 3：格式转换

把源 markdown 转为：

```text
overlay/agents/<agentId>/workspace/IDENTITY.md
overlay/agents/<agentId>/workspace/AGENTS.md
overlay/agents/<agentId>/workspace/BOOTSTRAP.md
overlay/agents/<agentId>/workspace/TOOLS.md
runtime-templates/agents/<agentId>/config.patch.json
```

### 阶段 4：模板接入

只在明确需要时，把新 agent 加入：

- `runtime-templates/agents/environments/prod.json`
- `runtime-templates/agents/bindings/environments/prod.json`

不要因为角色已经存在于 `overlay/agents/*`，就默认激活进生产。

### 阶段 5：部署与 smoke

接入生产前至少验证：

- `pnpm check:repo-layering`
- `pnpm ops:assemble -- --output-root .artifacts/ops/<name> --environment prod --allow-unresolved-env`
- workspace 补种是否只写静态骨架
- 新 agent 是否不会把 runtime 文件回流进仓库

## 适配时必须清理的内容

以下内容不能原样从 Agency 仓库带入：

- `ai/memory-bank/*`
- `ai/agents/*`
- `remember` / `recall` / `rollback` 风格的旧 memory 语义
- Claude Code / Cursor / Windsurf 等特定客户端指令
- 任何直接写入用户主目录 runtime 的安装说明

这些内容要么：

- 删除
- 改写成 OpenClaw 现有工具
- 或抽到 `TOOLS.md`

## 验收标准

某个 Agency 角色被视为已成功迁入，需要同时满足：

1. 仓库内落点正确
   - 在 `overlay/agents/*`
   - 不在 `overlay/skills/*`

2. 静态边界正确
   - 不含 `sessions`
   - 不含真实 `memory`
   - 不含 `agent/*.json`

3. 模板边界正确
   - 有对应 `runtime-templates/agents/<id>/config.patch.json`

4. 行为边界正确
   - 没有遗留 MCP-memory 或固定路径假设
   - 工具依赖已改写成 OpenClaw 可用能力

5. 部署边界正确
   - 不通过外部 `install.sh` 直接写 live runtime

## 推荐下一步

按当前评估，建议先做一个最小试点：

1. 从 `marketing`、`sales`、`testing` 各挑 1 到 2 个角色
2. 转成 `overlay/agents/agency-<slug>/workspace/*`
3. 为每个角色补空的 `runtime-templates/agents/<id>/config.patch.json`
4. 本地通过 layering 与 assemble 校验
5. 再决定是否推广到更大范围

这会比一次性导入大量角色更稳，也更符合当前仓库的分层治理方式。
