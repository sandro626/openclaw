export function resolveNpmRunner(params?: {
  execPath?: string;
  npmArgs?: string[];
  existsSync?: (path: string) => boolean;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  comSpec?: string;
}): {
  command: string;
  args: string[];
  shell: boolean;
  env?: NodeJS.ProcessEnv;
  windowsVerbatimArguments?: boolean;
};

export function stageBundledPluginRuntimeDeps(params?: {
  repoRoot?: string;
  cwd?: string;
  logger?: (message: string) => void;
  env?: NodeJS.ProcessEnv;
  execPath?: string;
  existsSync?: (path: string) => boolean;
  spawnSync?: typeof import("node:child_process").spawnSync;
}): void;
