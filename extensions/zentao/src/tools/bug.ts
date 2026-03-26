import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { stringEnum } from "../../../../src/agents/schema/typebox.js";
import {
  enforceReasonIfRequired,
  enforceScopeIfConfigured,
  enforceWriteAllowed,
} from "../guardrails.js";
import { zentaoErrorResult, zentaoJsonResult } from "../result.js";
import type { ZentaoRuntime, ZentaoToolResult } from "../types.js";

const BUG_ACTIONS = [
  "list",
  "get",
  "create",
  "update",
  "assign",
  "resolve",
  "close",
  "activate",
] as const;

const ZentaoBugToolSchema = Type.Object(
  {
    action: stringEnum(BUG_ACTIONS, {
      description: `Action to perform: ${BUG_ACTIONS.join(", ")}`,
    }),
    productId: Type.Number({ description: "Product ID that owns the bug list" }),
    bugId: Type.Optional(Type.Number({ description: "Bug ID for get action" })),
    projectId: Type.Optional(Type.Number({ description: "Project ID" })),
    executionId: Type.Optional(Type.Number({ description: "Execution ID" })),
    module: Type.Optional(Type.Number({ description: "Module ID" })),
    story: Type.Optional(Type.Number({ description: "Related story ID" })),
    task: Type.Optional(Type.Number({ description: "Related task ID" })),
    title: Type.Optional(Type.String({ description: "Bug title" })),
    steps: Type.Optional(Type.String({ description: "Bug steps or expected/actual details" })),
    assignedTo: Type.Optional(Type.String({ description: "Assignee account" })),
    openedBuild: Type.Optional(Type.String({ description: "Opened build label" })),
    severity: Type.Optional(Type.Number({ description: "Severity" })),
    pri: Type.Optional(Type.Number({ description: "Priority" })),
    type: Type.Optional(
      stringEnum(
        [
          "codeerror",
          "config",
          "install",
          "security",
          "performance",
          "standard",
          "automation",
          "designdefect",
          "others",
        ] as const,
        { description: "Bug type" },
      ),
    ),
    os: Type.Optional(Type.String({ description: "Operating system" })),
    browser: Type.Optional(Type.String({ description: "Browser" })),
    hardware: Type.Optional(Type.String({ description: "Hardware" })),
    resolution: Type.Optional(
      stringEnum(
        ["fixed", "postponed", "wontfix", "bydesign", "duplicate", "external", "notrepro"] as const,
        { description: "Resolution for resolve action" },
      ),
    ),
    resolvedBuild: Type.Optional(Type.String({ description: "Resolved build label" })),
    duplicateBug: Type.Optional(
      Type.Number({ description: "Duplicate bug ID when resolution is duplicate" }),
    ),
    comment: Type.Optional(Type.String({ description: "Comment or note" })),
    reason: Type.Optional(Type.String({ description: "Reason for risky write actions" })),
    query: Type.Optional(Type.String({ description: "Optional substring filter" })),
    limit: Type.Optional(Type.Number({ description: "Optional max items to return" })),
  },
  { additionalProperties: false },
);

type BugAction = (typeof BUG_ACTIONS)[number];

type BugParams = {
  action: BugAction;
  productId: number;
  bugId?: number;
  projectId?: number;
  executionId?: number;
  module?: number;
  story?: number;
  task?: number;
  title?: string;
  steps?: string;
  assignedTo?: string;
  openedBuild?: string;
  severity?: number;
  pri?: number;
  type?: string;
  os?: string;
  browser?: string;
  hardware?: string;
  resolution?: string;
  resolvedBuild?: string;
  duplicateBug?: number;
  comment?: string;
  reason?: string;
  query?: string;
  limit?: number;
};

type ZentaoBugListResponse = {
  page?: number;
  total?: number;
  limit?: number;
  bugs?: Array<Record<string, unknown>>;
};

