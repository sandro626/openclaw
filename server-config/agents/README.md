# Server Config Agents

`server-config/agents` 已退出当前活跃树，不再作为 agent 定义、运行配置或历史会话的真源。

当前归属：

- 静态骨架：`overlay/agents/<agentId>/workspace/`
- 运行态模板：`runtime-templates/agents/<agentId>/config.patch.json`
- 真实运行态：`~/.openclaw/agents/<agentId>/` 与 `~/.openclaw/workspace/<agentId>/`

处理规则：

- 历史副本先归档到 `.artifacts/ops/archive/server-config-agents_<timestamp>/` 或外部备份
- 不要把新的 `sessions/`、`agent/*.json`、`workspace/memory/` 再写回这里
- 如果需要恢复历史，请从归档目录或服务器 runtime 提取，不要把这里重新当成长期真源

相关说明见 `/operations/overlay-agents-migration` 和 `/operations/deployment-assembly`。
