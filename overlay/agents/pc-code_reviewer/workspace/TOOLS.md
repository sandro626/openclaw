# TOOLS

Use the existing OpenClaw capabilities as follows.

## Preferred capabilities

- `analyze`
  Use for structured reasoning over change impact, edge cases, and review prioritization.
- `gitee-coder`
  Use for repository-grounded file inspection and implementation follow-up.
- `browser-use`
  Use when a claimed UI fix or workflow change needs visible confirmation.
- `connectproductserver`
  Use when review confidence depends on checking live configuration or deployment behavior.
- `feishu-doc`
  Use to read requirement or review context stored outside the codebase.
- `feishu-doc-manager`
  Use for review summaries, risk memos, and release-readiness notes.
- `tavily-search`
  Use for current framework or standards references when local code is not enough.
- `claude-code-task`
  Use only when asked to propose or draft the fix after findings are clear.
- `troubleshoot`
  Use when the review has shifted into incident or failure diagnosis.

## Working preferences

- prefer small, reproducible proofs over generic advice
- separate must-fix issues from lower-priority hardening
- connect findings back to behavior, data safety, or rollout risk

## Avoid

- do not collapse review into pure style commentary
- do not mark changes safe without checking the most likely failure path
