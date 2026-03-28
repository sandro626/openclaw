import type { OpenClawPluginApi } from "./api.js";
import { zentaoConfigSchema } from "./src/config-schema.js";
import { createZentaoRuntimeManager } from "./src/runtime.js";
import { createZentaoBugTool } from "./src/tools/bug.js";
import { createZentaoExecutionTool } from "./src/tools/execution.js";
import { createZentaoMetaTool } from "./src/tools/meta.js";
import { createZentaoProjectTool } from "./src/tools/project.js";
import { createZentaoStoryTool } from "./src/tools/story.js";
import { createZentaoTaskTool } from "./src/tools/task.js";
import { createZentaoTestcaseTool } from "./src/tools/testcase.js";

const plugin = {
  id: "zentao",
  name: "Zentao",
  description: "Zentao RESTful API integration for structured work management.",
  configSchema: zentaoConfigSchema,
  register(api: OpenClawPluginApi) {
    const config = zentaoConfigSchema.parse(api.pluginConfig ?? {});
    const runtimeManager = createZentaoRuntimeManager({
      config,
      rootConfig: api.config,
      logger: api.logger,
    });
    api.registerTool(
      (ctx) => createZentaoMetaTool(runtimeManager.getRuntimeForAgent(ctx.agentId)),
      {
        name: "zentao_meta",
      },
    );
    api.registerTool(
      (ctx) => createZentaoTaskTool(runtimeManager.getRuntimeForAgent(ctx.agentId)),
      {
        name: "zentao_task",
      },
    );
    api.registerTool((ctx) => createZentaoBugTool(runtimeManager.getRuntimeForAgent(ctx.agentId)), {
      name: "zentao_bug",
    });
    api.registerTool(
      (ctx) => createZentaoStoryTool(runtimeManager.getRuntimeForAgent(ctx.agentId)),
      {
        name: "zentao_story",
      },
    );
    api.registerTool(
      (ctx) => createZentaoProjectTool(runtimeManager.getRuntimeForAgent(ctx.agentId)),
      {
        name: "zentao_project",
      },
    );
    api.registerTool(
      (ctx) => createZentaoExecutionTool(runtimeManager.getRuntimeForAgent(ctx.agentId)),
      {
        name: "zentao_execution",
      },
    );
    api.registerTool(
      (ctx) => createZentaoTestcaseTool(runtimeManager.getRuntimeForAgent(ctx.agentId)),
      {
        name: "zentao_testcase",
      },
    );
    api.logger.info(`zentao: plugin registered for ${config.baseUrl}`);
  },
};

export default plugin;
