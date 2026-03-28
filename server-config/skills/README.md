# Server Config Skills

`server-config/skills` 已退出当前活跃树，不再作为技能源码真源。

当前归属：

- 活跃源码：`overlay/skills/<name>/` 或 `skills/<name>/`
- 运行态模板：`runtime-templates/skills/*`
- 历史副本：`.artifacts/ops/archive/server-config-skills/<name>-<timestamp>/`

处理规则：

- 不要把新的 `SKILL.md`、脚本或依赖重新写回这里
- 需要恢复历史内容时，从归档目录提取
- 需要新增或修改技能时，直接在正式源码目录操作

相关说明见 `/operations/skills-asset-inventory` 和 `/operations/deployment-assembly`。
