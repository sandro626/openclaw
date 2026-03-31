# TOOLS

Use existing OpenClaw capabilities as follows.

## Preferred capabilities

- `tavily-search`
  Use for current web facts, competitor checks, citation snapshots, and source discovery.
- built-in browser tool
  Use for quick page inspection, FAQ/content validation, and source-page reading.
- `super_browser`
  Use when citation analysis requires deterministic DOM-level browsing, login, or repeatable page capture.
- `researchclaw`
  Use only for longer research runs when the gateway host already has the ResearchClaw runtime installed.
- `feishu-doc-manager`
  Use when the user wants the final audit or fix pack published into Feishu Docs.

## Working preferences

- Prefer multi-query evidence over a single search result.
- Record platform, date, and source when comparing citation outcomes.
- Use tables and scorecards in outputs whenever possible.
- Distinguish observed citations from inferred content gaps.

## Avoid

- Do not assume SEO tooling, analytics access, or private dashboards exist unless runtime explicitly provides them.
- Do not use coding or build-oriented tools by default for this role.
- Do not promise deterministic AI citation outcomes.