export function createZentaoBugTool(runtime: ZentaoRuntime): AnyAgentTool {
  return {
    name: "zentao_bug",
    label: "Zentao Bug",
    description: "List Zentao bugs by product and fetch a specific bug from a product bug list.",
    parameters: ZentaoBugToolSchema,
    async execute(_toolCallId, rawParams): Promise<ZentaoToolResult> {
      const params = rawParams as BugParams;

      try {
        switch (params.action) {
          case "list":
            return zentaoJsonResult(await listBugs(runtime, params));
          case "get":
            return zentaoJsonResult(await getBug(runtime, params));
          case "create":
            return zentaoJsonResult(await createBug(runtime, params));
          case "update":
            return zentaoJsonResult(await updateBug(runtime, params));
          case "assign":
            return zentaoJsonResult(await assignBug(runtime, params));
          case "resolve":
            return zentaoJsonResult(await resolveBug(runtime, params));
          case "close":
            return zentaoJsonResult(await closeBug(runtime, params));
          case "activate":
            return zentaoJsonResult(await activateBug(runtime, params));
          default:
            params.action satisfies never;
            return zentaoErrorResult(`Unsupported zentao_bug action: ${String(params.action)}`);
        }
      } catch (error) {
        return zentaoErrorResult(error);
      }
    },
  } as AnyAgentTool;
}

async function listBugs(runtime: ZentaoRuntime, params: BugParams) {
  const payload = await fetchBugList(runtime, params.productId);
  const bugs = payload.bugs ?? [];
  const filtered = filterItems(bugs, params.query, params.limit);

  return {
    action: "list",
    resourceType: "bug",
    productId: params.productId,
    count: filtered.length,
    page: payload.page ?? null,
    total: payload.total ?? bugs.length,
    limit: payload.limit ?? bugs.length,
    items: filtered,
  };
}

async function getBug(runtime: ZentaoRuntime, params: BugParams) {
  if (params.bugId === undefined) {
    throw new Error("bugId required for get action");
  }

  try {
    const detail = await runtime.client.get<Record<string, unknown>>(`/bugs/${params.bugId}`);
    if (typeof detail.id === "number" || typeof detail.title === "string") {
      return {
        action: "get",
        resourceType: "bug",
        productId: params.productId,
        bugId: params.bugId,
        item: detail,
      };
    }
  } catch {
    // Fall back to list-based lookup. Some Zentao instances may not expose /bugs/:id cleanly.
  }

  const payload = await fetchBugList(runtime, params.productId);
  const bug = (payload.bugs ?? []).find((item) => item.id === params.bugId);

  if (!bug) {
    throw new Error(`Bug ${params.bugId} not found in product ${params.productId}`);
  }

  return {
    action: "get",
    resourceType: "bug",
    productId: params.productId,
    bugId: params.bugId,
    item: bug,
  };
}

async function createBug(runtime: ZentaoRuntime, params: BugParams) {
  requireField(params.title, "title");
  requireField(params.steps, "steps");
  requireField(params.openedBuild, "openedBuild");
  requireField(params.type, "type");

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    product: params.productId,
    project: params.projectId,
    execution: params.executionId,
    module: params.module,
    story: params.story,
    task: params.task,
    title: params.title,
    steps: params.steps,
    assignedTo: params.assignedTo,
    openedBuild: params.openedBuild,
    severity: params.severity,
    pri: params.pri,
    type: params.type,
    os: params.os,
    browser: params.browser,
    hardware: params.hardware,
  });

  const item = await runtime.client.post<Record<string, unknown>>("/bugs", body);

  return {
    action: "create",
    resourceType: "bug",
    productId: params.productId,
    projectId: params.projectId ?? null,
    executionId: params.executionId ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function updateBug(runtime: ZentaoRuntime, params: BugParams) {
  if (params.bugId === undefined) {
    throw new Error("bugId required for update action");
  }

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    product: params.productId,
    project: params.projectId,
    execution: params.executionId,
    module: params.module,
    story: params.story,
    task: params.task,
    title: params.title,
    steps: params.steps,
    assignedTo: params.assignedTo,
    openedBuild: params.openedBuild,
    severity: params.severity,
    pri: params.pri,
    type: params.type,
    os: params.os,
    browser: params.browser,
    hardware: params.hardware,
  });

  if (Object.keys(body).length === 0) {
    throw new Error("No writable fields provided for update action");
  }

  const item = await runtime.client.request<Record<string, unknown>>({
    method: "PUT",
    path: `/bugs/${params.bugId}`,
    body,
  });

  return {
    action: "update",
    resourceType: "bug",
    productId: params.productId,
    bugId: params.bugId,
    projectId: params.projectId ?? null,
    executionId: params.executionId ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function assignBug(runtime: ZentaoRuntime, params: BugParams) {
  if (params.bugId === undefined) {
    throw new Error("bugId required for assign action");
  }
  requireField(params.assignedTo, "assignedTo");

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    assignedTo: params.assignedTo,
    comment: params.comment,
  });

  const item = await runtime.client.post<Record<string, unknown>>(
    `/bugs/${params.bugId}/assign`,
    body,
  );

  return {
    action: "assign",
    resourceType: "bug",
    productId: params.productId,
    bugId: params.bugId,
    changedFields: Object.keys(body),
    item,
  };
}

