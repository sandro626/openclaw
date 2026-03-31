# Agency 全量收口

## 目标

在前十批手工迁移与吸收的基础上，把 `agency-agents-main` 中剩余未收口的源角色一次性转为本仓库可维护的 OpenClaw agent 资产。

## 当前结论

当前递归源角色清点结果如下：

- Agency 源角色总数：`162`
- 已形成独立 incubating `agency-*`：`137`
- 已吸收到现有业务角色：`25`

这里的“已吸收”是指：

- 不再保留独立 `agency-*` 账户
- 直接增强现有 `ops`、`pc-ceo_assistant`、`pc-pm`、`pc-devops`、`pc-pctester` 等业务角色
- 继续遵守 `core/upstream -> overlay -> runtime` 三层边界

最近一次吸收收口的是：

- `agency-technical-writer` -> `ops/元小运`

## 批量转换方式

为避免继续手工补几十批计划，本轮新增：

- `scripts/import-agency-remaining.mjs`

这个脚本会：

1. 递归扫描 `agency-agents-main` 源仓库中的角色 markdown
2. 跳过 `examples/`、`integrations/`、`strategy/` 与仓库说明文件
3. 读取 `docs/agency/*.md` 中已记录的源角色，避免把已吸收的角色重复转成独立账户
4. 把剩余源角色统一生成到：
   - `overlay/agents/<id>/workspace/*`
   - `runtime-templates/agents/<id>/config.patch.json`
5. 为每个角色补齐：
   - `IDENTITY.md`
   - `AGENTS.md`
   - `BOOTSTRAP.md`
   - `TOOLS.md`
   - `USER.md`
   - `CLAUDE.md -> AGENTS.md`

## 这次补齐了什么

本轮批量补齐了此前未覆盖的剩余角色，包括但不限于：

- 学术类角色
- 工程与基础设施类角色
- 深层游戏开发角色
  - `blender/*`
  - `godot/*`
  - `roblox-studio/*`
  - `unity/*`
  - `unreal-engine/*`
- 更深层的空间计算角色
- 专项顾问与专业流程角色
- 剩余的测试与支持角色

## 边界说明

这次批量转换仍然只是在仓库资产层完成，不代表全部 live 启用：

- 新增角色默认只进入 `overlay/agents/*` 与 `runtime-templates/agents/*`
- 不自动进入 `prod` 或 `staging` 的 `agents.list`
- 不自动进入 live bindings
- 不把 Agency 原仓库里任何 runtime、memory、sessions 或工具执行状态带回 repo

## 下一步

当前 `Agency -> OpenClaw agent` 的库存收口已经完成。后续工作不再是“继续把源角色转进 repo”，而是两类动作：

1. 从新补齐的 incubating `agency-*` 中选具体角色做 `staging` 试跑
2. 继续把明显重叠的角色吸收到现有业务账号，而不是新增 live 账户
