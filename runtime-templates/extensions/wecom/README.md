# WeCom Runtime Templates

此目录用于存放 WeCom 相关运行态模板。

建议内容：

- 企业号配置模板
- 机器人绑定模板
- agent 映射模板
- 启用开关模板

当前状态：

- `overlay/extensions/wecom/` 当前作为运行时默认加载的私有分叉
- 默认模板会把 `overlay/extensions/wecom` 加进 `plugins.load.paths`
- `extensions/wecom/` 保留为上游对照与兼容基线
- 如果后续切回 bundled `extensions/wecom/`，应同时移除这条加载路径
