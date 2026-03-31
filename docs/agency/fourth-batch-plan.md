# Agency 第四批迁移计划

## 目标

继续从 `agency-agents-main` 中迁入一批更偏 discoverability、content distribution 与 developer-facing enablement 的角色。

这一批仍然保持：

- 只落到 `overlay/agents/<id>/workspace/*`
- 只补 `runtime-templates/agents/<id>/config.patch.json`
- 不直接进入 `prod` 或 `staging` 的 `agents.list`

## 选择原则

第四批优先选择：

- 主要基于公开 Web、公开 listing、公开内容或文档就能起效
- 不需要广告账户、CRM、私有数据仓库或专属控制台写权限
- 与现有 `pc-*` 工程执行角色和前几批 `agency-*` 角色边界清晰

第四批避免选择：

- 强依赖广告投放平台直连或 attribution 回传的角色
- 高度依赖法律判断、合规背书或高风险专业建议的角色
- 应优先吸收到现有 `pc-*` 或 `yz-app-*` 的工程、PM、测试类角色

## 第四批清单

| 类型     | 源文件                                            | 目标 agent id                     | 兼容性 | 说明                                                           |
| -------- | ------------------------------------------------- | --------------------------------- | ------ | -------------------------------------------------------------- |
| 本轮新增 | `marketing/marketing-seo-specialist.md`           | `agency-seo-specialist`           | 高     | 适合公开 Web 审计、SERP 分析、内容 gap 与技术 SEO 框架         |
| 本轮新增 | `marketing/marketing-app-store-optimizer.md`      | `agency-app-store-optimizer`      | 高     | 适合 app listing、metadata、截图叙事与 store conversion 视角   |
| 本轮新增 | `marketing/marketing-linkedin-content-creator.md` | `agency-linkedin-content-creator` | 高     | 适合 founder / executive thought-leadership 与 B2B 内容分发    |
| 本轮新增 | `specialized/specialized-developer-advocate.md`   | `agency-developer-advocate`       | 中高   | 适合 DX、docs、sample app、community response 与外部开发者支持 |

## 当前仓库落地范围

第四批现在在仓库中形成以下静态骨架：

- `agency-seo-specialist`
- `agency-app-store-optimizer`
- `agency-linkedin-content-creator`
- `agency-developer-advocate`

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

- Google Search Console、App Store Connect、Google Play Console、LinkedIn 控制台或社区后台天然可用
- 私有 attribution、下载归因、CRM 或社区运营系统一定存在
- 任何固定目录、旧 memory-bank 或外部 runtime 安装脚本
- 任何会把 live sessions、memory 或真实工作产物回流进 repo 的说明

如果未来确实需要这些系统能力，只能通过：

- `overlay/skills/*`
- 或 live runtime 配置

显式补上。

## 不在本批做的事

本批不会：

- 把第四批角色直接加入 live 配置
- 假装提供 Search Console、App Store、Play Console 或 LinkedIn 账户后台访问
- 把 developer advocacy 角色变成新的工程执行主账号
- 把 image generation、video production 或 ASO 设计资产系统写死进角色骨架

## 当前状态

第四批完成后，应达到：

- `docs/agency` 对 discoverability 与 developer-facing 角色有明确归档
- 这 4 个角色在仓库中成为可装配的 incubating `agency-*` agent
- 不影响当前 `prod` 和 `staging` 的 live agent 清单
- `pnpm check:repo-layering`
- `pnpm ops:assemble`
- `pnpm ops:seed-workspaces --dry-run`

## 下一步

第四批之后，最合理的后续动作是：

1. 从 `agency-seo-specialist`、`agency-app-store-optimizer`、`agency-developer-advocate` 中挑 `1` 到 `2` 个做 `staging` 试跑
2. 再决定其中哪些能力更适合吸收到现有 `pc-frontend`、`pc-pm`、`pc-ceo_assistant` 或 app 相关角色
