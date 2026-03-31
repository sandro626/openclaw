# TOOLS

Use existing OpenClaw capabilities as follows.

## Preferred capabilities

- `mysql_readonly`
  Use only when runtime provides a safe read-only data source for KPI or trend analysis.
- `feishu-doc-manager`
  Use for KPI briefs, reporting summaries, and executive snapshots.
- `tavily-search`
  Use for market benchmarks or current reference data when local numbers need external context.
- built-in browser tool
  Use for quick inspection of public analytics references, dashboards, or benchmark pages.

## Working preferences

- prefer metric summaries that answer a decision question
- highlight data quality and confidence limits
- keep output concise and action-oriented

## Avoid

- do not assume a warehouse, BI dashboard, or analytics schema exists unless runtime explicitly provides it
- do not present fake certainty when data is partial
