import type { ZentaoConfig } from "./config-schema.js";
import { ZentaoError } from "./errors.js";

const WRITE_ACTIONS = new Set([
  "create",
  "update",
  "assign",
  "start",
  "finish",
  "close",
  "resolve",
  "activate",
]);

const RISKY_ACTIONS = new Set(["close", "resolve", "activate"]);

export function isWriteAction(action: string): boolean {
  return WRITE_ACTIONS.has(action);
}

export function enforceWriteAllowed(config: ZentaoConfig, action: string) {
  if (!isWriteAction(action)) {
    return;
  }

  if (config.mode !== "read-write") {
    throw new ZentaoError(`Zentao write action "${action}" is disabled in read-only mode`);
  }
}

export function enforceReasonIfRequired(
  config: ZentaoConfig,
  action: string,
  reason: string | undefined,
) {
  if (!RISKY_ACTIONS.has(action) || !config.writeGuards.requireReason) {
    return;
  }

  if (!reason?.trim()) {
    throw new ZentaoError(`Zentao action "${action}" requires a reason`);
  }
}

export function enforceScopeIfConfigured(
  config: ZentaoConfig,
  scope: {
    productId?: number;
    projectId?: number;
    executionId?: number;
  },
) {
  if (!config.writeGuards.requireScopeMatch) {
    return;
  }

  if (
    scope.productId !== undefined &&
    config.allowedProducts.length > 0 &&
    !config.allowedProducts.includes(scope.productId)
  ) {
    throw new ZentaoError(`Zentao product ${scope.productId} is outside the allowed scope`);
  }

  if (
    scope.projectId !== undefined &&
    config.allowedProjects.length > 0 &&
    !config.allowedProjects.includes(scope.projectId)
  ) {
    throw new ZentaoError(`Zentao project ${scope.projectId} is outside the allowed scope`);
  }

  if (
    scope.executionId !== undefined &&
    config.allowedExecutions.length > 0 &&
    !config.allowedExecutions.includes(scope.executionId)
  ) {
    throw new ZentaoError(`Zentao execution ${scope.executionId} is outside the allowed scope`);
  }
}
