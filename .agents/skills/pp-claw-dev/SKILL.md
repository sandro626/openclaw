---
name: pp-claw-dev
description: Use when working on this OpenClaw fork's development, layering, deploy, or live-ops tasks, especially when changes must preserve the upstream/core, overlay, and runtime split and follow this repo's server workflow.
---

# PP Claw Dev

Use this skill when the task is about this repository's architecture, local development flow, deployment, or live production operations.

## Default workflow

1. Treat the repo as a three-layer system:
   - `core/upstream`: repo-owned product code such as `src/`, `extensions/`, `skills/`, `apps/`, `docs/`
   - `overlay`: repo-owned private assets under `overlay/`
   - `runtime`: live state under the server's `~/.openclaw`, never the repo
2. Before substantial edits, read `references/docs-map.md`.
3. Before deploy or live config changes, read `references/live-runtime.md`.
4. Re-verify layering with:
   - `pnpm check:repo-layering`
   - `pnpm ops:assemble -- --output-root .artifacts/ops/<name> --environment prod --allow-unresolved-env`
5. For upgrade or large pushes, keep the existing commit grouping:
   - `Group 1`: upstream sync
   - `Group 2`: layering
   - `Group 3`: local forks
   - `Group 4`: build cleanups

## Hard rules

- Do not move runtime data back into the repo. `sessions/`, live `memory/`, real workspace outputs, and secrets stay on the server runtime.
- Do not create a second server code tree. Deploy the local built result into the existing server checkout.
- When plugin or provider code changes affect build output, sync the whole `dist/` tree, not only one plugin directory.
- Keep `server-config/` as templates and retirement notes only; it is not a live source of truth.
- Keep `overlay/agents/<id>/workspace/` static only. Runtime state belongs in the live workspace.

## MiniMax rule

- MiniMax API keys must match the endpoint region.
- `CN` key: `https://api.minimaxi.com/anthropic`
- `Global` key: `https://api.minimax.io/anthropic`
- This repo's live MiniMax route currently uses Anthropic-compatible requests, not the OpenAI-compatible route.

## Validation checklist

- Layering: `pnpm check:repo-layering`
- Build: `pnpm build`
- Runtime bundle render: `pnpm ops:assemble -- --output-root .artifacts/ops/<name> --environment prod --allow-unresolved-env`
- Optional local-fork audit: `pnpm ops:audit-local-forks --summary-only`
- Live smoke after deploy:
  - `openclaw health`
  - `openclaw models list`
  - `openclaw channels status --probe`
  - one `main` smoke
  - one `pc-*` smoke
  - one `yz-app-*` smoke

## References

- Architecture and required docs: `references/docs-map.md`
- Server environment, login, deploy, and smoke flow: `references/live-runtime.md`
