import type { PluginLogger } from "openclaw/plugin-sdk";
import type { SuperBrowerConfig } from "./config-schema.js";
import { createSuperBrowerSession } from "./executor.js";
import type { SuperBrowerRuntime, SuperBrowerSession } from "./types.js";

export function createSuperBrowerRuntime(params: {
  config: SuperBrowerConfig;
  logger: PluginLogger;
}): SuperBrowerRuntime {
  let sessionPromise: Promise<SuperBrowerSession> | null = null;

  async function getSession() {
    if (!sessionPromise) {
      sessionPromise = createSuperBrowerSession(params.config);
    }
    return await sessionPromise;
  }

  return {
    config: params.config,
    logger: params.logger,
    async getPage() {
      return (await getSession()).page;
    },
    async getDiagnostics() {
      return (await getSession()).diagnostics;
    },
    async close() {
      if (!sessionPromise) {
        return;
      }
      const session = await sessionPromise;
      await session.browser.close();
      sessionPromise = null;
    },
  };
}
