---
name: zentao
description: "使用 Zentao / 禅道 API 管理产品、项目、迭代、需求、任务、测试用例和 Bug。要求 OpenClaw 已启用 zentao 插件，并在 agents.list[].params.zentao 中为当前机器人配置账号。"
---

# Zentao Skill

通用 Zentao 技能，供所有机器人直接使用。

这个 skill 依赖 `zentao` 插件已经启用，并且插件配置里至少已经设置：

- `baseUrl`
- `agents.list[].params.zentao.account`
- `agents.list[].params.zentao.password`

不要要求用户手动提供 token。插件会自动申请和复用 token。
每个机器人应使用自己在配置文件里的禅道账号。

## 何时使用

当用户提到以下任一场景时，优先使用这个 skill：

- 禅道 / Zentao
- 产品、项目、迭代、执行
- 需求、任务、Bug、测试用例
- 通过 API 管理项目管理对象，而不是通过浏览器手工录入

## 工作方式

1. 先调用 `zentao_meta` 解出 `productId`、`projectId`、`executionId`、`user`
2. 再调用对应对象工具
3. 写操作遵守插件 guardrails
4. 如果遇到 `read-only`、scope 或 `reason` 限制，直接按错误信息处理，不要绕过

## 工具概览

- `zentao_meta`
  - `list_products`
  - `list_projects`
  - `list_executions`
  - `list_users`
  - `resolve_context`
- `zentao_story`
  - `list`
  - `get`
  - `create`
  - `update`
- `zentao_task`
  - `list`
  - `get`
  - `create`
  - `update`
  - `assign`
  - `start`
  - `finish`
  - `close`
- `zentao_bug`
  - `list`
  - `get`
  - `create`
  - `update`
  - `assign`
  - `resolve`
  - `close`
  - `activate`
- `zentao_project`
  - `list`
  - `get`
  - `create`
  - `update`
- `zentao_execution`
  - `list`
  - `get`
  - `create`
  - `update`
  - `close`
- `zentao_testcase`
  - `list`
  - `get`
  - `create`
  - `update`

## 已验证的关键规则

这些规则已经通过真实联调和测试固化：

- `task.create` 需要 `estStarted`
- `task.close` 需要 `reason`
- `task.start` 需要 `left`
- `task.finish` 需要 `assignedTo`、`currentConsumed`、`consumed`、`finishedDate`
- `bug.resolve` 需要 `resolution` 和 `resolvedBuild`
- `bug.close` / `bug.activate` 需要 `reason`
- `story.create` 需要 `pri` 和 `category`
- `story.update` 会同时走：
  - `PUT /stories/:id`
  - `POST /stories/:id/change`
- `story` 某些实例需要 `reviewer`
- `testcase` 的 `steps/expected` 会被内部转换成 Zentao 步骤数组
- `project.create` 需要 `products`、`begin`、`PM`
- `execution.create` 需要 `begin`

## 示例

先解上下文：

```json
{ "action": "list_projects", "query": "V3" }
```

创建任务：

```json
{
  "action": "create",
  "executionId": 38,
  "name": "补充接口联调",
  "type": "devel",
  "assignedTo": "zhongle",
  "estimate": 4,
  "estStarted": "2026-03-21",
  "deadline": "2026-03-24"
}
```

创建 Bug：

```json
{
  "action": "create",
  "productId": 7,
  "projectId": 37,
  "title": "新增 API 返回字段缺失",
  "steps": "[步骤]\\n1. 调用接口\\n[结果]\\n字段缺失\\n[期望]\\n字段完整",
  "openedBuild": "主干",
  "type": "codeerror",
  "severity": 3,
  "pri": 3
}
```

更新需求：

```json
{
  "action": "update",
  "productId": 7,
  "storyId": 92,
  "title": "统一禅道 Skill 能力",
  "category": "improve",
  "pri": 2,
  "reviewer": ["zhongle"],
  "spec": "更新后的需求描述",
  "verify": "更新后的验收标准"
}
```

创建测试用例：

```json
{
  "action": "create",
  "productId": 7,
  "projectId": 37,
  "title": "API 字段完整性检查",
  "type": "feature",
  "pri": 3,
  "steps": "调用接口并检查字段",
  "expected": "返回字段完整"
}
```

## 参考

- 插件说明：
  [`extensions/zentao/README.md`](/home/zhongle/dev/openclaw-main/extensions/zentao/README.md)
- 插件内 skill：
  [`extensions/zentao/skills/zentao/SKILL.md`](/home/zhongle/dev/openclaw-main/extensions/zentao/skills/zentao/SKILL.md)
- 示例配置：
  [`extensions/zentao/config.example.json`](/home/zhongle/dev/openclaw-main/extensions/zentao/config.example.json)
