import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { stringEnum } from "../../../../src/agents/schema/typebox.js";
import { enforceScopeIfConfigured, enforceWriteAllowed } from "../guardrails.js";
import { zentaoErrorResult, zentaoJsonResult } from "../result.js";
import type { ZentaoRuntime, ZentaoToolResult } from "../types.js";

const PROJECT_ACTIONS = ["list", "get", "create", "update"] as const;

const ZentaoProjectToolSchema = Type.Object(
  {
    action: stringEnum(PROJECT_ACTIONS, {
      description: `Action to perform: ${PROJECT_ACTIONS.join(", ")}`,
    }),
    projectId: Type.Optional(Type.Number({ description: "Project ID for get or update action" })),
    name: Type.Optional(Type.String({ description: "Project name" })),
    products: Type.Optional(
      Type.Array(Type.Number({ description: "Linked product ID" }), {
        description: "Product IDs linked to the project",
      }),
    ),
    code: Type.Optional(Type.String({ description: "Project code" })),
    model: Type.Optional(
      stringEnum(["scrum", "waterfall", "kanban"] as const, { description: "Project model" }),
    ),
    begin: Type.Optional(Type.String({ description: "Planned start date" })),
    end: Type.Optional(Type.String({ description: "Planned end date" })),
    desc: Type.Optional(Type.String({ description: "Project description" })),
    PM: Type.Optional(Type.String({ description: "Project manager account" })),
    query: Type.Optional(Type.String({ description: "Optional substring filter" })),
    limit: Type.Optional(Type.Number({ description: "Optional max items to return" })),
  },
  { additionalProperties: false },
);

type ProjectAction = (typeof PROJECT_ACTIONS)[number];

type ProjectParams = {
  action: ProjectAction;
  projectId?: number;
  name?: string;
  products?: number[];
  code?: string;
  model?: string;
  begin?: string;
  end?: string;
  desc?: string;
  PM?: string;
  query?: string;
  limit?: number;
};

type ZentaoProjectListResponse = {
  page?: number;
  total?: number;
  limit?: number;
  projects?: Array<Record<string, unknown>>;
};

export function createZentaoProjectTool(runtime: ZentaoRuntime): AnyAgentTool {
  return {
    name: "zentao_project",
    label: "Zentao Project",
    description: "List, read, create, and update Zentao projects.",
    parameters: ZentaoProjectToolSchema,
    async execute(_toolCallId, rawParams): Promise<ZentaoToolResult> {
      const params = rawParams as ProjectParams;

      try {
        switch (params.action) {
          case "list":
            return zentaoJsonResult(await listProjects(runtime, params));
          case "get":
            return zentaoJsonResult(await getProject(runtime, params));
          case "create":
            return zentaoJsonResult(await createProject(runtime, params));
          case "update":
            return zentaoJsonResult(await updateProject(runtime, params));
          default:
            params.action satisfies never;
            return zentaoErrorResult(`Unsupported zentao_project action: ${String(params.action)}`);
        }
      } catch (error) {
        return zentaoErrorResult(error);
      }
    },
  } as AnyAgentTool;
}

async function listProjects(runtime: ZentaoRuntime, params: ProjectParams) {
  const payload = await runtime.client.get<ZentaoProjectListResponse>("/projects");
  const projects = payload.projects ?? [];
  const filtered = filterItems(projects, params.query, params.limit);

  return {
    action: "list",
    resourceType: "project",
    count: filtered.length,
    page: payload.page ?? null,
    total: payload.total ?? projects.length,
    limit: payload.limit ?? projects.length,
    items: filtered,
  };
}

async function getProject(runtime: ZentaoRuntime, params: ProjectParams) {
  if (params.projectId === undefined) {
    throw new Error("projectId required for get action");
  }

  const item = await runtime.client.get<Record<string, unknown>>(`/projects/${params.projectId}`);
  return {
    action: "get",
    resourceType: "project",
    projectId: params.projectId,
    item,
  };
}

async function createProject(runtime: ZentaoRuntime, params: ProjectParams) {
  requireField(params.name, "name");
  requireField(params.begin, "begin");
  if (!params.products?.length) {
    throw new Error("products required");
  }
  requireField(params.PM, "PM");

  assertWriteAllowed(runtime, params.action, params.projectId);

  const body = compactObject({
    name: params.name,
    products: params.products,
    code: params.code,
    model: params.model,
    begin: params.begin,
    end: params.end,
    desc: params.desc,
    PM: params.PM,
  });

  const item = await runtime.client.post<Record<string, unknown>>("/projects", body);

  return {
    action: "create",
    resourceType: "project",
    changedFields: Object.keys(body),
    item,
  };
}

async function updateProject(runtime: ZentaoRuntime, params: ProjectParams) {
  if (params.projectId === undefined) {
    throw new Error("projectId required for update action");
  }

  assertWriteAllowed(runtime, params.action, params.projectId);

  const body = compactObject({
    name: params.name,
    products: params.products,
    code: params.code,
    model: params.model,
    begin: params.begin,
    end: params.end,
    desc: params.desc,
    PM: params.PM,
  });

  if (Object.keys(body).length === 0) {
    throw new Error("No writable fields provided for update action");
  }

  const item = await runtime.client.request<Record<string, unknown>>({
    method: "PUT",
    path: `/projects/${params.projectId}`,
    body,
  });

  return {
    action: "update",
    resourceType: "project",
    projectId: params.projectId,
    changedFields: Object.keys(body),
    item,
  };
}

function assertWriteAllowed(runtime: ZentaoRuntime, action: string, projectId?: number) {
  enforceWriteAllowed(runtime.config, action);
  enforceScopeIfConfigured(runtime.config, { projectId });
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
  for (const key of ["name", "status", "model", "code"] as const) {
    const value = item[key];
    if (typeof value === "string" && value.toLowerCase().includes(needle)) {
      return true;
    }
  }
  return false;
}

function requireField(value: string | undefined, fieldName: string) {
  if (!value?.trim()) {
    throw new Error(`${fieldName} required`);
  }
}

function compactObject(
  value: Record<string, string | number | number[] | undefined>,
): Record<string, string | number | number[]> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Record<string, string | number | number[]>;
}
