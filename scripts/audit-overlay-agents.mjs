#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const STATIC_WORKSPACE_FILES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "IDENTITY.md",
  "BOOTSTRAP.md",
  "USER.md",
  "TOOLS.md",
]);

function printUsage() {
  console.log(`Usage: node scripts/audit-overlay-agents.mjs [options]

Options:
  --root <dir>      Overlay agents root. Default: overlay/agents
  --json            Print JSON output (default)
  --text            Print text summary
`);
}

function parseArgs(argv) {
  const parsed = {
    root: "overlay/agents",
    format: "json",
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
    if (arg === "--json") {
      parsed.format = "json";
      continue;
    }
    if (arg === "--text") {
      parsed.format = "text";
      continue;
    }
    if (arg === "--root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --root");
      }
      parsed.root = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
}

function classifyRelative(relPath) {
  const normalized = relPath.split(path.sep).join("/");
  if (
    normalized.endsWith("/agent/auth-profiles.json") ||
    normalized.endsWith("/agent/auth-profiles.json.bak")
  ) {
    return "runtime_auth_profiles";
  }
  if (normalized.endsWith("/agent/auth.json")) {
    return "runtime_auth";
  }
  if (normalized.endsWith("/agent/models.json")) {
    return "runtime_models";
  }
  if (normalized.endsWith("/agent/config.json")) {
    return "runtime_config";
  }
  if (
    normalized.includes("/sessions/") ||
    normalized.endsWith("/sessions.json") ||
    normalized.includes("/sessions.json.")
  ) {
    return "session_history";
  }
  if (normalized.includes("/workspace/memory/")) {
    return "workspace_memory";
  }
  if (normalized.endsWith("/workspace/SESSION-STATE.md")) {
    return "workspace_state";
  }
  if (normalized.includes("/workspace/")) {
    const name = path.basename(normalized);
    if (STATIC_WORKSPACE_FILES.has(name)) {
      return "workspace_static";
    }
    return "workspace_other";
  }
  return "other";
}

function initBucket() {
  return {
    total: 0,
    byClass: {},
    byAgent: {},
  };
}

function record(bucket, relPath) {
  const agentId = relPath.split(path.sep)[0];
  const kind = classifyRelative(relPath);
  bucket.total += 1;
  bucket.byClass[kind] = (bucket.byClass[kind] ?? 0) + 1;
  bucket.byAgent[agentId] ??= {};
  bucket.byAgent[agentId][kind] = (bucket.byAgent[agentId][kind] ?? 0) + 1;
}

function sortEntryPairs(recordLike) {
  return Object.entries(recordLike).toSorted(([left], [right]) => left.localeCompare(right));
}

async function scanFilesystem(rootDir) {
  const bucket = initBucket();

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      const relPath = path.relative(rootDir, fullPath);
      if (relPath === "README.md") {
        continue;
      }
      record(bucket, relPath);
    }
  }

  await walk(rootDir);
  return bucket;
}

async function recordDirectoryTree(params) {
  const entries = await fs.readdir(params.fullPath, { withFileTypes: true });
  for (const entry of entries) {
    const childPath = path.join(params.fullPath, entry.name);
    if (entry.isDirectory()) {
      await recordDirectoryTree({
        bucket: params.bucket,
        fullPath: childPath,
        rootDir: params.rootDir,
      });
      continue;
    }
    const relPath = path.relative(params.rootDir, childPath);
    if (relPath === "README.md") {
      continue;
    }
    record(params.bucket, relPath);
  }
}

async function scanGitStatus(rootDir) {
  const bucket = initBucket();
  const raw = execFileSync("git", ["status", "--short", "--", rootDir], {
    encoding: "utf8",
  });

  for (const line of raw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const rawPath = line.slice(3).trim();
    const fullPath = path.resolve(rawPath);
    const relPath = path.relative(rootDir, fullPath);
    if (relPath === "README.md") {
      continue;
    }
    if (line.startsWith("?? ") && (await fs.stat(fullPath).catch(() => null))?.isDirectory()) {
      await recordDirectoryTree({
        bucket,
        fullPath,
        rootDir,
      });
      continue;
    }
    record(bucket, relPath);
  }

  return bucket;
}

function printText(summary) {
  console.log(`Root: ${summary.root}`);
  console.log(`Filesystem total: ${summary.filesystem.total}`);
  for (const [kind, count] of sortEntryPairs(summary.filesystem.byClass)) {
    console.log(`  fs.${kind}: ${String(count)}`);
  }
  console.log(`Git status total: ${summary.gitStatus.total}`);
  for (const [kind, count] of sortEntryPairs(summary.gitStatus.byClass)) {
    console.log(`  git.${kind}: ${String(count)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const rootDir = path.resolve(args.root);
  const summary = {
    root: rootDir,
    generatedAt: new Date().toISOString(),
    filesystem: await scanFilesystem(rootDir),
    gitStatus: await scanGitStatus(rootDir),
  };

  if (args.format === "text") {
    printText(summary);
    return;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
