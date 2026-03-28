# Zentao Runtime Templates

此目录用于存放 `zentao` 插件的运行态模板。

当前约定：

- 当前插件源码真源仍在 `extensions/zentao/`
- 插件级配置进入 `runtime-templates/extensions/base.json`
- 环境变量样例进入 `runtime-templates/extensions/env.example`
- 是否启用由 `runtime-templates/extensions/environments/<env>.json` 控制
- 每个 agent 的账号密码不应写在插件模板里，应留在 agent 级 runtime 配置

这里不应放真实禅道地址、真实账号或真实密码。
