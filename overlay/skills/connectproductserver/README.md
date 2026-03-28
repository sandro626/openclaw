# Connect Product Server

此技能从服务器本地 skill 真源回迁到 `overlay/skills/connectproductserver/`。

边界约束：

- `overlay/skills/connectproductserver/` 只保留可版本化的静态 skill 定义
- 主机地址、SSH 用户、密钥路径、日志目录和服务名通过 `runtime-templates/skills/*` 注入
- 不把真实服务器 IP、账号或密钥路径直接写回仓库
