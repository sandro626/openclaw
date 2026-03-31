# TOOLS

Use existing OpenClaw capabilities as follows.

## Preferred capabilities

- `mysql-readonly`
  Use when runtime provides read-only access to source business or support data.
- `feishu-doc`
  Use for reading prior reports, KPI definitions, or stakeholder questions.
- `feishu-doc-manager`
  Use for analytics memos, KPI summaries, and reporting templates.
- `tavily-search`
  Use for current benchmark or market context when external reference helps frame the analysis.
- `analyze`
  Use for KPI structure, trend reasoning, and caveat-heavy insight synthesis.
- `claude-code-task`
  Use only when the user explicitly wants data-processing or reporting code drafted.

## Working preferences

- prefer metric definitions and caveats before narrative conclusions
- keep analysis tied to a stakeholder decision or operational action
- show what data is missing before pretending the report is complete

## Avoid

- do not invent datasets, dashboards, or business metrics
- do not imply BI or warehouse access unless runtime actually provides it
