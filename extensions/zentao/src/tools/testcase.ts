import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { stringEnum } from "../../../../src/agents/schema/typebox.js";
import { enforceScopeIfConfigured, enforceWriteAllowed } from "../guardrails.js";
import { zentaoErrorResult, zentaoJsonResult } from "../result.js";
import type { ZentaoRuntime, ZentaoToolResult } from "../types.js";

const TESTCASE_ACTIONS = ["list", "get", "create", "update"] as const;

const ZentaoTestcaseToolSchema = Type.Object(
  {
    action: stringEnum(TESTCASE_ACTIONS, {
      description: `Action to perform: ${TESTCASE_ACTIONS.join(", ")}`,
    }),
    productId: Type.Number({ description: "Product ID that owns the test case" }),
    caseId: Type.Optional(Type.Number({ description: "Test case ID for get or update action" })),
    projectId: Type.Optional(Type.Number({ description: "Project ID" })),
    module: Type.Optional(Type.Number({ description: "Module ID" })),
    story: Type.Optional(Type.Number({ description: "Related story ID" })),
    title: Type.Optional(Type.String({ description: "Test case title" })),
    precondition: Type.Optional(Type.String({ description: "Preconditions" })),
    keywords: Type.Optional(Type.String({ description: "Keywords" })),
    pri: Type.Optional(Type.Number({ description: "Priority" })),
    type: Type.Optional(
      stringEnum(["feature", "performance", "install", "security", "other"] as const, {
        description: "Test case type",
      }),
    ),
    auto: Type.Optional(
      stringEnum(["no", "unit", "func", "api"] as const, { description: "Automation level" }),
    ),
    stage: Type.Optional(Type.String({ description: "Applicable stage" })),
    steps: Type.Optional(Type.String({ description: "Step text block" })),
    expected: Type.Optional(Type.String({ description: "Expected result text block" })),
    query: Type.Optional(Type.String({ description: "Optional substring filter" })),
    limit: Type.Optional(Type.Number({ description: "Optional max items to return" })),
  },
  { additionalProperties: false },
);

type TestcaseAction = (typeof TESTCASE_ACTIONS)[number];

type TestcaseParams = {
  action: TestcaseAction;
  productId: number;
  caseId?: number;
  projectId?: number;
  module?: number;
  story?: number;
  title?: string;
  precondition?: string;
  keywords?: string;
  pri?: number;
  type?: string;
  auto?: string;
  stage?: string;
  steps?: string;
  expected?: string;
  query?: string;
  limit?: number;
};

type ZentaoTestcaseListResponse = {
  page?: number;
  total?: number;
  limit?: number;
  testcases?: Array<Record<string, unknown>>;
};

export function createZentaoTestcaseTool(runtime: ZentaoRuntime): AnyAgentTool {
  return {
    name: "zentao_testcase",
    label: "Zentao Testcase",
    description: "List, read, create, and update Zentao test cases by product.",
    parameters: ZentaoTestcaseToolSchema,
    async execute(_toolCallId, rawParams): Promise<ZentaoToolResult> {
      const params = rawParams as TestcaseParams;

      try {
        switch (params.action) {
          case "list":
            return zentaoJsonResult(await listTestcases(runtime, params));
          case "get":
            return zentaoJsonResult(await getTestcase(runtime, params));
          case "create":
            return zentaoJsonResult(await createTestcase(runtime, params));
          case "update":
            return zentaoJsonResult(await updateTestcase(runtime, params));
          default:
            params.action satisfies never;
            return zentaoErrorResult(
              `Unsupported zentao_testcase action: ${String(params.action)}`,
            );
        }
      } catch (error) {
        return zentaoErrorResult(error);
      }
    },
  } as AnyAgentTool;
}

async function listTestcases(runtime: ZentaoRuntime, params: TestcaseParams) {
  const payload = await runtime.client.get<ZentaoTestcaseListResponse>(
    `/products/${params.productId}/testcases`,
  );
  const testcases = payload.testcases ?? [];
  const filtered = filterItems(testcases, params.query, params.limit);

  return {
    action: "list",
    resourceType: "testcase",
    productId: params.productId,
    count: filtered.length,
    page: payload.page ?? null,
    total: payload.total ?? testcases.length,
    limit: payload.limit ?? testcases.length,
    items: filtered,
  };
}

async function getTestcase(runtime: ZentaoRuntime, params: TestcaseParams) {
  if (params.caseId === undefined) {
    throw new Error("caseId required for get action");
  }

  const item = await runtime.client.get<Record<string, unknown>>(`/testcases/${params.caseId}`);
  return {
    action: "get",
    resourceType: "testcase",
    productId: params.productId,
    caseId: params.caseId,
    item,
  };
}

async function createTestcase(runtime: ZentaoRuntime, params: TestcaseParams) {
  requireField(params.title, "title");
  if (params.pri === undefined) {
    throw new Error("pri required");
  }

  assertWriteAllowed(runtime, params);
  const normalizedSteps = buildTestcaseSteps(params.steps, params.expected);

  const body = compactObject({
    product: params.productId,
    project: params.projectId,
    module: params.module,
    story: params.story,
    title: params.title,
    precondition: params.precondition,
    keywords: params.keywords,
    pri: params.pri,
    type: params.type,
    auto: params.auto,
    stage: params.stage,
    steps: normalizedSteps,
  });

  const item = await runtime.client.post<Record<string, unknown>>("/testcases", body);

  return {
    action: "create",
    resourceType: "testcase",
    productId: params.productId,
    changedFields: Object.keys(body),
    item,
  };
}

async function updateTestcase(runtime: ZentaoRuntime, params: TestcaseParams) {
  if (params.caseId === undefined) {
    throw new Error("caseId required for update action");
  }

  assertWriteAllowed(runtime, params);
  const normalizedSteps = buildTestcaseSteps(params.steps, params.expected);

  const body = compactObject({
    project: params.projectId,
    module: params.module,
    story: params.story,
    title: params.title,
    precondition: params.precondition,
    keywords: params.keywords,
    pri: params.pri,
    type: params.type,
    auto: params.auto,
    stage: params.stage,
    steps: normalizedSteps,
  });

  if (Object.keys(body).length === 0) {
    throw new Error("No writable fields provided for update action");
  }

  const item = await runtime.client.request<Record<string, unknown>>({
    method: "PUT",
    path: `/testcases/${params.caseId}`,
    body,
  });

  return {
    action: "update",
    resourceType: "testcase",
    productId: params.productId,
    caseId: params.caseId,
    changedFields: Object.keys(body),
    item,
  };
}

function assertWriteAllowed(runtime: ZentaoRuntime, params: TestcaseParams) {
  enforceWriteAllowed(runtime.config, params.action);
  enforceScopeIfConfigured(runtime.config, {
    productId: params.productId,
    projectId: params.projectId,
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
  for (const key of ["title", "status", "type", "precondition"] as const) {
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
  value: Record<string, string | number | Array<{ desc: string; expect: string }> | undefined>,
): Record<string, string | number | Array<{ desc: string; expect: string }>> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Record<string, string | number | Array<{ desc: string; expect: string }>>;
}

function buildTestcaseSteps(steps: string | undefined, expected: string | undefined) {
  if (!steps?.trim() && !expected?.trim()) {
    return undefined;
  }

  return [
    {
      desc: steps?.trim() ?? "",
      expect: expected?.trim() ?? "",
    },
  ];
}
