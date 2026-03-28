# Runtime Config Templates

This directory holds source-controlled runtime config templates.

Recommended flow:

1. Keep shared defaults in `openclaw.base.json`
2. Keep environment overrides in `environments/*.json`
3. Keep agent defaults and active agent lists in `../agents/base.json` and `../agents/environments/*.json`
4. Keep channel -> agent bindings in `../agents/bindings/base.json` and `../agents/bindings/environments/*.json`
5. Render the final `openclaw.json` with `scripts/assemble-runtime-bundle.mjs`
6. Inject real secrets via environment variables instead of committing them

Host-local runtime state examples live in `../state/` and should not be merged into rendered config.

Placeholder syntax:

- `${NAME}`: required environment variable
- `${NAME:-fallback}`: optional environment variable with fallback

Do not commit:

- real API keys
- real gateway tokens
- real account identifiers
- real host-specific runtime paths
