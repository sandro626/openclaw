#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { compareLocalForkPair, hasMeaningfulForkDelta } from "./lib/local-fork-audit.mjs";
import {
  OVERLAY_AGENT_STATIC_FILES,
  REQUIRED_OVERLAY_AGENT_STATIC_FILES,
} from "./lib/overlay-agent-static-files.mjs";

const projectRoot = process.cwd();

const ALLOWED_EXTENSION_OVERLAPS = new Set(["feishu", "wecom"]);
const REQUIRED_ACTIVE_OVERLAY_EXTENSIONS = new Set(["wecom"]);
const FORBIDDEN_ACTIVE_OVERLAY_EXTENSIONS = new Set(["feishu"]);
const FORBIDDEN_ROOT_DIRS = ["memory", "modify-code"];
const FORBIDDEN_OVERLAY_AGENT_TOP_LEVEL_PATHS = ["agent", "sessions", "memory"];
const FORBIDDEN_OVERLAY_AGENT_WORKSPACE_PATHS = ["SESSION-STATE.md", "memory"];
const RESERVED_AGENT_TEMPLATE_DIRS = new Set(["bindings", "environments", "workspace-skeleton"]);
const AGENT_SKILL_RESOLUTION_FILE = "skill-resolution.json";

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toPortablePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function relativeToRoot(filePath) {
  return toPortablePath(path.relative(projectRoot, filePath));
}

async function listChildDirs(rootDir) {
  if (!(await exists(rootDir))) {
    return [];
  }
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted((left, right) => left.localeCompare(right));
}

async function walkTree(rootDir, visitor) {
  if (!(await exists(rootDir))) {
    return;
  }
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    await visitor({ entry, fullPath });
    if (entry.isDirectory()) {
      await walkTree(fullPath, visitor);
    }
  }
}

async function hasPluginMetadata(dirPath) {
  return (
    (await exists(path.join(dirPath, "openclaw.plugin.json"))) ||
    (await exists(path.join(dirPath, "package.json")))
  );
}

function collectOverlayExtensionRefs(value, results = []) {
  if (typeof value === "string") {
    const normalized = value.replaceAll("\\", "/");
    const match = normalized.match(/(?:^|\/)extensions\/([^/]+)$/);
    if (match) {
      results.push({
        raw: value,
        name: match[1],
      });
    }
    return results;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectOverlayExtensionRefs(entry, results);
    }
    return results;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      collectOverlayExtensionRefs(entry, results);
    }
  }
  return results;
}

function collectAgentListIds(value, results = []) {
  if (!isPlainObject(value) || !isPlainObject(value.agents) || !Array.isArray(value.agents.list)) {
    return results;
  }
  for (const entry of value.agents.list) {
    if (isPlainObject(entry) && typeof entry.id === "string") {
      results.push(entry.id);
    }
  }
  return results;
}

function collectBindingAgentIds(value, results = []) {
  if (!isPlainObject(value) || !Array.isArray(value.bindings)) {
    return results;
  }
  for (const entry of value.bindings) {
    if (isPlainObject(entry) && typeof entry.agentId === "string") {
      results.push(entry.agentId);
    }
  }
  return results;
}

function collectAgentSkillIds(value, results = []) {
  if (Array.isArray(value?.skills)) {
    for (const entry of value.skills) {
      if (typeof entry === "string") {
        results.push(entry);
      }
    }
  }
  if (!isPlainObject(value) || !isPlainObject(value.agents) || !Array.isArray(value.agents.list)) {
    return results;
  }
  for (const entry of value.agents.list) {
    if (!isPlainObject(entry) || !Array.isArray(entry.skills)) {
      continue;
    }
    for (const skillId of entry.skills) {
      if (typeof skillId === "string") {
        results.push(skillId);
      }
    }
  }
  return results;
}

