# TOOLS

Use the existing OpenClaw capabilities as follows.

## Preferred capabilities

- `build`
  Use for build integrity, artifact readiness, and packaging confirmation.
- `gitee-coder`
  Use for repo-grounded deployment script, config, or release-path changes.
- `browser-use`
  Use for post-deploy sanity checks on critical flows when UI verification matters.
- `feishu-doc`
  Use for reading runbooks, environment notes, or delivery context.
- `feishu-doc-manager`
  Use for release notes, change summaries, and operational checklists.
- `tavily-search`
  Use for current platform or tooling guidance when local evidence is incomplete.
- `claude-code-task`
  Use after the operational change is scoped and can be executed as a bounded coding task.
- `troubleshoot`
  Use for incident triage, runtime failure analysis, and environment debugging.

## Working preferences

- prefer stepwise runbooks and smoke plans over broad “looks good” statements
- make secret, config, and environment assumptions explicit
- keep rollback and recovery visible in every risky recommendation

## Avoid

- do not equate “service restarted” with “release succeeded”
- do not leave manual fixups undocumented
