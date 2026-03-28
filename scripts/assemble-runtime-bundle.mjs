#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const OVERLAY_SECTIONS = ["extensions", "skills", "patches", "scripts"];

function printUsage() {
  console.log(`Usage: node scripts/assemble-runtime-bundle.mjs --output-root <dir> [options]

Options:
  --output-root <dir>         Required. Bundle output directory.
  --overlay-root <dir>        Overlay source root. Default: overlay
  --templates-root <dir>      Runtime template root. Default: runtime-templates
  --environment <name>        Template environment. Default: prod
  --base-template <file>      Base config template path
  --env-template <file>       Environment config template path
  --config-out <file>         Rendered config output path
  --allow-unresolved-env      Keep unresolved \${VAR} placeholders
  --dry-run                   Print actions without writing files
`);
}

function parseArgs(argv) {
  const parsed = {
    overlayRoot: "overlay",
    templatesRoot: "runtime-templates",
    environment: "prod",
    allowUnresolvedEnv: false,
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
    if (arg === "--allow-unresolved-env") {
      parsed.allowUnresolvedEnv = true;
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
      case "output-root":
        parsed.outputRoot = value;
        break;
      case "overlay-root":
        parsed.overlayRoot = value;
        break;
      case "templates-root":
        parsed.templatesRoot = value;
        break;
      case "environment":
        parsed.environment = value;
        break;
      case "base-template":
        parsed.baseTemplate = value;
        break;
      case "env-template":
        parsed.envTemplate = value;
        break;
      case "config-out":
        parsed.configOut = value;
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

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function readMergedJsonTemplates(filePaths) {
  const used = [];
  let merged;
  for (const filePath of filePaths) {
    if (!(await exists(filePath))) {
      continue;
    }
    const parsed = await readJson(filePath);
    merged = merged === undefined ? parsed : deepMerge(merged, parsed);
    used.push(filePath);
  }
  return { merged, used };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, overlay) {
  if (Array.isArray(base) && Array.isArray(overlay)) {
    return overlay.slice();
  }
  if (isPlainObject(base) && isPlainObject(overlay)) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
      merged[key] = key in merged ? deepMerge(merged[key], value) : value;
    }
    return merged;
  }
  return overlay;
}

function substituteEnv(value, options) {
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Z0-9_]+)(?::-(.*?))?\}/g, (full, name, fallback) => {
      const resolved = options.env[name];
      if (typeof resolved === "string" && resolved.length > 0) {
        return resolved;
      }
      if (typeof fallback === "string") {
        return fallback;
      }
      if (options.allowUnresolvedEnv) {
        return full;
      }
      throw new Error(`Missing environment variable: ${name}`);
    });
  }
  if (Array.isArray(value)) {
    return value.map((entry) => substituteEnv(entry, options));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, substituteEnv(entry, options)]),
    );
  }
  return value;
}

async function listChildDirs(rootDir) {
  if (!(await exists(rootDir))) {
    return [];
  }
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name))
    .toSorted((left, right) => left.localeCompare(right));
}

async function listChildPluginDirs(rootDir) {
  const childDirs = await listChildDirs(rootDir);
  const plugins = [];
  const skipped = [];
  for (const dir of childDirs) {
    const hasPluginMetadata =
      (await exists(path.join(dir, "openclaw.plugin.json"))) ||
      (await exists(path.join(dir, "package.json")));
    if (hasPluginMetadata) {
      plugins.push(dir);
      continue;
    }
    skipped.push(dir);
  }
  return { plugins, skipped };
}

async function renderAgentConfigPatches(params) {
  if (!(await exists(params.templatesRoot))) {
    return [];
  }
  const entries = await fs.readdir(params.templatesRoot, { withFileTypes: true });
  const renderedPatches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const source = path.join(params.templatesRoot, entry.name, "config.patch.json");
    if (!(await exists(source))) {
      continue;
    }
    const target = path.join(params.outputRoot, entry.name, "config.patch.json");
    const rendered = substituteEnv(await readJson(source), {
      env: process.env,
      allowUnresolvedEnv: params.allowUnresolvedEnv,
    });
    if (params.dryRun) {
      console.log(`render ${source} -> ${target}`);
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, `${JSON.stringify(rendered, null, 2)}\n`, "utf8");
    }
    renderedPatches.push({
      agentId: entry.name,
      source: toPortablePath(source),
      target: toPortablePath(target),
    });
  }
  return renderedPatches;
}

