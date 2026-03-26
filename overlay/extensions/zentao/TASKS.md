# Zentao Extension Task Breakdown

## Phase 0: Skeleton and Shared Runtime

### 0.1 Create plugin scaffold

- Add `index.ts`
- Add `openclaw.plugin.json`
- Add `package.json`
- Add `README.md`

Deliverable:

- plugin can be discovered and loaded by OpenClaw

### 0.2 Add config schema

File:

- `src/config-schema.ts`

Tasks:

- define `baseUrl`
- define `account`
- define `password`
- define `apiVersion`
- define `verifyTls`
- define `requestTimeoutMs`
- define `mode`
- define `allowedProducts`
- define `allowedProjects`
- define `allowedExecutions`
- define `writeGuards`

Deliverable:

- config is validated on plugin registration

### 0.3 Add shared runtime state

Files:

- `src/types.ts`
- `src/runtime.ts`

Tasks:

- define config types
- define auth state type
- define client dependencies
- add runtime setter and getter helpers if needed

Deliverable:

- tool modules can access shared config and client state

## Phase 1: Authentication and HTTP Client

### 1.1 Implement token auth

File:

- `src/auth.ts`

Tasks:

- implement `createToken(account, password)`
- cache token in memory
- support refresh on auth failure
- redact secrets from logs

Deliverable:

- tools can authenticate without storing a hardcoded token

### 1.2 Implement API client

File:

- `src/client.ts`

Tasks:

- build v1 request URL paths
- send requests with token header
- support GET and POST first
- parse JSON responses
- normalize timeout and HTTP errors
- retry once after auth refresh

Deliverable:

- one shared typed client for all tool modules

### 1.3 Implement error normalization

File:

- `src/errors.ts`

Tasks:

- define auth error
- define request error
- define validation error
- define scope error
- define unsupported action error

Deliverable:

- user-facing errors are concise and consistent

## Phase 2: Guardrails and Result Helpers

### 2.1 Implement write guardrails

File:

- `src/guardrails.ts`

Tasks:

- block writes in read-only mode
- require scope match when enabled
- require `reason` for risky actions when enabled
- classify actions as read or write

Deliverable:

- accidental writes are prevented by default

### 2.2 Implement result helpers

File:

- `src/result.ts`

Tasks:

- add helper for read result
- add helper for list result
- add helper for write result
- add helper for error result

Deliverable:

- all tools emit consistent `content` and `details`

## Phase 3: Meta Tool

### 3.1 Implement `zentao_meta`

File:

- `src/tools/meta.ts`

Actions:

- `list_products`
- `list_projects`
- `list_executions`
- `list_users`
- `resolve_context`

Tasks:

- define flat schema with `action`
- map actions to client methods
- support basic filtering by query or parent id

Deliverable:

- agents can resolve products, projects, executions, and users before write operations

## Phase 4: Task and Bug Tools

### 4.1 Implement `zentao_task`

File:

- `src/tools/task.ts`

Actions:

- `list`
- `get`
- `create`
- `update`
- `assign`
- `start`
- `finish`
- `close`

Tasks:

- define schema
- validate action-specific required fields
- call guardrails before writes
- map returned task payloads into standard tool results

Deliverable:

- task management works through API for core day-to-day flows

### 4.2 Implement `zentao_bug`

File:

- `src/tools/bug.ts`

Actions:

- `list`
- `get`
- `create`
- `update`
- `assign`
- `resolve`
- `close`
- `activate`

Tasks:

- define schema
- validate action-specific required fields
- call guardrails before writes
- normalize bug resolution fields

Deliverable:

- bug creation and state changes work through API

## Phase 5: Story, Project, and Execution Tools

### 5.1 Implement `zentao_story`

File:

- `src/tools/story.ts`

Actions:

- `list`
- `get`
- `create`
- `update`

### 5.2 Implement `zentao_project`

File:

- `src/tools/project.ts`

Actions:

- `list`
- `get`
- `create`
- `update`

### 5.3 Implement `zentao_execution`

File:

- `src/tools/execution.ts`

Actions:

- `list`
- `get`
- `create`
- `update`
- `close`

Deliverable:

- project and iteration context can be managed without using the UI

## Phase 6: Test Case Tool

### 6.1 Implement `zentao_testcase`

File:

- `src/tools/testcase.ts`

Actions:

- `list`
- `get`
- `create`
- `update`

Deliverable:

- test case management is available from OpenClaw

## Phase 7: Registration and Wiring

### 7.1 Register all tools

File:

- `index.ts`

Tasks:

- parse plugin config
- create shared client
- register each tool with `api.registerTool`

Deliverable:

- tools appear in OpenClaw tool catalog

### 7.2 Add plugin metadata

File:

- `openclaw.plugin.json`

Tasks:

- set plugin id to `zentao`
- define config schema stub or plugin metadata as required

Deliverable:

- plugin metadata matches repository extension conventions

## Phase 8: Tests

### 8.1 Authentication tests

File:

- `src/test/auth.test.ts`

Coverage:

- token creation
- token reuse
- refresh after auth failure

### 8.2 Client tests

File:

- `src/test/client.test.ts`

Coverage:

- path building
- token header injection
- retry behavior
- timeout handling

### 8.3 Guardrail tests

File:

- `src/test/guardrails.test.ts`

Coverage:

- read-only write rejection
- scope rejection
- reason requirement

### 8.4 Tool tests

Files:

- `src/test/meta.tool.test.ts`
- `src/test/story.tool.test.ts`
- `src/test/task.tool.test.ts`
- `src/test/bug.tool.test.ts`

Coverage:

- schema validation
- action routing
- result shape
- write guard invocation

## Phase 9: Docs and Examples

### 9.1 Write usage docs

File:

- `README.md`

Contents:

- installation and enablement
- config example
- tool list
- safety model
- examples for querying products and creating bugs or tasks

## Immediate Build Order

Recommended implementation order:

1. `src/config-schema.ts`
2. `src/types.ts`
3. `src/auth.ts`
4. `src/client.ts`
5. `src/errors.ts`
6. `src/guardrails.ts`
7. `src/result.ts`
8. `src/tools/meta.ts`
9. `index.ts`
10. `src/tools/task.ts`
11. `src/tools/bug.ts`
12. `src/tools/story.ts`
13. `src/tools/project.ts`
14. `src/tools/execution.ts`
15. `src/tools/testcase.ts`
16. tests
17. `README.md`

## Definition of Done

- plugin loads
- auth works against target Zentao site
- meta tool works
- task and bug tools support at least one create flow each
- write guardrails are enforced
- tests cover auth, client, guardrails, and core tools
