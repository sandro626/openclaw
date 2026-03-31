# Agency 第八批迁移计划

## 目标

继续从 `agency-agents-main` 中迁入一批更偏反馈综合、销售辅导与视觉叙事的角色，并保持它们作为新的 incubating `agency-*` agent。

这一批仍然遵守当前边界：

- 只落到 `overlay/agents/<id>/workspace/*`
- 只补 `runtime-templates/agents/<id>/config.patch.json`
- 不直接进入 `prod` 或 `staging` 的 `agents.list`

## 选择原则

第八批优先选择：

- 即使没有 CRM、访谈仓库、通话平台或设计资产系统，也能提供方法论价值
- 更偏综合、辅导、评审、叙事，而不是依赖强执行后台的运营角色
- 与现有 `pc-*`、`yz-app-*`、`ops`、`pc-ceo_assistant` 的重叠相对较低

第八批避免选择：

- 强依赖法务裁定、ERP 写入、广告后台或专有分析平台的角色
- 更适合直接吸收到现有 PM、销售、支持或设计角色中的能力
- 需要固定私有目录、旧 memory-bank 或外部 runtime 安装脚本才能成立的角色

## 第八批清单

| 类型     | 源文件                                    | 目标 agent id                 | 兼容性 | 说明                                                         |
| -------- | ----------------------------------------- | ----------------------------- | ------ | ------------------------------------------------------------ |
| 本轮新增 | `product/product-feedback-synthesizer.md` | `agency-feedback-synthesizer` | 高     | 适合多渠道反馈归纳、主题抽取与优先级综合，不依赖单一后台系统 |
| 本轮新增 | `sales/sales-coach.md`                    | `agency-sales-coach`          | 中高   | 适合销售辅导、pipeline review 与行为反馈，不要求 CRM 写权限  |
| 本轮新增 | `sales/sales-discovery-coach.md`          | `agency-discovery-coach`      | 高     | 适合发现式销售方法论、问题设计与通话结构优化                 |
| 本轮新增 | `design/design-visual-storyteller.md`     | `agency-visual-storyteller`   | 高     | 适合品牌叙事、视觉结构与多平台故事化表达                     |

## 当前仓库落地范围

第八批现在在仓库中形成以下静态骨架：

- `agency-feedback-synthesizer`
- `agency-sales-coach`
- `agency-discovery-coach`
- `agency-visual-storyteller`

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

- CRM、call recorder、研究仓库、问卷系统或设计资产管理平台天然可用
- 私有分析面板、销售自动化、通话评分系统或原始访谈数据库一定存在
- 任何固定目录、旧 memory-bank 或外部 runtime 安装脚本
- 任何会把 live sessions、memory 或真实工作产物回流进 repo 的说明

如果未来确实需要这些系统能力，只能通过：

- `overlay/skills/*`
- 或 live runtime 配置

显式补上。

## 不在本批做的事

本批不会：

- 把第八批角色直接加入 live 配置
- 假装提供 CRM 写权限、通话转录后台、用户研究平台或设计资产系统访问
- 把销售辅导角色扩展成销售经理或审批角色
- 把视觉叙事角色扩展成真实视频制作或资产生产流水线

## 当前状态

第八批完成后，应达到：

- `docs/agency` 对反馈综合、销售辅导与视觉叙事角色有明确归档
- 这 4 个角色在仓库中成为可装配的 incubating `agency-*` agent
- 不影响当前 `prod` 和 `staging` 的 live agent 清单
- `pnpm check:repo-layering`
- `pnpm ops:assemble`
- `pnpm ops:seed-workspaces --dry-run`

## 下一步

第八批之后，最合理的后续动作是：

1. 从 `agency-feedback-synthesizer`、`agency-discovery-coach`、`agency-visual-storyteller` 中挑 `1` 到 `2` 个做 `staging` 试跑
2. 再决定其中哪些能力更适合吸收到现有 PM、销售或内容相关角色
