import type { PluginLogger } from "../api.js";
import type { ZentaoConfig, ZentaoCredential } from "./config-schema.js";

export type ZentaoWriteMode = ZentaoConfig["mode"];

export type ZentaoAuthState = {
  token?: string;
  fetchedAt?: number;
};

export type ZentaoRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  signal?: AbortSignal;
};

export type ZentaoClient = {
  request<T>(options: ZentaoRequestOptions): Promise<T>;
  get<T>(path: string, signal?: AbortSignal): Promise<T>;
  post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T>;
};

export type ZentaoRuntime = {
  agentId?: string;
  config: ZentaoResolvedConfig;
  client: ZentaoClient;
  logger: PluginLogger;
};

export type ZentaoResolvedConfig = Omit<ZentaoConfig, "account" | "password" | "accountsByAgent"> &
  ZentaoCredential;

export type ZentaoRuntimeManager = {
  config: ZentaoConfig;
  logger: PluginLogger;
  getRuntimeForAgent(agentId?: string): ZentaoRuntime;
};

export type ZentaoToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details?: unknown;
};
