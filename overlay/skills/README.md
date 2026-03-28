# Overlay Skills

此目录用于存放团队私有技能。

适合放在这里的内容：

- 企业内部流程技能
- 专用文档/报表/办公技能
- 不属于 OpenClaw 通用能力的业务技能

加载规则：

- `skills.load.extraDirs` 只会扫描 `overlay/skills/*/SKILL.md` 这种一级目录
- 需要默认可加载的技能，必须直接放在 `overlay/skills/<name>/`
- 仅用于归档或分组说明的目录，不应包含一级 `SKILL.md`
- 新增或迁移技能时，`SKILL.md` 的 `name` 应优先与 `overlay/skills/<name>/` 目录名保持一致
- 如果 `skills/<name>/` 已经是活跃真源，不要再在 `overlay/skills/<name>/` 保留同名副本
- 只有明确作为私有分叉维护的技能，才允许与 `skills/<name>/` 同名，并应在目录内说明分叉理由

当前状态：

- 原 `server-config/skills/*` 中仍需保留为技能源码的目录，已经提升到这里
- `server-config/skills/*` 当前只保留历史入口说明，不再承担真源职责
- 已经存在于 `skills/*` 的主仓通用技能，应优先回归 `skills/*` 作为正式真源，而不是在 overlay 保留重复副本
