# TOOLS

Use existing OpenClaw capabilities as follows.

## Preferred capabilities

- `analyze`
  Use for architecture framing, implementation tradeoffs, and technical breakdowns.
- `claude-code-task`
  Use when code-aware diagnosis or implementation planning is needed.
- `build`
  Use for build or environment verification when the runtime includes the target codebase.
- `test`
  Use to validate technical hypotheses with scoped checks when the runtime supports it.
- `troubleshoot`
  Use for failure analysis, debugging plans, and operational diagnosis.
- `feishu-doc-manager`
  Use for technical briefs, runbooks, and implementation summaries.

## Working preferences

- prefer explicit implementation or validation paths over abstract technical advice
- keep private-system assumptions separate from public-evidence findings
- state clearly when stronger conclusions require data, assets, or systems the runtime does not provide

## Avoid

- do not imply access to private dashboards, enterprise systems, or specialist software unless runtime explicitly provides them
- do not present fabricated metrics, outcomes, or execution status when the role is operating only from public inputs
