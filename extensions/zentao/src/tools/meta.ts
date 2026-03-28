import { Type } from "@sinclair/typebox";
import { stringEnum } from "../../api.js";
import type { AnyAgentTool } from "../../api.js";
import { zentaoErrorResult, zentaoJsonResult } from "../result.js";
import type { ZentaoRuntime, ZentaoToolResult } from "../types.js";

const META_ACTIONS = [
  "list_products",
  "list_projects",
  "list_executions",
  "list_users",
  "resolve_context",
] as const;

const ZentaoMetaToolSchema = Type.Object(
  {
    action: stringEnum(META_ACTIONS, {
      description: `Action to perform: ${META_ACTIONS.join(", ")}`,
    }),
    productId: Type.Optional(Type.Number({ description: "Filter by product ID" })),
    projectId: Type.Optional(Type.Number({ description: "Filter by project ID" })),
    query: Type.Optional(Type.String({ description: "Optional substring filter" })),
    limit: Type.Optional(Type.Number({ description: "Optional max items to return" })),
  },
  { additionalProperties: false },
);

type MetaAction = (typeof META_ACTIONS)[number];

type MetaParams = {
  action: MetaAction;
  productId?: number;
  projectId?: number;
  query?: string;
  limit?: number;
};

type ZentaoListResponse<T> = {
  page?: number;
  total?: number;
  limit?: number;
} & Record<string, T[] | number | undefined>;

export function createZentaoMetaTool(runtime: ZentaoRuntime): AnyAgentTool {
  return {
    name: "zentao_meta",
    label: "Zentao Meta",
    description:
      "List Zentao products, projects, executions, and users, or resolve likely context IDs before calling work-item tools.",
    parameters: ZentaoMetaToolSchema,
    async execute(_toolCallId, rawParams): Promise<ZentaoToolResult> {
      const params = rawParams as MetaParams;

      try {
        switch (params.action) {
          case "list_products":
            return zentaoJsonResult(await listProducts(runtime, params));
          case "list_projects":
            return zentaoJsonResult(await listProjects(runtime, params));
          case "list_executions":
            return zentaoJsonResult(await listExecutions(runtime, params));
          case "list_users":
            return zentaoJsonResult(await listUsers(runtime, params));
          case "resolve_context":
            return zentaoJsonResult(await resolveContext(runtime, params));
          default:
            params.action satisfies never;
            return zentaoErrorResult(`Unsupported zentao_meta action: ${String(params.action)}`);
        }
      } catch (error) {
        return zentaoErrorResult(error);
      }
    },
  } as AnyAgentTool;
}

async function listProducts(runtime: ZentaoRuntime, params: MetaParams) {
  const payload =
    await runtime.client.get<ZentaoListResponse<Record<string, unknown>>>("/products");
  const items = normalizeList(payload, "products");
  return buildListPayload("product", filterItems(items, params.query, params.limit), payload);
}

async function listProjects(runtime: ZentaoRuntime, params: MetaParams) {
  const path =
    params.productId !== undefined ? `/products/${params.productId}/projects` : "/projects";
  const payload = await runtime.client.get<ZentaoListResponse<Record<string, unknown>>>(path);
  const items = normalizeList(payload, "projects");
  return buildListPayload("project", filterItems(items, params.query, params.limit), payload);
}

async function listExecutions(runtime: ZentaoRuntime, params: MetaParams) {
  const path =
    params.projectId !== undefined ? `/projects/${params.projectId}/executions` : "/executions";
  const payload = await runtime.client.get<ZentaoListResponse<Record<string, unknown>>>(path);
  const items = normalizeList(payload, "executions");
  return buildListPayload("execution", filterItems(items, params.query, params.limit), payload);
}

async function listUsers(runtime: ZentaoRuntime, params: MetaParams) {
  const payload = await runtime.client.get<ZentaoListResponse<Record<string, unknown>>>("/users");
  const items = normalizeList(payload, "users");
  return buildListPayload("user", filterItems(items, params.query, params.limit), payload);
}

async function resolveContext(runtime: ZentaoRuntime, params: MetaParams) {
  const [productsPayload, projectsPayload, executionsPayload, usersPayload] = await Promise.all([
    runtime.client.get<ZentaoListResponse<Record<string, unknown>>>("/products"),
    runtime.client.get<ZentaoListResponse<Record<string, unknown>>>("/projects"),
    runtime.client.get<ZentaoListResponse<Record<string, unknown>>>("/executions"),
    runtime.client.get<ZentaoListResponse<Record<string, unknown>>>("/users"),
  ]);

  const query = params.query?.trim();
  return {
    action: "resolve_context",
    query: query ?? null,
    matches: {
      products: filterItems(normalizeList(productsPayload, "products"), query, params.limit),
      projects: filterItems(normalizeList(projectsPayload, "projects"), query, params.limit),
      executions: filterItems(normalizeList(executionsPayload, "executions"), query, params.limit),
      users: filterItems(normalizeList(usersPayload, "users"), query, params.limit),
    },
  };
}

function normalizeList(
  payload: ZentaoListResponse<Record<string, unknown>>,
  key: string,
): Array<Record<string, unknown>> {
  const list = payload[key];
  return Array.isArray(list) ? list : [];
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
  for (const key of ["name", "title", "account", "realname", "code"] as const) {
    const value = item[key];
    if (typeof value === "string" && value.toLowerCase().includes(needle)) {
      return true;
    }
  }
  return false;
}

function buildListPayload(
  resourceType: string,
  items: Array<Record<string, unknown>>,
  payload: ZentaoListResponse<Record<string, unknown>>,
) {
  return {
    action: `list_${resourceType}s`,
    resourceType,
    count: items.length,
    page: payload.page ?? null,
    total: payload.total ?? items.length,
    limit: payload.limit ?? items.length,
    items,
  };
}
