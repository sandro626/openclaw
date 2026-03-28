# Feishu Skill Suite

此目录用于承接飞书相关业务技能的分组治理说明。

候选来源：

- `server-config/skills/feishu-contacts`
- `server-config/skills/feishu-doc-guide`
- `server-config/skills/feishu-doc-manager`
- `server-config/skills/lark-integration`
- `server-config/skills/dingtalk-feishu-cn`

当前加载约束：

- `skills.load.extraDirs` 只会扫描 `overlay/skills/*/SKILL.md` 这种一级目录
- 所以真正可加载的技能已落在：
  - `overlay/skills/feishu-contacts/`
  - `overlay/skills/feishu-doc-guide/`
  - `overlay/skills/feishu-doc-manager/`
  - `overlay/skills/lark-integration/`
  - `overlay/skills/dingtalk-feishu-cn/`

这里保留为统一治理入口和说明文档，不直接作为可加载 skill 目录。
