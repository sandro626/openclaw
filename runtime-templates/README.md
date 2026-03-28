# Runtime Templates

`runtime-templates/` 用于存放运行态模板，而不是运行态真数据。

适合放在这里的内容：

- 配置模板
- 扩展启用模板
- agent 绑定模板
- 环境变量示例
- workspace 静态骨架模板
- host-local runtime state 的 example

推荐配套脚本：

- `scripts/assemble-runtime-bundle.mjs`：复制 overlay 资产并渲染最终 `openclaw.json`
- `scripts/seed-agent-workspaces.mjs`：向 runtime workspace 补种静态骨架文件

这里不应放：

- 真实 token
- 真实账号映射
- 真实 workspace 数据
- 真实 sessions 与 memory

目录约定：

- `runtime-templates/config/`：参与装配渲染的配置模板
- `runtime-templates/state/`：不参与装配的 runtime state 结构样例
