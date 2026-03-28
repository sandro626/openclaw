---
name: superBrower
description: 使用 Playwright + CDP 的通用网页执行器完成网页导航、表单填写、MFA 输入和站点配置化自动化。适合需要稳定 DOM 级交互、但又不想为每个站点写专用脚本的场景。
---

# superBrower

Use this skill when the task requires reliable browser execution, not vague
browser narration.

## Principles

1. Use `super_browser` as the executor.
2. Prefer reusable actions over ad-hoc site scripting.
3. Use `siteProfileId` when a site profile exists.
4. For MFA or OTP pages, use `type_otp` instead of plain `fill_fields`.
5. When planner is enabled, use `plan_task` or `execute_goal` for goal-to-DSL planning.
6. After login or route changes, use `detect_state`.
7. If auth succeeded but the site still behaves oddly, use `explain_auth_state`.
8. If a route is bad but login succeeded, use `recover_landing`.
9. If a site still behaves unexpectedly, use `capture_diagnostics`.

## Recommended flow

1. `navigate`
2. `snapshot`
3. `fill_fields`
4. `toggle`
5. `click`
6. `type_otp`
7. `plan_task`
8. `execute_goal`
9. `detect_state`
10. `explain_auth_state`
11. `recover_landing`
12. `capture_diagnostics`
13. `wait_for`

## Example

站点相关账号、密码、OTP 不要写死在 profile JSON 或 skill 里，应通过 runtime 注入的环境变量传入。

```json
{
  "action": "run_plan",
  "siteProfileId": "bmsys-test",
  "steps": [
    { "action": "navigate", "url": "$BMSYS_TEST_URL" },
    { "action": "fill_fields", "name": "username", "value": "$BMSYS_TEST_USERNAME" },
    { "action": "fill_fields", "name": "password", "value": "$BMSYS_TEST_PASSWORD" },
    { "action": "toggle" },
    { "action": "click" },
    { "action": "type_otp", "otp": "$BMSYS_TEST_OTP" },
    { "action": "detect_state" },
    { "action": "explain_auth_state" },
    { "action": "recover_landing" }
  ]
}
```

Planner defaults:

- provider style: MiniMax anthropic-compatible
- model: `MiniMax-M2.7`
- api key env: `MINIMAX_API_KEY`
