# Server Config Feishu Copy

`server-config/extensions/feishu` 已退出当前活跃树，不再作为 Feishu 扩展源码真源。

当前归属：

- 正式扩展实现：`extensions/feishu/`
- overlay 预留接收位：`overlay/extensions/feishu/`
- 运行态模板：`runtime-templates/extensions/`

迁位判断依据：

- 旧副本中的 onboarding 逻辑已由 `extensions/feishu/src/setup-surface.ts` 接管
- 其余源码模块以 `extensions/feishu/` 的现行结构为准

处理规则：

- 历史副本先归档到 `.artifacts/ops/archive/server-config-extensions/feishu-<timestamp>/` 或外部备份
- 不要把新的源码改动、依赖目录或环境文件再写回这里
- 如需恢复历史差异，请从归档目录提取后再决定回归 `extensions/feishu/` 还是转成 overlay 私有定制

相关说明见 `/operations/extensions-asset-inventory` 与 `/operations/first-batch-asset-migration`。
