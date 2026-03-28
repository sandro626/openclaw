import fs from "node:fs/promises";
import path from "node:path";

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toPortablePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function shouldIgnoreRelativePath(relativePath, ignoreSegments) {
  const segments = toPortablePath(relativePath).split("/");
  return segments.some((segment) => ignoreSegments.includes(segment));
}

async function collectFiles(rootDir, options = {}) {
  const ignoreSegments = options.ignoreSegments ?? [];
  const entries = new Map();
  if (!(await exists(rootDir))) {
    return entries;
  }

  async function walk(currentDir) {
    const dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of dirEntries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = toPortablePath(path.relative(rootDir, fullPath));
      if (shouldIgnoreRelativePath(relativePath, ignoreSegments)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      entries.set(relativePath, fullPath);
    }
  }

  await walk(rootDir);
  return entries;
}

export async function compareLocalForkPair(params) {
  const ignoreSegments = params.ignoreSegments ?? [];
  const baseFiles = await collectFiles(params.baseDir, { ignoreSegments });
  const overlayFiles = await collectFiles(params.overlayDir, { ignoreSegments });

  const onlyBase = [];
  const onlyOverlay = [];
  const different = [];
  const same = [];

  for (const relativePath of [...baseFiles.keys()].toSorted((a, b) => a.localeCompare(b))) {
    if (!overlayFiles.has(relativePath)) {
      onlyBase.push(relativePath);
      continue;
    }
    const [baseContent, overlayContent] = await Promise.all([
      fs.readFile(baseFiles.get(relativePath)),
      fs.readFile(overlayFiles.get(relativePath)),
    ]);
    if (baseContent.equals(overlayContent)) {
      same.push(relativePath);
      continue;
    }
    different.push(relativePath);
  }

  for (const relativePath of [...overlayFiles.keys()].toSorted((a, b) => a.localeCompare(b))) {
    if (!baseFiles.has(relativePath)) {
      onlyOverlay.push(relativePath);
    }
  }

  return {
    id: params.id,
    baseDir: params.baseDir,
    overlayDir: params.overlayDir,
    ignoreSegments,
    baseFileCount: baseFiles.size,
    overlayFileCount: overlayFiles.size,
    same,
    different,
    onlyBase,
    onlyOverlay,
  };
}

export function hasMeaningfulForkDelta(result) {
  return result.different.length > 0 || result.onlyBase.length > 0 || result.onlyOverlay.length > 0;
}
