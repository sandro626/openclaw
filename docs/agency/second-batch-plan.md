# Agency 第二批迁移计划

## 目标

在第一批试点和第二阶段重叠消解之后，继续从 `agency-agents-main` 中迁入一批角色能力。

这一轮分成两类：

- 保留为 net-new `agency-*` 的角色
- 吸收进现有业务 agent 的角色

## 选择原则

第二批优先选择：

- 横向业务能力明显，适合作为独立顾问角色
- 对 OpenClaw 现有工具的映射相对清晰
- 不需要先引入私有 API、CRM、广告平台直连才能成立

第二批避免选择：

- 与现有工程角色高度重叠的技术 agent
- 强依赖广告平台 API、GTM、GA4、CRM 或私有数仓的角色
- 强绑定固定路径、旧 memory 语义或外部 runtime 安装脚本的角色

## 第二批清单

| 类型     | 源文件                                           | 目标落点                                | 兼容性 | 说明                                                      |
| -------- | ------------------------------------------------ | --------------------------------------- | ------ | --------------------------------------------------------- |
| 试点新增 | `design/design-ui-designer.md`                   | `agency-ui-designer`                    | 高     | 独立设计顾问能力，不应简单并进 `pc-frontend`              |
| 试点新增 | `design/design-ux-researcher.md`                 | `agency-ux-researcher`                  | 高     | 研究方法论和用户洞察独立于现有 PM 与前端角色              |
| 试点新增 | `paid-media/paid-media-creative-strategist.md`   | `agency-paid-media-creative-strategist` | 中高   | 偏创意策略和测试框架，当前仓库没有等价角色                |
| 吸收增强 | `design/design-brand-guardian.md`                | `pc-ceo_assistant`                      | 高     | 作为 CEO 助手的品牌一致性与表达守护能力，不单独开账户     |
| 吸收增强 | `sales/sales-outbound-strategist.md`             | `pc-ceo_assistant`                      | 中高   | 作为 CEO 助手的高价值外联与合作沟通策略能力，不单独开账户 |
| 吸收增强 | `support/support-executive-summary-generator.md` | `pc-ceo_assistant`                      | 高     | 直接增强元小芯的领导层摘要与决策备忘能力                  |

## 本次仓库落地范围

本次已为 net-new 角色补齐：

- `agency-ui-designer`
- `agency-ux-researcher`
- `agency-paid-media-creative-strategist`

这类角色保留在：

- `overlay/agents/<id>/workspace/*`
- `runtime-templates/agents/<id>/config.patch.json`

本次对吸收型角色的处理方式是：

- 不新建 `agency-brand-guardian`
- 不新建 `agency-outbound-strategist`
- 不新建 `agency-executive-summary-generator`
- 直接把这三类方法论增强进 `overlay/agents/pc-ceo_assistant/workspace/*`

## 适配规则

迁入时必须去掉或改写以下假设：

- 广告平台、CRM 或 BI 平台的直连 API 假设
- GTM、GA4、私有 dashboard、私有数仓的固定访问前提
- 旧 memory-bank 语义
- 任何直接写入用户主目录 runtime 的说明

如果这些依赖未来确实需要，只能通过：

- `overlay/skills/*`
- 或 live runtime 配置

显式补上，不能写死在 `overlay/agents/*`。

## 不在本次做的事

本次不会：

- 为被吸收的三类能力额外创建独立 live 账户
- 假装这些角色已经拥有广告平台 API、CRM、BI、投放数据或设计资产系统访问
- 把 `paid-media-tracking-specialist`、`sales-pipeline-analyst` 这类更重分析依赖的角色一起塞进来

## 当前状态

第二批完成后应达到：

- `docs/agency` 有明确的第二批清单
- net-new 角色在仓库中形成静态骨架
- 吸收型角色不会被错误地开成新账户
- `pc-ceo_assistant` 已吸收品牌守护、外联策略和高管摘要能力
- `pnpm check:repo-layering`
- `pnpm ops:assemble`
- `pnpm ops:seed-workspaces --dry-run`

## 下一步

第二批落地后，最合理的后续动作是：

1. 从 `agency-ui-designer`、`agency-ux-researcher`、`agency-paid-media-creative-strategist` 中挑 `1` 到 `2` 个做 staging 试跑
2. 继续验证 `pc-ceo_assistant` 吸收后的行为是否符合元小芯定位

## 当前试跑约束

你已明确要求：

- `agency-brand-guardian`
- `agency-outbound-strategist`
- `agency-executive-summary-generator`

这三类能力必须并入 `pc-ceo_assistant` 的技能包和静态角色骨架中，而不是创建三条独立 agent 账户。
