import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { stringEnum } from "../../../../src/agents/schema/typebox.js";
import { enforceScopeIfConfigured, enforceWriteAllowed } from "../guardrails.js";
import { zentaoErrorResult, zentaoJsonResult } from "../result.js";
import type { ZentaoRuntime, ZentaoToolResult } from "../types.js";

const STORY_ACTIONS = ["list", "get", "create", "update"] as const;

const ZentaoStoryToolSchema = Type.Object(
  {
    action: stringEnum(STORY_ACTIONS, {
      description: `Action to perform: ${STORY_ACTIONS.join(", ")}`,
    }),
    productId: Type.Number({ description: "Product ID that owns the story" }),
    storyId: Type.Optional(Type.Number({ description: "Story ID for get or update action" })),
    module: Type.Optional(Type.Number({ description: "Module ID" })),
    plan: Type.Optional(Type.String({ description: "Plan ID or comma-joined plan IDs" })),
    source: Type.Optional(
      stringEnum(["customer", "user", "po", "market"] as const, { description: "Story source" }),
    ),
    sourceNote: Type.Optional(Type.String({ description: "Source note" })),
    title: Type.Optional(Type.String({ description: "Story title" })),
    category: Type.Optional(
      stringEnum(
        ["feature", "interface", "performance", "safe", "experience", "improve", "other"] as const,
        { description: "Story category" },
      ),
    ),
    pri: Type.Optional(Type.Number({ description: "Priority" })),
    estimate: Type.Optional(Type.Number({ description: "Estimated hours" })),
    keywords: Type.Optional(Type.String({ description: "Keywords" })),
    spec: Type.Optional(Type.String({ description: "Story specification" })),
    verify: Type.Optional(Type.String({ description: "Verification notes" })),
    assignedTo: Type.Optional(Type.String({ description: "Assignee account" })),
    reviewer: Type.Optional(
      Type.Array(Type.String({ description: "Reviewer account" }), {
        description: "Story reviewers for instances that require review on update",
      }),
    ),
    query: Type.Optional(Type.String({ description: "Optional substring filter" })),
    limit: Type.Optional(Type.Number({ description: "Optional max items to return" })),
  },
  { additionalProperties: false },
);

type StoryAction = (typeof STORY_ACTIONS)[number];

type StoryParams = {
  action: StoryAction;
  productId: number;
  storyId?: number;
  module?: number;
  plan?: string;
  source?: string;
  sourceNote?: string;
  title?: string;
  category?: string;
  pri?: number;
  estimate?: number;
  keywords?: string;
  spec?: string;
  verify?: string;
  assignedTo?: string;
  reviewer?: string[];
  query?: string;
  limit?: number;
};

type ZentaoStoryListResponse = {
  page?: number;
  total?: number;
  limit?: number;
  stories?: Array<Record<string, unknown>>;
};

export function createZentaoStoryTool(runtime: ZentaoRuntime): AnyAgentTool {
  return {
    name: "zentao_story",
    label: "Zentao Story",
    description: "List, read, create, and update Zentao stories by product.",
    parameters: ZentaoStoryToolSchema,
    async execute(_toolCallId, rawParams): Promise<ZentaoToolResult> {
      const params = rawParams as StoryParams;

      try {
        switch (params.action) {
          case "list":
            return zentaoJsonResult(await listStories(runtime, params));
          case "get":
            return zentaoJsonResult(await getStory(runtime, params));
          case "create":
            return zentaoJsonResult(await createStory(runtime, params));
          case "update":
            return zentaoJsonResult(await updateStory(runtime, params));
          default:
            params.action satisfies never;
            return zentaoErrorResult(`Unsupported zentao_story action: ${String(params.action)}`);
        }
      } catch (error) {
        return zentaoErrorResult(error);
      }
    },
  } as AnyAgentTool;
}

