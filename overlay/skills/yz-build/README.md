# YZ Build

此技能从服务器现行真源回迁到 `overlay/skills/yz-build/`。

回迁依据：

- 服务器存在现行 `yz-build/SKILL.md`
- 业务仓库副本中的同名 skill 与服务器真源 hash 一致

边界约束：

- `overlay/skills/yz-build/` 只保留可版本化的构建规范
- 项目根目录通过 `runtime-templates/skills/*` 注入
- 不把服务器本地目录或私有构建参数写回仓库