function extractAgentIdsFromConfig(value) {
  if (!Array.isArray(value?.agents?.list)) {
    return [];
  }
  return value.agents.list
    .map((entry) => (isPlainObject(entry) && typeof entry.id === "string" ? entry.id : null))
    .filter((entry) => typeof entry === "string");
}

function extractBindingAgentIds(value) {
  if (!Array.isArray(value?.bindings)) {
    return [];
  }
  return value.bindings
    .map((entry) =>
      isPlainObject(entry) && typeof entry.agentId === "string" ? entry.agentId : null,
    )
    .filter((entry) => typeof entry === "string");
}

function extractAgentSkillIds(value) {
  if (!Array.isArray(value?.agents?.list)) {
    return [];
  }
  const skillIds = new Set();
  for (const entry of value.agents.list) {
    if (!isPlainObject(entry) || !Array.isArray(entry.skills)) {
      continue;
    }
    for (const skillId of entry.skills) {
      if (typeof skillId === "string") {
        skillIds.add(skillId);
      }
    }
  }
  return Array.from(skillIds).toSorted((left, right) => left.localeCompare(right));
}

function toPortablePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function getOverlayExtensionDirName(loadPath) {
  if (typeof loadPath !== "string") {
    return null;
  }
  const normalized = loadPath.replaceAll("\\", "/").replace(/\/+$/, "");
  const match = normalized.match(/(?:^|\/)extensions\/([^/]+)$/);
  return match?.[1] ?? null;
}

function detectConfiguredOverlayLoadPathWarnings(params) {
  const discoveredByName = new Map(
    params.discoveredDirs.map((entry) => [path.basename(entry), entry]),
  );
  const skippedByName = new Map(params.skippedDirs.map((entry) => [path.basename(entry), entry]));
  const warnings = [];
  for (const loadPath of params.loadPaths) {
    const dirName = getOverlayExtensionDirName(loadPath);
    if (!dirName) {
      continue;
    }
    if (discoveredByName.has(dirName)) {
      continue;
    }
    const skippedPath = skippedByName.get(dirName);
    if (skippedPath) {
      warnings.push(
        `configured overlay plugin load path "${loadPath}" points at non-loadable placeholder "${toPortablePath(skippedPath)}"`,
      );
    }
  }
  return warnings;
}

async function copySection(params) {
  if (!(await exists(params.source))) {
    return false;
  }
  if (params.dryRun) {
    console.log(`copy ${params.source} -> ${params.target}`);
    return true;
  }
  await fs.rm(params.target, { recursive: true, force: true });
  await fs.mkdir(path.dirname(params.target), { recursive: true });
  await fs.cp(params.source, params.target, { recursive: true });
  return true;
}

async function detectOverlayWarnings(agentsRoot) {
  if (!(await exists(agentsRoot))) {
    return [];
  }
  const warnings = [];
  const agents = await fs.readdir(agentsRoot, { withFileTypes: true });
  for (const entry of agents) {
    if (!entry.isDirectory()) {
      continue;
    }
    const agentRoot = path.join(agentsRoot, entry.name);
    for (const flagged of ["agent", "sessions", "memory"]) {
      const flaggedPath = path.join(agentRoot, flagged);
      if (await exists(flaggedPath)) {
        warnings.push(
          `overlay agent "${entry.name}" still contains runtime-oriented path "${toPortablePath(path.relative(process.cwd(), flaggedPath))}"`,
        );
      }
    }
  }
  return warnings;
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
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      await collectRuntimeSkillNames(fullPath, results);
      continue;
    }
    if (!entry.isFile() || entry.name !== "SKILL.md") {
      continue;
    }
    const skillName = await readSkillNameFromFile(fullPath);
    if (skillName) {
      results.add(skillName);
    }
  }
}

