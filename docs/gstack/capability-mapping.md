# gstack 能力映射矩阵

本文把 `gstack` 的 `27` 个 top-level skill 逐项映射到 OpenClaw 的正确落点。

## 规划与设计

| gstack skill          | 主要价值           | OpenClaw 落点                        | 机器人侧承载                | 说明                                     |
| --------------------- | ------------------ | ------------------------------------ | --------------------------- | ---------------------------------------- |
| `office-hours`        | 产品问题重构       | `overlay/skills/gstack-strategy`     | `pc-ceo_assistant`, `pc-pm` | 作为前置提问框架，不保留 gstack preamble |
| `autoplan`            | 方案自动成型       | `overlay/skills/gstack-strategy`     | `pc-pm`                     | 可与现有 `agent-orchestrator` 配合       |
| `plan-ceo-review`     | CEO 视角取舍       | `overlay/skills/gstack-strategy`     | `pc-ceo_assistant`          | 适合长期并入元小芯                       |
| `plan-eng-review`     | 架构/边界/测试     | `overlay/skills/gstack-architecture` | `cto`, `dev`                | 适合与 `claude-code-task` 协同           |
| `plan-design-review`  | 设计维度评分       | `overlay/skills/gstack-design`       | `pc-pm`, `pc-frontend`      | 不单独建账号                             |
| `design-consultation` | 设计系统与创意方案 | `overlay/skills/gstack-design`       | `pc-pm`, `pc-frontend`      | 适合与现有 Agency 设计角色融合           |

## 工程评审与调试

| gstack skill  | 主要价值                | OpenClaw 落点                                 | 机器人侧承载                              | 说明                                                                     |
| ------------- | ----------------------- | --------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| `review`      | pre-landing code review | `overlay/skills/gstack-review`                | `cto`, `dev`, `pc-code_reviewer`          | 直接面向对话最有价值的一组                                               |
| `investigate` | 根因排查                | `overlay/skills/gstack-investigate`           | `dev`, `cto`, `pc-backend`, `pc-frontend` | 与现有 debug workflow 高度兼容                                           |
| `codex`       | 第二意见/对抗审查       | 吸收到 `gstack-review` / `gstack-investigate` | `cto`, `dev`, `pc-code_reviewer`          | 复用现有 `skills/coding-agent` 或 `claude-code-task`，不先单独迁 wrapper |
| `cso`         | 安全威胁建模            | `overlay/skills/gstack-security`              | `cto`, `pc-devops`                        | 默认只给技术角色                                                         |

## QA 与浏览器验证

| gstack skill            | 主要价值              | OpenClaw 落点                                                     | 机器人侧承载                          | 说明                           |
| ----------------------- | --------------------- | ----------------------------------------------------------------- | ------------------------------------- | ------------------------------ |
| `qa`                    | 浏览器测试 + 修复循环 | `overlay/skills/gstack-qa`                                        | `pc-pctester`, `dev`                  | 以现有 `browser` 插件为执行面  |
| `qa-only`               | 浏览器测试报告        | `overlay/skills/gstack-qa` 的 report-only 模式                    | `pc-pctester`                         | 不需要单独 skill               |
| `design-review`         | 视觉审计 + 修复建议   | `overlay/skills/gstack-design` 或 `gstack-qa` 子模式              | `pc-pctester`, `pc-frontend`, `pc-pm` | 取决于最终实现方式             |
| `browse`                | 快速 headless 浏览器  | 增强 `extensions/browser` + `overlay/skills/gstack-browser-qa`    | 所有需要浏览器的 agent                | 不迁第二套 daemon              |
| `setup-browser-cookies` | 认证页面测试前置      | `overlay/skills/gstack-browser-login` 或增强现有 browser 登录流程 | `pc-pctester`, `dev`, `ops`           | 不引入 `~/.gstack/browse.json` |

## 发布、部署与复盘

| gstack skill       | 主要价值              | OpenClaw 落点                        | 机器人侧承载                     | 说明                       |
| ------------------ | --------------------- | ------------------------------------ | -------------------------------- | -------------------------- |
| `document-release` | 发布后文档同步        | `overlay/skills/gstack-release-docs` | `pc-ceo_assistant`, `ops`, `dev` | 对话价值高，可较早迁入     |
| `retro`            | 复盘与趋势总结        | `overlay/skills/gstack-retro`        | `ops`, `pc-ceo_assistant`        | 更适合管理者和运营         |
| `ship`             | 测试/评审/PR/发版串联 | `overlay/skills/gstack-release-ops`  | `ops`, `dev`                     | 默认 operator-only         |
| `setup-deploy`     | 部署元数据配置        | `overlay/skills/gstack-deploy-setup` | `ops`                            | 默认 operator-only         |
| `land-and-deploy`  | 合并并部署            | `overlay/skills/gstack-release-ops`  | `ops`                            | 不面向普通聊天入口         |
| `canary`           | 灰度/探针验证         | `overlay/skills/gstack-release-ops`  | `ops`                            | 与现有 live smoke 流程结合 |
| `benchmark`        | 回归对比/性能检查     | `overlay/skills/gstack-benchmark`    | `ops`, `dev`                     | 可后置迁移                 |

## 安全与控制流

| gstack skill     | 主要价值         | OpenClaw 落点      | 机器人侧承载    | 说明                             |
| ---------------- | ---------------- | ------------------ | --------------- | -------------------------------- |
| `careful`        | 危险命令提醒     | hook / admin skill | operator only   | 不建议面向普通用户               |
| `freeze`         | 目录编辑冻结     | hook / admin skill | operator only   | 更像策略，不像对话技能           |
| `guard`          | careful + freeze | hook / admin skill | operator only   | 保留为管理员能力                 |
| `unfreeze`       | 解锁冻结         | hook / admin skill | operator only   | 同上                             |
| `gstack-upgrade` | gstack 自升级    | 不迁               | maintainer only | 用 OpenClaw 自己的维护工作流替代 |

## 最优收敛结果

把 `27` 个 gstack skill 收敛成下面几类：

### 私有 skill packs

- `gstack-strategy`
- `gstack-architecture`
- `gstack-design`
- `gstack-review`
- `gstack-investigate`
- `gstack-qa`
- `gstack-security`
- `gstack-release-ops`
- `gstack-release-docs`
- `gstack-browser-login`
- `gstack-benchmark`
- `gstack-retro`

### 插件增强

- `extensions/browser`

### 现有 agent 吸收

- `pc-ceo_assistant`
- `pc-pm`
- `cto`
- `dev`
- `ops`
- `pc-code_reviewer`
- `pc-pctester`

### 不迁入普通对话面

- `careful`
- `freeze`
- `guard`
- `unfreeze`
- `gstack-upgrade`

## 推荐先做的第一波

最优第一波不是按目录做，而是按价值做：

1. `review`
2. `investigate`
3. `qa`
4. `office-hours`
5. `plan-ceo-review`
6. `plan-eng-review`
7. `browse` 缺口能力
8. `document-release`

这一波完成后，OpenClaw 机器人就已经能获得 `gstack` 最有价值的对话能力了。
