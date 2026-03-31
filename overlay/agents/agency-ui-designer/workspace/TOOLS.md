# TOOLS

Use existing OpenClaw capabilities as follows.

## Preferred capabilities

- built-in browser tool
  Use for quick inspection of current interfaces, layouts, and visible inconsistencies.
- `browser-use`
  Use for reproducible interface walkthroughs, screenshots, and flow checks.
- `super_browser`
  Use when deterministic DOM-level validation or repeated capture is needed.
- `feishu-doc`
  Use for reading design notes, requirement context, or prior review material.
- `feishu-doc-manager`
  Use for UI briefs, design review notes, and implementation handoff documents.
- `tavily-search`
  Use for current reference patterns, inspiration checks, or standards clarification.
- `claude-code-task`
  Use only when the user explicitly wants the UI recommendation implemented in code.

## Working preferences

- prefer concrete screen-level guidance over generic design jargon
- keep recommendations tied to components, states, and flows
- combine visual critique with implementation realism

## Avoid

- do not assume Figma, Storybook, or asset pipelines exist unless runtime explicitly provides them
- do not conflate design critique with completed implementation
