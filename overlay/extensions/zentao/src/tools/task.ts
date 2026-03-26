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

const TASK_ACTIONS = [
  "list",
  "get",
  "create",
  "update",
  "assign",
  "start",
  "finish",
  "close",
] as const;

const ZentaoTaskToolSchema = Type.Object(
  {
    action: stringEnum(TASK_ACTIONS, {
      description: `Action to perform: ${TASK_ACTIONS.join(", ")}`,
    }),
    taskId: Type.Optional(Type.Number({ description: "Task ID for get action" })),
    executionId: Type.Optional(Type.Number({ description: "Execution ID to scope task listing" })),
    module: Type.Optional(Type.Number({ description: "Module ID" })),
    story: Type.Optional(Type.Number({ description: "Related story ID" })),
    fromBug: Type.Optional(Type.Number({ description: "Source bug ID" })),
    name: Type.Optional(Type.String({ description: "Task name" })),
    type: Type.Optional(
      stringEnum(
        ["design", "devel", "request", "test", "study", "discuss", "ui", "affair", "misc"] as const,
        {
          description: "Task type",
        },
      ),
    ),
    assignedTo: Type.Optional(Type.String({ description: "Assignee account" })),
    pri: Type.Optional(Type.Number({ description: "Priority" })),
    estimate: Type.Optional(Type.Number({ description: "Estimated hours" })),
    estStarted: Type.Optional(Type.String({ description: "Estimated start date" })),
    deadline: Type.Optional(Type.String({ description: "Deadline date" })),
    desc: Type.Optional(Type.String({ description: "Task description" })),
    left: Type.Optional(Type.Number({ description: "Remaining hours" })),
    consumed: Type.Optional(Type.Number({ description: "Total consumed hours" })),
    currentConsumed: Type.Optional(
      Type.Number({ description: "Current consumed hours for finish" }),
    ),
    realStarted: Type.Optional(Type.String({ description: "Actual start time/date" })),
    finishedDate: Type.Optional(Type.String({ description: "Finished date" })),
    comment: Type.Optional(Type.String({ description: "Comment or note" })),
    reason: Type.Optional(Type.String({ description: "Reason for risky write actions" })),
    query: Type.Optional(Type.String({ description: "Optional substring filter" })),
    limit: Type.Optional(Type.Number({ description: "Optional max items to return" })),
  },
  { additionalProperties: false },
);

type TaskAction = (typeof TASK_ACTIONS)[number];

type TaskParams = {
  action: TaskAction;
  taskId?: number;
  executionId?: number;
  module?: number;
  story?: number;
  fromBug?: number;
  name?: string;
  type?: string;
  assignedTo?: string;
  pri?: number;
  estimate?: number;
  estStarted?: string;
  deadline?: string;
  desc?: string;
  left?: number;
  consumed?: number;
  currentConsumed?: number;
  realStarted?: string;
  finishedDate?: string;
  comment?: string;
  reason?: string;
  query?: string;
  limit?: number;
};

type ZentaoTaskListResponse = {
  page?: number;
  total?: number;
  limit?: number;
  tasks?: Array<Record<string, unknown>>;
};

export function createZentaoTaskTool(runtime: ZentaoRuntime): AnyAgentTool {
  return {
    name: "zentao_task",
    label: "Zentao Task",
    description:
      "List Zentao tasks globally or by execution, and fetch a specific task from visible task lists.",
    parameters: ZentaoTaskToolSchema,
    async execute(_toolCallId, rawParams): Promise<ZentaoToolResult> {
      const params = rawParams as TaskParams;

      try {
        switch (params.action) {
          case "list":
            return zentaoJsonResult(await listTasks(runtime, params));
          case "get":
            return zentaoJsonResult(await getTask(runtime, params));
          case "create":
            return zentaoJsonResult(await createTask(runtime, params));
          case "update":
            return zentaoJsonResult(await updateTask(runtime, params));
          case "assign":
            return zentaoJsonResult(await assignTask(runtime, params));
          case "start":
            return zentaoJsonResult(await startTask(runtime, params));
          case "finish":
            return zentaoJsonResult(await finishTask(runtime, params));
          case "close":
            return zentaoJsonResult(await closeTask(runtime, params));
          default:
            params.action satisfies never;
            return zentaoErrorResult(`Unsupported zentao_task action: ${String(params.action)}`);
        }
      } catch (error) {
        return zentaoErrorResult(error);
      }
    },
  } as AnyAgentTool;
}

async function listTasks(runtime: ZentaoRuntime, params: TaskParams) {
  const payload = await fetchTaskList(runtime, params.executionId);
  const tasks = payload.tasks ?? [];
  const filtered = filterItems(tasks, params.query, params.limit);

  return {
    action: "list",
    resourceType: "task",
    executionId: params.executionId ?? null,
    count: filtered.length,
    page: payload.page ?? null,
    total: payload.total ?? tasks.length,
    limit: payload.limit ?? tasks.length,
    items: filtered,
  };
}

async function getTask(runtime: ZentaoRuntime, params: TaskParams) {
  if (params.taskId === undefined) {
    throw new Error("taskId required for get action");
  }

  try {
    const detail = await runtime.client.get<Record<string, unknown>>(`/tasks/${params.taskId}`);
    if (typeof detail.id === "number" || typeof detail.name === "string") {
      return {
        action: "get",
        resourceType: "task",
        taskId: params.taskId,
        executionId: params.executionId ?? null,
        item: detail,
      };
    }
  } catch {
    // Fall back to list-based lookup. Some Zentao instances return incomplete payloads for /tasks/:id.
  }

  const payload = await fetchTaskList(runtime, params.executionId);
  const task = (payload.tasks ?? []).find((item) => item.id === params.taskId);

  if (!task) {
    throw new Error(
      params.executionId !== undefined
        ? `Task ${params.taskId} not found in execution ${params.executionId}`
        : `Task ${params.taskId} not found in current task listing`,
    );
  }

  return {
    action: "get",
    resourceType: "task",
    taskId: params.taskId,
    executionId: params.executionId ?? null,
    item: task,
  };
}

