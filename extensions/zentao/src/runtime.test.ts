import { describe, expect, it } from "vitest";
import { zentaoConfigSchema } from "./config-schema.js";
import { ZentaoError } from "./errors.js";
import {
  createZentaoRuntimeManager,
  resolveZentaoConfigForAgent,
  resolveZentaoCredentialForAgent,
} from "./runtime.js";

const logger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return this;
  },
};

const rootConfig = {
  agents: {
    list: [
      {
        id: "main",
        params: {
          zentao: {
            account: "pm-user",
            password: "pm-secret",
          },
        },
      },
      {
        id: "dev",
        params: {
          zentao: {
            account: "dev-user",
            password: "dev-secret",
          },
        },
      },
    ],
  },
};

describe("zentao runtime credential resolution", () => {
  it("prefers credentials from agents.list[].params.zentao", () => {
    const config = zentaoConfigSchema.parse({
      baseUrl: "https://example.com",
      account: "global-user",
      password: "global-secret",
    });

    expect(resolveZentaoCredentialForAgent(config, rootConfig, "dev")).toEqual({
      account: "dev-user",
      password: "dev-secret",
    });
  });

  it("falls back to plugin-level global credentials when an agent has no dedicated mapping", () => {
    const config = zentaoConfigSchema.parse({
      baseUrl: "https://example.com",
      account: "global-user",
      password: "global-secret",
    });

    expect(resolveZentaoConfigForAgent(config, rootConfig, "tester")).toEqual(
      expect.objectContaining({
        account: "global-user",
        password: "global-secret",
      }),
    );
  });

  it("throws when no credentials exist for the current agent and no default is configured", () => {
    const config = zentaoConfigSchema.parse({
      baseUrl: "https://example.com",
    });

    expect(() => resolveZentaoCredentialForAgent(config, rootConfig, "tester")).toThrowError(
      new ZentaoError('No Zentao credentials configured for agent "tester"'),
    );
  });

  it("reuses the same runtime for repeated calls from the same agent", () => {
    const config = zentaoConfigSchema.parse({
      baseUrl: "https://example.com",
    });

    const manager = createZentaoRuntimeManager({ config, rootConfig, logger });
    const first = manager.getRuntimeForAgent("main");
    const second = manager.getRuntimeForAgent("main");

    expect(first).toBe(second);
    expect(first.config.account).toBe("pm-user");
  });
});
