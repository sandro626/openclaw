import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHUNK_ORDER = [
  "browser-runtime",
  "provider-and-channel-surfaces",
  "memory-runtime-stack",
  "agent-gateway-runtime",
  "contracts-tests-and-apps",
  "misc-upstream",
];

const CHUNK_LABELS = {
  "browser-runtime": "Chunk 1: Browser Runtime",
  "provider-and-channel-surfaces": "Chunk 2: Provider And Channel Surfaces",
  "memory-runtime-stack": "Chunk 3: Memory Runtime Stack",
  "agent-gateway-runtime": "Chunk 4: Agent Gateway Runtime",
  "contracts-tests-and-apps": "Chunk 5: Contracts Tests And Apps",
  "misc-upstream": "Chunk 6: Misc Upstream",
};

const BROWSER_RUNTIME_EXACT = new Set(["test/helpers/browser-bundled-plugin-fixture.ts"]);

const MEMORY_RUNTIME_EXACT = new Set(["src/library.test.ts"]);

const MEMORY_RUNTIME_PREFIXES = [
  "extensions/memory-core/",
  "packages/memory-host-sdk/",
  "src/plugin-sdk/memory-",
  "src/plugins/memory-",
];

const AGENT_GATEWAY_RUNTIME_EXACT = new Set(["src/utils/zod-parse.ts"]);

const AGENT_GATEWAY_RUNTIME_PREFIXES = [
  "src/agents/",
  "src/auto-reply/",
  "src/channels/",
  "src/chat/",
  "src/cli/",
  "src/commands/",
  "src/config/",
  "src/daemon/",
  "src/flows/",
  "src/gateway/",
  "src/infra/",
  "src/mcp/",
  "src/process/",
  "src/shared/",
  "src/terminal/",
  "src/test-utils/",
  "src/tts/",
  "src/tui/",
];

const CONTRACTS_TESTS_AND_APPS_EXACT = new Set([
  "CHANGELOG.md",
  "docs/cli/mcp.md",
  "scripts/generate-bundled-channel-config-metadata.ts",
  "scripts/stage-bundled-plugin-runtime-deps.d.mts",
  "vitest.contracts.config.ts",
]);

const CONTRACTS_TESTS_AND_APPS_PREFIXES = [
  "apps/",
  "scripts/e2e/",
  "scripts/test-",
  "test/",
  "ui/",
];

const PROVIDER_AND_CHANNEL_SURFACES_EXACT = new Set([
  "scripts/generate-plugin-sdk-facades.mjs",
  "scripts/lib/copy-assets.ts",
  "scripts/lib/plugin-sdk-facades.mjs",
]);

const PROVIDER_AND_CHANNEL_SURFACES_PREFIXES = [
  "extensions/",
  "src/media-understanding/",
  "src/plugin-sdk/",
  "src/plugins/",
];

function parseArgs(argv) {
  const args = {
    baseRef: "upstream/main",
    chunk: null,
    format: "text",
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
    if (arg === "--chunk") {
      args.chunk = argv[index + 1] ?? args.chunk;
      index += 1;
      continue;
    }
    if (arg === "--format") {
      args.format = argv[index + 1] ?? args.format;
      index += 1;
      continue;
    }
    if (arg === "--summary-only") {
      args.includeFiles = false;
      continue;
    }
    if (arg === "--write-dir") {
      args.writeDir = argv[index + 1] ?? args.writeDir;
      index += 1;
      continue;
    }
  }
  return args;
}

