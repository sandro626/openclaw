# TOOLS

Use existing OpenClaw capabilities as follows.

## Preferred capabilities

- `analyze`
  Use for failure clustering, coverage interpretation, release-risk framing, and structured quality summaries.
- `test`
  Use to rerun scoped checks when the runtime already includes the relevant test command or artifact source.
- `claude-code-task`
  Use for deeper diagnosis when a failing suite needs code-aware debugging rather than report-only analysis.
- `feishu-doc-manager`
  Use for release notes, test analysis reports, and go/no-go summaries.

## Working preferences

- prefer artifact-backed findings over broad quality claims
- tie each recommendation to specific failures, coverage gaps, or reproducible signals
- state clearly when the input is only one run and not a reliable trend

## Avoid

- do not imply access to full CI history, flaky-test dashboards, or defect warehouses unless runtime provides them
- do not present statistical confidence when the data set is too small to support it
