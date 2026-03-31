# Agency 第三批迁移计划

## 目标

继续从 `agency-agents-main` 中迁入一批更偏 revenue、analytics、content 与 strategy 的角色，并把它们收成仓库可装配的 incubating `agency-*` agent。

这一批仍然遵守当前边界：

- 只落到 `overlay/agents/<id>/workspace/*`
- 只补 `runtime-templates/agents/<id>/config.patch.json`
- 不直接进入 `prod` 或 `staging` 的 `agents.list`

## 选择原则

第三批优先选择：

- 与现有 `pc-*`、`yz-app-*` 角色重叠较小
- 即使没有 CRM、广告 API、私有数仓，也能先提供方法论和交付结构
- 更偏分析、策略、研究或内容顾问，而不是强执行型 runtime 角色

第三批避免选择：

- 强依赖法律结论、监管裁定或专业执照背书的角色
- 强依赖广告平台直连、CRM 写入、ERP/财务系统写入的角色
- 与现有工程与 PM 角色高度重叠、应优先走吸收路线的角色

## 第三批清单

| 类型     | 源文件                                          | 目标 agent id                       | 兼容性 | 说明                                                              |
| -------- | ----------------------------------------------- | ----------------------------------- | ------ | ----------------------------------------------------------------- |
| 已落地   | `sales/sales-account-strategist.md`             | `agency-account-strategist`         | 高     | 偏 post-sale land-and-expand，与现有业务技术角色冲突小            |
| 已落地   | `sales/sales-pipeline-analyst.md`               | `agency-pipeline-analyst`           | 高     | 偏 revenue inspection、forecast risk 与 pipeline health           |
| 已落地   | `paid-media/paid-media-ppc-strategist.md`       | `agency-ppc-strategist`             | 中高   | 保留 paid-media strategy 能力，但明确不假设 ad-platform API       |
| 已落地   | `paid-media/paid-media-search-query-analyst.md` | `agency-search-query-analyst`       | 高     | 适合做 query intent、waste analysis 与 content gap 诊断           |
| 已落地   | `support/support-analytics-reporter.md`         | `agency-support-analytics-reporter` | 高     | 保留 support/ops reporting 语境的 analytics 角色                  |
| 已落地   | `support/support-analytics-reporter.md`         | `agency-analytics-reporter`         | 中高   | 同源泛化版，用于更通用的 KPI、趋势与高层报告，不局限 support      |
| 本轮新增 | `marketing/marketing-content-creator.md`        | `agency-content-creator`            | 高     | 偏多平台内容策略与品牌叙事，不和现有工程角色冲突                  |
| 本轮新增 | `product/product-trend-researcher.md`           | `agency-trend-researcher`           | 中高   | 偏市场与产品趋势研究，适合 incubating 研究顾问                    |
| 本轮新增 | `sales/sales-deal-strategist.md`                | `agency-deal-strategist`            | 高     | 偏 MEDDPICC、deal inspection 与竞争定位，独立于 account expansion |
| 本轮新增 | `support/support-finance-tracker.md`            | `agency-finance-tracker`            | 中     | 可先作为财务规划与现金流顾问，但不假设 ERP/账务系统写入           |

## 当前仓库落地范围

第三批现在已在仓库形成静态骨架并显式对位：

- `agency-account-strategist`
- `agency-analytics-reporter`
- `agency-pipeline-analyst`
- `agency-ppc-strategist`
- `agency-search-query-analyst`
- `agency-support-analytics-reporter`
- `agency-content-creator`
- `agency-trend-researcher`
- `agency-deal-strategist`
- `agency-finance-tracker`

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

- CRM、广告平台、BI、ERP、财务系统的写权限假设
- 私有 warehouse、dashboard、GA4、Looker、HubSpot、Salesforce 直接可用的假设
- 固定路径、旧 memory-bank 或外部 runtime 安装脚本
- 任何会把 live 真实数据、sessions、memory 回流进 repo 的说明

如果未来确实需要这些能力，只能通过：

- `overlay/skills/*`
- 或 live runtime 配置

显式补上。

## 不在本批做的事

本批不会：

- 把第三批角色直接加进 `prod` 或 `staging` 的 `agents.list`
- 为 `agency-finance-tracker` 假装提供会计系统、发票系统或银行数据
- 为 `agency-ppc-strategist`、`agency-search-query-analyst` 假装提供广告账户直连
- 为 `agency-trend-researcher` 假装提供私有研究平台、付费数据库或完整情报源
- 引入法律合规、广告 tracking、CRM automation 等更高依赖角色

## 当前状态

第三批完成后，应达到：

- `docs/agency` 对 revenue、analytics、content 与 strategy 这一批有明确归档
- 这些角色在仓库中成为可装配的 incubating `agency-*` agent
- 仍然不影响当前 `prod` 和 `staging` 的 live agent 清单
- `pnpm check:repo-layering`
- `pnpm ops:assemble`
- `pnpm ops:seed-workspaces --dry-run`

## 下一步

第三批之后，最合理的后续动作是：

1. 从 `agency-content-creator`、`agency-deal-strategist`、`agency-trend-researcher` 中挑 `1` 到 `2` 个做 `staging` 试跑
2. 再决定哪些能力更适合吸收到现有 `pc-pm`、`pc-ceo_assistant`、`ops` 或 `yz-app-*`
