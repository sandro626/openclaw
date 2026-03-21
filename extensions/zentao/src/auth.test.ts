import { afterEach, describe, expect, it, vi } from "vitest";
import { createZentaoAuthManager } from "./auth.js";
import { ZentaoAuthError, ZentaoRequestError } from "./errors.js";

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

describe("createZentaoAuthManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and caches a token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ token: "token-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const auth = createZentaoAuthManager({ config: baseConfig, logger });

    await expect(auth.getToken()).resolves.toBe("token-1");
    await expect(auth.getToken()).resolves.toBe("token-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/api.php/v1/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        account: "zhongle",
        password: "secret",
      }),
      signal: undefined,
    });
  });

  it("refetches after token invalidation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "token-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: "token-2" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const auth = createZentaoAuthManager({ config: baseConfig, logger });

    await expect(auth.getToken()).resolves.toBe("token-1");
    auth.invalidateToken();
    await expect(auth.getToken()).resolves.toBe("token-2");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws a request error when token creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );

    const auth = createZentaoAuthManager({ config: baseConfig, logger });

    await expect(auth.getToken()).rejects.toEqual(
      expect.objectContaining<Partial<ZentaoRequestError>>({
        name: "ZentaoRequestError",
        status: 401,
        path: "/api.php/v1/tokens",
      }),
    );
  });

  it("throws an auth error when the token response cannot be parsed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error("bad json")),
      }),
    );

    const auth = createZentaoAuthManager({ config: baseConfig, logger });

    await expect(auth.getToken()).rejects.toEqual(
      expect.objectContaining<Partial<ZentaoAuthError>>({
        name: "ZentaoAuthError",
      }),
    );
  });

  it("throws an auth error when the token field is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      }),
    );

    const auth = createZentaoAuthManager({ config: baseConfig, logger });

    await expect(auth.getToken()).rejects.toEqual(
      expect.objectContaining<Partial<ZentaoAuthError>>({
        name: "ZentaoAuthError",
        message: "Zentao token response did not include a token",
      }),
    );
  });
});
