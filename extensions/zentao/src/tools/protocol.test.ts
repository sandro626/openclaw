import { describe, expect, it, vi } from "vitest";
import type { ZentaoClient, ZentaoRuntime } from "../types.js";
import { createZentaoBugTool } from "./bug.js";
import { createZentaoExecutionTool } from "./execution.js";
import { createZentaoProjectTool } from "./project.js";
import { createZentaoStoryTool } from "./story.js";
import { createZentaoTaskTool } from "./task.js";
import { createZentaoTestcaseTool } from "./testcase.js";

function createRuntime() {
  const client: ZentaoClient = {
    request: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  };

  const runtime: ZentaoRuntime = {
    config: {
      baseUrl: "https://example.com",
      apiVersion: "v1",
      account: "zhongle",
      password: "secret",
      verifyTls: true,
      requestTimeoutMs: 15_000,
      mode: "read-write",
      allowedProducts: [7],
      allowedProjects: [37],
      allowedExecutions: [38],
      writeGuards: {
        requireReason: true,
        requireScopeMatch: true,
        confirmBeforeDestructive: true,
      },
    },
    client,
    logger: {
      info() {},
      warn() {},
      error() {},
      debug() {},
      child() {
        return this;
      },
    } as ZentaoRuntime["logger"],
  };

  return { runtime, client };
}

function getErrorMessage(result: { details?: unknown }) {
  const details = result.details as { error?: string } | undefined;
  return details?.error ?? "";
}

