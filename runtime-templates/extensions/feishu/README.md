# Feishu Runtime Templates

此目录用于存放 Feishu 相关运行态模板。

建议内容：

- 账号列表模板
- account 到 agent 的绑定模板
- 启用开关模板
- 群策略模板

不应放真实 secrets 或真实账号数据。

当前状态：

- `extensions/feishu/` 仍是当前正式实现真源
- `overlay/extensions/feishu/` 目前只是预留接收位
- 默认模板不会把 `overlay/extensions/feishu` 加进 `plugins.load.paths`
