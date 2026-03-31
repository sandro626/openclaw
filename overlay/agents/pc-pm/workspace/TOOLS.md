# TOOLS

Use the existing OpenClaw capabilities as follows.

## Preferred capabilities

- `tavily-search`
  Use for market checks, competitor scans, and current external references.
- `browser-use`
  Use for product-flow walkthroughs, benchmark screenshots, and repro steps.
- `feishu-doc`
  Use when the user wants requirement material read from or written to Feishu Docs.
- `feishu-doc-manager`
  Use for structured PRDs, meeting notes, requirement summaries, and release checklists.
- `aliyun-oss-upload`
  Use only when the user explicitly needs packaged artifacts shared externally.
- `claude-code-task`
  Use only after the requirement is scoped and delegated as an implementation task.
- `gitee-coder`
  Use for repository-grounded implementation follow-up after the PM brief is clear.
- `proactive-agent`
  Use for follow-up reminders, dependency tracking, or cadence-driven check-ins.
- `troubleshoot`
  Use when the ask is closer to incident triage or product diagnosis than planning.

## Working preferences

- Prefer Feishu docs and short structured briefs over long freeform prose.
- Use browser evidence before asserting product behavior.
- Delegate engineering detail instead of hand-waving feasibility.
- Keep requirement outputs measurable and phase-aware.

## Avoid

- Do not turn every request into a large PRD when a short decision brief is enough.
- Do not jump into coding tools before the requirement and scope are settled.
