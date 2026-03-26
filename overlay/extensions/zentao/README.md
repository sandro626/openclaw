# Zentao (OpenClaw plugin)

Generic Zentao plugin and skill for OpenClaw.

It uses Zentao `API v1` and is designed around the user model you actually want:

- configure `baseUrl`
- configure each robot's `agents.list[].params.zentao`
- let the agent use the bundled `zentao` skill

The plugin handles token acquisition and reuse automatically. Users should not
need to pass a token manually. Each robot can use its own Zentao account.

## What it provides

Tools:

- `zentao_meta`
- `zentao_story`
- `zentao_task`
- `zentao_bug`
- `zentao_project`
- `zentao_execution`
- `zentao_testcase`

Skill:

- `zentao`

The skill lives at
[`skills/zentao/SKILL.md`](/home/zhongle/dev/openclaw-main/extensions/zentao/skills/zentao/SKILL.md)
and tells the agent how to resolve IDs and call the generic tools safely.

## Enable

Bundled plugins are disabled by default. Enable `zentao` under
`plugins.entries`.

```json
{
  "plugins": {
    "entries": {
      "zentao": {
        "enabled": true,
        "config": {
          "baseUrl": "https://chandao.example.com"
        }
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "skills": ["zentao"],
        "params": {
          "zentao": {
            "account": "pm-user",
            "password": "${ZENTAO_PM_PASSWORD}"
          }
        }
      }
    ]
  }
}
```

Restart the Gateway after enabling.

A copy-pasteable example file is available at
[`config.example.json`](/home/zhongle/dev/openclaw-main/extensions/zentao/config.example.json).

## Recommended config

For production use, do not stop at the minimal config. Set write mode and
scope limits explicitly.

```json
{
  "plugins": {
    "entries": {
      "zentao": {
        "enabled": true,
        "config": {
          "baseUrl": "https://chandao.example.com",
          "apiVersion": "v1",
          "verifyTls": true,
          "requestTimeoutMs": 15000,
          "mode": "read-only",
          "allowedProducts": [7],
          "allowedProjects": [37],
          "allowedExecutions": [38],
          "writeGuards": {
            "requireReason": true,
            "requireScopeMatch": true,
            "confirmBeforeDestructive": true
          }
        }
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "skills": ["zentao"],
        "params": {
          "zentao": {
            "account": "pm-user",
            "password": "${ZENTAO_PM_PASSWORD}"
          }
        }
      },
      {
        "id": "dev",
        "skills": ["zentao"],
        "params": {
          "zentao": {
            "account": "dev-user",
            "password": "${ZENTAO_DEV_PASSWORD}"
          }
        }
      },
      {
        "id": "tester",
        "skills": ["zentao"],
        "params": {
          "zentao": {
            "account": "tester-user",
            "password": "${ZENTAO_TESTER_PASSWORD}"
          }
        }
      }
    ]
  }
}
```

## Config reference

- `baseUrl`: Zentao base URL. Must be HTTPS.
- `apiVersion`: only `v1` is currently supported.
- `agents.list[].params.zentao.account`: per-agent Zentao username.
- `agents.list[].params.zentao.password`: per-agent Zentao password.
- `account`: optional default Zentao username used only as a fallback when the
  current agent has no dedicated mapping.
- `password`: optional default Zentao password used with the fallback account.
- `verifyTls`: whether TLS certificates should be verified.
- `requestTimeoutMs`: per-request timeout.
- `mode`: `read-only` or `read-write`.
- `allowedProducts`: optional product allowlist.
- `allowedProjects`: optional project allowlist.
- `allowedExecutions`: optional execution allowlist.
- `writeGuards.requireReason`: require a reason for risky actions like
  `close`, `resolve`, and `activate`.
- `writeGuards.requireScopeMatch`: reject writes outside the configured scope.
- `writeGuards.confirmBeforeDestructive`: reserved policy flag for future
  confirmation flows.

## Suggested rollout

Start with:

- `mode: "read-only"`
- explicit `agents.list[].params.zentao` mappings for the robots that should touch Zentao
- a narrow allowlist in `allowedProducts`, `allowedProjects`, and
  `allowedExecutions`

After read-only validation succeeds, switch to `read-write` only for the
products and projects you want the agent to manage.

## Example usage

Once enabled, the agent should use `zentao_meta` first to resolve IDs and then
call a domain tool.

Find a project or sprint:

```json
{ "action": "list_projects", "query": "V3" }
```

List tasks under an execution:

```json
{ "action": "list", "executionId": 38, "limit": 20 }
```

Create a task:

```json
{
  "action": "create",
  "executionId": 38,
  "name": "补充接口联调",
  "type": "devel",
  "assignedTo": "zhongle",
  "estimate": 4,
  "estStarted": "2026-03-21",
  "deadline": "2026-03-24",
  "desc": "通过 OpenClaw 的 Zentao skill 创建"
}
```

Create a bug:

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

Update a story with review metadata and changed content:

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

Create a test case:

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

## Notes from live validation

These rules were validated against a real Zentao `21.7.5` instance and are also
covered by tests:

- task creation requires `estStarted`
- story creation requires `pri` and `category`
- story content changes use `POST /stories/:id/change`
- story review updates may require `reviewer`
- test case steps must be sent as Zentao step objects internally
- project creation requires `products`, `begin`, and `PM`
- execution creation requires `begin`

## Validation

Protocol and guardrail tests now cover:

- tool request shapes and required fields
- auth token acquisition and caching
- client retry behavior on `401/403`
- guardrails for read-only mode, reason requirements, and scope enforcement

Useful commands:

```bash
pnpm exec vitest run extensions/zentao/src/tools/protocol.test.ts
pnpm exec vitest run extensions/zentao/src/auth.test.ts extensions/zentao/src/client.test.ts extensions/zentao/src/guardrails.test.ts
```

## Related files

- [`DESIGN.md`](/home/zhongle/dev/openclaw-main/extensions/zentao/DESIGN.md)
- [`TASKS.md`](/home/zhongle/dev/openclaw-main/extensions/zentao/TASKS.md)
- [`SKILL.md`](/home/zhongle/dev/openclaw-main/extensions/zentao/skills/zentao/SKILL.md)
- [`config.example.json`](/home/zhongle/dev/openclaw-main/extensions/zentao/config.example.json)
