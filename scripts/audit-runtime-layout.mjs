#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function printUsage() {
  console.log(`Usage: node scripts/audit-runtime-layout.mjs --runtime-root <dir> [options]

Options:
  --runtime-root <dir>        Required. Runtime root, for example ~/.openclaw
  --environment <name>       Default: prod
  --config-path <file>       Optional. Read agent ids from an openclaw.json instead of template env
  --format <text|json>       Default: text
  --write-file <path>        Optional. Write the full JSON report to a file
`);
}

function parseArgs(argv) {
  const parsed = {
    environment: "prod",
    format: "text",
    writeFile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;
    switch (key) {
      case "runtime-root":
        parsed.runtimeRoot = value;
        break;
      case "environment":
        parsed.environment = value;
        break;
      case "config-path":
        parsed.configPath = value;
        break;
      case "format":
        if (value !== "text" && value !== "json") {
          throw new Error(`Unsupported format: ${value}`);
        }
        parsed.format = value;
        break;
      case "write-file":
        parsed.writeFile = value;
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }

  return parsed;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listDirectories(targetPath) {
  if (!(await pathExists(targetPath))) {
    return [];
  }
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted((left, right) => left.localeCompare(right));
}

async function readJson(targetPath) {
  return JSON.parse(await fs.readFile(targetPath, "utf8"));
}

function normalizePath(targetPath) {
  return targetPath.split(path.sep).join("/");
}

async function loadEnvironmentAgentIds(environment) {
  const envPath = path.resolve("runtime-templates/agents/environments", `${environment}.json`);
  if (!(await pathExists(envPath))) {
    throw new Error(`Agent environment template not found: ${envPath}`);
  }
  const raw = await readJson(envPath);
  const list = raw?.agents?.list;
  if (!Array.isArray(list)) {
    throw new Error(`Expected agents.list array in ${envPath}`);
  }
  const rawAgentIds = list
    .map((entry) => entry?.id)
    .filter((entry) => typeof entry === "string" && entry.length > 0);
  return {
    rawAgentIds,
    uniqueAgentIds: Array.from(new Set(rawAgentIds)).toSorted((left, right) =>
      left.localeCompare(right),
    ),
    duplicateAgentIds: [],
  };
}

async function loadConfigAgentIds(configPath) {
  const resolvedConfigPath = path.resolve(configPath);
  if (!(await pathExists(resolvedConfigPath))) {
    throw new Error(`Runtime config not found: ${resolvedConfigPath}`);
  }
  const raw = await readJson(resolvedConfigPath);
  const list = raw?.agents?.list;
  if (!Array.isArray(list)) {
    throw new Error(`Expected agents.list array in ${resolvedConfigPath}`);
  }
  const rawAgentIds = list
    .map((entry) => entry?.id)
    .filter((entry) => typeof entry === "string" && entry.length > 0);
  const duplicateAgentIds = [];
  const seen = new Set();
  for (const agentId of rawAgentIds) {
    if (seen.has(agentId) && !duplicateAgentIds.includes(agentId)) {
      duplicateAgentIds.push(agentId);
      continue;
    }
    seen.add(agentId);
  }
  return {
    rawAgentIds,
    uniqueAgentIds: Array.from(new Set(rawAgentIds)).toSorted((left, right) =>
      left.localeCompare(right),
    ),
    duplicateAgentIds: duplicateAgentIds.toSorted((left, right) => left.localeCompare(right)),
  };
}

async function inspectProdAgents(runtimeRoot, prodAgentIds, legacyWorkspaceSet, agentDirSet) {
  const rows = [];
  for (const agentId of prodAgentIds) {
    const normalizedWorkspacePath = path.join(runtimeRoot, "workspace", agentId);
    const normalizedMemoryPath = path.join(normalizedWorkspacePath, "memory");
    const legacyWorkspaceName = `workspace-${agentId}`;
    const legacyWorkspacePath = path.join(runtimeRoot, legacyWorkspaceName);
    const legacyMemoryPath = path.join(legacyWorkspacePath, "memory");
    const sessionDirPath = path.join(runtimeRoot, "agents", agentId, "sessions");
    const normalizedWorkspaceExists = await pathExists(normalizedWorkspacePath);
    const normalizedMemoryExists = await pathExists(normalizedMemoryPath);
    const legacyWorkspaceExists = legacyWorkspaceSet.has(legacyWorkspaceName);
    const legacyMemoryExists = legacyWorkspaceExists && (await pathExists(legacyMemoryPath));
    const sessionDirExists = agentDirSet.has(agentId) && (await pathExists(sessionDirPath));
    let recommendedAction = "verify";
    if (legacyWorkspaceExists) {
      recommendedAction = normalizedMemoryExists
        ? "review-before-merge"
        : "migrate-legacy-workspace";
    } else if (!normalizedWorkspaceExists) {
      recommendedAction = "create-normalized-workspace";
    } else if (!normalizedMemoryExists) {
      recommendedAction = "verify-normalized-memory";
    } else if (!sessionDirExists) {
      recommendedAction = "verify-session-dir";
    } else {
      recommendedAction = "keep-current-layout";
    }
    rows.push({
      id: agentId,
      normalizedWorkspacePath: normalizePath(normalizedWorkspacePath),
      normalizedWorkspaceExists,
      normalizedMemoryPath: normalizePath(normalizedMemoryPath),
      normalizedMemoryExists,
      legacyWorkspacePath: normalizePath(legacyWorkspacePath),
      legacyWorkspaceExists,
      legacyMemoryPath: normalizePath(legacyMemoryPath),
      legacyMemoryExists,
      sessionDirPath: normalizePath(sessionDirPath),
      sessionDirExists,
      recommendedAction,
    });
  }
  return rows;
}

function buildReport(args, agentIds, prodAgents, legacyWorkspaceDirs, historicalAgentIds) {
  const prodAgentIds = agentIds.uniqueAgentIds;
  const migrateLegacyWorkspaces = legacyWorkspaceDirs
    .filter((entry) => prodAgentIds.includes(entry.agentId))
    .map((entry) => ({
      legacyDir: entry.name,
      agentId: entry.agentId,
      targetDir: `workspace/${entry.agentId}`,
    }));

  const archiveLegacyWorkspaces = legacyWorkspaceDirs
    .filter((entry) => !prodAgentIds.includes(entry.agentId))
    .map((entry) => entry.name);

  const normalizedMemoryReady = prodAgents
    .filter((entry) => entry.normalizedMemoryExists)
    .map((entry) => entry.id);

  const needsLegacyMemoryReview = prodAgents
    .filter((entry) => !entry.normalizedMemoryExists)
    .map((entry) => entry.id);

  const prodAgentsMissingSessionDir = prodAgents
    .filter((entry) => !entry.sessionDirExists)
    .map((entry) => entry.id);

  return {
    runtimeRoot: normalizePath(args.runtimeRoot),
    environment: args.environment,
    agentSource: args.configPath ? "config" : "environment-template",
    configPath: args.configPath ? normalizePath(path.resolve(args.configPath)) : null,
    rawConfiguredAgentIds: agentIds.rawAgentIds,
    prodAgentIds,
    duplicateConfiguredAgentIds: agentIds.duplicateAgentIds,
    summary: {
      rawConfiguredAgentCount: agentIds.rawAgentIds.length,
      prodAgentCount: prodAgentIds.length,
      duplicateConfiguredAgentCount: agentIds.duplicateAgentIds.length,
      normalizedMemoryReadyCount: normalizedMemoryReady.length,
      needsLegacyMemoryReviewCount: needsLegacyMemoryReview.length,
      migrateLegacyWorkspaceCount: migrateLegacyWorkspaces.length,
      archiveLegacyWorkspaceCount: archiveLegacyWorkspaces.length,
      historicalAgentSessionCount: historicalAgentIds.length,
      prodAgentsMissingSessionDirCount: prodAgentsMissingSessionDir.length,
    },
    prodAgents,
    normalizedMemoryReady,
    needsLegacyMemoryReview,
    migrateLegacyWorkspaces,
    archiveLegacyWorkspaces,
    historicalAgentSessionsToArchive: historicalAgentIds,
    prodAgentsMissingSessionDir,
  };
}

function formatText(report) {
  const lines = [
    `Runtime root: ${report.runtimeRoot}`,
    `Environment: ${report.environment}`,
    `Configured agent rows: ${report.summary.rawConfiguredAgentCount}`,
    `Prod agents: ${report.summary.prodAgentCount}`,
    `Duplicate configured agent ids: ${report.summary.duplicateConfiguredAgentCount}`,
    `Normalized memory ready: ${report.summary.normalizedMemoryReadyCount}`,
    `Needs legacy memory review: ${report.summary.needsLegacyMemoryReviewCount}`,
    `Legacy workspaces to migrate: ${report.summary.migrateLegacyWorkspaceCount}`,
    `Legacy workspaces to archive: ${report.summary.archiveLegacyWorkspaceCount}`,
    `Historical agent sessions to archive: ${report.summary.historicalAgentSessionCount}`,
    `Prod agents missing session dir: ${report.summary.prodAgentsMissingSessionDirCount}`,
    "",
    "Normalized memory ready",
  ];

  if (report.normalizedMemoryReady.length === 0) {
    lines.push("(none)");
  } else {
    for (const agentId of report.normalizedMemoryReady) {
      lines.push(agentId);
    }
  }

  lines.push("");
  lines.push("Duplicate configured agent ids");
  if (report.duplicateConfiguredAgentIds.length === 0) {
    lines.push("(none)");
  } else {
    for (const agentId of report.duplicateConfiguredAgentIds) {
      lines.push(agentId);
    }
  }

  lines.push("");
  lines.push("Needs legacy memory review");
  if (report.needsLegacyMemoryReview.length === 0) {
    lines.push("(none)");
  } else {
    for (const agentId of report.needsLegacyMemoryReview) {
      lines.push(agentId);
    }
  }

  lines.push("");
  lines.push("Legacy workspaces to migrate");
  if (report.migrateLegacyWorkspaces.length === 0) {
    lines.push("(none)");
  } else {
    for (const entry of report.migrateLegacyWorkspaces) {
      lines.push(`${entry.legacyDir} -> ${entry.targetDir}`);
    }
  }

  lines.push("");
  lines.push("Legacy workspaces to archive");
  if (report.archiveLegacyWorkspaces.length === 0) {
    lines.push("(none)");
  } else {
    for (const workspaceName of report.archiveLegacyWorkspaces) {
      lines.push(workspaceName);
    }
  }

  lines.push("");
  lines.push("Historical agent sessions to archive");
  if (report.historicalAgentSessionsToArchive.length === 0) {
    lines.push("(none)");
  } else {
    for (const agentId of report.historicalAgentSessionsToArchive) {
      lines.push(agentId);
    }
  }

  lines.push("");
  lines.push("Prod agent status");
  for (const entry of report.prodAgents) {
    lines.push(
      [
        entry.id,
        `normalized=${entry.normalizedWorkspaceExists ? "yes" : "no"}`,
        `memory=${entry.normalizedMemoryExists ? "yes" : "no"}`,
        `legacy=${entry.legacyWorkspaceExists ? "yes" : "no"}`,
        `sessions=${entry.sessionDirExists ? "yes" : "no"}`,
        `action=${entry.recommendedAction}`,
      ].join(" "),
    );
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (!args.runtimeRoot) {
    printUsage();
    throw new Error("--runtime-root is required");
  }

  const runtimeRoot = path.resolve(args.runtimeRoot);
  const agentIds = args.configPath
    ? await loadConfigAgentIds(args.configPath)
    : await loadEnvironmentAgentIds(args.environment);
  const prodAgentIds = agentIds.uniqueAgentIds;
  const agentDirs = await listDirectories(path.join(runtimeRoot, "agents"));
  const runtimeRootDirs = await listDirectories(runtimeRoot);
  const legacyWorkspaceDirs = runtimeRootDirs
    .filter((name) => name.startsWith("workspace-"))
    .map((name) => ({
      name,
      agentId: name.slice("workspace-".length),
    }));
  const prodAgents = await inspectProdAgents(
    runtimeRoot,
    prodAgentIds,
    new Set(legacyWorkspaceDirs.map((entry) => entry.name)),
    new Set(agentDirs),
  );
  const historicalAgentIds = agentDirs.filter((agentId) => !prodAgentIds.includes(agentId));
  const report = buildReport(
    {
      runtimeRoot,
      environment: args.environment,
      configPath: args.configPath ?? null,
    },
    agentIds,
    prodAgents,
    legacyWorkspaceDirs,
    historicalAgentIds,
  );

  if (args.writeFile) {
    const targetPath = path.resolve(args.writeFile);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  if (args.format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(formatText(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
