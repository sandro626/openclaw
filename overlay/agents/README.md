# Overlay Agents

此目录用于存放 agent 的静态定义资产。

适合放在这里的内容：

- agent workspace 静态骨架
- `AGENTS.md`
- `IDENTITY.md`
- `BOOTSTRAP.md`
- `USER.md`
- workspace 骨架模板

不适合放在这里的内容：

- `agent/*.json`
- 实时 sessions
- 真实 memory 数据
- 生产生成文件

过渡期规则：

- 如果这里仍存在运行态或历史记录，先迁到 runtime 或备份目录，再退出 `overlay/agents`
- 不要把“迁出 overlay”理解成“删除历史”
- 当前迁位方案见 `/operations/overlay-agents-migration`

当前仓库约束：

- `overlay/agents/<id>/workspace/` 只保留白名单静态文件：`AGENTS.md`、`IDENTITY.md`、`BOOTSTRAP.md`、`TOOLS.md`、`USER.md`
- `runtime-templates/agents/<id>/config.patch.json` 承载可模板化的 agent 默认配置
- `pnpm check:repo-layering` 会阻止白名单之外的文件或目录重新回流到 `overlay/agents/<id>/workspace/`
