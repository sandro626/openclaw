import type { PluginLogger } from "../api.js";
import { createZentaoAuthManager } from "./auth.js";
import { ZentaoRequestError } from "./errors.js";
import type { ZentaoClient, ZentaoRequestOptions, ZentaoResolvedConfig } from "./types.js";

type CreateZentaoClientOptions = {
  config: ZentaoResolvedConfig;
  logger: PluginLogger;
};

export function createZentaoClient({ config, logger }: CreateZentaoClientOptions): ZentaoClient {
  const auth = createZentaoAuthManager({ config, logger });

  async function request<T>({
    method = "GET",
    path,
    body,
    signal,
  }: ZentaoRequestOptions): Promise<T> {
    return requestWithRetry<T>({ method, path, body, signal }, true);
  }

  async function requestWithRetry<T>(
    { method = "GET", path, body, signal }: ZentaoRequestOptions,
    allowRetry: boolean,
  ): Promise<T> {
    const token = await auth.getToken(signal);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch(buildUrl(config, path), {
        method,
        headers: {
          "content-type": "application/json",
          Token: token,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: mergeAbortSignals(signal, controller.signal),
      });

      if ((response.status === 401 || response.status === 403) && allowRetry) {
        auth.invalidateToken();
        return requestWithRetry<T>({ method, path, body, signal }, false);
      }

      if (!response.ok) {
        const errorBody = await readErrorBody(response);
        throw new ZentaoRequestError(
          errorBody
            ? `Zentao API request failed: HTTP ${response.status} - ${errorBody}`
            : `Zentao API request failed: HTTP ${response.status}`,
          response.status,
          path,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ZentaoRequestError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new ZentaoRequestError("Zentao API request timed out", 408, path);
      }
      throw new ZentaoRequestError(
        `Zentao API request failed: ${error instanceof Error ? error.message : String(error)}`,
        500,
        path,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    request,
    get<T>(path: string, signal?: AbortSignal) {
      return request<T>({ path, signal });
    },
    post<T>(path: string, body?: unknown, signal?: AbortSignal) {
      return request<T>({ method: "POST", path, body, signal });
    },
  };
}

async function readErrorBody(response: Response): Promise<string | undefined> {
  try {
    const text = (await response.text()).trim();
    if (!text) {
      return undefined;
    }
    return text.length > 400 ? `${text.slice(0, 397)}...` : text;
  } catch {
    return undefined;
  }
}

function buildUrl(config: ZentaoResolvedConfig, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${config.baseUrl}/api.php/${config.apiVersion}${normalizedPath}`;
}

function mergeAbortSignals(
  outerSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
): AbortSignal {
  if (!outerSignal) {
    return timeoutSignal;
  }
  if (outerSignal.aborted) {
    return outerSignal;
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  outerSignal.addEventListener("abort", abort, { once: true });
  timeoutSignal.addEventListener("abort", abort, { once: true });
  return controller.signal;
}
