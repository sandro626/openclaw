# Agency 第六批迁移计划

## 目标

继续从 `agency-agents-main` 中迁入一批更偏中国平台内容分发、知识型内容运营与社区权威建设的角色。

这一批分成两类：

- 保留为 net-new `agency-*` 的 incubating 角色
- 吸收进现有 `ops/元小运` 的平台运营能力

## 选择原则

第六批优先选择：

- 可以基于公开平台页面、公开内容和公开社区行为先提供方法论价值
- 不要求平台后台、广告投放权限、私域 CRM 或私有数据仓库才能成立
- 与现有 `agency-*` 角色形成“中国平台内容分发”这一组清晰边界

第六批避免选择：

- 更强依赖实时热点运营、平台投放后台或危机舆情处置链路的角色
- 明显需要 live 平台运营权限才能成立的重执行型账号运营角色
- 应优先被吸收到现有 `pc-*`、`yz-app-*` 的工程、产品、测试角色

## 第六批清单

| 类型     | 源文件                                               | 目标 agent id                            | 兼容性 | 说明                                                       |
| -------- | ---------------------------------------------------- | ---------------------------------------- | ------ | ---------------------------------------------------------- |
| 本轮新增 | `marketing/marketing-bilibili-content-strategist.md` | `agency-bilibili-content-strategist`     | 高     | 适合视频内容包装、社区语境、danmaku 互动设计与内容系列规划 |
| 本轮新增 | `marketing/marketing-wechat-official-account.md`     | `agency-wechat-official-account-manager` | 高     | 适合公众号内容结构、菜单架构、订阅者价值设计与内容运营框架 |
| 吸收增强 | `marketing/marketing-xiaohongshu-specialist.md`      | `ops`                                    | 高     | 直接增强元小运的小红书内容节奏、种草叙事与社区运营能力     |
| 吸收增强 | `marketing/marketing-zhihu-strategist.md`            | `ops`                                    | 高     | 直接增强元小运的知乎问答策略、权威建设与长回答结构能力     |

## 当前仓库落地范围

第六批现在在仓库中形成以下 net-new 静态骨架：

- `agency-bilibili-content-strategist`
- `agency-wechat-official-account-manager`

这两个 net-new 角色具备：

- `IDENTITY.md`
- `AGENTS.md`
- `BOOTSTRAP.md`
- `TOOLS.md`
- `USER.md`
- `CLAUDE.md -> AGENTS.md`
- `runtime-templates/agents/<id>/config.patch.json`

本次对吸收型角色的处理方式是：

- 不保留 `agency-xiaohongshu-specialist`
- 不保留 `agency-zhihu-strategist`
- 直接把这两类方法论增强进 `overlay/agents/ops/workspace/*`

## 适配规则

迁入时必须显式去掉或改写以下假设：

- Bilibili、微信公众号、小红书、知乎后台天然可用
- 平台原生 analytics、粉丝数据、菜单系统、达人合作后台或内容审核后台一定存在
- 任何固定目录、旧 memory-bank 或外部 runtime 安装脚本
- 任何会把 live sessions、memory 或真实工作产物回流进 repo 的说明

如果未来确实需要这些系统能力，只能通过：

- `overlay/skills/*`
- 或 live runtime 配置

显式补上。

## 不在本批做的事

本批不会：

- 把第六批角色直接加入 live 配置
- 假装提供公众号后台、B 站后台、小红书商家或知乎创作后台访问
- 把中国平台内容角色扩展成实时投放、舆情或危机公关系统
- 把私域、广告投放和达人管理链路写死在 agent 骨架中
- 为被吸收的两类能力额外创建独立 live 账户

## 当前状态

第六批完成后，应达到：

- `docs/agency` 对中国平台内容分发角色有明确归档
- `agency-bilibili-content-strategist` 与 `agency-wechat-official-account-manager` 在仓库中成为可装配的 incubating `agency-*` agent
- `ops/元小运` 已吸收小红书与知乎的运营方法论
- 不影响当前 `prod` 和 `staging` 的 live agent 清单
- `pnpm check:repo-layering`
- `pnpm ops:assemble`
- `pnpm ops:seed-workspaces --dry-run`

## 下一步

第六批之后，最合理的后续动作是：

1. 从 `agency-bilibili-content-strategist` 与 `agency-wechat-official-account-manager` 中挑 `1` 到 `2` 个做 `staging` 试跑
2. 继续验证 `ops/元小运` 吸收小红书与知乎方法论后的行为是否符合运营专家定位
