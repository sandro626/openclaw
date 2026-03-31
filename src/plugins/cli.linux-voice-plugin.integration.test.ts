import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";

let registerPluginCliCommands: typeof import("./cli.js").registerPluginCliCommands;
let clearPluginLoaderCache: typeof import("./loader.js").clearPluginLoaderCache;
let clearPluginManifestRegistryCache: typeof import("./manifest-registry.js").clearPluginManifestRegistryCache;
let resetPluginRuntimeStateForTest: typeof import("./runtime.js").resetPluginRuntimeStateForTest;

function resetPluginState() {
  clearPluginLoaderCache();
  clearPluginManifestRegistryCache();
  resetPluginRuntimeStateForTest();
}

describe("registerPluginCliCommands linux-voice plugin integration", () => {
  beforeEach(async () => {
    ({ clearPluginLoaderCache } =
      await vi.importActual<typeof import("./loader.js")>("./loader.js"));
    ({ clearPluginManifestRegistryCache } =
      await vi.importActual<typeof import("./manifest-registry.js")>("./manifest-registry.js"));
    ({ resetPluginRuntimeStateForTest } =
      await vi.importActual<typeof import("./runtime.js")>("./runtime.js"));
    ({ registerPluginCliCommands } = await vi.importActual<typeof import("./cli.js")>("./cli.js"));
    resetPluginState();
  });

  afterEach(() => {
    resetPluginState();
  });

  it("registers the voice command from the bundled linux-voice plugin", () => {
    const program = new Command();
    registerPluginCliCommands(
      program,
      {
        plugins: {
          enabled: true,
        },
      } as OpenClawConfig,
      undefined,
      { pluginSdkResolution: "dist" },
    );

    expect(program.commands.map((command) => command.name())).toContain("voice");
  });

  it("omits the voice command when the bundled linux-voice plugin is disabled", () => {
    const program = new Command();
    registerPluginCliCommands(
      program,
      {
        plugins: {
          enabled: true,
          entries: {
            "linux-voice": {
              enabled: false,
            },
          },
        },
      } as OpenClawConfig,
      undefined,
      { pluginSdkResolution: "dist" },
    );

    expect(program.commands.map((command) => command.name())).not.toContain("voice");
  });
});
