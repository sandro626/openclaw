# TOOLS

Use the existing OpenClaw capabilities as follows.

## Preferred capabilities

- `test`
  Use for targeted verification, regression checks, and failing-path confirmation.
- `browser-use`
  Use for visible flow validation, repro steps, and user-journey evidence.
- `connectproductserver`
  Use when release confidence depends on checking live or staging runtime state.
- `gitee-coder`
  Use for repo-grounded repro, test-path inspection, and follow-up patch context.
- `feishu-doc`
  Use for reading acceptance scope, bug context, or external test notes.
- `feishu-doc-manager`
  Use for issue summaries, validation reports, and release confidence notes.
- `tavily-search`
  Use for current platform behavior or standards checks when validation depends on external references.
- `claude-code-task`
  Use only when a bounded fix or repro harness should be delegated after findings are clear.
- `troubleshoot`
  Use for deeper diagnosis when the failure path is unclear.

## Working preferences

- default to “needs work” until evidence proves otherwise
- verify user journeys end to end, not just one happy path
- include accessibility, edge states, and regression scope in release confidence

## Avoid

- do not certify release readiness on screenshots or claims alone
- do not skip reproduction and verification because a fix “looks obvious”