async function createTask(runtime: ZentaoRuntime, params: TaskParams) {
  if (params.executionId === undefined) {
    throw new Error("executionId required for create action");
  }
  requireField(params.name, "name");
  requireField(params.type, "type");
  requireField(params.assignedTo, "assignedTo");
  requireField(params.estStarted, "estStarted");

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    module: params.module,
    story: params.story,
    fromBug: params.fromBug,
    name: params.name,
    type: params.type,
    assignedTo: params.assignedTo,
    pri: params.pri,
    estimate: params.estimate,
    estStarted: params.estStarted,
    deadline: params.deadline,
    desc: params.desc,
  });

  const item = await runtime.client.post<Record<string, unknown>>(
    `/executions/${params.executionId}/tasks`,
    body,
  );

  return {
    action: "create",
    resourceType: "task",
    executionId: params.executionId,
    changedFields: Object.keys(body),
    item,
  };
}

async function updateTask(runtime: ZentaoRuntime, params: TaskParams) {
  if (params.taskId === undefined) {
    throw new Error("taskId required for update action");
  }

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    module: params.module,
    story: params.story,
    fromBug: params.fromBug,
    name: params.name,
    type: params.type,
    assignedTo: params.assignedTo,
    pri: params.pri,
    estimate: params.estimate,
    estStarted: params.estStarted,
    deadline: params.deadline,
    desc: params.desc,
  });

  if (Object.keys(body).length === 0) {
    throw new Error("No writable fields provided for update action");
  }

  const item = await runtime.client.request<Record<string, unknown>>({
    method: "PUT",
    path: `/tasks/${params.taskId}`,
    body,
  });

  return {
    action: "update",
    resourceType: "task",
    taskId: params.taskId,
    executionId: params.executionId ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function assignTask(runtime: ZentaoRuntime, params: TaskParams) {
  if (params.taskId === undefined) {
    throw new Error("taskId required for assign action");
  }
  requireField(params.assignedTo, "assignedTo");

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    assignedTo: params.assignedTo,
  });

  const item = await runtime.client.request<Record<string, unknown>>({
    method: "PUT",
    path: `/tasks/${params.taskId}`,
    body,
  });

  return {
    action: "assign",
    resourceType: "task",
    taskId: params.taskId,
    executionId: params.executionId ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function startTask(runtime: ZentaoRuntime, params: TaskParams) {
  if (params.taskId === undefined) {
    throw new Error("taskId required for start action");
  }
  if (params.left === undefined) {
    throw new Error("left required for start action");
  }

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    assignedTo: params.assignedTo,
    realStarted: params.realStarted,
    consumed: params.consumed,
    left: params.left,
    comment: params.comment,
  });

  const item = await runtime.client.post<Record<string, unknown>>(
    `/tasks/${params.taskId}/start`,
    body,
  );

  return {
    action: "start",
    resourceType: "task",
    taskId: params.taskId,
    executionId: params.executionId ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function finishTask(runtime: ZentaoRuntime, params: TaskParams) {
  if (params.taskId === undefined) {
    throw new Error("taskId required for finish action");
  }
  requireField(params.assignedTo, "assignedTo");
  if (params.currentConsumed === undefined) {
    throw new Error("currentConsumed required for finish action");
  }
  if (params.consumed === undefined) {
    throw new Error("consumed required for finish action");
  }
  requireField(params.finishedDate, "finishedDate");

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    currentConsumed: params.currentConsumed,
    consumed: params.consumed,
    assignedTo: params.assignedTo,
    finishedDate: params.finishedDate,
    comment: params.comment,
  });

  const item = await runtime.client.post<Record<string, unknown>>(
    `/tasks/${params.taskId}/finish`,
    body,
  );

  return {
    action: "finish",
    resourceType: "task",
    taskId: params.taskId,
    executionId: params.executionId ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function closeTask(runtime: ZentaoRuntime, params: TaskParams) {
  if (params.taskId === undefined) {
    throw new Error("taskId required for close action");
  }

  assertWriteAllowed(runtime, params.action, params);

  const body = compactObject({
    comment: params.comment,
  });

  const item = await runtime.client.post<Record<string, unknown>>(
    `/tasks/${params.taskId}/close`,
    body,
  );

  return {
    action: "close",
    resourceType: "task",
    taskId: params.taskId,
    executionId: params.executionId ?? null,
    reason: params.reason ?? null,
    changedFields: Object.keys(body),
    item,
  };
}

async function fetchTaskList(runtime: ZentaoRuntime, executionId: number | undefined) {
  const path = executionId !== undefined ? `/executions/${executionId}/tasks` : "/tasks";
  return runtime.client.get<ZentaoTaskListResponse>(path);
}

function assertWriteAllowed(runtime: ZentaoRuntime, action: string, params: TaskParams) {
  enforceWriteAllowed(runtime.config, action);
  enforceReasonIfRequired(runtime.config, action, params.reason);
  enforceScopeIfConfigured(runtime.config, {
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
  for (const key of ["name", "title", "status", "type"] as const) {
    const value = item[key];
    if (typeof value === "string" && value.toLowerCase().includes(needle)) {
      return true;
    }
  }
  return false;
}
