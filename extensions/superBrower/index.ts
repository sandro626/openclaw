import type { OpenClawPluginApi } from "./api.js";
import { superBrowerConfigSchema } from "./src/config-schema.js";
import { createSuperBrowerRuntime } from "./src/runtime.js";
import { createSuperBrowserTool } from "./src/tool.js";

const plugin = {
  id: "superBrower",
  name: "superBrower",
  description: "Playwright + CDP browser executor with reusable action DSL and site profiles.",
  configSchema: superBrowerConfigSchema,
  register(api: OpenClawPluginApi) {
    const config = superBrowerConfigSchema.parse(api.pluginConfig ?? {});
    const runtime = createSuperBrowerRuntime({ config, logger: api.logger });
    api.registerTool(createSuperBrowserTool(runtime), { name: "super_browser" });
    api.logger.info("superBrower: plugin registered");
  },
};

export default plugin;