async function listStories(runtime: ZentaoRuntime, params: StoryParams) {
  const payload = await fetchStoryList(runtime, params.productId);
  const stories = payload.stories ?? [];
  const filtered = filterItems(stories, params.query, params.limit);

  return {
    action: "list",
    resourceType: "story",
    productId: params.productId,
    count: filtered.length,
    page: payload.page ?? null,
    total: payload.total ?? stories.length,
    limit: payload.limit ?? stories.length,
    items: filtered,
  };
}

async function getStory(runtime: ZentaoRuntime, params: StoryParams) {
  if (params.storyId === undefined) {
    throw new Error("storyId required for get action");
  }

  const item = await runtime.client.get<Record<string, unknown>>(`/stories/${params.storyId}`);
  return {
    action: "get",
    resourceType: "story",
    productId: params.productId,
    storyId: params.storyId,
    item,
  };
}

async function createStory(runtime: ZentaoRuntime, params: StoryParams) {
  requireField(params.title, "title");
  if (params.pri === undefined) {
    throw new Error("pri required");
  }
  requireField(params.category, "category");

  assertWriteAllowed(runtime, params);

  const body = compactObject({
    product: params.productId,
    module: params.module,
    plan: params.plan,
    source: params.source,
    sourceNote: params.sourceNote,
    title: params.title,
    category: params.category,
    pri: params.pri,
    estimate: params.estimate,
    keywords: params.keywords,
    spec: params.spec,
    verify: params.verify,
    assignedTo: params.assignedTo,
    reviewer: params.reviewer,
  });

  const item = await runtime.client.post<Record<string, unknown>>("/stories", body);

  return {
    action: "create",
    resourceType: "story",
    productId: params.productId,
    changedFields: Object.keys(body),
    item,
  };
}

async function updateStory(runtime: ZentaoRuntime, params: StoryParams) {
  if (params.storyId === undefined) {
    throw new Error("storyId required for update action");
  }

  assertWriteAllowed(runtime, params);

  const editBody = compactObject({
    module: params.module,
    plan: params.plan,
    source: params.source,
    sourceNote: params.sourceNote,
    title: params.title,
    category: params.category,
    pri: params.pri,
    estimate: params.estimate,
    keywords: params.keywords,
    assignedTo: params.assignedTo,
    reviewer: params.reviewer,
  });
  const changeBody = compactObject({
    title: params.title,
    spec: params.spec,
    verify: params.verify,
  });

  if (Object.keys(editBody).length === 0 && Object.keys(changeBody).length === 0) {
    throw new Error("No writable fields provided for update action");
  }

  if (Object.keys(editBody).length > 0) {
    await runtime.client.request<Record<string, unknown>>({
      method: "PUT",
      path: `/stories/${params.storyId}`,
      body: editBody,
    });
  }

  if (Object.keys(changeBody).length > 0) {
    await runtime.client.post<Record<string, unknown>>(
      `/stories/${params.storyId}/change`,
      changeBody,
    );
  }

  const item = await runtime.client.get<Record<string, unknown>>(`/stories/${params.storyId}`);

  return {
    action: "update",
    resourceType: "story",
    productId: params.productId,
    storyId: params.storyId,
    changedFields: [...new Set([...Object.keys(editBody), ...Object.keys(changeBody)])],
    item,
  };
}

async function fetchStoryList(runtime: ZentaoRuntime, productId: number) {
  return runtime.client.get<ZentaoStoryListResponse>(`/products/${productId}/stories`);
}

function assertWriteAllowed(runtime: ZentaoRuntime, params: StoryParams) {
  enforceWriteAllowed(runtime.config, params.action);
  enforceScopeIfConfigured(runtime.config, {
    productId: params.productId,
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
  for (const key of ["title", "status", "category", "stage"] as const) {
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
  value: Record<string, string | number | string[] | undefined>,
): Record<string, string | number | string[]> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Record<string, string | number | string[]>;
}
