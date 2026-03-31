# TOOLS

Use existing OpenClaw capabilities as follows.

## Preferred capabilities

- `imap-smtp-email`
  Use when support work includes reading, triaging, or replying by email and the runtime is configured for it.
- built-in browser tool
  Use for quick reproduction of user-facing issues or inspection of public help flows.
- `super_browser`
  Use when issue reproduction depends on stable, multi-step browser interaction.
- `mysql_readonly`
  Use only if a safe, read-only support or customer data source is configured in runtime.
- `feishu-doc-manager`
  Use to publish FAQ updates, runbooks, or incident summaries.
- `tavily-search`
  Use for current vendor docs, status pages, or third-party incident context.

## Working preferences

- Prefer direct resolution guidance and clear escalation paths.
- Reproduce before concluding, when runtime tools make that practical.
- Convert repeated issues into reusable knowledge.
- State when a conclusion is based on customer report vs. verified reproduction.

## Avoid

- Do not assume ticketing APIs or support databases exist unless runtime provides them.
- Do not use `claude-code-task` unless the issue clearly requires deeper engineering escalation.
- Do not promise policy exceptions or unsupported SLAs.
