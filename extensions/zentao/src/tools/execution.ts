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

const EXECUTION_ACTIONS = ["list", "get", "create", "update", "close"] as const;

const ZentaoExecutionToolSchema = Type.Object(
  {
    action: stringEnum(EXECUTION_ACTIONS, {
      description: `Action to perform: ${EXECUTION_ACTIONS.join(", ")}`,
    }),
    executionId: Type.Optional(
      Type.Number({ description: "Execution ID for get, update, or close action" }),
    ),
    projectId: Type.Optional(Type.Number({ description: "Project ID for create or scoped list" })),
    name: Type.Optional(Type.String({ description: "Execution name" })),
    code: Type.Optional(Type.String({ description: "Execution code" })),
    type: Type.Optional(
      stringEnum(["sprint", "stage", "kanban"] as const, { description: "Execution type" }),
    ),
    begin: Type.Optional(Type.String({ description: "Planned start date" })),
    end: Type.Optional(Type.String({ description: "Planned end date" })),
    desc: Type.Optional(Type.String({ description: "Execution description" })),
    reason: Type.Optional(Type.String({ description: "Reason for risky write actions" })),
    comment: Type.Optional(Type.String({ description: "Comment or note" })),
    query: Type.Optional(Type.String({ description: "Optional substring filter" })),
    limit: Type.Optional(Type.Number({ description: "Optional max items to return" })),
  },
  { additionalProperties: false },
);

type ExecutionAction = (typeof EXECUTION_ACTIONS)[number];

type ExecutionParams = {
  action: ExecutionAction;
  executionId?: number;
  projectId?: number;
  name?: string;
  code?: string;
  type?: string;
  begin?: string;
  end?: string;
  desc?: string;
  reason?: string;
  comment?: string;
  query?: string;
  limit?: number;
};

type ZentaoExecutionListResponse = {
  page?: number;
  total?: number;
  limit?: number;
  executions?: Array<Record<string, unknown>>;
};

export function createZentaoExecutionTool(runtime: ZentaoRuntime): AnyAgentTool {
  return {
    name: "zentao_execution",
    label: "Zentao Execution",
    description: "List, read, create, update, and close Zentao executions or sprints.",
    parameters: ZentaoExecutionToolSchema,
    async execute(_toolCallId, rawParams): Promise<ZentaoToolResult> {
      const params = rawParams as ExecutionParams;

      try {
        switch (params.action) {
          case "list":
            return zentaoJsonResult(await listExecutions(runtime, params));
          case "get":
            return zentaoJsonResult(await getExecution(runtime, params));
          case "create":
            return zentaoJsonResult(await createExecution(runtime, params));
          case "update":
            return zentaoJsonResult(await updateExecution(runtime, params));
          case "close":
            return zentaoJsonResult(await closeExecution(runtime, params));
          default:
            params.action satisfies never;
            return zentaoErrorResult(
              `Unsupported zentao_execution action: ${String(params.action)}`,
            );
        }
      } catch (error) {
        return zentaoErrorResult(error);
      }
    },
  } as AnyAgentTool;
}

async function listExecutions(runtime: ZentaoRuntime, params: ExecutionParams) {
  const payload = await fetchExecutionList(runtime, params.projectId);
  const executions = payload.executions ?? [];
  const filtered = filterItems(executions, params.query, params.limit);

  return {
    action: "list",
    resourceType: "execution",
    projectId: params.projectId ?? null,
    count: filtered.length,
    page: payload.page ?? null,
    total: payload.total ?? executions.length,
    limit: payload.limit ?? executions.length,
    items: filtered,
  };
}

async function getExecution(runtime: ZentaoRuntime, params: ExecutionParams) {
  if (params.executionId === undefined) {
    throw new Error("executionId required for get action");
  }

  const item = await runtime.client.get<Record<string, unknown>>(
    `/executions/${params.executionId}`,
  );
  return {
    action: "get",
    resourceType: "execution",
    executionId: params.executionId,
    item,
  };
}

async function createExecution(runtime: ZentaoRuntime, params: ExecutionParams) {
  if (params.projectId === undefined) {
    throw new Error("projectId required for create action");
  }
  requireField(params.name, "name");
  requireField(params.begin, "begin");

  assertWriteAllowed(runtime, params);

  const body = compactObject({
    name: params.name,
    code: params.code,
    type: params.type,
    begin: params.begin,
    end: params.end,
    desc: params.desc,
  });

  const item = await runtime.client.post<Record<string, unknown>>(
    `/projects/${params.projectId}/executions`,
    body,
  );

  return {
    action: "create",
    resourceType: "execution",
    projectId: params.projectId,
    changedFields: Object.keys(body),
    item,
  };
}

async function updateExecution(runtime: ZentaoRuntime, params: ExecutionParams) {
  if (params.executionId === undefined) {
    throw new Error("executionId required for update action");
  }

  assertWriteAllowed(runtime, params);

  const body = compactObject({
    name: params.name,
    code: params.code,
    type: params.type,
    begin: params.begin,
    end: params.end,
    desc: params.desc,
  });

  if (Object.keys(body).length === 0) {
    throw new Error("No writable fields provided for update action");
  }

  const item = await runtime.client.request<Record<string, unknown>>({
    method: "PUT",
    path: `/executions/${params.executionId}`,
    body,
  });

  return {
    action: "update",
    resourceType: "execution",
    executionId: params.executionId,
    projectId: params.projectId ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function closeExecution(runtime: ZentaoRuntime, params: ExecutionParams) {
  if (params.executionId === undefined) {
    throw new Error("executionId required for close action");
  }

  assertWriteAllowed(runtime, params);

  const body = compactObject({
    comment: params.comment,
  });

  const item = await runtime.client.post<Record<string, unknown>>(
    `/executions/${params.executionId}/close`,
    body,
  );

  return {
    action: "close",
    resourceType: "execution",
    executionId: params.executionId,
    projectId: params.projectId ?? null,
    reason: params.reason ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function fetchExecutionList(runtime: ZentaoRuntime, projectId: number | undefined) {
  const path = projectId !== undefined ? `/projects/${projectId}/executions` : "/executions";
  return runtime.client.get<ZentaoExecutionListResponse>(path);
}

function assertWriteAllowed(runtime: ZentaoRuntime, params: ExecutionParams) {
  enforceWriteAllowed(runtime.config, params.action);
  enforceReasonIfRequired(runtime.config, params.action, params.reason);
  enforceScopeIfConfigured(runtime.config, {
    projectId: params.projectId,
    executionId: params.executionId,
  });
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
  for (const key of ["name", "status", "type", "code"] as const) {
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
  value: Record<string, string | number | undefined>,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Record<string, string | number>;
}
