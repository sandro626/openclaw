#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { OVERLAY_AGENT_STATIC_FILES } from "./lib/overlay-agent-static-files.mjs";

function printUsage() {
  console.log(`Usage: node scripts/seed-agent-workspaces.mjs --workspace-root <dir> [options]

Options:
  --workspace-root <dir>      Required. Runtime workspace root.
  --agent-ids <a,b,c>         Optional. Default: auto-detect from overlay/agents
  --overlay-agents-root <dir> Default: overlay/agents
  --skeleton-root <dir>       Default: runtime-templates/agents/workspace-skeleton
  --mode <missing|overwrite>  Default: missing
  --dry-run                   Print actions without writing files
`);
}

function parseArgs(argv) {
  const parsed = {
    overlayAgentsRoot: "overlay/agents",
    skeletonRoot: "runtime-templates/agents/workspace-skeleton",
    mode: "missing",
    dryRun: false,
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
    if (arg === "--dry-run") {
      parsed.dryRun = true;
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
      case "workspace-root":
        parsed.workspaceRoot = value;
        break;
      case "agent-ids":
        parsed.agentIds = value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
        break;
      case "overlay-agents-root":
        parsed.overlayAgentsRoot = value;
        break;
      case "skeleton-root":
        parsed.skeletonRoot = value;
        break;
      case "mode":
        if (value !== "missing" && value !== "overwrite") {
          throw new Error(`Unsupported mode: ${value}`);
        }
        parsed.mode = value;
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }

  return parsed;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listAgentIds(overlayAgentsRoot) {
  if (!(await exists(overlayAgentsRoot))) {
    return [];
  }
  const entries = await fs.readdir(overlayAgentsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted((left, right) => left.localeCompare(right));
}

function renderTemplate(raw, agentId) {
  return raw.replaceAll("{{agentId}}", agentId);
}

async function listExistingSafeFileNames(rootDir) {
  if (!(await exists(rootDir))) {
    return new Set();
  }
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  return new Set(
    entries
      .filter((entry) => entry.isFile() && OVERLAY_AGENT_STATIC_FILES.has(entry.name))
      .map((entry) => entry.name),
  );
}

async function copySafeFiles(params) {
  if (!(await exists(params.sourceRoot))) {
    return;
  }
  const entries = await fs.readdir(params.sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !OVERLAY_AGENT_STATIC_FILES.has(entry.name)) {
      continue;
    }
    const source = path.join(params.sourceRoot, entry.name);
    const target = path.join(params.targetRoot, entry.name);
    const targetExistedBefore = params.preexistingTargetFiles.has(entry.name);
    const targetSeededThisRun = params.seededTargetFiles.has(entry.name);
    if (params.mode === "missing") {
      const allowOverlayReplacement = params.allowSeededOverwrite && targetSeededThisRun;
      if (targetExistedBefore && !allowOverlayReplacement) {
        continue;
      }
    }
    const raw = await fs.readFile(source, "utf8");
    const rendered = renderTemplate(raw, params.agentId);
    if (params.dryRun) {
      console.log(`seed ${source} -> ${target}`);
    } else {
      await fs.mkdir(params.targetRoot, { recursive: true });
      await fs.writeFile(target, rendered, "utf8");
    }
    params.seededTargetFiles.add(entry.name);
    params.appliedTargets.set(entry.name, target);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (!args.workspaceRoot) {
    printUsage();
    throw new Error("--workspace-root is required");
  }

  const workspaceRoot = path.resolve(args.workspaceRoot);
  const overlayAgentsRoot = path.resolve(args.overlayAgentsRoot);
  const skeletonRoot = path.resolve(args.skeletonRoot);
  const agentIds = args.agentIds ?? (await listAgentIds(overlayAgentsRoot));

  if (agentIds.length === 0) {
    throw new Error("No agent ids found to seed");
  }

  const summary = [];
  for (const agentId of agentIds) {
    const targetRoot = path.join(workspaceRoot, agentId);
    const overlayWorkspaceRoot = path.join(overlayAgentsRoot, agentId, "workspace");
    const preexistingTargetFiles = await listExistingSafeFileNames(targetRoot);
    const seededTargetFiles = new Set();
    const appliedTargets = new Map();
    await copySafeFiles({
      sourceRoot: skeletonRoot,
      targetRoot,
      agentId,
      mode: args.mode,
      dryRun: args.dryRun,
      preexistingTargetFiles,
      seededTargetFiles,
      appliedTargets,
      allowSeededOverwrite: false,
    });
    await copySafeFiles({
      sourceRoot: overlayWorkspaceRoot,
      targetRoot,
      agentId,
      mode: args.mode,
      dryRun: args.dryRun,
      preexistingTargetFiles,
      seededTargetFiles,
      appliedTargets,
      allowSeededOverwrite: true,
    });

    if (args.dryRun) {
      console.log(`ensure ${path.join(targetRoot, "memory")}`);
    } else {
      await fs.mkdir(path.join(targetRoot, "memory"), { recursive: true });
    }

    summary.push({
      agentId,
      copiedFiles: Array.from(appliedTargets.values(), (filePath) =>
        filePath.split(path.sep).join("/"),
      ),
      memoryDir: path.join(targetRoot, "memory").split(path.sep).join("/"),
    });
  }

  console.log(JSON.stringify({ workspaceRoot, mode: args.mode, agents: summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
