# Agency 第七批迁移计划

## 目标

继续从 `agency-agents-main` 中迁入一批更偏中国平台传播、短视频分发与搜索可见性的角色。

这一批分成两类：

- 保留为 net-new `agency-*` 的 incubating 角色
- 吸收进现有 `ops/元小运` 的平台增长能力

## 选择原则

第七批优先选择：

- 即使没有平台后台，也能通过公开页面、公开内容和公开搜索结果提供方法论价值
- 与已有第六批形成“中国平台增长与搜索”这一组清晰边界
- 能映射到现有 OpenClaw 工具，而不需要先引入私有投放系统或商业后台

第七批避免选择：

- 更强依赖私域 CRM、广告后台、订单系统或电商履约数据的角色
- 需要持续直播控场、带货后台或重运营团队协同才能成立的角色
- 更适合吸收到现有 `pc-*`、`ops`、`pc-ceo_assistant` 的角色

## 第七批清单

| 类型     | 源文件                                        | 目标 agent id | 兼容性 | 说明                                                         |
| -------- | --------------------------------------------- | ------------- | ------ | ------------------------------------------------------------ |
| 吸收增强 | `marketing/marketing-douyin-strategist.md`    | `ops`         | 中高   | 直接增强元小运的短视频结构、分发节奏与公开视频包装能力       |
| 吸收增强 | `marketing/marketing-kuaishou-strategist.md`  | `ops`         | 中高   | 直接增强元小运的下沉市场语境、老铁关系与社区信任运营能力     |
| 吸收增强 | `marketing/marketing-weibo-strategist.md`     | `ops`         | 中高   | 直接增强元小运的话题传播、热点响应与公开舆论场运营能力       |
| 吸收增强 | `marketing/marketing-baidu-seo-specialist.md` | `ops`         | 高     | 直接增强元小运的中文搜索可见性、Baidu 生态与中国搜索合规框架 |

## 当前仓库落地范围

本次对吸收型角色的处理方式是：

- 不保留 `agency-douyin-strategist`
- 不保留 `agency-kuaishou-strategist`
- 不保留 `agency-weibo-strategist`
- 不保留 `agency-baidu-seo-specialist`
- 直接把这四类方法论增强进 `overlay/agents/ops/workspace/*`

## 适配规则

迁入时必须显式去掉或改写以下假设：

- Douyin、Kuaishou、Weibo 或 Baidu 后台天然可用
- 任何广告平台、投流账户、SEO console、Webmaster 工具或私有 analytics 已连接
- 任何固定目录、旧 memory-bank 或外部 runtime 安装脚本
- 任何会把 live sessions、memory 或真实工作产物回流进 repo 的说明

如果未来确实需要这些系统能力，只能通过：

- `overlay/skills/*`
- 或 live runtime 配置

显式补上。

## 不在本批做的事

本批不会：

- 为被吸收的四类能力额外创建独立 live 账户
- 假装提供 Douyin、Kuaishou、Weibo、Baidu Webmaster 或广告后台访问
- 把短视频运营建议扩展成真实投放、直播团队或舆情应急系统
- 把 ICP、服务器在华、审核与广告合规之类前置条件写成已经满足的既成事实

## 当前状态

第七批完成后，应达到：

- `docs/agency` 对中国平台增长与搜索角色有明确归档
- `ops/元小运` 已吸收 Douyin、Kuaishou、Weibo 与 Baidu SEO 的方法论
- 不影响当前 `prod` 和 `staging` 的 live agent 清单
- `pnpm check:repo-layering`
- `pnpm ops:assemble`
- `pnpm ops:seed-workspaces --dry-run`

## 下一步

第七批之后，最合理的后续动作是：

1. 继续验证 `ops/元小运` 吸收中国平台增长与搜索方法论后的行为是否符合运营专家定位
2. 再决定后续哪一批更适合保留为 net-new `agency-*`，哪一批更应该继续吸收到现有业务角色
