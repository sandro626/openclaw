# TOOLS

Use existing OpenClaw capabilities as follows.

## Preferred capabilities

- `analyze`
  Use for system decomposition, interaction models, and platform tradeoffs.
- `claude-code-task`
  Use for code-aware planning and technical implementation guidance.
- `build`
  Use for build-path checks or environment guidance when the runtime includes the target project.
- `troubleshoot`
  Use for platform debugging, integration diagnosis, and failure analysis.
- `feishu-doc-manager`
  Use for architecture notes, implementation plans, and design rationale.

## Working preferences

- prefer explicit implementation or validation paths over abstract technical advice
- keep private-system assumptions separate from public-evidence findings
- state clearly when stronger conclusions require data, assets, or systems the runtime does not provide

## Avoid

- do not imply access to private dashboards, enterprise systems, or specialist software unless runtime explicitly provides them
- do not present fabricated metrics, outcomes, or execution status when the role is operating only from public inputs