function buildActiveAgentIdSet(params) {
  const ids = new Set();
  for (const entry of collectAgentListIds(params.baseTemplate)) {
    ids.add(entry);
  }
  for (const entry of collectAgentListIds(params.envTemplate)) {
    ids.add(entry);
  }
  return ids;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readSkillNameFromFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  for (const line of raw.split(/\r?\n/u).slice(0, 40)) {
    const match = line.match(/^name:\s*(.+)$/u);
    if (!match) {
      continue;
    }
    return match[1].trim().replace(/^['"]|['"]$/gu, "");
  }
  return null;
}

async function collectRuntimeSkillNames(rootDir, results) {
  if (!(await exists(rootDir))) {
    return;
  }
  await walkTree(rootDir, async ({ entry, fullPath }) => {
    if (!entry.isFile() || entry.name !== "SKILL.md") {
      return;
    }
    const name = await readSkillNameFromFile(fullPath);
    if (name) {
      results.add(name);
    }
  });
}

async function main() {
  const errors = [];

  for (const dirName of FORBIDDEN_ROOT_DIRS) {
    const dirPath = path.join(projectRoot, dirName);
    if (await exists(dirPath)) {
      errors.push(
        `root directory "${dirName}/" is not part of the core/overlay/runtime layout; move it under .artifacts/ or formal docs instead`,
      );
    }
  }

  const serverConfigRoot = path.join(projectRoot, "server-config");
  await walkTree(serverConfigRoot, async ({ entry, fullPath }) => {
    if (!entry.isFile()) {
      return;
    }
    if (entry.name !== "README.md") {
      errors.push(
        `server-config archive must stay README-only, found active file "${relativeToRoot(fullPath)}"`,
      );
    }
  });

  const overlayRoot = path.join(projectRoot, "overlay");
  await walkTree(overlayRoot, async ({ entry, fullPath }) => {
    if (entry.name.endsWith(":Zone.Identifier")) {
      errors.push(`forbidden Windows metadata leak under overlay: "${relativeToRoot(fullPath)}"`);
    }
    const segments = relativeToRoot(fullPath).split("/");
    if (segments.includes("node_modules")) {
      errors.push(`overlay must not contain node_modules: "${relativeToRoot(fullPath)}"`);
    }
  });

  const coreSkillDirs = await listChildDirs(path.join(projectRoot, "skills"));
  const overlaySkillDirs = await listChildDirs(path.join(projectRoot, "overlay", "skills"));
  const skillOverlap = coreSkillDirs.filter((name) => overlaySkillDirs.includes(name));
  if (skillOverlap.length > 0) {
    errors.push(
      `skills and overlay/skills must not overlap: ${skillOverlap.map((name) => `"${name}"`).join(", ")}`,
    );
  }

  const coreExtensionDirs = await listChildDirs(path.join(projectRoot, "extensions"));
  const overlayExtensionDirs = await listChildDirs(path.join(projectRoot, "overlay", "extensions"));
  const extensionOverlap = coreExtensionDirs.filter((name) => overlayExtensionDirs.includes(name));
  const forbiddenOverlap = extensionOverlap.filter((name) => !ALLOWED_EXTENSION_OVERLAPS.has(name));
  if (forbiddenOverlap.length > 0) {
    errors.push(
      `extensions and overlay/extensions overlap is only allowed for feishu/wecom, found: ${forbiddenOverlap.map((name) => `"${name}"`).join(", ")}`,
    );
  }

  const overlayFeishuDir = path.join(projectRoot, "overlay", "extensions", "feishu");
  if (await exists(overlayFeishuDir)) {
    if (await hasPluginMetadata(overlayFeishuDir)) {
      errors.push(
        "overlay/extensions/feishu must remain a non-loadable placeholder until an explicit cutover is approved",
      );
    }
  }

  const overlayWecomDir = path.join(projectRoot, "overlay", "extensions", "wecom");
  if (await exists(overlayWecomDir)) {
    if (!(await hasPluginMetadata(overlayWecomDir))) {
      errors.push(
        "overlay/extensions/wecom is the active private fork and must keep loadable plugin metadata",
      );
    }
    const baseWecomDir = path.join(projectRoot, "extensions", "wecom");
    if (await exists(baseWecomDir)) {
      const wecomForkAudit = await compareLocalForkPair({
        id: "wecom",
        baseDir: baseWecomDir,
        overlayDir: overlayWecomDir,
        ignoreSegments: ["node_modules"],
      });
      if (!hasMeaningfulForkDelta(wecomForkAudit)) {
        errors.push(
          "overlay/extensions/wecom must not degrade into a byte-identical mirror of extensions/wecom; retire the overlay load path or keep an intentional fork delta",
        );
      }
    }
  }

  const extensionTemplatesRoot = path.join(projectRoot, "runtime-templates", "extensions");
  const configuredOverlayExtensionRefs = new Set();
  await walkTree(extensionTemplatesRoot, async ({ entry, fullPath }) => {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      return;
    }
    const parsed = await readJson(fullPath);
    const refs = collectOverlayExtensionRefs(parsed);
    for (const ref of refs) {
      configuredOverlayExtensionRefs.add(ref.name);
      const overlayDir = path.join(projectRoot, "overlay", "extensions", ref.name);
      if (!(await exists(overlayDir))) {
        errors.push(
          `runtime template "${relativeToRoot(fullPath)}" points to missing overlay extension "${ref.raw}"`,
        );
        continue;
      }
      if (!(await hasPluginMetadata(overlayDir))) {
        errors.push(
          `runtime template "${relativeToRoot(fullPath)}" points to non-loadable overlay extension "${ref.raw}"`,
        );
      }
    }
  });
  for (const extensionName of REQUIRED_ACTIVE_OVERLAY_EXTENSIONS) {
    if (!configuredOverlayExtensionRefs.has(extensionName)) {
      errors.push(
        `runtime-templates/extensions must keep overlay/extensions/${extensionName} as an explicit active load path`,
      );
    }
  }
  for (const extensionName of FORBIDDEN_ACTIVE_OVERLAY_EXTENSIONS) {
    if (configuredOverlayExtensionRefs.has(extensionName)) {
      errors.push(
        `runtime-templates/extensions must not activate placeholder overlay/extensions/${extensionName}`,
      );
    }
  }

  const openclawExamplePath = path.join(projectRoot, "runtime-templates", "openclaw.json.example");
  if (await exists(openclawExamplePath)) {
    const openclawExample = await readJson(openclawExamplePath);
    const exampleRefs = new Set(
      collectOverlayExtensionRefs(openclawExample).map((entry) => entry.name),
    );
    for (const extensionName of REQUIRED_ACTIVE_OVERLAY_EXTENSIONS) {
      if (!exampleRefs.has(extensionName)) {
        errors.push(
          `runtime-templates/openclaw.json.example must show overlay/extensions/${extensionName} as an explicit active load path`,
        );
      }
    }
    for (const extensionName of FORBIDDEN_ACTIVE_OVERLAY_EXTENSIONS) {
      if (exampleRefs.has(extensionName)) {
        errors.push(
          `runtime-templates/openclaw.json.example must not show placeholder overlay/extensions/${extensionName} as active`,
        );
      }
    }
  }

  const overlayAgentsRoot = path.join(projectRoot, "overlay", "agents");
  const agentDirs = await listChildDirs(overlayAgentsRoot);
  const runtimeAgentTemplatesRoot = path.join(projectRoot, "runtime-templates", "agents");
  const runtimeAgentTemplateDirs = (await listChildDirs(runtimeAgentTemplatesRoot)).filter(
    (entry) => !RESERVED_AGENT_TEMPLATE_DIRS.has(entry),
  );
  const agentBaseTemplatePath = path.join(runtimeAgentTemplatesRoot, "base.json");
  const agentEnvTemplatesRoot = path.join(runtimeAgentTemplatesRoot, "environments");
  const bindingBaseTemplatePath = path.join(runtimeAgentTemplatesRoot, "bindings", "base.json");
  const bindingEnvTemplatesRoot = path.join(runtimeAgentTemplatesRoot, "bindings", "environments");
  const skillResolutionPath = path.join(runtimeAgentTemplatesRoot, AGENT_SKILL_RESOLUTION_FILE);
  const repoSkillNames = new Set();
  await collectRuntimeSkillNames(path.join(projectRoot, "skills"), repoSkillNames);
  await collectRuntimeSkillNames(path.join(projectRoot, "overlay", "skills"), repoSkillNames);
  await collectRuntimeSkillNames(path.join(projectRoot, "extensions"), repoSkillNames);
  let skillResolution = {};
  if (await exists(skillResolutionPath)) {
    skillResolution = await readJson(skillResolutionPath);
  }
  const skillAliases = new Map(
    isPlainObject(skillResolution.aliases) ? Object.entries(skillResolution.aliases) : [],
  );
  const externalProvidedSkillIds = new Set(
    Array.isArray(skillResolution.externalProvided)
      ? skillResolution.externalProvided.filter((entry) => typeof entry === "string")
      : [],
  );
  const runtimeOnlySkillIds = new Set(
    Array.isArray(skillResolution.runtimeOnly)
      ? skillResolution.runtimeOnly.filter((entry) => typeof entry === "string")
      : [],
  );
  const configOnlySkillIds = new Set(
    Array.isArray(skillResolution.configOnly)
      ? skillResolution.configOnly.filter((entry) => typeof entry === "string")
      : [],
  );

  function validateAgentSkillIds(filePath, parsed) {
    for (const skillId of collectAgentSkillIds(parsed)) {
      if (skillAliases.has(skillId)) {
        const canonicalSkillId = skillAliases.get(skillId);
        errors.push(
          `runtime agent template "${relativeToRoot(filePath)}" uses historical skill alias "${skillId}"; use canonical "${typeof canonicalSkillId === "string" ? canonicalSkillId : "<unknown>"}" instead`,
        );
        continue;
      }
      if (
        repoSkillNames.has(skillId) ||
        externalProvidedSkillIds.has(skillId) ||
        runtimeOnlySkillIds.has(skillId) ||
        configOnlySkillIds.has(skillId)
      ) {
        continue;
      }
      errors.push(
        `runtime agent template "${relativeToRoot(filePath)}" references unresolved skill "${skillId}"; add a repo skill, or register it in runtime-templates/agents/${AGENT_SKILL_RESOLUTION_FILE}`,
      );
    }
  }

  for (const agentId of agentDirs) {
    const patchPath = path.join(runtimeAgentTemplatesRoot, agentId, "config.patch.json");
    if (!(await exists(patchPath))) {
      errors.push(
        `overlay agent "${agentId}" must have a matching runtime template patch at "${relativeToRoot(patchPath)}"`,
      );
    }
  }
  if (await exists(agentBaseTemplatePath)) {
    const parsed = await readJson(agentBaseTemplatePath);
    validateAgentSkillIds(agentBaseTemplatePath, parsed);
    for (const agentId of collectAgentListIds(parsed)) {
      if (!agentDirs.includes(agentId)) {
        errors.push(
          `runtime agent template "${relativeToRoot(agentBaseTemplatePath)}" references unknown overlay agent "${agentId}"`,
        );
      }
    }
  }
  if (await exists(agentEnvTemplatesRoot)) {
    await walkTree(agentEnvTemplatesRoot, async ({ entry, fullPath }) => {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        return;
      }
      const parsed = await readJson(fullPath);
      validateAgentSkillIds(fullPath, parsed);
      for (const agentId of collectAgentListIds(parsed)) {
        if (!agentDirs.includes(agentId)) {
          errors.push(
            `runtime agent template "${relativeToRoot(fullPath)}" references unknown overlay agent "${agentId}"`,
          );
        }
      }
    });
  }
  for (const agentId of agentDirs) {
    const patchPath = path.join(runtimeAgentTemplatesRoot, agentId, "config.patch.json");
    if (!(await exists(patchPath))) {
      continue;
    }
    validateAgentSkillIds(patchPath, await readJson(patchPath));
  }
  if (await exists(bindingBaseTemplatePath)) {
    const parsed = await readJson(bindingBaseTemplatePath);
    for (const agentId of collectBindingAgentIds(parsed)) {
      if (!agentDirs.includes(agentId)) {
        errors.push(
          `runtime binding template "${relativeToRoot(bindingBaseTemplatePath)}" references unknown overlay agent "${agentId}"`,
        );
      }
    }
  }
  if (await exists(bindingEnvTemplatesRoot)) {
    await walkTree(bindingEnvTemplatesRoot, async ({ entry, fullPath }) => {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        return;
      }
      const parsed = await readJson(fullPath);
      const activeAgentIds = buildActiveAgentIdSet({
        baseTemplate: (await exists(agentBaseTemplatePath))
          ? await readJson(agentBaseTemplatePath)
          : {},
        envTemplate:
          path.join(agentEnvTemplatesRoot, entry.name) &&
          (await exists(path.join(agentEnvTemplatesRoot, entry.name)))
            ? await readJson(path.join(agentEnvTemplatesRoot, entry.name))
            : {},
      });
      for (const agentId of collectBindingAgentIds(parsed)) {
        if (!agentDirs.includes(agentId)) {
          errors.push(
            `runtime binding template "${relativeToRoot(fullPath)}" references unknown overlay agent "${agentId}"`,
          );
          continue;
        }
        if (!activeAgentIds.has(agentId)) {
          errors.push(
            `runtime binding template "${relativeToRoot(fullPath)}" references agent "${agentId}" that is not active in the matching runtime-templates/agents/environments/${entry.name}`,
          );
        }
      }
    });
  }

  const configTemplatesToKeepBindingsFree = [
    path.join(projectRoot, "runtime-templates", "config", "openclaw.base.json"),
    path.join(projectRoot, "runtime-templates", "config", "environments", "prod.json"),
    path.join(projectRoot, "runtime-templates", "config", "environments", "staging.json"),
  ];
  for (const filePath of configTemplatesToKeepBindingsFree) {
    if (!(await exists(filePath))) {
      continue;
    }
    const parsed = await readJson(filePath);
    if (Array.isArray(parsed?.bindings)) {
      errors.push(
        `channel -> agent bindings must live under runtime-templates/agents/bindings, found top-level bindings in "${relativeToRoot(filePath)}"`,
      );
    }
  }
  for (const agentId of runtimeAgentTemplateDirs) {
    if (!agentDirs.includes(agentId)) {
      errors.push(
        `runtime agent template "${relativeToRoot(path.join(runtimeAgentTemplatesRoot, agentId))}" has no matching overlay/agents/${agentId} static skeleton`,
      );
    }
  }
  for (const agentId of agentDirs) {
    const agentRoot = path.join(overlayAgentsRoot, agentId);
    for (const flaggedPath of FORBIDDEN_OVERLAY_AGENT_TOP_LEVEL_PATHS) {
      const target = path.join(agentRoot, flaggedPath);
      if (await exists(target)) {
        errors.push(
          `overlay/agents must stay static-only, found runtime path "${relativeToRoot(target)}"`,
        );
      }
    }
    const workspaceRoot = path.join(agentRoot, "workspace");
    for (const flaggedPath of FORBIDDEN_OVERLAY_AGENT_WORKSPACE_PATHS) {
      const target = path.join(workspaceRoot, flaggedPath);
      if (await exists(target)) {
        errors.push(
          `overlay agent workspace must stay static-only, found runtime path "${relativeToRoot(target)}"`,
        );
      }
    }
    if (await exists(workspaceRoot)) {
      const workspaceEntries = await fs.readdir(workspaceRoot, { withFileTypes: true });
      const presentFiles = new Set();
      for (const entry of workspaceEntries) {
        if (entry.isDirectory()) {
          errors.push(
            `overlay agent workspace must not contain directories, found "${relativeToRoot(path.join(workspaceRoot, entry.name))}"`,
          );
          continue;
        }
        if (!entry.isFile()) {
          errors.push(
            `overlay agent workspace must only contain static markdown files, found "${relativeToRoot(path.join(workspaceRoot, entry.name))}"`,
          );
          continue;
        }
        if (!OVERLAY_AGENT_STATIC_FILES.has(entry.name)) {
          errors.push(
            `overlay agent workspace file "${relativeToRoot(path.join(workspaceRoot, entry.name))}" is not in the static whitelist (${Array.from(OVERLAY_AGENT_STATIC_FILES).toSorted().join(", ")})`,
          );
        }
        presentFiles.add(entry.name);
      }
      for (const requiredFile of REQUIRED_OVERLAY_AGENT_STATIC_FILES) {
        if (!presentFiles.has(requiredFile)) {
          errors.push(
            `overlay agent workspace "${relativeToRoot(workspaceRoot)}" is missing required static file "${requiredFile}"`,
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error("Repo layering check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    "OK: repo layering boundaries are intact (core/overlay/runtime templates remain separated).",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
