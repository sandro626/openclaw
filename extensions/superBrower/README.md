# superBrower

`superBrower` is a reusable browser automation extension built on Playwright and
CDP. It is designed to avoid one-site-one-script automation.

For the current capability report, verified coverage, and known limits, see
[CAPABILITIES.md](./CAPABILITIES.md).

## Goals

- keep browser execution deterministic
- let the agent work through reusable browser actions
- support site-level selector profiles instead of site-level scripts

## Tool

- `super_browser`

## Core actions

- `list_site_profiles`
- `get_site_profile`
- `navigate`
- `snapshot`
- `fill_fields`
- `toggle`
- `click`
- `type_otp`
- `wait_for`
- `plan_task`
- `execute_goal`
- `detect_state`
- `explain_auth_state`
- `recover_landing`
- `capture_diagnostics`
- `run_plan`

## Config example

```json
{
  "plugins": {
    "entries": {
      "superBrower": {
        "enabled": true,
        "config": {
          "cdpUrl": "http://127.0.0.1:9222",
          "connectTimeoutMs": 15000,
          "actionTimeoutMs": 10000,
          "snapshotMaxLength": 4000,
          "planner": {
            "enabled": true,
            "baseUrl": "https://api.minimax.io/anthropic",
            "apiKeyEnv": "MINIMAX_API_KEY",
            "model": "MiniMax-M2.7",
            "maxTokens": 2048,
            "maxSteps": 8,
            "temperature": 0.1
          },
          "siteProfiles": [
            {
              "id": "bmsys-test",
              "urlPatterns": ["https://bmsys-test.cdyzyc.com/*"],
              "fieldConfigs": [
                {
                  "name": "username",
                  "selectors": ["input[name='username']"]
                },
                {
                  "name": "password",
                  "selectors": ["input[name='password']"]
                }
              ],
              "agreementSelectors": ["button[data-state='unchecked']", "button[role='checkbox']"],
              "submitSelectors": ["button:has-text('下一步')", "button:has-text('登录')"],
              "otpSelectors": ["input[inputmode='numeric']", "input[maxlength=\"1\"]"],
              "otpMode": "digits",
              "successSignals": [
                {
                  "type": "localStorage",
                  "key": "vben-web-ele-5.5.9-prod-core-access",
                  "value": "="
                },
                {
                  "type": "response",
                  "value": "/system/user/menus",
                  "status": 200
                }
              ],
              "failureSignals": [
                { "type": "text", "value": "短信验证码错误" },
                { "type": "text", "value": "未找到页面" },
                { "type": "title", "value": "404" }
              ],
              "postLoginCandidates": [
                "https://bmsys-test.cdyzyc.com/#/",
                "https://bmsys-test.cdyzyc.com/#/screens/school-control/",
                "https://bmsys-test.cdyzyc.com/#/auth/login"
              ]
            }
          ]
        }
      }
    }
  }
}
```

## Why this is better

- the executor is generic
- the planner model is optional and only decides actions
- the skill stays generic
- site changes usually mean config updates, not code rewrites
- success and failure are profile-driven, not hidden in site scripts

## Signal types

- `text`
- `url`
- `title`
- `cookie`
- `localStorage`
- `sessionStorage`
- `request`
- `response`

## Verified outcome

`superBrower` has been validated on `bmsys-test.cdyzyc.com` for:

- username/password login
- agreement toggle
- OTP page transition
- 6-digit OTP input
- auth-state detection
- diagnostics capture

For this site, the remaining post-login problem is not browser execution. The
account logs in successfully, but the backend returns an empty menu payload and
the frontend falls through to a bad default route.
