import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stageBundledPluginRuntimeDeps } from "../../scripts/stage-bundled-plugin-runtime-deps.mjs";

const tempDirs: string[] = [];
type StageBundledPluginRuntimeDepsOptions = NonNullable<
  Parameters<typeof stageBundledPluginRuntimeDeps>[0]
>;
type SpawnSyncOverride = NonNullable<StageBundledPluginRuntimeDepsOptions["spawnSync"]>;

function makeRepoRoot(prefix: string): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(repoRoot);
  return repoRoot;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("stageBundledPluginRuntimeDeps", () => {
  it("reuses staged runtime deps when the sanitized manifest stamp is unchanged", () => {
    const repoRoot = makeRepoRoot("openclaw-runtime-deps-stage-");
    const pluginDir = path.join(repoRoot, "dist", "extensions", "discord");
    writeJson(path.join(pluginDir, "package.json"), {
      name: "@openclaw/discord",
      version: "1.0.0",
      dependencies: {
        zod: "^4.3.6",
      },
      devDependencies: {
        openclaw: "workspace:*",
      },
      peerDependencies: {
        openclaw: ">=2026.3.22",
      },
      peerDependenciesMeta: {
        openclaw: {
          optional: true,
        },
      },
      openclaw: {
        bundle: {
          stageRuntimeDependencies: true,
        },
      },
    });

    const spawnSyncMock = vi.fn((_command, _args, options: { cwd?: string } | undefined) => {
      fs.mkdirSync(path.join(String(options?.cwd), "node_modules"), { recursive: true });
      return {
        status: 0,
        stdout: "",
        stderr: "",
      } as never;
    });
    const logs: string[] = [];

    stageBundledPluginRuntimeDeps({
      repoRoot,
      logger: (message) => logs.push(message),
      spawnSync: spawnSyncMock as unknown as SpawnSyncOverride,
    });
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock.mock.calls[0]?.[1]).toContain("--prefer-offline");
    expect(spawnSyncMock.mock.calls[0]?.[1]).toContain("--no-audit");
    expect(spawnSyncMock.mock.calls[0]?.[1]).toContain("--no-fund");
    expect(fs.existsSync(path.join(pluginDir, "node_modules"))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, ".openclaw-runtime-deps.json"))).toBe(true);
    const sanitizedPackageJson = JSON.parse(
      fs.readFileSync(path.join(pluginDir, "package.json"), "utf8"),
    ) as {
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, unknown>;
    };
    expect(sanitizedPackageJson.devDependencies?.openclaw).toBeUndefined();
    expect(sanitizedPackageJson.peerDependencies?.openclaw).toBeUndefined();
    expect(sanitizedPackageJson.peerDependenciesMeta?.openclaw).toBeUndefined();
    expect(
      logs.some((message) => message.includes("staging bundled runtime deps for discord")),
    ).toBe(true);

    logs.length = 0;
    stageBundledPluginRuntimeDeps({
      repoRoot,
      logger: (message) => logs.push(message),
      spawnSync: spawnSyncMock as unknown as SpawnSyncOverride,
    });
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(logs).toContain("[runtime-postbuild] reusing bundled runtime deps for discord");
  });

  it("restores staged runtime deps from the persistent cache on a fresh dist rebuild", () => {
    const repoRoot = makeRepoRoot("openclaw-runtime-deps-restore-");
    const pluginDir = path.join(repoRoot, "dist", "extensions", "discord");
    const cacheDir = path.join(
      repoRoot,
      "node_modules",
      ".cache",
      "openclaw",
      "bundled-plugin-runtime-deps",
      "discord",
    );
    writeJson(path.join(pluginDir, "package.json"), {
      name: "@openclaw/discord",
      version: "1.0.0",
      dependencies: {
        zod: "^4.3.6",
      },
      openclaw: {
        bundle: {
          stageRuntimeDependencies: true,
        },
      },
    });

    const spawnSyncMock = vi.fn((_command, _args, options: { cwd?: string } | undefined) => {
      fs.mkdirSync(path.join(String(options?.cwd), "node_modules"), { recursive: true });
      fs.writeFileSync(path.join(String(options?.cwd), "node_modules", "installed.txt"), "ok");
      return {
        status: 0,
        stdout: "",
        stderr: "",
      } as never;
    });

    stageBundledPluginRuntimeDeps({
      repoRoot,
      spawnSync: spawnSyncMock as unknown as SpawnSyncOverride,
    });
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(cacheDir, "node_modules", "installed.txt"))).toBe(true);

    fs.rmSync(path.join(pluginDir, "node_modules"), { recursive: true, force: true });
    fs.rmSync(path.join(pluginDir, ".openclaw-runtime-deps.json"), { force: true });

    const logs: string[] = [];
    stageBundledPluginRuntimeDeps({
      repoRoot,
      logger: (message) => logs.push(message),
      spawnSync: spawnSyncMock as unknown as SpawnSyncOverride,
    });

    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(pluginDir, "node_modules", "installed.txt"))).toBe(true);
    expect(logs).toContain(
      "[runtime-postbuild] restored bundled runtime deps for discord from cache",
    );
  });

  it("removes stale staged runtime deps when a plugin no longer opts in", () => {
    const repoRoot = makeRepoRoot("openclaw-runtime-deps-cleanup-");
    const pluginDir = path.join(repoRoot, "dist", "extensions", "discord");
    const cacheDir = path.join(
      repoRoot,
      "node_modules",
      ".cache",
      "openclaw",
      "bundled-plugin-runtime-deps",
      "discord",
    );
    writeJson(path.join(pluginDir, "package.json"), {
      name: "@openclaw/discord",
      version: "1.0.0",
      dependencies: {
        zod: "^4.3.6",
      },
      openclaw: {
        bundle: {
          stageRuntimeDependencies: false,
        },
      },
    });
    fs.mkdirSync(path.join(pluginDir, "node_modules"), { recursive: true });
    writeJson(path.join(pluginDir, ".openclaw-runtime-deps.json"), {
      version: 1,
      stamp: "stale",
    });
    fs.mkdirSync(path.join(cacheDir, "node_modules"), { recursive: true });
    writeJson(path.join(cacheDir, ".openclaw-runtime-deps.json"), {
      version: 1,
      stamp: "stale",
    });

    stageBundledPluginRuntimeDeps({ repoRoot });

    expect(fs.existsSync(path.join(pluginDir, "node_modules"))).toBe(false);
    expect(fs.existsSync(path.join(pluginDir, ".openclaw-runtime-deps.json"))).toBe(false);
    expect(fs.existsSync(cacheDir)).toBe(false);
  });
});
