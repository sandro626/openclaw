# Server Config WeCom Copy

`server-config/extensions/wecom` 已退出当前活跃树，不再作为 WeCom 扩展源码真源。

当前归属：

- 正式扩展实现：`extensions/wecom/`
- overlay 接收位：`overlay/extensions/wecom/`
- 运行态模板：`runtime-templates/extensions/`

处理规则：

- 历史副本先归档到 `.artifacts/ops/archive/server-config-extensions/wecom-<timestamp>/` 或外部备份
- 不要把新的源码改动、依赖目录或环境文件再写回这里
- 如需恢复历史差异，请从归档目录提取后再决定回归 `extensions/wecom/` 还是 `overlay/extensions/wecom/`

相关说明见 `/operations/extensions-asset-inventory` 与 `/operations/first-batch-asset-migration`。
