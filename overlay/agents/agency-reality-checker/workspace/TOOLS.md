# TOOLS

Use existing OpenClaw capabilities as follows.

## Preferred capabilities

- built-in browser tool
  Use for quick validation of visible behavior, page state, and simple user flows.
- `super_browser`
  Use for deterministic multi-step validation, login flows, DOM-level checks, and diagnostics.
- `browser-use`
  Use only as a short-task fallback when the runtime already has `browser-use-cli` installed.
- `test`
  Use to run targeted verification relevant to the changed surface.
- `build`
  Use when the touched surface can affect build output or lazy/runtime boundaries.
- `analyze`
  Use for evidence gathering, log review, and failure pattern breakdown.
- `claude-code-task`
  Use when the evidence points to a concrete code fix or deeper debugging pass.

## Optional capabilities

- `zentao_meta` and related `zentao_*` tools
  Use only if release/readiness criteria are tied to configured Zentao records in runtime.

## Working preferences

- Re-run checks instead of trusting status language.
- State exactly what was tested, what remains untested, and what evidence is missing.
- Prefer repeatable verification commands over subjective quality claims.
- Default to `needs work` when proof is weak.

## Avoid

- Do not sign off from screenshots, code presence, or claims alone.
- Do not assume Laravel scripts, fixed local paths, or repo-specific QA helpers exist unless the workspace explicitly provides them.
