# Agency 第十批迁移计划

## 目标

继续从 `agency-agents-main` 中迁入一批更偏工具评估、流程优化、轮播增长与短视频后期方法论的角色，并保持它们作为新的 incubating `agency-*` agent。

这一批仍然遵守当前边界：

- 只落到 `overlay/agents/<id>/workspace/*`
- 只补 `runtime-templates/agents/<id>/config.patch.json`
- 不直接进入 `prod` 或 `staging` 的 `agents.list`

## 选择原则

第十批优先选择：

- 即使没有专有平台后台、自动发布 API 或企业级流程系统，也能先提供方法论价值
- 更偏评估、结构化优化、内容包装与后期指导，而不是强执行型自动化流水线
- 与现有 `pc-*`、`yz-app-*`、`ops`、`pc-ceo_assistant` 的重叠相对较低

第十批避免选择：

- 已在前批次转过或已被吸收到现有业务角色中的条目
- 强依赖 CRM 写权限、广告自动投放、私有 CI 平台或复杂审批系统的角色
- 需要固定私有目录、旧 memory-bank 或外部 runtime 安装脚本才能成立的角色

## 第十批清单

| 类型     | 源文件                                             | 目标 agent id                      | 兼容性 | 说明                                                                 |
| -------- | -------------------------------------------------- | ---------------------------------- | ------ | -------------------------------------------------------------------- |
| 本轮新增 | `testing/testing-tool-evaluator.md`                | `agency-tool-evaluator`            | 高     | 适合做工具选型、比较评审与引入建议，不要求直接写入采购或合同系统     |
| 本轮新增 | `testing/testing-workflow-optimizer.md`            | `agency-workflow-optimizer`        | 高     | 适合做流程梳理、瓶颈分析与自动化机会设计，不要求直接接管真实流程引擎 |
| 本轮新增 | `marketing/marketing-carousel-growth-engine.md`    | `agency-carousel-growth-engine`    | 中高   | 适合做轮播内容结构、滑页叙事与增长实验设计，不假设自动生成和自动发布 |
| 本轮新增 | `marketing/marketing-short-video-editing-coach.md` | `agency-short-video-editing-coach` | 中高   | 适合做短视频后期方法论、剪辑节奏与导出规范指导，不假设剪辑软件可控   |

## 当前仓库落地范围

第十批现在在仓库中形成以下独立 incubating 静态骨架：

- `agency-tool-evaluator`
- `agency-workflow-optimizer`
- `agency-carousel-growth-engine`
- `agency-short-video-editing-coach`

每个角色都应具备：

- `IDENTITY.md`
- `AGENTS.md`
- `BOOTSTRAP.md`
- `TOOLS.md`
- `USER.md`
- `CLAUDE.md -> AGENTS.md`
- `runtime-templates/agents/<id>/config.patch.json`

## 适配规则

迁入时必须显式去掉或改写以下假设：

- 工具采购、合同审批、流程引擎、自动发布平台或剪辑软件后台天然可用
- 可以直接运行 Gemini 图像生成、Upload-Post 发布、企业 BPM 系统或专业 NLE 软件插件
- 任何固定目录、旧 memory-bank 或外部 runtime 安装脚本
- 任何会把 live sessions、memory 或真实工作产物回流进 repo 的说明

如果未来确实需要这些系统能力，只能通过：

- `overlay/skills/*`
- 或 live runtime 配置

显式补上。

## 不在本批做的事

本批不会：

- 把第十批角色直接加入 live 配置
- 假装提供采购系统、合同系统、自动发帖后台、视频编辑工作站或真实流程引擎访问
- 把轮播增长角色扩展成自动发布机器人
- 把短视频后期角色扩展成真实素材库、代理渲染农场或商用交付流水线

## 当前状态

第十批完成后，应达到：

- `docs/agency` 对工具评估、流程优化、轮播增长与短视频后期角色有明确归档
- 这 4 个角色在仓库中成为可装配的 incubating `agency-*` agent
- 不影响当前 `prod` 和 `staging` 的 live agent 清单
- `pnpm check:repo-layering`
- `pnpm ops:assemble`
- `pnpm ops:seed-workspaces --dry-run`

## 下一步

第十批之后，最合理的后续动作是：

1. 从 `agency-tool-evaluator` 与 `agency-workflow-optimizer` 中挑 `1` 到 `2` 个做 `staging` 试跑
2. 再决定其中哪些能力更适合吸收到现有运营、项目或管理角色
