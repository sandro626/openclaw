# Zentao Extension Design

## Goal

Build an OpenClaw extension at `extensions/zentao` that uses Zentao RESTful API v1 to access and manage:

- stories
- tasks
- projects
- executions
- test cases
- bugs

The extension is API-first. It does not depend on browser automation for core CRUD flows.

## Context

- Target site currently exposes `api.php/v1`
- Token creation via `POST /api.php/v1/tokens` is available
- Core read endpoints such as `/users` and `/products` are reachable
- The deployed Zentao instance appears to be in the `21.7.x` line

This makes a v1-based tool plugin practical now without waiting for v2.

## Design Principles

- Default safe: read-only unless explicitly enabled for writes
- Structured tools: one domain tool per object area, not one giant tool
- Stable schemas: flat TypeBox object schemas with `action`
- Auditable writes: every write action returns structured details
- Scope guards: writes can be constrained by allowed products, projects, and executions
- API-first: no UI recording fallback inside the extension

## Extension Shape

Register the following tools:

- `zentao_meta`
- `zentao_story`
- `zentao_task`
- `zentao_project`
- `zentao_execution`
- `zentao_testcase`
- `zentao_bug`

Each tool owns one object domain and exposes a small action set.

## Proposed Directory Layout

```text
extensions/zentao/
  index.ts
  openclaw.plugin.json
  package.json
  README.md
  DESIGN.md
  TASKS.md
  src/
    config-schema.ts
    types.ts
    runtime.ts
    auth.ts
    client.ts
    errors.ts
    guardrails.ts
    result.ts
    tools/
      meta.ts
      story.ts
      task.ts
      project.ts
      execution.ts
      testcase.ts
      bug.ts
    test/
      auth.test.ts
      client.test.ts
      guardrails.test.ts
      meta.tool.test.ts
      story.tool.test.ts
      task.tool.test.ts
      bug.tool.test.ts
```

## File Responsibilities

### `index.ts`

- Parse plugin config
- Create shared runtime state
- Register all Zentao tools

### `src/config-schema.ts`

- Validate plugin config with zod
- Define write mode and scope restrictions

### `src/auth.ts`

- Create token via `/api.php/v1/tokens`
- Cache token in memory
- Refresh once on auth failure

### `src/client.ts`

- Build request URLs
- Attach token
- Set timeout
- Parse JSON
- Normalize API errors

### `src/guardrails.ts`

- Reject writes in read-only mode
- Enforce allowed product or project scope
- Require reason for risky actions

### `src/result.ts`

- Create consistent OpenClaw tool results

### `src/tools/*.ts`

- Define schema for a domain tool
- Validate action-specific requirements
- Map domain actions to Zentao API calls

## Configuration Model

Suggested plugin config:

```json
{
  "baseUrl": "https://chandao.cdyzyc.com",
  "apiVersion": "v1",
  "account": "zhongle",
  "password": "env:ZENTAO_PASSWORD",
  "verifyTls": true,
  "requestTimeoutMs": 15000,
  "mode": "read-only",
  "allowedProducts": [7, 9],
  "allowedProjects": [1, 3],
  "allowedExecutions": [],
  "writeGuards": {
    "requireReason": true,
    "requireScopeMatch": true,
    "confirmBeforeDestructive": true
  }
}
```

### Required fields

- `baseUrl`
- `account`
- `password`

### Optional fields

- `apiVersion`
- `verifyTls`
- `requestTimeoutMs`
- `mode`
- `allowedProducts`
- `allowedProjects`
- `allowedExecutions`
- `writeGuards`

## Runtime Model

Shared runtime state should contain:

- parsed config
- authenticated Zentao client
- token cache metadata

Use a single shared client for all tools registered by the plugin.

## Tool Domains

### `zentao_meta`

Purpose:

- resolve IDs before write operations
- avoid model guessing across products or projects

Initial actions:

- `list_products`
- `list_projects`
- `list_executions`
- `list_users`
- `resolve_context`

### `zentao_story`

Initial actions:

- `list`
- `get`
- `create`
- `update`

### `zentao_task`

Initial actions:

- `list`
- `get`
- `create`
- `update`
- `assign`
- `start`
- `finish`
- `close`

### `zentao_project`

Initial actions:

- `list`
- `get`
- `create`
- `update`

### `zentao_execution`

Initial actions:

- `list`
- `get`
- `create`
- `update`
- `close`

### `zentao_testcase`

Initial actions:

- `list`
- `get`
- `create`
- `update`

### `zentao_bug`

Initial actions:

- `list`
- `get`
- `create`
- `update`
- `assign`
- `resolve`
- `close`
- `activate`

## Schema Rules

Follow repository tool-schema guardrails:

- use `Type.Object`
- use `stringEnum` and `optionalStringEnum`
- avoid `Type.Union`
- avoid `anyOf`, `oneOf`, `allOf`
- set `additionalProperties: false`

Each tool should use one flat schema with an `action` field.

## Guardrails

Required guardrails:

- writes disabled by default
- write actions require `mode = read-write`
- risky actions require `reason` when enabled
- write scope must match configured allowlists when enabled
- no arbitrary endpoint passthrough
- no batch mutation in v1 of the plugin

High-risk actions include:

- `close`
- `resolve`
- `activate`
- future `delete`

## Result Format

Every tool returns:

```ts
type AgentToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details?: unknown;
};
```

For reads, `details` should include:

- `action`
- `resourceType`
- `items` or `item`
- `requestPath`

For writes, `details` should additionally include:

- `resourceId`
- `changedFields`
- `reason`
- `scope`

## Delivery Phases

### Phase 0

- plugin skeleton
- config schema
- auth
- client
- meta tool

### Phase 1

- task tool
- bug tool

### Phase 2

- story tool
- project tool
- execution tool

### Phase 3

- testcase tool
- docs and polish

## Out of Scope for Initial Version

- browser automation fallback
- attachment upload
- bulk update or delete
- free-form endpoint proxying
- v2 API support
- complex comment formatting support

## Acceptance Criteria

- plugin loads successfully
- `zentao_meta` can list products, users, and projects
- token auth is automatic
- write actions are blocked in read-only mode
- first write flows exist for tasks and bugs
- tool results are structured and auditable
