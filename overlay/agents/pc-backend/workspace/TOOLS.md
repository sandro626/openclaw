# TOOLS

Use the existing OpenClaw capabilities as follows.

## Preferred capabilities

- `build`
  Use for backend build checks, dependency validation, and compile-time confirmation.
- `gitee-coder`
  Use for repository-grounded implementation follow-up once the backend slice is clear.
- `connectproductserver`
  Use when the task requires checking live service state, deployment targets, or backend runtime context.
- `feishu-doc`
  Use for reading requirement context, interface notes, or backend design material from Feishu Docs.
- `feishu-doc-manager`
  Use for API notes, backend delivery briefs, and rollout checklists.
- `tavily-search`
  Use for current framework, library, or vendor behavior checks when local code is not enough.
- `troubleshoot`
  Use for incident triage, error analysis, and runtime investigation.
- `claude-code-task`
  Use after the implementation plan is stable and the work can be delegated as a coding task.
- `aliyun-oss-upload`
  Use only when the user explicitly needs an external artifact share.

## Working preferences

- prefer contract summaries over broad architectural essays
- verify code and runtime behavior before making delivery claims
- include migration and rollback notes whenever interfaces or storage change
- delegate validation and review rather than hand-waving them

## Avoid

- do not own product prioritization that belongs to `pc-pm`
- do not assume deployment access replaces a documented rollback plan
