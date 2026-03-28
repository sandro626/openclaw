import { describe, expect, it } from "vitest";
import {
  collectRoutePaths,
  deriveRecoveryFailureReason,
  extractResponseCandidates,
  normalizeCandidateUrl,
  summarizeAuthState,
} from "./tool.js";

describe("summarizeAuthState", () => {
  it("classifies authenticated but empty-menu accounts", () => {
    const result = summarizeAuthState({
      signalState: "failure",
      matchedSignal: { type: "title", value: "404" },
      authContext: {
        defaultHomePath: "/screens/school-control/",
        hasAccessToken: true,
        menuCount: 0,
        permissionCount: 0,
        menuPayload: {
          code: "000000",
          msg: "成功",
          data: { menus: [], permissions: [] },
        },
      },
      currentUrl: "https://portal.example.com/#/screens/school-control/",
      currentTitle: "404 - 芯安校园管理后台",
      candidateUrls: ["https://portal.example.com/#/screens/school-control/"],
    });

    expect(result.conclusion).toContain("account has no menus");
    expect(result.observations).toContain("Login token is present in localStorage.");
    expect(result.observations).toContain("Menu count is 0.");
    expect(result.nextActions.some((item) => item.includes("menu permissions"))).toBe(true);
  });

  it("classifies authenticated sessions on invalid default routes", () => {
    const result = summarizeAuthState({
      signalState: "failure",
      matchedSignal: { type: "title", value: "404" },
      authContext: {
        defaultHomePath: "/screens/school-control/",
        hasAccessToken: true,
        menuCount: 3,
        permissionCount: 5,
        menuPayload: {
          code: "000000",
          msg: "成功",
          data: { menus: [{ path: "/dashboard" }], permissions: ["view"] },
        },
      },
      currentUrl: "https://portal.example.com/#/screens/school-control/",
      currentTitle: "404 - 芯安校园管理后台",
      candidateUrls: [
        "https://portal.example.com/#/screens/school-control/",
        "https://portal.example.com/#/dashboard",
      ],
    });

    expect(result.conclusion).toContain("landed on an invalid route");
    expect(result.observations).toContain("Current page title indicates a 404 route.");
    expect(result.nextActions.some((item) => item.includes("known-good route"))).toBe(true);
  });

  it("classifies unauthenticated failures", () => {
    const result = summarizeAuthState({
      signalState: "failure",
      matchedSignal: { type: "text", value: "短信验证码错误" },
      authContext: {
        defaultHomePath: null,
        hasAccessToken: false,
        menuCount: null,
        permissionCount: null,
        menuPayload: null,
      },
      currentUrl: "https://portal.example.com/#/auth/login",
      currentTitle: "登录 - 芯安校园管理后台",
      candidateUrls: [],
    });

    expect(result.conclusion).toContain("Authentication failed");
    expect(result.observations).toContain("No login token detected in localStorage.");
    expect(result.nextActions.some((item) => item.includes("credentials"))).toBe(true);
  });
});

describe("recover_landing helpers", () => {
  it("classifies empty-menu authenticated recovery failures", () => {
    expect(
      deriveRecoveryFailureReason(
        {
          defaultHomePath: "/screens/school-control/",
          hasAccessToken: true,
          menuCount: 0,
          permissionCount: 0,
          menuPayload: {
            code: "000000",
            msg: "成功",
            data: { menus: [], permissions: [] },
          },
        },
        ["https://portal.example.com/#/screens/school-control/"],
      ),
    ).toBe("authenticated_but_menu_empty");
  });

  it("classifies invalid default-home recovery failures", () => {
    expect(
      deriveRecoveryFailureReason(
        {
          defaultHomePath: "/screens/school-control/",
          hasAccessToken: true,
          menuCount: 2,
          permissionCount: 4,
          menuPayload: {
            code: "000000",
            msg: "成功",
            data: { menus: [{ path: "/dashboard" }], permissions: ["view"] },
          },
        },
        ["https://portal.example.com/#/screens/school-control/"],
      ),
    ).toBe("default_home_path_invalid");
  });

  it("extracts route candidates from menu payload responses", () => {
    const candidates = extractResponseCandidates(
      {
        consoleMessages: [],
        requests: [],
        responses: [
          {
            status: 200,
            url: "https://api.example.com/system/user/menus",
            contentType: "application/json",
            bodySnippet: JSON.stringify({
              code: "000000",
              data: {
                menus: [{ path: "/dashboard" }, { children: [{ redirect: "/school/list" }] }],
              },
            }),
          },
        ],
        pageErrors: [],
      },
      "https://portal.example.com",
    );

    expect(candidates).toEqual([
      "https://portal.example.com/#/dashboard",
      "https://portal.example.com/#/school/list",
    ]);
  });

  it("normalizes route paths consistently", () => {
    expect(normalizeCandidateUrl("https://portal.example.com", "/dashboard")).toBe(
      "https://portal.example.com/#/dashboard",
    );
    expect(normalizeCandidateUrl("https://portal.example.com", "#/school/list")).toBe(
      "https://portal.example.com/#/school/list",
    );
  });

  it("collects nested route fields from arbitrary menu payloads", () => {
    expect(
      collectRoutePaths({
        path: "/dashboard",
        children: [{ routePath: "/school/list" }, { meta: { redirectPath: "/report" } }],
      }),
    ).toEqual(["/dashboard", "/school/list", "/report"]);
  });
});
