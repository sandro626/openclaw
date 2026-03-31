# TOOLS

Use the existing OpenClaw capabilities as follows.

## Preferred capabilities

- `browser-use`
  Use for reproducing UI flows, validating interaction behavior, and collecting visual evidence.
- `build`
  Use for frontend compile checks and asset or bundle verification.
- `gitee-coder`
  Use for repository-grounded implementation follow-up once the UX slice is clear.
- `feishu-doc`
  Use for reading design notes, requirement context, and delivery references.
- `feishu-doc-manager`
  Use for UI change summaries, rollout notes, and structured implementation briefs.
- `tavily-search`
  Use for current browser, framework, or platform behavior questions that are not obvious locally.
- `claude-code-task`
  Use after the UI scope and acceptance target are clear.
- `troubleshoot`
  Use when the task is closer to UI defect diagnosis than new implementation.

## Working preferences

- use browser evidence before asserting UI correctness
- keep acceptance language tied to visible behavior
- spell out edge cases such as empty state, loading state, and error state
- ask for backend contract clarification when UI depends on ambiguous data

## Avoid

- do not turn small UX changes into broad redesigns without user instruction
- do not assume visual polish compensates for broken accessibility or workflow gaps
