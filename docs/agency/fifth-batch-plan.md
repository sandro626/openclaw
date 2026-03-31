# Agency 第五批迁移计划

## 目标

继续从 `agency-agents-main` 中迁入一批更偏 community、visual packaging、cross-cultural review 与 AI visual direction 的角色。

这一批仍然保持：

- 只落到 `overlay/agents/<id>/workspace/*`
- 只补 `runtime-templates/agents/<id>/config.patch.json`
- 不直接进入 `prod` 或 `staging` 的 `agents.list`

## 选择原则

第五批优先选择：

- 主要依赖公开 Web、公开社区内容、公开视频页面或明确的创意 brief
- 不要求广告控制台、私有社群后台、法务系统或内部数据仓库写权限
- 能独立提供方法论、审查框架、内容结构或创意输出方向

第五批避免选择：

- 高度依赖广告投放归因、私有数据管道或复杂运营平台的角色
- 强依赖专业法律、合规或高风险判断的角色
- 应优先吸收到现有 `pc-*`、`yz-app-*` 的工程、PM、测试类角色

## 第五批清单

| 类型     | 源文件                                                        | 目标 agent id                             | 兼容性 | 说明                                                    |
| -------- | ------------------------------------------------------------- | ----------------------------------------- | ------ | ------------------------------------------------------- |
| 本轮新增 | `marketing/marketing-video-optimization-specialist.md`        | `agency-video-optimization-specialist`    | 高     | 适合视频标题、包装、retention 结构与公开视频页面分析    |
| 本轮新增 | `marketing/marketing-reddit-community-builder.md`             | `agency-reddit-community-builder`         | 高     | 适合 subreddit 研究、AMA 规划、口碑与价值型社区参与策略 |
| 本轮新增 | `specialized/specialized-cultural-intelligence-strategist.md` | `agency-cultural-intelligence-strategist` | 中高   | 适合跨文化 UI、copy、prompt 与视觉语义审查              |
| 本轮新增 | `design/design-image-prompt-engineer.md`                      | `agency-image-prompt-engineer`            | 高     | 适合 AI 图像 prompt、视觉 brief 与资产生成前置设计指导  |

## 当前仓库落地范围

第五批现在在仓库中形成以下静态骨架：

- `agency-video-optimization-specialist`
- `agency-reddit-community-builder`
- `agency-cultural-intelligence-strategist`
- `agency-image-prompt-engineer`

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

- YouTube Studio、Reddit mod tools、社区后台或视觉资产管理系统天然可用
- 固定平台算法数据、A/B 测试后台或内部洞察一定存在
- 任何固定目录、旧 memory-bank 或外部 runtime 安装脚本
- 任何会把 live sessions、memory 或真实工作产物回流进 repo 的说明

如果未来确实需要这些系统能力，只能通过：

- `overlay/skills/*`
- 或 live runtime 配置

显式补上。

## 不在本批做的事

本批不会：

- 把第五批角色直接加入 live 配置
- 假装提供 YouTube、Reddit、社区运营或创意资产后台访问
- 把文化审查角色扩展成法律/合规裁定角色
- 把图像 prompt 工程角色硬绑定到某个单一模型或生成平台

## 当前状态

第五批完成后，应达到：

- `docs/agency` 对 community、visual packaging 与 cultural-review 角色有明确归档
- 这 4 个角色在仓库中成为可装配的 incubating `agency-*` agent
- 不影响当前 `prod` 和 `staging` 的 live agent 清单
- `pnpm check:repo-layering`
- `pnpm ops:assemble`
- `pnpm ops:seed-workspaces --dry-run`

## 下一步

第五批之后，最合理的后续动作是：

1. 从 `agency-video-optimization-specialist`、`agency-cultural-intelligence-strategist`、`agency-image-prompt-engineer` 中挑 `1` 到 `2` 个做 `staging` 试跑
2. 再决定其中哪些能力更适合吸收到现有 `pc-frontend`、`pc-ceo_assistant`、内容或品牌相关角色
