# gstack 能力迁移

## 目标

把外部 `gstack` 仓库里的能力迁到 OpenClaw，但保持当前三层结构：

- `core/upstream`
- `overlay`
- `runtime`

迁移目标不是把 `gstack` 原样装进 OpenClaw，而是把其中真正有价值的能力拆成：

1. OpenClaw 插件能力
2. OpenClaw 私有技能
3. 吸收到现有业务 agent 的方法论
4. 仅保留为 operator workflow 的后台流程

## 文档

- [Migration Plan](/gstack/migration-plan)
- [Capability Mapping](/gstack/capability-mapping)

## 当前结论

`gstack` 不应该按 `27` 个 skill 原样导入。

最优方案是：

- 浏览器运行时只保留一个主实现，继续以 OpenClaw 自带 `browser` 插件为核心
- 流程型 skill 收敛成少量 `overlay/skills/gstack-*` 能力包
- 一部分角色方法论吸收到现有 agent，例如 `pc-ceo_assistant`、`pc-pm`、`cto`、`dev`、`ops`
- 安全/冻结/升级这类 operator 工具不作为普通对话能力暴露

## 推荐落点

### 插件层

适合进入或增强：

- `extensions/browser`

### 私有 skill 层

适合进入：

- `overlay/skills/gstack-*`

### agent 方法论层

适合吸收进：

- `overlay/agents/pc-ceo_assistant/workspace/*`
- `overlay/agents/pc-pm/workspace/*`
- `overlay/agents/cto/workspace/*`
- `overlay/agents/dev/workspace/*`
- `overlay/agents/ops/workspace/*`
- `overlay/agents/pc-code_reviewer/workspace/*`
- `overlay/agents/pc-pctester/workspace/*`

### runtime 层

只保留：

- 浏览器登录态
- deploy 目标地址
- 评审基线
- 历史会话与输出

这些内容不回流进仓库。
