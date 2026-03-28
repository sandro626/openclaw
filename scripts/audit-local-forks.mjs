#!/usr/bin/env node

import path from "node:path";
import { compareLocalForkPair, hasMeaningfulForkDelta } from "./lib/local-fork-audit.mjs";

const projectRoot = process.cwd();

const FORK_PAIRS = [
  {
    id: "wecom",
    baseDir: path.join(projectRoot, "extensions", "wecom"),
    overlayDir: path.join(projectRoot, "overlay", "extensions", "wecom"),
    ignoreSegments: ["node_modules"],
  },
];

function parseArgs(argv) {
  return {
    format: argv.includes("--json") ? "json" : "text",
    summaryOnly: argv.includes("--summary-only"),
  };
}

function renderText(results, summaryOnly) {
  const lines = [];
  for (const result of results) {
    lines.push(`Fork: ${result.id}`);
    lines.push(`  Base dir: ${path.relative(projectRoot, result.baseDir)}`);
    lines.push(`  Overlay dir: ${path.relative(projectRoot, result.overlayDir)}`);
    lines.push(`  Base files: ${result.baseFileCount}`);
    lines.push(`  Overlay files: ${result.overlayFileCount}`);
    lines.push(`  Same files: ${result.same.length}`);
    lines.push(`  Different files: ${result.different.length}`);
    lines.push(`  Overlay-only files: ${result.onlyOverlay.length}`);
    lines.push(`  Base-only files: ${result.onlyBase.length}`);
    lines.push(`  Meaningful delta: ${hasMeaningfulForkDelta(result) ? "yes" : "no"}`);
    if (summaryOnly) {
      lines.push("");
      continue;
    }
    for (const relativePath of result.different) {
      lines.push(`    diff ${relativePath}`);
    }
    for (const relativePath of result.onlyOverlay) {
      lines.push(`    overlay-only ${relativePath}`);
    }
    for (const relativePath of result.onlyBase) {
      lines.push(`    base-only ${relativePath}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = [];
  for (const pair of FORK_PAIRS) {
    results.push(await compareLocalForkPair(pair));
  }
  if (args.format === "json") {
    process.stdout.write(`${JSON.stringify({ forks: results }, null, 2)}\n`);
    return;
  }
  process.stdout.write(renderText(results, args.summaryOnly));
}

await main();
