# Overlay

`overlay/` 用于承接团队自有资产，不直接放进 OpenClaw core。

建议内容：

- `overlay/extensions/`：私有扩展
- `overlay/skills/`：私有技能
- `overlay/agents/`：agent 定义模板与静态资产

这里不应放：

- 真实运行态数据
- 生产 secrets
- sessions
- memory 索引数据库
