import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WINDOWS_UNSAFE_CMD_CHARS_RE = /[&|<>^%\r\n]/;
const RUNTIME_DEPS_STAMP_FILE = ".openclaw-runtime-deps.json";
const RUNTIME_DEPS_STAMP_VERSION = 1;
const RUNTIME_DEPS_CACHE_DIR = path.join(
  "node_modules",
  ".cache",
  "openclaw",
  "bundled-plugin-runtime-deps",
);
const DEFAULT_NPM_INSTALL_ARGS = [
  "install",
  "--omit=dev",
  "--silent",
  "--no-audit",
  "--no-fund",
  "--ignore-scripts",
  "--legacy-peer-deps",
  "--package-lock=false",
  "--prefer-offline",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function removePathIfExists(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function makeTempDir(parentDir, prefix) {
  return fs.mkdtempSync(path.join(parentDir, prefix));
}

function copyPath(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function listBundledPluginRuntimeDirs(repoRoot) {
  const extensionsRoot = path.join(repoRoot, "dist", "extensions");
  if (!fs.existsSync(extensionsRoot)) {
    return [];
  }

  return fs
    .readdirSync(extensionsRoot, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => path.join(extensionsRoot, dirent.name))
    .filter((pluginDir) => fs.existsSync(path.join(pluginDir, "package.json")));
}

function hasRuntimeDeps(packageJson) {
  return (
    Object.keys(packageJson.dependencies ?? {}).length > 0 ||
    Object.keys(packageJson.optionalDependencies ?? {}).length > 0
  );
}

function shouldStageRuntimeDeps(packageJson) {
  return packageJson.openclaw?.bundle?.stageRuntimeDependencies === true;
}

function buildRuntimeDepsStamp(packageJson) {
  return JSON.stringify({
    version: RUNTIME_DEPS_STAMP_VERSION,
    name: packageJson.name ?? null,
    packageVersion: packageJson.version ?? null,
    dependencies: packageJson.dependencies ?? {},
    optionalDependencies: packageJson.optionalDependencies ?? {},
    peerDependencies: packageJson.peerDependencies ?? {},
    peerDependenciesMeta: packageJson.peerDependenciesMeta ?? {},
    overrides: packageJson.overrides ?? {},
    os: packageJson.os ?? [],
    cpu: packageJson.cpu ?? [],
    installArgs: DEFAULT_NPM_INSTALL_ARGS,
  });
}

function readRuntimeDepsStamp(filePath) {
  try {
    const payload = readJson(filePath);
    if (typeof payload?.stamp === "string") {
      return payload.stamp;
    }

    // Accept the transient upstream stamp format while converging on the
    // cache-aware overlay versioned stamp.
    return typeof payload?.fingerprint === "string" ? payload.fingerprint : null;
  } catch {
    return null;
  }
}

function writeRuntimeDepsStamp(filePath, stamp) {
  writeJson(filePath, {
    version: RUNTIME_DEPS_STAMP_VERSION,
    stamp,
  });
}

function resolveRuntimeDepsCacheDir(repoRoot, pluginId) {
  return path.join(repoRoot, RUNTIME_DEPS_CACHE_DIR, pluginId);
}

function sanitizeBundledManifestForRuntimeInstall(pluginDir) {
  const manifestPath = path.join(pluginDir, "package.json");
  const packageJson = readJson(manifestPath);
  let changed = false;

  if (packageJson.peerDependencies?.openclaw) {
    const nextPeerDependencies = { ...packageJson.peerDependencies };
    delete nextPeerDependencies.openclaw;
    if (Object.keys(nextPeerDependencies).length === 0) {
      delete packageJson.peerDependencies;
    } else {
      packageJson.peerDependencies = nextPeerDependencies;
    }
    changed = true;
  }

  if (packageJson.peerDependenciesMeta?.openclaw) {
    const nextPeerDependenciesMeta = { ...packageJson.peerDependenciesMeta };
    delete nextPeerDependenciesMeta.openclaw;
    if (Object.keys(nextPeerDependenciesMeta).length === 0) {
      delete packageJson.peerDependenciesMeta;
    } else {
      packageJson.peerDependenciesMeta = nextPeerDependenciesMeta;
    }
    changed = true;
  }

  if (packageJson.devDependencies?.openclaw) {
    const nextDevDependencies = { ...packageJson.devDependencies };
    delete nextDevDependencies.openclaw;
    if (Object.keys(nextDevDependencies).length === 0) {
      delete packageJson.devDependencies;
    } else {
      packageJson.devDependencies = nextDevDependencies;
    }
    changed = true;
  }

  if (changed) {
    writeJson(manifestPath, packageJson);
  }

  return packageJson;
}

export function resolveNpmRunner(params = {}) {
  const execPath = params.execPath ?? process.execPath;
  const npmArgs = params.npmArgs ?? [];
  const existsSync = params.existsSync ?? fs.existsSync;
  const env = params.env ?? process.env;
  const platform = params.platform ?? process.platform;
  const comSpec = params.comSpec ?? env.ComSpec ?? "cmd.exe";
  const pathImpl = platform === "win32" ? path.win32 : path.posix;
  const nodeDir = pathImpl.dirname(execPath);
  const npmToolchain = resolveToolchainNpmRunner({
    comSpec,
    existsSync,
    nodeDir,
    npmArgs,
    pathImpl,
    platform,
  });
  if (npmToolchain) {
    return npmToolchain;
  }
  if (platform === "win32") {
    const expectedPaths = [
      pathImpl.resolve(nodeDir, "../lib/node_modules/npm/bin/npm-cli.js"),
      pathImpl.resolve(nodeDir, "node_modules/npm/bin/npm-cli.js"),
      pathImpl.resolve(nodeDir, "npm.exe"),
      pathImpl.resolve(nodeDir, "npm.cmd"),
    ];
    throw new Error(
      `failed to resolve a toolchain-local npm next to ${execPath}. ` +
        `Checked: ${expectedPaths.join(", ")}. ` +
        "OpenClaw refuses to shell out to bare npm on Windows; install a Node.js toolchain that bundles npm or run with a matching Node installation.",
    );
  }
  const pathKey = resolvePathEnvKey(env);
  const currentPath = env[pathKey];
  return {
    command: "npm",
    args: npmArgs,
    shell: false,
    env: {
      ...env,
      [pathKey]:
        typeof currentPath === "string" && currentPath.length > 0
          ? `${nodeDir}${path.delimiter}${currentPath}`
          : nodeDir,
    },
  };
}

function resolveToolchainNpmRunner(params) {
  const npmCliCandidates = [
    params.pathImpl.resolve(params.nodeDir, "../lib/node_modules/npm/bin/npm-cli.js"),
    params.pathImpl.resolve(params.nodeDir, "node_modules/npm/bin/npm-cli.js"),
  ];
  const npmCliPath = npmCliCandidates.find((candidate) => params.existsSync(candidate));
  if (npmCliPath) {
    return {
      command:
        params.platform === "win32"
          ? params.pathImpl.join(params.nodeDir, "node.exe")
          : params.pathImpl.join(params.nodeDir, "node"),
      args: [npmCliPath, ...params.npmArgs],
      shell: false,
    };
  }
  if (params.platform !== "win32") {
    return null;
  }
  const npmExePath = params.pathImpl.resolve(params.nodeDir, "npm.exe");
  if (params.existsSync(npmExePath)) {
    return {
      command: npmExePath,
      args: params.npmArgs,
      shell: false,
    };
  }
  const npmCmdPath = params.pathImpl.resolve(params.nodeDir, "npm.cmd");
  if (params.existsSync(npmCmdPath)) {
    return {
      command: params.comSpec,
      args: ["/d", "/s", "/c", buildCmdExeCommandLine(npmCmdPath, params.npmArgs)],
      shell: false,
      windowsVerbatimArguments: true,
    };
  }
  return null;
}

function resolvePathEnvKey(env) {
  return Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
}

function escapeForCmdExe(arg) {
  if (WINDOWS_UNSAFE_CMD_CHARS_RE.test(arg)) {
    throw new Error(`unsafe Windows cmd.exe argument detected: ${JSON.stringify(arg)}`);
  }
  if (!arg.includes(" ") && !arg.includes('"')) {
    return arg;
  }
  return `"${arg.replace(/"/g, '""')}"`;
}

function buildCmdExeCommandLine(command, args) {
  return [escapeForCmdExe(command), ...args.map(escapeForCmdExe)].join(" ");
}

function runPluginRuntimeDepsInstall(pluginDir, params = {}) {
  const npmRunner = resolveNpmRunner({
    env: params.env,
    execPath: params.execPath,
    existsSync: params.existsSync,
    npmArgs: params.npmArgs ?? DEFAULT_NPM_INSTALL_ARGS,
  });
  const spawnSyncImpl = params.spawnSync ?? spawnSync;
  return spawnSyncImpl(npmRunner.command, npmRunner.args, {
    cwd: pluginDir,
    encoding: "utf8",
    env: npmRunner.env,
    stdio: "pipe",
    shell: npmRunner.shell,
    windowsVerbatimArguments: npmRunner.windowsVerbatimArguments,
  });
}

function installPluginRuntimeDeps(params) {
  const { packageJson, pluginDir, pluginId } = params;
  const nodeModulesDir = path.join(pluginDir, "node_modules");
  const tempInstallDir = makeTempDir(pluginDir, ".runtime-deps-");

  try {
    writeJson(path.join(tempInstallDir, "package.json"), packageJson);
    let result = runPluginRuntimeDepsInstall(tempInstallDir, params);
    if (result.status !== 0) {
      const fallbackInstallArgs = DEFAULT_NPM_INSTALL_ARGS.filter(
        (arg) => arg !== "--prefer-offline",
      );
      result = runPluginRuntimeDepsInstall(tempInstallDir, {
        ...params,
        npmArgs: fallbackInstallArgs,
      });
    }
    if (result.status !== 0) {
      const output = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
      throw new Error(
        `failed to stage bundled runtime deps for ${pluginId}: ${output || "npm install failed"}`,
      );
    }

    const stagedNodeModulesDir = path.join(tempInstallDir, "node_modules");
    if (!fs.existsSync(stagedNodeModulesDir)) {
      throw new Error(
        `failed to stage bundled runtime deps for ${pluginId}: npm install produced no node_modules directory`,
      );
    }

    removePathIfExists(nodeModulesDir);
    fs.renameSync(stagedNodeModulesDir, nodeModulesDir);
  } finally {
    removePathIfExists(tempInstallDir);
  }
}

export function stageBundledPluginRuntimeDeps(params = {}) {
  const repoRoot = params.cwd ?? params.repoRoot ?? process.cwd();
  const logger =
    typeof params.logger === "function" ? params.logger : (message) => console.error(message);
  const installPluginRuntimeDepsImpl =
    params.installPluginRuntimeDepsImpl ?? installPluginRuntimeDeps;

  for (const pluginDir of listBundledPluginRuntimeDirs(repoRoot)) {
    const pluginId = path.basename(pluginDir);
    const nodeModulesDir = path.join(pluginDir, "node_modules");
    const stampPath = path.join(pluginDir, RUNTIME_DEPS_STAMP_FILE);
    const cacheDir = resolveRuntimeDepsCacheDir(repoRoot, pluginId);
    const cacheNodeModulesDir = path.join(cacheDir, "node_modules");
    const cacheStampPath = path.join(cacheDir, RUNTIME_DEPS_STAMP_FILE);
    const packageJson = readJson(path.join(pluginDir, "package.json"));

    if (!hasRuntimeDeps(packageJson) || !shouldStageRuntimeDeps(packageJson)) {
      removePathIfExists(cacheDir);
      removePathIfExists(stampPath);
      removePathIfExists(nodeModulesDir);
      continue;
    }

    const sanitizedPackageJson = sanitizeBundledManifestForRuntimeInstall(pluginDir);
    const expectedStamp = buildRuntimeDepsStamp(sanitizedPackageJson);
    if (fs.existsSync(nodeModulesDir) && readRuntimeDepsStamp(stampPath) === expectedStamp) {
      logger(`[runtime-postbuild] reusing bundled runtime deps for ${pluginId}`);
      continue;
    }

    if (
      fs.existsSync(cacheNodeModulesDir) &&
      readRuntimeDepsStamp(cacheStampPath) === expectedStamp
    ) {
      removePathIfExists(nodeModulesDir);
      removePathIfExists(stampPath);
      copyPath(cacheNodeModulesDir, nodeModulesDir);
      writeRuntimeDepsStamp(stampPath, expectedStamp);
      logger(`[runtime-postbuild] restored bundled runtime deps for ${pluginId} from cache`);
      continue;
    }

    removePathIfExists(nodeModulesDir);
    removePathIfExists(stampPath);
    logger(`[runtime-postbuild] staging bundled runtime deps for ${pluginId}`);
    const startedAt = Date.now();
    installPluginRuntimeDepsImpl({
      ...params,
      packageJson: sanitizedPackageJson,
      pluginDir,
      pluginId,
    });
    writeRuntimeDepsStamp(stampPath, expectedStamp);
    removePathIfExists(cacheDir);
    copyPath(nodeModulesDir, cacheNodeModulesDir);
    writeRuntimeDepsStamp(cacheStampPath, expectedStamp);
    logger(
      `[runtime-postbuild] staged bundled runtime deps for ${pluginId} in ${Date.now() - startedAt}ms`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  stageBundledPluginRuntimeDeps();
}