function analyzeAgentSkillIds(params) {
  const aliases = new Map(
    isPlainObject(params.resolution.aliases) ? Object.entries(params.resolution.aliases) : [],
  );
  const externalProvided = new Set(
    Array.isArray(params.resolution.externalProvided)
      ? params.resolution.externalProvided.filter((entry) => typeof entry === "string")
      : [],
  );
  const runtimeOnly = new Set(
    Array.isArray(params.resolution.runtimeOnly)
      ? params.resolution.runtimeOnly.filter((entry) => typeof entry === "string")
      : [],
  );
  const configOnly = new Set(
    Array.isArray(params.resolution.configOnly)
      ? params.resolution.configOnly.filter((entry) => typeof entry === "string")
      : [],
  );
  const aliasHits = [];
  const unresolved = [];
  for (const skillId of params.skillIds) {
    if (aliases.has(skillId)) {
      const canonicalSkillId = aliases.get(skillId);
      if (typeof canonicalSkillId === "string") {
        aliasHits.push({ alias: skillId, canonical: canonicalSkillId });
      }
      continue;
    }
    if (
      params.repoSkillNames.has(skillId) ||
      externalProvided.has(skillId) ||
      runtimeOnly.has(skillId) ||
      configOnly.has(skillId)
    ) {
      continue;
    }
    unresolved.push(skillId);
  }
  return {
    aliasHits,
    unresolved,
    runtimeOnly: Array.from(runtimeOnly).toSorted((left, right) => left.localeCompare(right)),
    configOnly: Array.from(configOnly).toSorted((left, right) => left.localeCompare(right)),
    externalProvided: Array.from(externalProvided).toSorted((left, right) =>
      left.localeCompare(right),
    ),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (!args.outputRoot) {
    printUsage();
    throw new Error("--output-root is required");
  }

  const overlayRoot = path.resolve(args.overlayRoot);
  const templatesRoot = path.resolve(args.templatesRoot);
  const outputRoot = path.resolve(args.outputRoot);
  const baseTemplate =
    args.baseTemplate ?? path.join(templatesRoot, "config", "openclaw.base.json");
  const envTemplate =
    args.envTemplate ??
    path.join(templatesRoot, "config", "environments", `${args.environment}.json`);
  const bundleOverlayRoot = path.join(outputRoot, "overlay");
  const renderedConfigDir = path.join(outputRoot, "rendered-config");
  const configOut = args.configOut ?? path.join(renderedConfigDir, "openclaw.json");
  const renderedAgentConfigRoot = path.join(renderedConfigDir, "agents");
  const extensionBaseTemplate = path.join(templatesRoot, "extensions", "base.json");
  const extensionEnvTemplate = path.join(
    templatesRoot,
    "extensions",
    "environments",
    `${args.environment}.json`,
  );
  const skillBaseTemplate = path.join(templatesRoot, "skills", "base.json");
  const skillEnvTemplate = path.join(
    templatesRoot,
    "skills",
    "environments",
    `${args.environment}.json`,
  );
  const agentBaseTemplate = path.join(templatesRoot, "agents", "base.json");
  const agentEnvTemplate = path.join(
    templatesRoot,
    "agents",
    "environments",
    `${args.environment}.json`,
  );
  const bindingBaseTemplate = path.join(templatesRoot, "agents", "bindings", "base.json");
  const bindingEnvTemplate = path.join(
    templatesRoot,
    "agents",
    "bindings",
    "environments",
    `${args.environment}.json`,
  );
  const agentSkillResolutionTemplate = path.join(templatesRoot, "agents", "skill-resolution.json");

  if (!args.dryRun) {
    // Always rebuild the bundle output from a clean root so stale overlay dirs
    // from previous runs do not survive and masquerade as active assets.
    await fs.rm(outputRoot, { recursive: true, force: true });
  }

  const copiedSections = [];
  for (const section of OVERLAY_SECTIONS) {
    const source = path.join(overlayRoot, section);
    const target = path.join(bundleOverlayRoot, section);
    const copied = await copySection({
      source,
      target,
      dryRun: args.dryRun,
    });
    if (copied) {
      copiedSections.push(section);
    }
  }

  const bundledExtensions = await listChildPluginDirs(path.join(bundleOverlayRoot, "extensions"));
  const bundledExtensionDirs = bundledExtensions.plugins;
  const bundledSkillRoot = path.join(bundleOverlayRoot, "skills");
  const hasBundledSkills = (await listChildDirs(bundledSkillRoot)).length > 0;

  const overlayConfigPatch = {
    skills: {
      load: {
        extraDirs: hasBundledSkills ? [toPortablePath(bundledSkillRoot)] : [],
      },
    },
  };

  const { merged: extensionConfigPatchRaw, used: extensionConfigTemplates } =
    await readMergedJsonTemplates([extensionBaseTemplate, extensionEnvTemplate]);
  const extensionConfigPatch = extensionConfigPatchRaw
    ? substituteEnv(extensionConfigPatchRaw, {
        env: process.env,
        allowUnresolvedEnv: args.allowUnresolvedEnv,
      })
    : undefined;
  const { merged: skillConfigPatchRaw, used: skillConfigTemplates } = await readMergedJsonTemplates(
    [skillBaseTemplate, skillEnvTemplate],
  );
  const skillConfigPatch = skillConfigPatchRaw
    ? substituteEnv(skillConfigPatchRaw, {
        env: process.env,
        allowUnresolvedEnv: args.allowUnresolvedEnv,
      })
    : undefined;
  const { merged: agentConfigTemplateRaw, used: agentConfigTemplates } =
    await readMergedJsonTemplates([agentBaseTemplate, agentEnvTemplate]);
  const agentConfigTemplate = agentConfigTemplateRaw
    ? substituteEnv(agentConfigTemplateRaw, {
        env: process.env,
        allowUnresolvedEnv: args.allowUnresolvedEnv,
      })
    : undefined;
  const { merged: bindingConfigTemplateRaw, used: bindingConfigTemplates } =
    await readMergedJsonTemplates([bindingBaseTemplate, bindingEnvTemplate]);
  const bindingConfigTemplate = bindingConfigTemplateRaw
    ? substituteEnv(bindingConfigTemplateRaw, {
        env: process.env,
        allowUnresolvedEnv: args.allowUnresolvedEnv,
      })
    : undefined;
  const agentSkillResolution = (await exists(agentSkillResolutionTemplate))
    ? await readJson(agentSkillResolutionTemplate)
    : {};

  let mergedConfig = deepMerge(await readJson(baseTemplate), await readJson(envTemplate));
  if (extensionConfigPatch) {
    mergedConfig = deepMerge(mergedConfig, extensionConfigPatch);
  }
  mergedConfig = deepMerge(mergedConfig, overlayConfigPatch);
  if (skillConfigPatch) {
    mergedConfig = deepMerge(mergedConfig, skillConfigPatch);
  }
  if (agentConfigTemplate) {
    mergedConfig = deepMerge(mergedConfig, agentConfigTemplate);
  }
  if (bindingConfigTemplate) {
    mergedConfig = deepMerge(mergedConfig, bindingConfigTemplate);
  }
  const renderedConfig = substituteEnv(mergedConfig, {
    env: process.env,
    allowUnresolvedEnv: args.allowUnresolvedEnv,
  });
  const agentConfigPatches = await renderAgentConfigPatches({
    templatesRoot: path.join(templatesRoot, "agents"),
    outputRoot: renderedAgentConfigRoot,
    allowUnresolvedEnv: args.allowUnresolvedEnv,
    dryRun: args.dryRun,
  });
  const repoSkillNames = new Set();
  await collectRuntimeSkillNames(path.join(process.cwd(), "skills"), repoSkillNames);
  await collectRuntimeSkillNames(path.join(process.cwd(), "overlay", "skills"), repoSkillNames);
  await collectRuntimeSkillNames(path.join(process.cwd(), "extensions"), repoSkillNames);
  const agentSkillIds = extractAgentSkillIds(renderedConfig);
  const agentSkillAnalysis = analyzeAgentSkillIds({
    skillIds: agentSkillIds,
    repoSkillNames,
    resolution: agentSkillResolution,
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    environment: args.environment,
    copiedSections,
    overlayRoot: toPortablePath(overlayRoot),
    templatesRoot: toPortablePath(templatesRoot),
    outputRoot: toPortablePath(outputRoot),
    discoveredOverlayExtensionDirs: bundledExtensionDirs.map((entry) => toPortablePath(entry)),
    pluginLoadPaths: Array.isArray(renderedConfig?.plugins?.load?.paths)
      ? renderedConfig.plugins.load.paths
      : [],
    skippedOverlayExtensionDirs: bundledExtensions.skipped.map((entry) => toPortablePath(entry)),
    extensionConfigTemplates: extensionConfigTemplates.map((entry) => toPortablePath(entry)),
    extensionEntryKeys: isPlainObject(extensionConfigPatch?.plugins?.entries)
      ? Object.keys(extensionConfigPatch.plugins.entries).toSorted((left, right) =>
          left.localeCompare(right),
        )
      : [],
    skillExtraDirs: overlayConfigPatch.skills.load.extraDirs,
    skillConfigTemplates: skillConfigTemplates.map((entry) => toPortablePath(entry)),
    skillEntryKeys: isPlainObject(skillConfigPatch?.skills?.entries)
      ? Object.keys(skillConfigPatch.skills.entries).toSorted((left, right) =>
          left.localeCompare(right),
        )
      : [],
    agentConfigTemplates: agentConfigTemplates.map((entry) => toPortablePath(entry)),
    agentListIds: extractAgentIdsFromConfig(renderedConfig),
    agentSkillIds,
    bindingConfigTemplates: bindingConfigTemplates.map((entry) => toPortablePath(entry)),
    bindingAgentIds: extractBindingAgentIds(renderedConfig),
    agentSkillResolutionTemplate: (await exists(agentSkillResolutionTemplate))
      ? toPortablePath(agentSkillResolutionTemplate)
      : null,
    agentSkillRuntimeOnlyIds: agentSkillAnalysis.runtimeOnly,
    agentSkillConfigOnlyIds: agentSkillAnalysis.configOnly,
    agentSkillExternalProvidedIds: agentSkillAnalysis.externalProvided,
    agentConfigPatches,
    warnings: [
      ...(await detectOverlayWarnings(path.join(overlayRoot, "agents"))),
      ...detectConfiguredOverlayLoadPathWarnings({
        loadPaths:
          Array.isArray(renderedConfig?.plugins?.load?.paths) &&
          renderedConfig.plugins.load.paths.every((entry) => typeof entry === "string")
            ? renderedConfig.plugins.load.paths
            : [],
        discoveredDirs: bundledExtensionDirs,
        skippedDirs: bundledExtensions.skipped,
      }),
      ...agentSkillAnalysis.aliasHits.map(
        ({ alias, canonical }) =>
          `agent skills still reference historical alias "${alias}"; use canonical "${canonical}" in runtime templates`,
      ),
      ...agentSkillAnalysis.unresolved.map(
        (skillId) =>
          `agent skills reference unresolved id "${skillId}"; register it in runtime-templates/agents/skill-resolution.json or add a repo skill source`,
      ),
    ],
  };

  if (args.dryRun) {
    console.log(`render ${baseTemplate} + ${envTemplate} -> ${configOut}`);
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  await fs.mkdir(renderedConfigDir, { recursive: true });
  await fs.writeFile(
    path.join(renderedConfigDir, "openclaw.overlay.generated.json"),
    `${JSON.stringify(overlayConfigPatch, null, 2)}\n`,
    "utf8",
  );
  if (extensionConfigPatch) {
    await fs.writeFile(
      path.join(renderedConfigDir, "openclaw.extensions.generated.json"),
      `${JSON.stringify(extensionConfigPatch, null, 2)}\n`,
      "utf8",
    );
  }
  if (skillConfigPatch) {
    await fs.writeFile(
      path.join(renderedConfigDir, "openclaw.skills.generated.json"),
      `${JSON.stringify(skillConfigPatch, null, 2)}\n`,
      "utf8",
    );
  }
  if (agentConfigTemplate) {
    await fs.writeFile(
      path.join(renderedConfigDir, "openclaw.agents.generated.json"),
      `${JSON.stringify(agentConfigTemplate, null, 2)}\n`,
      "utf8",
    );
  }
  if (bindingConfigTemplate) {
    await fs.writeFile(
      path.join(renderedConfigDir, "openclaw.bindings.generated.json"),
      `${JSON.stringify(bindingConfigTemplate, null, 2)}\n`,
      "utf8",
    );
  }
  await fs.writeFile(configOut, `${JSON.stringify(renderedConfig, null, 2)}\n`, "utf8");
  await fs.writeFile(
    path.join(outputRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`Assembled runtime bundle at ${outputRoot}`);
  console.log(`Rendered config: ${configOut}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