function runPnpm(args) {
  return execFileSync("pnpm", ["-s", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

function hasPrefix(filePath, prefixes) {
  return prefixes.some((prefix) => filePath.startsWith(prefix));
}

function assertValidChunk(chunkId) {
  if (!chunkId) {
    return;
  }
  if (!CHUNK_ORDER.includes(chunkId)) {
    throw new Error(`Unknown chunk "${chunkId}". Expected one of: ${CHUNK_ORDER.join(", ")}`);
  }
}

function classifyChunk(filePath) {
  if (BROWSER_RUNTIME_EXACT.has(filePath) || filePath.startsWith("extensions/browser/")) {
    return "browser-runtime";
  }
  if (MEMORY_RUNTIME_EXACT.has(filePath) || hasPrefix(filePath, MEMORY_RUNTIME_PREFIXES)) {
    return "memory-runtime-stack";
  }
  if (
    AGENT_GATEWAY_RUNTIME_EXACT.has(filePath) ||
    hasPrefix(filePath, AGENT_GATEWAY_RUNTIME_PREFIXES)
  ) {
    return "agent-gateway-runtime";
  }
  if (
    CONTRACTS_TESTS_AND_APPS_EXACT.has(filePath) ||
    hasPrefix(filePath, CONTRACTS_TESTS_AND_APPS_PREFIXES)
  ) {
    return "contracts-tests-and-apps";
  }
  if (
    PROVIDER_AND_CHANNEL_SURFACES_EXACT.has(filePath) ||
    hasPrefix(filePath, PROVIDER_AND_CHANNEL_SURFACES_PREFIXES)
  ) {
    return "provider-and-channel-surfaces";
  }
  return "misc-upstream";
}

function bucketFiles(filePaths) {
  const grouped = new Map(CHUNK_ORDER.map((chunk) => [chunk, []]));
  for (const filePath of filePaths) {
    grouped.get(classifyChunk(filePath)).push(filePath);
  }
  for (const [chunk, entries] of grouped) {
    grouped.set(
      chunk,
      entries.toSorted((left, right) => left.localeCompare(right)),
    );
  }
  return grouped;
}

function buildSummary(baseRef, upstreamSummary, grouped) {
  const allFiles = upstreamSummary.groups[0]?.files ?? [];
  return {
    baseRef,
    baseRefResolved: upstreamSummary.baseRefResolved,
    upstreamSyncCount: allFiles.length,
    chunks: CHUNK_ORDER.map((chunk) => ({
      id: chunk,
      label: CHUNK_LABELS[chunk],
      count: grouped.get(chunk)?.length ?? 0,
      files: grouped.get(chunk) ?? [],
    })),
  };
}

function selectChunks(summary, chunkId) {
  if (!chunkId) {
    return summary.chunks;
  }
  return summary.chunks.filter((chunk) => chunk.id === chunkId);
}

function formatText(summary, chunks, includeFiles) {
  const lines = [
    `Base ref: ${summary.baseRef}`,
    `Base ref resolved: ${summary.baseRefResolved}`,
    `Upstream sync paths: ${summary.upstreamSyncCount}`,
  ];

  for (const chunk of chunks) {
    lines.push("");
    lines.push(`${chunk.label} (${chunk.count})`);
    if (!includeFiles) {
      continue;
    }
    for (const filePath of chunk.files) {
      lines.push(filePath);
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatPaths(chunks) {
  return `${chunks.flatMap((chunk) => chunk.files).join("\n")}\n`;
}

function writeArtifacts(writeDir, summary) {
  fs.mkdirSync(writeDir, { recursive: true });
  fs.writeFileSync(
    path.join(writeDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  for (const chunk of summary.chunks) {
    fs.writeFileSync(path.join(writeDir, `${chunk.id}.txt`), `${chunk.files.join("\n")}\n`, "utf8");
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  assertValidChunk(args.chunk);
  const upstreamSummary = JSON.parse(
    runPnpm([
      "ops:list-upstream-upgrade-groups",
      "--base-ref",
      args.baseRef,
      "--group",
      "upstream-sync",
      "--format",
      "json",
    ]),
  );
  const upstreamFiles = upstreamSummary.groups[0]?.files ?? [];
  const grouped = bucketFiles(upstreamFiles);
  const summary = buildSummary(args.baseRef, upstreamSummary, grouped);

  if (args.writeDir) {
    writeArtifacts(args.writeDir, summary);
  }

  const selectedChunks = selectChunks(summary, args.chunk);

  if (args.format === "json") {
    process.stdout.write(`${JSON.stringify({ ...summary, chunks: selectedChunks }, null, 2)}\n`);
    return;
  }

  if (args.format === "paths") {
    process.stdout.write(formatPaths(selectedChunks));
    return;
  }

  process.stdout.write(formatText(summary, selectedChunks, args.includeFiles));
}

main();
