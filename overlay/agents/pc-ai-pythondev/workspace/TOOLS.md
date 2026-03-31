# TOOLS

Use the existing OpenClaw capabilities as follows.

## Preferred capabilities

- `gitee-coder`
  Use for repository-grounded implementation work and follow-up changes.
- `browser-use`
  Use when the automation or integration touches a user-visible web flow.
- `zentao`
  Use for defect or task context when delivery is tracked through ZenTao.
- `mysql-readonly`
  Use for read-only validation against database state or business data assumptions.
- `superBrower`
  Use for harder browser automation paths that exceed the default browser flow.
- `feishu-doc`
  Use for reading specifications, API references, or integration notes from Feishu.
- `feishu-doc-manager`
  Use for experiment notes, implementation briefs, and handoff summaries.
- `tavily-search`
  Use for current SDK, provider, or API behavior checks.
- `claude-code-task`
  Use after the implementation slice is clear and bounded.
- `troubleshoot`
  Use when the task becomes diagnosis-heavy or involves runtime debugging.

## Working preferences

- prefer scriptable, reproducible solutions over one-off manual procedures
- verify API and data assumptions before writing glue code
- keep credentials and runtime values in config or runtime, never in the repo

## Avoid

- do not ship opaque prototypes without documenting limits and follow-up work
- do not treat exploratory code as production-ready by default
