# Runtime Agent Templates

此目录用于存放 agent 相关的运行态模板。

示例：

- `runtime-templates/agents/base.json`
- `runtime-templates/agents/environments/<env>.json`
- `runtime-templates/agents/bindings/base.json`
- `runtime-templates/agents/bindings/environments/<env>.json`
- `runtime-templates/agents/skill-resolution.json`
- `runtime-templates/agents/<agentId>/config.patch.json`
- agent 列表模板
- channel 到 agent 的绑定模板
- workspace 命名模板

约束：

- 只放可渲染、可版本化、无实时状态的模板
- `base.json` 与 `environments/<env>.json` 负责渲染 `agents.defaults` 与 `agents.list`
- `bindings/base.json` 与 `bindings/environments/<env>.json` 负责渲染顶层 `bindings[]`
- `skill-resolution.json` 用来显式记录 server alias、外部内置 skill、server-local runtime-only skill 和仅在配置中可见但尚未找回源码的 skill id
- `config.patch.json` 只保留非敏感默认项
- 每个 `overlay/agents/<agentId>/` 都要有显式对应的 `runtime-templates/agents/<agentId>/config.patch.json`
- 如果某个 agent 没有仓库级默认配置，也应显式写成空对象 `{}`，不要靠缺文件表达“无默认项”
- 生产环境如果从服务器回拉最新真源，可以保留 server-local skill id，但必须先登记到 `skill-resolution.json`
- 如果服务器 `openclaw.json` 临时出现重复 agent 条目，仓库模板仍应只保留唯一的 canonical agent 定义，不把重复行原样带回仓库
- 如果服务器配置里引用了某个 skill id，但当前没有找回对应源码，应登记到 `configOnly`，而不是误记成 `runtimeOnly`
- 当前 `gitee-coder` 与 `yz-dev-java` 都已回迁到 `overlay/skills/*`；`configOnly` 应只用于新的未恢复 skill id
- `auth.json`、`auth-profiles.json`、`sessions/`、`workspace/memory/` 不进入这里
