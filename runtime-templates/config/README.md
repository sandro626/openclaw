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

Current production memory embedding envs:

- `MODELSTUDIO_API_KEY`: Alibaba Cloud Model Studio API key for canonical `agents.defaults.memorySearch.remote.apiKey`
- `OPENCLAW_MEMORY_EMBED_BASE_URL`: optional override for the embedding endpoint
- `OPENCLAW_MEMORY_EMBED_MODEL`: optional override for the embedding model (`text-embedding-v4` by default)

Live deploy note:

- Do not deploy a rendered `agents.defaults.memorySearch.remote.apiKey` SecretRef to a live gateway unless `MODELSTUDIO_API_KEY` is already present in the service environment. The gateway startup path fails closed when that env var is missing.

Do not commit:

- real API keys
- real gateway tokens
- real account identifiers
- real host-specific runtime paths
