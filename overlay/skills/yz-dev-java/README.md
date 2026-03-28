# YZ Dev Java

此技能从服务器现行真源回迁到 `overlay/skills/yz-dev-java/`。

回迁依据：

- 服务器存在 `/root/.claude/skills/yz-dev-java/SKILL.md`
- 业务仓库副本中的 `.claude/skills/yz-dev-java/SKILL.md` 与其 hash 一致

边界约束：

- `overlay/skills/yz-dev-java/` 只保留可版本化的静态开发规范
- Nacos 地址、命名空间、项目路径和配置部署目标通过 `runtime-templates/skills/*` 注入
- 不把服务器中的真实地址、控制台凭证或导入口令写回仓库

补充说明：

- `yz-build` 和 `yz-test-java` companion skill 也已回迁到 `overlay/skills/*`
- 当前生产 agent 模板仍只显式使用 `yz-dev-java`
