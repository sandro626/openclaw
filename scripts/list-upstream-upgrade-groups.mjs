import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const GROUP_ORDER = ["build-cleanups", "local-forks", "layering", "upstream-sync"];

const GROUP_LABELS = {
  "build-cleanups": "Group 4: Build Cleanups",
  "local-forks": "Group 3: Local Forks",
  layering: "Group 2: Layering",
  "upstream-sync": "Group 1: Upstream Sync",
};

const GROUP4_EXACT = new Set([
  ".gitignore",
  ".oxfmtrc.jsonc",
  "docs/install/hetzner.md",
  "package.json",
  "pnpm-lock.yaml",
  "scripts/commit-upstream-upgrade-group.sh",
  "scripts/copy-bundled-plugin-metadata.mjs",
  "scripts/docker/install-sh-e2e/run.sh",
  "scripts/lib/plugin-sdk-entrypoints.json",
  "scripts/list-upstream-upgrade-groups.mjs",
  "scripts/list-upstream-upgrade-review-chunks.mjs",
  "scripts/stage-bundled-plugin-runtime-deps.mjs",
  "skills/gh-issues/SKILL.md",
  "src/config/types.gateway.ts",
  "src/generated/bundled-channel-entries.generated.ts",
  "src/generated/bundled-plugin-entries.generated.ts",
  "src/plugins/bundled-plugin-metadata.generated.ts",
  "src/plugins/copy-bundled-plugin-metadata.test.ts",
  "src/plugins/stage-bundled-plugin-runtime-deps.test.ts",
  "src/utils/usage-format.ts",
]);

const GROUP3_PREFIXES = [
  "extensions/mysql-readonly/",
  "extensions/superBrower/",
  "extensions/wecom/",
  "extensions/zentao/",
  "overlay/extensions/wecom/",
];

const GROUP3_EXACT = new Set([
  "overlay/skills/browser-use/SKILL.md",
  "overlay/skills/dev-openclaw/SKILL.md",
  "overlay/skills/feishu-suite/README.md",
  "overlay/skills/mysql-readonly/SKILL.md",
  "overlay/skills/ops-workflows/README.md",
  "overlay/skills/superBrower/SKILL.md",
  "overlay/skills/zentao/SKILL.md",
  "src/plugin-sdk/wecom.ts",
]);

const GROUP2_PREFIXES = [
  "deploy/",
  "docs/operations/",
  "overlay/",
  "runtime-templates/",
  "server-config/",
];

const GROUP2_EXACT = new Set([
  "docs/development/DEPLOY-LOCAL-TO-SERVER.md",
  "scripts/assemble-runtime-bundle.mjs",
  "scripts/audit-overlay-agents.mjs",
  "scripts/check-repo-layering.mjs",
  "scripts/lib/overlay-agent-static-files.mjs",
  "scripts/seed-agent-workspaces.mjs",
]);

function parseArgs(argv) {
  const args = {
    baseRef: "upstream/main",
    format: "text",
    group: null,
    includeFiles: true,
    writeDir: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-ref") {
      args.baseRef = argv[index + 1] ?? args.baseRef;
      index += 1;
      continue;
    }
    if (arg === "--format") {
      args.format = argv[index + 1] ?? args.format;
      index += 1;
      continue;
    }
    if (arg === "--group") {
      args.group = argv[index + 1] ?? args.group;
      index += 1;
      continue;
    }
    if (arg === "--summary-only") {
      args.includeFiles = false;
      continue;
    }
    if (arg === "--write-dir") {
      args.writeDir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
  }
  return args;
}

