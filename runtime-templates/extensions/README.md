# Runtime Extension Templates

此目录用于存放扩展相关的运行态模板。

当前结构：

- `base.json`: 共享插件配置补丁
- `environments/<env>.json`: 环境差异补丁
- `env.example`: 插件运行态环境变量样例
- `<plugin>/README.md`: 各插件的模板归属说明

当前已接管的内容：

- `mysql-readonly` 的只读数据库连接模板
- `zentao` 的插件级 guardrails 与 base URL 模板

启用规则：

- bundled 插件来自 `extensions/*`，会被默认发现
- 对 bundled 插件，通常只需要在 `plugins.entries.<id>` 中配置 `enabled` 和 `config`
- overlay 私有插件不会因为目录存在而自动启用
- 需要启用 overlay 插件时，必须显式加入 `plugins.load.paths`，或部署到 `~/.openclaw/extensions` / workspace 插件目录

当前默认模板：

- 只显式加载 `overlay/extensions/wecom`
- `feishu` 仍通过 bundled `extensions/feishu` 生效
- `mysql-readonly`、`superBrower`、`zentao` 当前仍以 `extensions/*` 为真源，runtime 模板只负责配置，不再依赖 overlay 同名源码副本
- repo layering hook 会校验这条边界：`wecom` 必须继续作为显式 overlay load path，`feishu` 不允许被模板误激活
