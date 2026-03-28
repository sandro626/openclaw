import type { OpenClawConfig, PluginLogger } from "../api.js";
import { createZentaoClient } from "./client.js";
import type { ZentaoConfig, ZentaoCredential } from "./config-schema.js";
import { ZentaoError } from "./errors.js";
import type { ZentaoResolvedConfig, ZentaoRuntime, ZentaoRuntimeManager } from "./types.js";

type CreateZentaoRuntimeManagerOptions = {
  config: ZentaoConfig;
  rootConfig: OpenClawConfig;
  logger: PluginLogger;
};

export function createZentaoRuntimeManager({
  config,
  rootConfig,
  logger,
}: CreateZentaoRuntimeManagerOptions): ZentaoRuntimeManager {
  const runtimeCache = new Map<string, ZentaoRuntime>();

  return {
    config,
    logger,
    getRuntimeForAgent(agentId?: string) {
      const cacheKey = agentId ?? "__default__";
      const cached = runtimeCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const resolvedConfig = resolveZentaoConfigForAgent(config, rootConfig, agentId);
      const runtime: ZentaoRuntime = {
        agentId,
        config: resolvedConfig,
        client: createZentaoClient({
          config: resolvedConfig,
          logger,
        }),
        logger,
      };
      runtimeCache.set(cacheKey, runtime);
      return runtime;
    },
  };
}

export function resolveZentaoConfigForAgent(
  config: ZentaoConfig,
  rootConfig: OpenClawConfig,
  agentId?: string,
): ZentaoResolvedConfig {
  const credential = resolveZentaoCredentialForAgent(config, rootConfig, agentId);
  return {
    baseUrl: config.baseUrl,
    apiVersion: config.apiVersion,
    verifyTls: config.verifyTls,
    requestTimeoutMs: config.requestTimeoutMs,
    mode: config.mode,
    allowedProducts: [...config.allowedProducts],
    allowedProjects: [...config.allowedProjects],
    allowedExecutions: [...config.allowedExecutions],
    writeGuards: { ...config.writeGuards },
    account: credential.account,
    password: credential.password,
  };
}

export function resolveZentaoCredentialForAgent(
  config: ZentaoConfig,
  rootConfig: OpenClawConfig,
  agentId?: string,
): ZentaoCredential {
  const fromAgentParams = resolveAgentCredentialFromConfig(rootConfig, agentId);
  if (fromAgentParams) {
    return fromAgentParams;
  }

  if (agentId) {
    const byAgent = config.accountsByAgent[agentId];
    if (byAgent) {
      return byAgent;
    }
  }

  if (config.account && config.password) {
    return {
      account: config.account,
      password: config.password,
    };
  }

  if (agentId) {
    throw new ZentaoError(`No Zentao credentials configured for agent "${agentId}"`);
  }

  throw new ZentaoError(
    "No default Zentao credentials configured and tool context did not include an agentId",
  );
}

function resolveAgentCredentialFromConfig(
  rootConfig: OpenClawConfig,
  agentId?: string,
): ZentaoCredential | undefined {
  if (!agentId) {
    return undefined;
  }

  const raw = rootConfig.agents?.list?.find((agent) => agent.id === agentId)?.params?.zentao;
  if (raw === undefined) {
    return undefined;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ZentaoError(
      `Invalid agents.list entry for "${agentId}": params.zentao must be an object`,
    );
  }

  const { account, password } = raw as {
    account?: unknown;
    password?: unknown;
  };
  if (typeof account !== "string" || typeof password !== "string" || !account || !password) {
    throw new ZentaoError(
      `Invalid Zentao credentials for agent "${agentId}": params.zentao.account/password are required`,
    );
  }
  return { account, password };
}