function runGit(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function splitLines(value) {
  if (!value) {
    return [];
  }
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function listTrackedChanges(baseRef) {
  return splitLines(runGit(["diff", "--name-only", baseRef, "--"]));
}

function resolveRef(baseRef) {
  return runGit(["rev-parse", "--verify", baseRef]);
}

function listUntrackedChanges() {
  return splitLines(runGit(["ls-files", "--others", "--exclude-standard"]));
}

function uniqueSorted(items) {
  return Array.from(new Set(items)).toSorted((left, right) => left.localeCompare(right));
}

function hasPrefix(filePath, prefixes) {
  return prefixes.some((prefix) => filePath.startsWith(prefix));
}

function classifyPath(filePath) {
  if (GROUP4_EXACT.has(filePath)) {
    return "build-cleanups";
  }
  if (GROUP3_EXACT.has(filePath) || hasPrefix(filePath, GROUP3_PREFIXES)) {
    return "local-forks";
  }
  if (GROUP2_EXACT.has(filePath) || hasPrefix(filePath, GROUP2_PREFIXES)) {
    return "layering";
  }
  return "upstream-sync";
}

function bucketPaths(filePaths) {
  const grouped = new Map(GROUP_ORDER.map((group) => [group, []]));
  for (const filePath of filePaths) {
    grouped.get(classifyPath(filePath)).push(filePath);
  }
  for (const [group, entries] of grouped) {
    grouped.set(
      group,
      entries.toSorted((left, right) => left.localeCompare(right)),
    );
  }
  return grouped;
}

function buildSummary(
  baseRef,
  baseRefResolved,
  trackedPaths,
  untrackedPaths,
  grouped,
  uniqueCount,
) {
  return {
    baseRef,
    baseRefResolved,
    trackedEntryCount: trackedPaths.length,
    untrackedEntryCount: untrackedPaths.length,
    rawEntryCount: trackedPaths.length + untrackedPaths.length,
    uniquePathCount: uniqueCount,
    groups: GROUP_ORDER.map((group) => ({
      id: group,
      label: GROUP_LABELS[group],
      count: grouped.get(group)?.length ?? 0,
      files: grouped.get(group) ?? [],
    })),
  };
}

function selectGroups(summary, groupId) {
  if (!groupId) {
    return summary.groups;
  }
  return summary.groups.filter((group) => group.id === groupId);
}

function assertValidGroup(groupId) {
  if (!groupId) {
    return;
  }
  if (!GROUP_ORDER.includes(groupId)) {
    throw new Error(`Unknown group "${groupId}". Expected one of: ${GROUP_ORDER.join(", ")}`);
  }
}

function formatText(summary, groups, includeFiles) {
  const lines = [
    `Base ref: ${summary.baseRef}`,
    `Base ref resolved: ${summary.baseRefResolved}`,
    `Tracked entries: ${summary.trackedEntryCount}`,
    `Untracked entries: ${summary.untrackedEntryCount}`,
    `Raw entry count: ${summary.rawEntryCount}`,
    `Unique paths: ${summary.uniquePathCount}`,
  ];

  for (const group of groups) {
    lines.push("");
    lines.push(`${group.label} (${group.count})`);
    if (!includeFiles) {
      continue;
    }
    for (const filePath of group.files) {
      lines.push(filePath);
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatPaths(groups) {
  return `${groups.flatMap((group) => group.files).join("\n")}\n`;
}

function writeArtifacts(writeDir, summary) {
  fs.mkdirSync(writeDir, { recursive: true });
  fs.writeFileSync(
    path.join(writeDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  for (const group of summary.groups) {
    fs.writeFileSync(path.join(writeDir, `${group.id}.txt`), `${group.files.join("\n")}\n`, "utf8");
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  assertValidGroup(args.group);
  const baseRefResolved = resolveRef(args.baseRef);
  const trackedPaths = listTrackedChanges(args.baseRef);
  const untrackedPaths = listUntrackedChanges();
  const allPaths = uniqueSorted([...trackedPaths, ...untrackedPaths]);
  const grouped = bucketPaths(allPaths);
  const summary = buildSummary(
    args.baseRef,
    baseRefResolved,
    trackedPaths,
    untrackedPaths,
    grouped,
    allPaths.length,
  );

  if (args.writeDir) {
    writeArtifacts(args.writeDir, summary);
  }

  const selectedGroups = selectGroups(summary, args.group);

  if (args.format === "json") {
    process.stdout.write(`${JSON.stringify({ ...summary, groups: selectedGroups }, null, 2)}\n`);
    return;
  }

  if (args.format === "paths") {
    process.stdout.write(formatPaths(selectedGroups));
    return;
  }

  process.stdout.write(formatText(summary, selectedGroups, args.includeFiles));
}

main();
