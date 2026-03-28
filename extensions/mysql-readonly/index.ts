import type { OpenClawPluginApi } from "./api.js";
import { mysqlReadonlyConfigSchema } from "./src/config-schema.js";
import { createMysqlReadonlyTool } from "./src/tool.js";

const plugin = {
  id: "mysql-readonly",
  name: "MySQL Readonly",
  description: "Read-only MySQL query plugin for OpenClaw.",
  configSchema: mysqlReadonlyConfigSchema,
  register(api: OpenClawPluginApi) {
    const config = mysqlReadonlyConfigSchema.parse(api.pluginConfig ?? {});
    api.registerTool(createMysqlReadonlyTool({ config, logger: api.logger }), {
      name: "mysql_readonly",
    });
    api.logger.info(`mysql-readonly: plugin registered for ${config.host}/${config.database}`);
  },
};

export default plugin;
