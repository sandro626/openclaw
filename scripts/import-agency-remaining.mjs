#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const agencyRoot = path.resolve(repoRoot, "../agency-agents-main/agency-agents-main");
const docsAgencyRoot = path.join(repoRoot, "docs", "agency");
const overlayAgentsRoot = path.join(repoRoot, "overlay", "agents");
const runtimeAgentsRoot = path.join(repoRoot, "runtime-templates", "agents");

const SOURCE_EXCLUDE_PREFIXES = ["examples/", "integrations/", "strategy/", ".github/"];
const SOURCE_EXCLUDE_FILES = new Set([
  "README.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "CONTRIBUTING_zh-CN.md",
]);

const CATEGORY_CONFIG = {
  academic: {
    tone: "analytical, research-oriented, synthesis-first",
    tools: [
      [
        "built-in browser tool",
        "Use for public-source review, references, and comparative reading.",
      ],
      [
        "tavily-search",
        "Use for topic discovery, source triangulation, and public background research.",
      ],
      ["analyze", "Use to structure argument maps, comparative frameworks, and synthesis output."],
      [
        "feishu-doc-manager",
        "Use for reading notes, research memos, and structured synthesis deliverables.",
      ],
    ],
    deliverables: [
      "research brief",
      "synthesis memo",
      "comparison framework",
      "reading outline",
      "open questions list",
    ],
    user: "researcher, operator, strategist, or writer needing stronger synthesis and explanation",
  },
  design: {
    tone: "intentional, user-aware, craft-focused",
    tools: [
      [
        "built-in browser tool",
        "Use for public examples, references, and interface or brand pattern review.",
      ],
      [
        "tavily-search",
        "Use for design benchmarks, accessibility guidance, and public best practices.",
      ],
      ["analyze", "Use to structure critique, design rationale, and tradeoff summaries."],
      ["feishu-doc-manager", "Use for design briefs, review notes, and critique summaries."],
    ],
    deliverables: [
      "design brief",
      "critique memo",
      "pattern shortlist",
      "experience review",
      "improvement checklist",
    ],
    user: "designer, founder, PM, or operator trying to improve experience quality and clarity",
  },
  engineering: {
    tone: "technical, explicit, build-minded",
    tools: [
      [
        "analyze",
        "Use for architecture framing, implementation tradeoffs, and technical breakdowns.",
      ],
      ["claude-code-task", "Use when code-aware diagnosis or implementation planning is needed."],
      [
        "build",
        "Use for build or environment verification when the runtime includes the target codebase.",
      ],
      [
        "test",
        "Use to validate technical hypotheses with scoped checks when the runtime supports it.",
      ],
      ["troubleshoot", "Use for failure analysis, debugging plans, and operational diagnosis."],
      ["feishu-doc-manager", "Use for technical briefs, runbooks, and implementation summaries."],
    ],
    deliverables: [
      "technical plan",
      "architecture note",
      "debug checklist",
      "implementation brief",
      "risk register",
    ],
    user: "engineer, lead, founder, or operator trying to make technical decisions or unblock delivery",
  },
  "game-development": {
    tone: "systems-aware, creative, production-minded",
    tools: [
      [
        "built-in browser tool",
        "Use for public references, genre benchmarks, and implementation examples.",
      ],
      ["tavily-search", "Use for genre research, tooling context, and production references."],
      ["analyze", "Use to structure mechanics, production tradeoffs, and review notes."],
      ["feishu-doc-manager", "Use for design notes, production outlines, and creative briefs."],
      [
        "claude-code-task",
        "Use when technical implementation planning or code-aware diagnosis is needed.",
      ],
    ],
    deliverables: [
      "design brief",
      "production plan",
      "mechanics review",
      "creative direction memo",
      "implementation checklist",
    ],
    user: "designer, developer, or producer trying to shape game ideas into clearer production work",
  },
  marketing: {
    tone: "audience-aware, strategic, channel-conscious",
    tools: [
      [
        "built-in browser tool",
        "Use for public page review, competitor inspection, and message or channel analysis.",
      ],
      ["tavily-search", "Use for trend research, competitor context, and public market signals."],
      ["analyze", "Use to structure audience logic, messaging, hooks, and growth hypotheses."],
      ["feishu-doc-manager", "Use for briefs, calendars, messaging maps, and strategy notes."],
    ],
    deliverables: [
      "strategy brief",
      "content plan",
      "channel memo",
      "campaign outline",
      "experiment checklist",
    ],
    user: "marketer, founder, operator, or content lead trying to sharpen channel strategy and messaging",
  },
  "paid-media": {
    tone: "performance-minded, disciplined, attribution-aware",
    tools: [
      ["built-in browser tool", "Use for landing pages, ads, and public funnel review."],
      [
        "tavily-search",
        "Use for benchmark research, channel trends, and public paid-media context.",
      ],
      ["analyze", "Use to structure hypothesis trees, experiment design, and optimization notes."],
      ["feishu-doc-manager", "Use for media plans, audit notes, and test backlogs."],
    ],
    deliverables: [
      "audit memo",
      "test plan",
      "channel strategy note",
      "optimization checklist",
      "risk summary",
    ],
    user: "performance marketer, founder, or operator trying to improve acquisition efficiency",
  },
  product: {
    tone: "user-aware, prioritization-minded, synthesis-first",
    tools: [
      [
        "built-in browser tool",
        "Use for public product examples, benchmark flows, and feature review.",
      ],
      ["tavily-search", "Use for market context, competitor patterns, and public user signals."],
      ["analyze", "Use for prioritization, framing, and product-decision synthesis."],
      ["feishu-doc-manager", "Use for briefs, requirement notes, and roadmap summaries."],
    ],
    deliverables: [
      "product brief",
      "decision memo",
      "prioritization note",
      "feature framing",
      "experiment outline",
    ],
    user: "PM, founder, or operator trying to make better product decisions with clearer user logic",
  },
  "project-management": {
    tone: "organized, accountability-driven, execution-aware",
    tools: [
      ["analyze", "Use for workflow framing, milestone structure, and dependency mapping."],
      ["feishu-doc-manager", "Use for plans, handoff notes, status summaries, and operating docs."],
      ["built-in browser tool", "Use for public workflow references and process-pattern research."],
      ["tavily-search", "Use for methods, templates, and operational benchmark context."],
      [
        "claude-code-task",
        "Use when automation or system changes are part of the project-delivery plan.",
      ],
    ],
    deliverables: [
      "execution plan",
      "status memo",
      "dependency map",
      "handoff checklist",
      "operating cadence note",
    ],
    user: "project lead, studio manager, or operator trying to improve delivery predictability",
  },
  sales: {
    tone: "commercially aware, practical, objection-sensitive",
    tools: [
      [
        "built-in browser tool",
        "Use for prospect research, competitor review, and public product context.",
      ],
      ["tavily-search", "Use for account research, market context, and public signal gathering."],
      ["analyze", "Use for pitch logic, objection handling, and deal strategy framing."],
      [
        "feishu-doc-manager",
        "Use for call notes, deal plans, proposal structure, and follow-up summaries.",
      ],
      [
        "imap-smtp-email",
        "Use for follow-up drafting or outbound structure when runtime email is available.",
      ],
    ],
    deliverables: [
      "account brief",
      "deal strategy note",
      "objection map",
      "follow-up plan",
      "call-prep memo",
    ],
    user: "seller, founder, or operator trying to improve revenue conversations and account strategy",
  },
  "spatial-computing": {
    tone: "technical, forward-looking, systems-aware",
    tools: [
      ["analyze", "Use for system decomposition, interaction models, and platform tradeoffs."],
      ["claude-code-task", "Use for code-aware planning and technical implementation guidance."],
      [
        "build",
        "Use for build-path checks or environment guidance when the runtime includes the target project.",
      ],
      ["troubleshoot", "Use for platform debugging, integration diagnosis, and failure analysis."],
      [
        "feishu-doc-manager",
        "Use for architecture notes, implementation plans, and design rationale.",
      ],
    ],
    deliverables: [
      "technical concept brief",
      "interaction architecture note",
      "implementation plan",
      "platform tradeoff memo",
      "debug checklist",
    ],
    user: "engineer, designer, or product lead exploring XR, spatial, or terminal-integration work",
  },
  specialized: {
    tone: "domain-aware, structured, judgment-heavy",
    tools: [
      [
        "built-in browser tool",
        "Use for public references, standards, ecosystem context, and comparable examples.",
      ],
      [
        "tavily-search",
        "Use for domain research, market context, and public-source triangulation.",
      ],
      ["analyze", "Use for structured recommendations, decision framing, and risk tradeoffs."],
      ["feishu-doc-manager", "Use for briefs, operating notes, and structured recommendations."],
      [
        "claude-code-task",
        "Use only when the specialty clearly includes technical implementation work and runtime supports it.",
      ],
    ],
    deliverables: [
      "domain brief",
      "decision memo",
      "risk checklist",
      "recommendation note",
      "operating summary",
    ],
    user: "specialist, founder, manager, or operator needing domain-specific structure without overclaiming runtime access",
  },
  support: {
    tone: "service-minded, reliable, issue-focused",
    tools: [
      ["built-in browser tool", "Use for public docs, status pages, and issue context."],
      [
        "tavily-search",
        "Use for product context, reference checks, and public troubleshooting information.",
      ],
      ["analyze", "Use for issue framing, escalation logic, and support pattern synthesis."],
      ["feishu-doc-manager", "Use for summaries, issue logs, and response playbooks."],
      ["imap-smtp-email", "Use for reply drafting when the runtime includes email handling."],
    ],
    deliverables: [
      "support summary",
      "issue triage note",
      "response framework",
      "escalation checklist",
      "operating note",
    ],
    user: "support lead, operator, or manager trying to handle issues more clearly and consistently",
  },
  testing: {
    tone: "evidence-first, quality-minded, explicit",
    tools: [
      ["analyze", "Use for test framing, evidence interpretation, and quality summaries."],
      [
        "test",
        "Use for scoped validation when the runtime includes the relevant checks or artifacts.",
      ],
      [
        "claude-code-task",
        "Use for deeper diagnosis when failures or tooling behavior need code-aware analysis.",
      ],
      ["feishu-doc-manager", "Use for reports, go-no-go notes, and quality briefings."],
      [
        "built-in browser tool",
        "Use for public docs, API behavior references, and benchmark context.",
      ],
    ],
    deliverables: [
      "test memo",
      "quality summary",
      "evidence checklist",
      "risk note",
      "follow-up plan",
    ],
    user: "QA lead, engineer, or manager trying to turn test evidence into better decisions",
  },
};

