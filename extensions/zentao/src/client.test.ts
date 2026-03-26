import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createZentaoClient } from "./client.js";
import { ZentaoRequestError } from "./errors.js";

const baseConfig = {
  baseUrl: "https://example.com",
  apiVersion: "v1" as const,
  account: "zhongle",
  password: "secret",
  verifyTls: true,
  requestTimeoutMs: 15_000,
  mode: "read-only" as const,
  allowedProducts: [] as number[],
  allowedProjects: [] as number[],
  allowedExecutions: [] as number[],
  writeGuards: {
    requireReason: true,
    requireScopeMatch: true,
    confirmBeforeDestructive: true,
  },
};

const logger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() {
    return this;
  },
};

describe("createZentaoClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("injects the token and serializes the request body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "token-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 1 }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = createZentaoClient({ config: baseConfig, logger });

    await expect(client.post("/bugs", { title: "bug" })).resolves.toEqual({ id: 1 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com/api.php/v1/bugs",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          Token: "token-1",
        },
        body: JSON.stringify({ title: "bug" }),
      }),
    );
  });

  it("retries once on 401 and refreshes the token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "token-1" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("expired"),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "token-2" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 7 }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = createZentaoClient({ config: baseConfig, logger });

    await expect(client.get("/products")).resolves.toEqual({ id: 7 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com/api.php/v1/products",
      expect.objectContaining({
        headers: expect.objectContaining({ Token: "token-1" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://example.com/api.php/v1/products",
      expect.objectContaining({
        headers: expect.objectContaining({ Token: "token-2" }),
      }),
    );
  });

  it("includes the response body in request errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "token-1" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('{"error":"bad request"}'),
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = createZentaoClient({ config: baseConfig, logger });

    await expect(client.get("/products")).rejects.toEqual(
      expect.objectContaining<Partial<ZentaoRequestError>>({
        name: "ZentaoRequestError",
        status: 400,
        path: "/products",
        message: 'Zentao API request failed: HTTP 400 - {"error":"bad request"}',
      }),
    );
  });

  it("converts aborts into timeout errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "token-1" }),
      })
      .mockImplementationOnce(async (_url, init) => {
        const signal = (init as { signal?: AbortSignal }).signal;
        return await new Promise((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = createZentaoClient({
      config: { ...baseConfig, requestTimeoutMs: 10 },
      logger,
    });

    const pending = client.get("/products");
    const assertion = expect(pending).rejects.toEqual(
      expect.objectContaining<Partial<ZentaoRequestError>>({
        name: "ZentaoRequestError",
        status: 408,
        path: "/products",
        message: "Zentao API request timed out",
      }),
    );
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
  });
});
