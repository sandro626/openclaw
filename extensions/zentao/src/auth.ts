import type { PluginLogger } from "openclaw/plugin-sdk";
import { ZentaoAuthError, ZentaoRequestError } from "./errors.js";
import type { ZentaoAuthState, ZentaoResolvedConfig } from "./types.js";

type CreateTokenResponse = {
  token?: string;
};

export type ZentaoAuthManager = {
  getToken: (signal?: AbortSignal) => Promise<string>;
  invalidateToken: () => void;
};

type CreateAuthManagerOptions = {
  config: ZentaoResolvedConfig;
  logger: PluginLogger;
};

export function createZentaoAuthManager({
  config,
  logger,
}: CreateAuthManagerOptions): ZentaoAuthManager {
  const state: ZentaoAuthState = {};

  return {
    async getToken(signal?: AbortSignal) {
      if (state.token) {
        return state.token;
      }

      const response = await fetch(`${config.baseUrl}/api.php/${config.apiVersion}/tokens`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          account: config.account,
          password: config.password,
        }),
        signal,
      });

      if (!response.ok) {
        throw new ZentaoRequestError(
          `Failed to create Zentao API token: HTTP ${response.status}`,
          response.status,
          `/api.php/${config.apiVersion}/tokens`,
        );
      }

      let payload: CreateTokenResponse;
      try {
        payload = (await response.json()) as CreateTokenResponse;
      } catch (error) {
        throw new ZentaoAuthError(
          `Failed to parse Zentao token response: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (!payload.token) {
        throw new ZentaoAuthError("Zentao token response did not include a token");
      }

      state.token = payload.token;
      state.fetchedAt = Date.now();
      logger.debug?.("zentao: acquired API token");
      return payload.token;
    },

    invalidateToken() {
      state.token = undefined;
      state.fetchedAt = undefined;
      logger.debug?.("zentao: invalidated cached API token");
    },
  };
}