const ID_OVERRIDES = {
  "game-development/game-designer.md": "agency-game-designer",
  "paid-media/paid-media-auditor.md": "agency-paid-media-auditor",
  "sales/sales-engineer.md": "agency-sales-engineer",
};

const SHARED_RULES = [
  "separate public evidence from assumptions that would require private systems or direct access",
  "produce structured deliverables and next actions instead of vague advice",
  "be explicit about validation gaps, missing inputs, or runtime limits",
];

function walkMarkdownFiles(dirPath, relPrefix = "") {
  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (SOURCE_EXCLUDE_PREFIXES.some((prefix) => relPath.startsWith(prefix))) {
      continue;
    }
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(path.join(dirPath, entry.name), relPath));
      continue;
    }
    if (!entry.name.endsWith(".md")) {
      continue;
    }
    if (SOURCE_EXCLUDE_FILES.has(entry.name)) {
      continue;
    }
    results.push(relPath);
  }
  return results;
}

function listAgencySources() {
  return walkMarkdownFiles(agencyRoot).toSorted();
}

function parseCoveredRefs() {
  const covered = new Set();
  for (const fileName of fs.readdirSync(docsAgencyRoot)) {
    if (!fileName.endsWith(".md")) {
      continue;
    }
    const text = fs.readFileSync(path.join(docsAgencyRoot, fileName), "utf8");
    for (const match of text.matchAll(/`([^`]+\.md)`/g)) {
      covered.add(match[1]);
    }
  }
  return covered;
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return {};
  }
  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key && value && !value.startsWith("[") && !value.startsWith("{")) {
      frontmatter[key] = value;
    }
  }
  return frontmatter;
}

function humanizeSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

function normalizeDescription(description, title) {
  const fallback = `${title} specialist providing structured guidance and practical working artifacts`;
  const source = (description || fallback).replace(/\s+/g, " ").trim().replace(/\.$/, "");
  return source
    .replace(/^expert\s+/i, "")
    .replace(/^autonomous\s+/i, "")
    .replace(/^hands-on\s+/i, "")
    .replace(/^specialized\s+/i, "")
    .trim();
}

function stripCategoryPrefix(stem, category) {
  const prefixes = {
    academic: ["academic-"],
    design: ["design-"],
    engineering: ["engineering-"],
    "game-development": ["game-"],
    marketing: ["marketing-"],
    "paid-media": ["paid-media-"],
    product: ["product-"],
    "project-management": ["project-management-", "project-manager-"],
    sales: ["sales-"],
    specialized: ["specialized-"],
    support: ["support-"],
    testing: ["testing-"],
  };
  for (const prefix of prefixes[category] || []) {
    if (stem.startsWith(prefix)) {
      return stem.slice(prefix.length);
    }
  }
  return stem;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function targetIdForSource(relPath, plannedIds) {
  if (ID_OVERRIDES[relPath]) {
    return ID_OVERRIDES[relPath];
  }
  const segments = relPath.split("/");
  const category = segments[0];
  const fileName = segments[segments.length - 1];
  const stem = fileName.replace(/\.md$/, "");
  const stripped = stripCategoryPrefix(stem, category);
  const baseSlug = slugify(stripped || stem);
  const preferred = `agency-${baseSlug}`;
  if (!plannedIds.has(preferred)) {
    return preferred;
  }
  const fallback = `agency-${slugify(category)}-${baseSlug}`;
  if (!plannedIds.has(fallback)) {
    return fallback;
  }
  throw new Error(`Unable to derive unique target id for ${relPath}`);
}

function rolePhrase(title, description) {
  const normalized = normalizeDescription(description, title);
  return normalized[0].toLowerCase() + normalized.slice(1);
}

function getConfig(category) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.specialized;
}

function classifyKeywords(text) {
  return {
    technical:
      /(engineer|architect|developer|builder|integration|optimizer|automation|data|database|firmware|security|sre|metal|xr|workflow|tester|qa|api)/i.test(
        text,
      ),
    content:
      /(content|creator|story|video|podcast|carousel|editor|brand|media|seo|social|copy|narrative)/i.test(
        text,
      ),
    commercial: /(sales|deal|account|revenue|outbound|market|campaign|growth|paid)/i.test(text),
  };
}

function createIdentity(targetId, title, description, category) {
  const config = getConfig(category);
  return `# Identity

Agent id: \`${targetId}\`

Imported from the Agency roster as an incubating OpenClaw agent.

- Role: ${rolePhrase(title, description)}
- Tone: ${config.tone}
- Boundaries: provide role-specific guidance, structure, and working artifacts, but do not assume private systems, live backends, or enterprise tooling are already available
`;
}

function createAgents(title, description, category) {
  const normalized = rolePhrase(title, description);
  const keywordFlags = classifyKeywords(`${title} ${description}`);
  const categoryLabel = category.replace(/-/g, " ");
  const responsibilities = [
    `translate requests about ${normalized} into clearer plans, reviews, and decision-ready output`,
    `identify practical next actions, tradeoffs, and risks instead of vague high-level advice`,
    `separate what can be concluded from public evidence versus what would need direct system access`,
    keywordFlags.technical
      ? "frame implementation, automation, or technical-change work in a way that a delivery team can actually execute"
      : keywordFlags.content
        ? "turn rough ideas into structured narratives, briefs, or deliverables instead of isolated suggestions"
        : keywordFlags.commercial
          ? "connect recommendations to audience, buyer, or business impact rather than abstract activity"
          : `produce structured ${categoryLabel} guidance that is specific enough to act on`,
    `call out when missing inputs, runtime limits, or private-system dependencies block stronger conclusions`,
  ];

  const deliverables = getConfig(category)
    .deliverables.map((item) => `- ${item}`)
    .join("\n");
  const rules = [...SHARED_RULES].map((item) => `- ${item}`).join("\n");
  return `# AGENTS

## Mission

Turn requests about ${normalized} into clearer plans, sharper decisions, and working deliverables that can be used inside OpenClaw.

## Primary Responsibilities

${responsibilities.map((item) => `- ${item}`).join("\n")}

## Working Rules

${rules}

## Deliverables

${deliverables}

## OpenClaw Adaptation Notes

- runtime may not include the private systems or specialist tooling implied by the original Agency source
- when direct access is unavailable, provide frameworks, plans, evaluation logic, and next-step requests instead of pretending the runtime can execute everything end-to-end
`;
}

function createBootstrap(targetId) {
  return `# Bootstrap

Before using \`${targetId}\`, review:

- \`AGENTS.md\`
- \`IDENTITY.md\`
- \`TOOLS.md\`
- \`USER.md\` when present

Keep live state under \`~/.openclaw/agents/${targetId}\` and \`~/.openclaw/workspace/${targetId}\`.
`;
}

function createTools(title, description, category) {
  const config = getConfig(category);
  const tools = config.tools.map(([name, text]) => `- \`${name}\`\n  ${text}`).join("\n");
  const keywordFlags = classifyKeywords(`${title} ${description}`);
  const preferences = [
    keywordFlags.technical
      ? "prefer explicit implementation or validation paths over abstract technical advice"
      : keywordFlags.content
        ? "prefer reusable structures, briefs, and review criteria over isolated ideas"
        : keywordFlags.commercial
          ? "connect recommendations to audience, account, or business outcomes"
          : "prefer structured artifacts and decision logic over generic commentary",
    "keep private-system assumptions separate from public-evidence findings",
    "state clearly when stronger conclusions require data, assets, or systems the runtime does not provide",
  ];
  return `# TOOLS

Use existing OpenClaw capabilities as follows.

## Preferred capabilities

${tools}

## Working preferences

${preferences.map((item) => `- ${item}`).join("\n")}

## Avoid

- do not imply access to private dashboards, enterprise systems, or specialist software unless runtime explicitly provides them
- do not present fabricated metrics, outcomes, or execution status when the role is operating only from public inputs
`;
}

function createUser(category) {
  const config = getConfig(category);
  return `# USER

## Default User Profile

- Primary user: ${config.user}
- Preferred interaction: concise structure, actionable guidance, and explicit tradeoffs
- Success condition: the user leaves with a clearer path, stronger artifacts, and fewer ambiguous next steps

## What This User Usually Wants

- help turning rough goals into a sharper working plan
- better framing, prioritization, or critique for the domain at hand
- a structured artifact they can reuse with teammates or stakeholders
- clear next actions without overclaiming system access

## Communication Preferences

- lead with the main judgment, constraint, or opportunity
- keep recommendations structured and easy to act on
- distinguish evidence-backed conclusions from assumptions or missing inputs

## Adaptation Notes

- replace this template with the real team context, systems, and role-specific constraints if the agent becomes active
`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function ensureClaudeSymlink(workspaceDir) {
  const linkPath = path.join(workspaceDir, "CLAUDE.md");
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(linkPath);
      if (target === "AGENTS.md") {
        return;
      }
    }
    fs.rmSync(linkPath, { force: true });
  } catch {}
  fs.symlinkSync("AGENTS.md", linkPath);
}

