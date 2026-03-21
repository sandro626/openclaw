import { describe, expect, it } from "vitest";
import { ZentaoError } from "./errors.js";
import {
  enforceReasonIfRequired,
  enforceScopeIfConfigured,
  enforceWriteAllowed,
  isWriteAction,
} from "./guardrails.js";

const baseConfig = {
  baseUrl: "https://example.com",
  apiVersion: "v1" as const,
  account: "zhongle",
  password: "secret",
  verifyTls: true,
  requestTimeoutMs: 15_000,
  mode: "read-only" as const,
  allowedProducts: [7],
  allowedProjects: [37],
  allowedExecutions: [38],
  writeGuards: {
    requireReason: true,
    requireScopeMatch: true,
    confirmBeforeDestructive: true,
  },
};

describe("zentao guardrails", () => {
  it("detects write actions", () => {
    expect(isWriteAction("create")).toBe(true);
    expect(isWriteAction("resolve")).toBe(true);
    expect(isWriteAction("list")).toBe(false);
  });

  it("blocks writes in read-only mode", () => {
    expect(() => enforceWriteAllowed(baseConfig, "create")).toThrowError(
      new ZentaoError('Zentao write action "create" is disabled in read-only mode'),
    );
    expect(() => enforceWriteAllowed(baseConfig, "list")).not.toThrow();
  });

  it("requires a reason for risky actions when enabled", () => {
    expect(() => enforceReasonIfRequired(baseConfig, "close", undefined)).toThrowError(
      new ZentaoError('Zentao action "close" requires a reason'),
    );
    expect(() => enforceReasonIfRequired(baseConfig, "update", undefined)).not.toThrow();
  });

  it("skips reason enforcement when disabled", () => {
    expect(() =>
      enforceReasonIfRequired(
        {
          ...baseConfig,
          writeGuards: { ...baseConfig.writeGuards, requireReason: false },
        },
        "close",
        undefined,
      ),
    ).not.toThrow();
  });

  it("enforces allowed product, project, and execution scopes", () => {
    expect(() => enforceScopeIfConfigured(baseConfig, { productId: 8 })).toThrowError(
      new ZentaoError("Zentao product 8 is outside the allowed scope"),
    );
    expect(() => enforceScopeIfConfigured(baseConfig, { projectId: 38 })).toThrowError(
      new ZentaoError("Zentao project 38 is outside the allowed scope"),
    );
    expect(() => enforceScopeIfConfigured(baseConfig, { executionId: 39 })).toThrowError(
      new ZentaoError("Zentao execution 39 is outside the allowed scope"),
    );
    expect(() =>
      enforceScopeIfConfigured(baseConfig, {
        productId: 7,
        projectId: 37,
        executionId: 38,
      }),
    ).not.toThrow();
  });

  it("skips scope checks when disabled", () => {
    expect(() =>
      enforceScopeIfConfigured(
        {
          ...baseConfig,
          writeGuards: { ...baseConfig.writeGuards, requireScopeMatch: false },
        },
        {
          productId: 999,
          projectId: 999,
          executionId: 999,
        },
      ),
    ).not.toThrow();
  });
});
