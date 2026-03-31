# Agency 第一批迁移计划

## 目标

在不冲击当前 `pc-*`、`yz-app-*` 生产角色体系的前提下，先从 `agency-agents-main` 中迁入一批高兼容、低冲突、以角色能力为主的 OpenClaw agent 试点。

本批次目标不是直接激活到生产，而是先在仓库内形成：

- `overlay/agents/<agentId>/workspace/*`
- `runtime-templates/agents/<agentId>/config.patch.json`

然后再决定哪些需要接入 live `agents.list`。

## 选择原则

第一批优先选择：

- 与现有技术角色重叠较少
- 外部工具和固定路径耦合较低
- 可以先作为独立顾问型角色存在
- 不依赖旧 `memory-bank` 或 MCP-memory 语义

第一批避免选择：

- 与 `pc-backend`、`pc-frontend`、`pc-devops`、`pc-code_reviewer` 明显重叠的工程角色
- 强绑定固定路径的角色
- 强绑定外部 IDE 或特定客户端的角色

## 第一批清单

| 类型     | 源文件                                                        | 目标 agent id                                 | 处理方式              | 兼容性 | 说明                                                                |
| -------- | ------------------------------------------------------------- | --------------------------------------------- | --------------------- | ------ | ------------------------------------------------------------------- |
| 试点新增 | `marketing/marketing-ai-citation-strategist.md`               | `agency-ai-citation-strategist`               | 新增 incubating agent | 高     | 偏分析与策略，不与现有 `pc-*` 技术角色直接冲突                      |
| 试点新增 | `marketing/marketing-china-market-localization-strategist.md` | `agency-china-market-localization-strategist` | 新增 incubating agent | 中高   | 能补足中国市场与内容本地化能力，但需保留平台依赖提醒                |
| 试点新增 | `sales/sales-proposal-strategist.md`                          | `agency-proposal-strategist`                  | 新增 incubating agent | 高     | 强叙事与提案能力，适合独立顾问角色                                  |
| 试点新增 | `support/support-support-responder.md`                        | `agency-support-responder`                    | 新增 incubating agent | 高     | 支持运营与客户沟通能力独立，和现有 agent 冲突较小                   |
| 试点新增 | `testing/testing-reality-checker.md`                          | `agency-reality-checker`                      | 新增 incubating agent | 高     | 适合作为质量把关角色，但执行命令需映射到 OpenClaw 工具              |
| 试点新增 | `testing/testing-accessibility-auditor.md`                    | `agency-accessibility-auditor`                | 新增 incubating agent | 高     | 适合独立审计角色，后续可配合浏览器与测试工具                        |
| 二期候选 | `testing/testing-tool-evaluator.md`                           | `agency-tool-evaluator`                       | 暂缓                  | 中高   | 能独立成角，但当前与通用评估任务边界还需再收                        |
| 二期候选 | `marketing/marketing-private-domain-operator.md`              | `agency-private-domain-operator`              | 暂缓                  | 中     | 与 WeCom / 私域生态耦合较重，适合后续和现有 channel/plugin 能力联动 |
| 吸收候选 | `product/product-feedback-synthesizer.md`                     | `pc-pm`                                       | 吸收进现有 agent      | 中高   | 更适合增强 `pc-pm`，不建议新开一个高度重叠的产品 agent              |
| 吸收候选 | `product/product-manager.md`                                  | `pc-pm` / `yz-app-pm`                         | 吸收进现有 agent      | 中     | 与现有 PM 角色重叠较大，应吸收而不是新增                            |

## 本次仓库落地范围

本次先在仓库中落地以下 `6` 个试点角色：

- `agency-ai-citation-strategist`
- `agency-china-market-localization-strategist`
- `agency-proposal-strategist`
- `agency-support-responder`
- `agency-reality-checker`
- `agency-accessibility-auditor`

并为每个角色补上：

- `overlay/agents/<id>/workspace/IDENTITY.md`
- `overlay/agents/<id>/workspace/AGENTS.md`
- `overlay/agents/<id>/workspace/BOOTSTRAP.md`
- `overlay/agents/<id>/workspace/TOOLS.md`
- `overlay/agents/<id>/workspace/USER.md`
- `runtime-templates/agents/<id>/config.patch.json`

## 角色命名策略

当前统一使用：

```text
agency-<slug>
```

原因：

- 避免与现有 `pc-*`、`yz-app-*` 生产角色混淆
- 明确这是从外部来源迁入的 incubating 角色
- 后续如果验证稳定，再决定是否合并命名或升级为正式业务角色

## 不在本次做的事

本次不会：

- 把这 `6` 个角色加入 `runtime-templates/agents/environments/prod.json`
- 把它们加入 live `openclaw.json`
- 把对方仓库的 `scripts/install.sh --tool openclaw` 接进本仓库部署链路
- 原样保留 `SOUL.md`

## 当前状态

当前仓库已经完成：

- `6` 个试点角色的静态骨架导入
- 对应的 `config.patch.json` 显式对位
- 每个角色的 `TOOLS.md` 初版映射
- 每个角色的首版 `USER.md` 模板
- `pc-ceo_assistant`、`pc-pm`、`ops` 的 staging 试跑角色对位
- `元小芯`、`元小宝`、`元小运` 的首版静态 workspace 定制

当前仓库尚未完成：

- 不会自动激活到 `prod` 的 `agents.list`
- 没有接入 live runtime
- 还没有补任何角色专属的真实业务上下文

## 第二阶段衔接

第一批试点之后，第二阶段不再继续大量新增 `agency-*` 角色，而是转向：

- 吸收 `product`、`project-management`、`engineering`、`testing` 中与现有业务角色高度重叠的方法论
- 把这些能力收进 `pc-*`、`yz-app-*`、`ops` 与 `pc-ceo_assistant`

对应矩阵和当前落地范围见：

- [Agency Second Phase Overlap Resolution](/agency/second-phase-overlap-resolution)

## Staging 试跑对位

当前 staging 试跑不直接启用新的 `agency-*` 角色，而是先把外部 Agency 方法论吸收进现有业务角色：

- `pc-ceo_assistant` -> `元小芯-管理平台CEO助手`
- `pc-pm` -> `元小宝-管理平台产品经理`
- `ops` -> `元小运-运营专家`

这样做的原因：

- 直接复用现有业务 agent id，避免再引入第二组高度重叠的角色
- 可以先验证角色语气、工具偏好、工作方式是否合适
- 不影响当前 `prod` 的 agent 清单，只在 `staging` 试跑

## 下一步

本批落地后，下一步应做：

1. 对第二阶段已增强的现有业务角色继续做 staging 试跑
2. 再决定哪些吸收结果需要进入 live 行为模板
3. 继续筛选仍适合保留为 net-new `agency-*` 的角色
