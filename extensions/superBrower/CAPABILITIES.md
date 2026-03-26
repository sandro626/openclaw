# superBrower Capability Report

## Positioning

`superBrower` is a general browser automation extension for OpenClaw.

It uses:

- Playwright + CDP as the deterministic executor
- a reusable action DSL as the control surface
- an optional planner model for goal-to-action planning
- site profiles as configuration, not site scripts

The current planner default is:

- provider style: MiniMax anthropic-compatible
- model: `MiniMax-M2.7`
- api key env: `MINIMAX_API_KEY`

## Current actions

`superBrower` currently supports these actions through `super_browser`:

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

## What it can do today

### Core browser execution

- Open pages through direct navigation.
- Capture page snapshots with URL, title, visible body text, inputs, and button summaries.
- Fill structured form fields by field name or explicit selector.
- Toggle agreement checkboxes and similar controls.
- Click submit, next, login, confirm, and other actionable controls with fallback strategies.
- Wait for selector, text, or URL transitions.

### MFA and OTP handling

- Detect and operate single-input OTP forms.
- Detect and operate multi-input OTP forms.
- Prefer OTP selectors from site profiles instead of relying on fragile page text.
- Fall back from planner-provided OTP selectors to profile selectors when needed.

### Planner-driven execution

- Use `MiniMax-M2.7` to turn user goals into browser DSL steps.
- Normalize weak planner output into safer login-oriented steps.
- Keep the model responsible for planning, not direct DOM execution.

### Auth-state reasoning

- Detect `success`, `failure`, or `unknown` states based on profile signals.
- Explain whether a site is:
  - unauthenticated
  - authenticated but on a bad route
  - authenticated but has empty menus
  - authenticated and healthy
- Recover from bad post-login landing routes when valid route candidates exist.

### Diagnostics

- Capture cookies.
- Capture localStorage and sessionStorage.
- Capture console messages.
- Capture recent requests and responses.
- Preserve selected response body snippets for login, auth, menu, permission, and route analysis.

## Verified behavior

`superBrower` has been tested end-to-end against `https://bmsys-test.cdyzyc.com/`.

The validated login chain is:

1. Open login page
2. Fill username and password
3. Toggle agreement control
4. Click the first-stage submit button
5. Detect transition into OTP stage
6. Fill the 6-digit verification code
7. Submit the OTP stage
8. Detect resulting auth state

This means the executor is already proven to handle:

- multi-stage login
- selector-based progression checks
- OTP stage transitions
- login success detection beyond URL checks

## Verified `bmsys-test` finding

For `bmsys-test`, the remaining problem is not browser execution.

The observed post-login state is:

- authentication succeeds
- access token exists in localStorage
- `GET /system/user/menus` returns success
- menu payload is empty:
  - `menus: []`
  - `permissions: []`
- frontend default home path is `/screens/school-control/`
- the browser lands on `#/screens/school-control/`
- that route renders a `404`

So the current site-side issue is:

- account or role has no menus
- and the default home route is invalid for the returned menu state

## Why this is better than the previous browser tool

- The executor is deterministic instead of prompt-only.
- Profiles are data, not one-off site scripts.
- Clicking is verified by page progression, not assumed.
- Login success is not guessed from a single URL change.
- Failures can be explained in structured form.
- Diagnostics are built in, not ad hoc.

## Current limits

`superBrower` is strong for login, MFA, form filling, and route recovery. It is
not yet a full browser RPA platform.

Current limits include:

- planner quality still depends on prompt quality and profile quality
- heavily custom widgets may still need profile refinement
- iframe, shadow DOM, drag-and-drop, and rich editors are not yet deeply optimized
- route recovery works best when the site exposes route candidates through storage or APIs

## Testing status

The current local test coverage includes:

- auth-state summary helpers
- landing recovery helpers
- site-profile matching

Relevant test files:

- `extensions/superBrower/src/tool.test.ts`
- `extensions/superBrower/src/site-profiles.test.ts`

The latest local validation passed:

- `vitest`
- `oxlint`
- `oxfmt`

## Deployment status

`superBrower` has already been deployed to the gateway server used for live
validation, and its planner path is configured for `MiniMax-M2.7`.

## Practical conclusion

`superBrower` is already good enough for:

- general login automation
- OTP and MFA workflows
- structured form automation
- auth-state analysis
- post-login route diagnosis

For sites that still fail after login, the next question is often site
configuration or account permission state, not whether the executor clicked the
right button.
