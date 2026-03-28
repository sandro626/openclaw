# Docs Map

Read these first when the task touches architecture, layering, migration, or deployment:

- `docs/operations/deployment-assembly.md`
- `docs/operations/layering-strategy.md`
- `docs/operations/runtime-unification-checklist.md`
- `docs/operations/production-runtime-migration-runbook.md`
- `docs/operations/agents-asset-inventory.md`
- `docs/operations/extensions-asset-inventory.md`
- `docs/operations/skills-asset-inventory.md`
- `docs/operations/workspace-migration.md`
- `docs/providers/minimax.md`

Use these supporting docs when the task needs them:

- `docs/operations/upstream-upgrade-grouping.md`
- `docs/operations/upstream-upgrade-commit-plan.md`
- `docs/operations/upstream-upgrade-group1-summary.md`
- `docs/operations/upstream-upgrade-layering-fork-boundary.md`
- `docs/operations/upstream-upgrade-wecom-fork-strategy.md`
- `docs/operations/upstream-upgrade-superbrower-convergence.md`
- `docs/operations/upstream-upgrade-business-tool-forks.md`

Expected repo shape:

- `src/`, `extensions/`, `skills/`, `apps/`, `docs/`: core/upstream area
- `overlay/`: private assets and static overlays
- `runtime-templates/`: renderable config and runtime templates
- `server-config/`: README-only retirement layer, not a live source of truth

Quick verification commands:

- `pnpm check:repo-layering`
- `pnpm ops:assemble -- --output-root .artifacts/ops/<name> --environment prod --allow-unresolved-env`
- `pnpm ops:list-upstream-upgrade-groups --summary-only`
