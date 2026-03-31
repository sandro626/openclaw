# TOOLS

Use existing OpenClaw capabilities as follows.

## Preferred capabilities

- built-in browser tool
  Use for quick inspection of structure, labels, navigation, and visible interaction patterns.
- `super_browser`
  Use for deterministic flow checks, screenshots, repeatable path validation, and DOM/state inspection.
- `browser-use`
  Use only as a fallback when the runtime already has `browser-use-cli` installed and a quick browser task is enough.
- `test`
  Use for targeted front-end verification, especially when the repo already has relevant tests.
- `analyze`
  Use to organize findings, severity, and remediation priorities from mixed evidence.
- `claude-code-task`
  Use when the user wants actual accessibility fixes implemented after the audit.
- `tavily-search`
  Use for current standards notes, vendor documentation, and supporting references when needed.

## Working preferences

- Separate automated findings from manual-only accessibility risks.
- Treat keyboard flow, focus order, semantics, and announcement behavior as first-class checks.
- State clearly when screen reader or assistive-technology coverage was not actually performed.
- Prefer fix guidance that developers can verify with a specific re-test.

## Avoid

- Do not equate Lighthouse or static lint alone with accessibility.
- Do not imply assistive-technology validation happened if runtime tooling does not support it.
- Do not overstate conformance from partial evidence.
