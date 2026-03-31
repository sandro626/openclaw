# Agency 第九批迁移计划

## 目标

继续从 `agency-agents-main` 中迁入一批更偏长内容、培训设计与测试结果分析的角色，并保持它们作为新的 incubating `agency-*` agent。

这一批仍然遵守当前边界：

- 只落到 `overlay/agents/<id>/workspace/*`
- 只补 `runtime-templates/agents/<id>/config.patch.json`
- 不直接进入 `prod` 或 `staging` 的 `agents.list`

## 选择原则

第九批优先选择：

- 即使没有企业 LMS、ATS、播客托管平台或完整测试平台，也能提供方法论价值
- 更偏结构化分析、内容组织、训练方案与长内容协作，而不是强执行后台
- 与现有 `pc-*`、`yz-app-*`、`ops`、`pc-ceo_assistant` 的重叠相对较低

第九批避免选择：

- 已在前批次转过或已被吸收到现有业务角色中的条目
- 强依赖招聘平台、法务判定、合规写入或专有运维后台的角色
- 需要固定私有目录、旧 memory-bank 或外部 runtime 安装脚本才能成立的角色

## 第九批清单

| 类型     | 源文件                                       | 目标 agent id                  | 兼容性 | 说明                                                               |
| -------- | -------------------------------------------- | ------------------------------ | ------ | ------------------------------------------------------------------ |
| 本轮新增 | `testing/testing-test-results-analyzer.md`   | `agency-test-results-analyzer` | 高     | 适合测试产物、覆盖率、失败模式与发布风险分析，不要求接管 CI        |
| 吸收并入 | `marketing/marketing-book-co-author.md`      | `pc-ceo_assistant` + `ops`     | 高     | 以“长内容与知识资产方法包”形式并入元小芯和元小运，不保留独立账户   |
| 吸收并入 | `specialized/corporate-training-designer.md` | `pc-ceo_assistant` + `ops`     | 高     | 以“培训设计与能力建设方法包”形式并入元小芯和元小运，不保留独立账户 |
| 本轮新增 | `marketing/marketing-podcast-strategist.md`  | `agency-podcast-strategist`    | 中高   | 适合播客定位、选题、结构与分发建议，不要求音频生产后台             |

## 当前仓库落地范围

第九批现在在仓库中形成以下独立 incubating 静态骨架：

- `agency-test-results-analyzer`
- `agency-podcast-strategist`

同时，这一批有两类方法包直接吸收到现有业务角色：

- `marketing-book-co-author` -> `pc-ceo_assistant` + `ops`
- `corporate-training-designer` -> `pc-ceo_assistant` + `ops`

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

- 企业 LMS、播客托管平台、录音工作站、测试数据仓或统计看板天然可用
- 可以直接拿到完整 CI 历史、学习行为数据、作者知识库或播客分发后台
- 任何固定目录、旧 memory-bank 或外部 runtime 安装脚本
- 任何会把 live sessions、memory 或真实工作产物回流进 repo 的说明

如果未来确实需要这些系统能力，只能通过：

- `overlay/skills/*`
- 或 live runtime 配置

显式补上。

## 不在本批做的事

本批不会：

- 把第九批角色直接加入 live 配置
- 假装提供企业 LMS、测试仓库、播客后台或作者私有素材库访问
- 把测试结果分析角色扩展成真实发布审批器
- 把图书共著或播客角色扩展成真正的内容生产流水线

## 当前状态

第九批完成后，应达到：

- `docs/agency` 对长内容、培训设计与测试分析角色有明确归档
- 这 4 个角色在仓库中成为可装配的 incubating `agency-*` agent
- 不影响当前 `prod` 的 live agent 清单
- `pnpm check:repo-layering`
- `pnpm ops:assemble`
- `pnpm ops:seed-workspaces --dry-run`

## 当前试跑选择

第九批当前优先吸收的角色是：

- `marketing-book-co-author`
- `corporate-training-designer`

这一步直接并入 `元小芯/pc-ceo_assistant` 与 `元小运/ops` 的静态方法包，不新增 `staging` 或 `prod` 账户。

## 下一步

第九批之后，最合理的后续动作是：

1. 把 `marketing-book-co-author` 与 `corporate-training-designer` 的方法包同步到 `元小芯/pc-ceo_assistant` 与 `元小运/ops`
2. 再继续从剩余高兼容角色里选择下一批独立 incubating `agency-*`
