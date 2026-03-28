# Gitee Coder

此技能根据服务器中仍可恢复的历史 skill 元数据回迁到 `overlay/skills/gitee-coder/`。

当前结论：

- 服务器上已经找不到原始 `gitee-coder/SKILL.md` 真文件
- 但历史 session 中仍能恢复 skill id、说明文本和旧路径引用
- 因此这里保留的是按历史真源重建的静态 skill 定义，不是运行态数据镜像

边界约束：

- `overlay/skills/gitee-coder/` 只保留可版本化的静态说明
- 仓库宿主、默认 owner、工作目录、默认分支和 SSH key 路径通过 `runtime-templates/skills/*` 注入
- 不把真实仓库地址、账号或 SSH 凭证写回仓库