describe("zentao tool protocol rules", () => {
  it("requires estStarted for task creation before calling the API", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoTaskTool(runtime);

    const result = await tool.execute("test", {
      action: "create",
      executionId: 38,
      name: "Task",
      type: "devel",
      assignedTo: "zhongle",
    });

    expect(getErrorMessage(result)).toContain("estStarted required");
    expect(client.post).not.toHaveBeenCalled();
  });

  it("requires pri and category for story creation", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoStoryTool(runtime);

    const result = await tool.execute("test", {
      action: "create",
      productId: 7,
      title: "Story",
    });

    expect(getErrorMessage(result)).toContain("pri required");
    expect(client.post).not.toHaveBeenCalled();
  });

  it("splits story update between edit and change endpoints", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoStoryTool(runtime);
    vi.mocked(client.request).mockResolvedValue({ id: 91 });
    vi.mocked(client.post).mockResolvedValue({ id: 91 });
    vi.mocked(client.get).mockResolvedValue({
      id: 91,
      title: "Updated story",
      spec: "Updated spec",
      verify: "Updated verify",
    });

    const result = await tool.execute("test", {
      action: "update",
      productId: 7,
      storyId: 91,
      title: "Updated story",
      category: "improve",
      pri: 2,
      spec: "Updated spec",
      verify: "Updated verify",
      reviewer: ["zhongle"],
    });

    expect(client.request).toHaveBeenCalledWith({
      method: "PUT",
      path: "/stories/91",
      body: {
        title: "Updated story",
        category: "improve",
        pri: 2,
        reviewer: ["zhongle"],
      },
    });
    expect(client.post).toHaveBeenCalledWith("/stories/91/change", {
      title: "Updated story",
      spec: "Updated spec",
      verify: "Updated verify",
    });
    expect(client.get).toHaveBeenCalledWith("/stories/91");
    expect((result.details as { changedFields: string[] }).changedFields).toEqual([
      "title",
      "category",
      "pri",
      "reviewer",
      "spec",
      "verify",
    ]);
  });

  it("encodes testcase steps as a Zentao step array on create", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoTestcaseTool(runtime);
    vi.mocked(client.post).mockResolvedValue({ id: 157 });

    await tool.execute("test", {
      action: "create",
      productId: 7,
      projectId: 37,
      title: "Case",
      type: "feature",
      pri: 3,
      steps: "第一步",
      expected: "第一步预期",
    });

    expect(client.post).toHaveBeenCalledWith("/testcases", {
      product: 7,
      project: 37,
      title: "Case",
      pri: 3,
      type: "feature",
      steps: [{ desc: "第一步", expect: "第一步预期" }],
    });
  });

  it("encodes testcase steps as a Zentao step array on update", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoTestcaseTool(runtime);
    vi.mocked(client.request).mockResolvedValue({ id: 157 });

    await tool.execute("test", {
      action: "update",
      productId: 7,
      projectId: 37,
      caseId: 157,
      title: "Case updated",
      type: "feature",
      pri: 2,
      steps: "更新后的步骤",
      expected: "更新后的预期",
    });

    expect(client.request).toHaveBeenCalledWith({
      method: "PUT",
      path: "/testcases/157",
      body: {
        project: 37,
        title: "Case updated",
        pri: 2,
        type: "feature",
        steps: [{ desc: "更新后的步骤", expect: "更新后的预期" }],
      },
    });
  });

  it("requires products, begin, and PM for project creation", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoProjectTool(runtime);

    const result = await tool.execute("test", {
      action: "create",
      name: "Project",
      begin: "2026-03-21",
    });

    expect(getErrorMessage(result)).toContain("products required");
    expect(client.post).not.toHaveBeenCalled();
  });

  it("sends linked products when creating a project", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoProjectTool(runtime);
    vi.mocked(client.post).mockResolvedValue({ id: 41 });

    await tool.execute("test", {
      action: "create",
      name: "Project",
      products: [7],
      model: "scrum",
      begin: "2026-03-21",
      end: "2026-03-28",
      PM: "zhongle",
    });

    expect(client.post).toHaveBeenCalledWith("/projects", {
      name: "Project",
      products: [7],
      model: "scrum",
      begin: "2026-03-21",
      end: "2026-03-28",
      PM: "zhongle",
    });
  });

  it("requires begin for execution creation", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoExecutionTool(runtime);

    const result = await tool.execute("test", {
      action: "create",
      projectId: 37,
      name: "Execution",
    });

    expect(getErrorMessage(result)).toContain("begin required");
    expect(client.post).not.toHaveBeenCalled();
  });

  it("creates executions under the project execution endpoint", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoExecutionTool(runtime);
    vi.mocked(client.post).mockResolvedValue({ id: 40 });

    await tool.execute("test", {
      action: "create",
      projectId: 37,
      name: "Execution",
      begin: "2026-02-21",
      end: "2026-02-28",
      type: "sprint",
    });

    expect(client.post).toHaveBeenCalledWith("/projects/37/executions", {
      name: "Execution",
      type: "sprint",
      begin: "2026-02-21",
      end: "2026-02-28",
    });
  });

  it("requires left for task start and posts to the start endpoint", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoTaskTool(runtime);

    const missingLeft = await tool.execute("test", {
      action: "start",
      taskId: 193,
      executionId: 38,
    });

    expect(getErrorMessage(missingLeft)).toContain("left required");
    expect(client.post).not.toHaveBeenCalled();

    vi.mocked(client.post).mockResolvedValue({ id: 193 });
    await tool.execute("test", {
      action: "start",
      taskId: 193,
      executionId: 38,
      assignedTo: "zhongle",
      realStarted: "2026-03-21",
      consumed: 1,
      left: 2,
      comment: "start task",
    });

    expect(client.post).toHaveBeenCalledWith("/tasks/193/start", {
      assignedTo: "zhongle",
      realStarted: "2026-03-21",
      consumed: 1,
      left: 2,
      comment: "start task",
    });
  });

  it("requires assignedTo, currentConsumed, consumed, and finishedDate for task finish", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoTaskTool(runtime);

    const missingAssignedTo = await tool.execute("test", {
      action: "finish",
      taskId: 193,
      executionId: 38,
    });
    expect(getErrorMessage(missingAssignedTo)).toContain("assignedTo required");
    expect(client.post).not.toHaveBeenCalled();

    vi.mocked(client.post).mockResolvedValue({ id: 193 });
    await tool.execute("test", {
      action: "finish",
      taskId: 193,
      executionId: 38,
      assignedTo: "zhongle",
      currentConsumed: 1,
      consumed: 2,
      finishedDate: "2026-03-21",
      comment: "finish task",
    });

    expect(client.post).toHaveBeenCalledWith("/tasks/193/finish", {
      currentConsumed: 1,
      consumed: 2,
      assignedTo: "zhongle",
      finishedDate: "2026-03-21",
      comment: "finish task",
    });
  });

  it("requires reason for task close and posts to the close endpoint", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoTaskTool(runtime);

    const missingReason = await tool.execute("test", {
      action: "close",
      taskId: 193,
      executionId: 38,
    });

    expect(getErrorMessage(missingReason)).toContain("requires a reason");
    expect(client.post).not.toHaveBeenCalled();

    vi.mocked(client.post).mockResolvedValue({ id: 193 });
    await tool.execute("test", {
      action: "close",
      taskId: 193,
      executionId: 38,
      reason: "test close",
      comment: "closing task",
    });

    expect(client.post).toHaveBeenCalledWith("/tasks/193/close", {
      comment: "closing task",
    });
  });

  it("requires resolution and resolvedBuild for bug resolve", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoBugTool(runtime);

    const missingResolution = await tool.execute("test", {
      action: "resolve",
      productId: 7,
      projectId: 37,
      bugId: 60,
      reason: "resolve bug",
    });

    expect(getErrorMessage(missingResolution)).toContain("resolution required");
    expect(client.post).not.toHaveBeenCalled();

    vi.mocked(client.post).mockResolvedValue({ id: 60 });
    await tool.execute("test", {
      action: "resolve",
      productId: 7,
      projectId: 37,
      bugId: 60,
      resolution: "fixed",
      resolvedBuild: "主干",
      assignedTo: "zhongle",
      comment: "resolved",
      reason: "resolve bug",
    });

    expect(client.post).toHaveBeenCalledWith("/bugs/60/resolve", {
      resolution: "fixed",
      resolvedBuild: "主干",
      assignedTo: "zhongle",
      comment: "resolved",
    });
  });

  it("requires reason for bug close and activate", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoBugTool(runtime);

    const closeMissingReason = await tool.execute("test", {
      action: "close",
      productId: 7,
      projectId: 37,
      bugId: 60,
    });
    expect(getErrorMessage(closeMissingReason)).toContain("requires a reason");

    const activateMissingReason = await tool.execute("test", {
      action: "activate",
      productId: 7,
      projectId: 37,
      bugId: 60,
    });
    expect(getErrorMessage(activateMissingReason)).toContain("requires a reason");
    expect(client.post).not.toHaveBeenCalled();
  });

  it("posts to bug close and activate endpoints when a reason is provided", async () => {
    const { runtime, client } = createRuntime();
    const tool = createZentaoBugTool(runtime);
    vi.mocked(client.post).mockResolvedValue({ id: 60 });

    await tool.execute("test", {
      action: "close",
      productId: 7,
      projectId: 37,
      bugId: 60,
      reason: "close bug",
      comment: "closing bug",
    });
    await tool.execute("test", {
      action: "activate",
      productId: 7,
      projectId: 37,
      bugId: 60,
      reason: "activate bug",
      comment: "activating bug",
    });

    expect(client.post).toHaveBeenNthCalledWith(1, "/bugs/60/close", {
      comment: "closing bug",
    });
    expect(client.post).toHaveBeenNthCalledWith(2, "/bugs/60/activate", {
      comment: "activating bug",
    });
  });
});
