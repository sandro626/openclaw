# MySQL Readonly Runtime Templates

此目录用于存放 `mysql-readonly` 插件的运行态模板。

当前约定：

- 当前插件源码真源仍在 `extensions/mysql-readonly/`
- 连接参数进入 `runtime-templates/extensions/base.json`
- 环境变量样例进入 `runtime-templates/extensions/env.example`
- 是否启用由 `runtime-templates/extensions/environments/<env>.json` 控制

这里不应放真实数据库密码或真实库名。