async function resolveBug(runtime: ZentaoRuntime, params: BugParams) {
  if (params.bugId === undefined) {
    throw new Error("bugId required for resolve action");
  }
  requireField(params.resolution, "resolution");
  requireField(params.resolvedBuild, "resolvedBuild");

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    resolution: params.resolution,
    resolvedBuild: params.resolvedBuild,
    assignedTo: params.assignedTo,
    duplicateBug: params.duplicateBug,
    comment: params.comment,
  });

  const item = await runtime.client.post<Record<string, unknown>>(
    `/bugs/${params.bugId}/resolve`,
    body,
  );

  return {
    action: "resolve",
    resourceType: "bug",
    productId: params.productId,
    bugId: params.bugId,
    reason: params.reason ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function closeBug(runtime: ZentaoRuntime, params: BugParams) {
  if (params.bugId === undefined) {
    throw new Error("bugId required for close action");
  }

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    comment: params.comment,
  });

  const item = await runtime.client.post<Record<string, unknown>>(
    `/bugs/${params.bugId}/close`,
    body,
  );

  return {
    action: "close",
    resourceType: "bug",
    productId: params.productId,
    bugId: params.bugId,
    reason: params.reason ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function activateBug(runtime: ZentaoRuntime, params: BugParams) {
  if (params.bugId === undefined) {
    throw new Error("bugId required for activate action");
  }

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    comment: params.comment,
  });

  const item = await runtime.client.post<Record<string, unknown>>(
    `/bugs/${params.bugId}/activate`,
    body,
  );

  return {
    action: "activate",
    resourceType: "bug",
    productId: params.productId,
    bugId: params.bugId,
    reason: params.reason ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function fetchBugList(runtime: ZentaoRuntime, productId: number) {
  return runtime.client.get<ZentaoBugListResponse>(`/products/${productId}/bugs`);
}

function assertWriteAllowed(runtime: ZentaoRuntime, action: string, params: BugParams) {
  enforceWriteAllowed(runtime.config, action);
  enforceReasonIfRequired(runtime.config, action, params.reason);
  enforceScopeIfConfigured(runtime.config, {
    productId: params.productId,
    projectId: params.projectId,
    executionId: params.executionId,
  });
}

function requireField(value: string | undefined, fieldName: string) {
  if (!value?.trim()) {
    throw new Error(`${fieldName} required`);
  }
}

function compactObject(
  value: Record<string, string | number | undefined>,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Record<string, string | number>;
}

function filterItems(
  items: Array<Record<string, unknown>>,
  query: string | undefined,
  limit: number | undefined,
): Array<Record<string, unknown>> {
  const filtered = query ? items.filter((item) => matchesQuery(item, query)) : items;
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return filtered;
  }
  return filtered.slice(0, Math.trunc(limit));
}

function matchesQuery(item: Record<string, unknown>, query: string): boolean {
  const needle = query.toLowerCase();
  for (const key of ["title", "status", "type", "resolution"] as const) {
    const value = item[key];
    if (typeof value === "string" && value.toLowerCase().includes(needle)) {
      return true;
    }
  }
  return false;
}