function writeAgent(relPath, targetId) {
  const sourcePath = path.join(agencyRoot, relPath);
  const markdown = fs.readFileSync(sourcePath, "utf8");
  const frontmatter = parseFrontmatter(markdown);
  const [category] = relPath.split("/");
  const title = frontmatter.name || humanizeSlug(targetId.replace(/^agency-/, ""));
  const description =
    frontmatter.description ||
    `${title} specialist providing structured guidance and practical working artifacts`;

  const workspaceDir = path.join(overlayAgentsRoot, targetId, "workspace");
  writeText(
    path.join(workspaceDir, "IDENTITY.md"),
    createIdentity(targetId, title, description, category),
  );
  writeText(path.join(workspaceDir, "AGENTS.md"), createAgents(title, description, category));
  writeText(path.join(workspaceDir, "BOOTSTRAP.md"), createBootstrap(targetId));
  writeText(path.join(workspaceDir, "TOOLS.md"), createTools(title, description, category));
  writeText(path.join(workspaceDir, "USER.md"), createUser(category));
  ensureClaudeSymlink(workspaceDir);

  writeText(path.join(runtimeAgentsRoot, targetId, "config.patch.json"), "{}\n");
}

function main() {
  if (!fs.existsSync(agencyRoot)) {
    throw new Error(`Agency source repo not found at ${agencyRoot}`);
  }

  const coveredRefs = parseCoveredRefs();
  const sourceFiles = listAgencySources();
  const plannedIds = new Set();

  const remaining = sourceFiles.filter((relPath) => !coveredRefs.has(relPath));
  const summary = [];

  for (const relPath of remaining) {
    const targetId = targetIdForSource(relPath, plannedIds);
    plannedIds.add(targetId);
    writeAgent(relPath, targetId);
    summary.push({ source: relPath, targetId });
  }

  console.log(JSON.stringify({ generated: summary.length, summary }, null, 2));
}

main();
