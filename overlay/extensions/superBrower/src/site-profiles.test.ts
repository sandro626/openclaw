import { describe, expect, it } from "vitest";
import { matchSiteProfile, urlMatchesPattern } from "./site-profiles.js";

describe("urlMatchesPattern", () => {
  it("matches wildcard patterns", () => {
    expect(
      urlMatchesPattern(
        "https://bmsys-test.cdyzyc.com/#/auth/login",
        "https://bmsys-test.cdyzyc.com/*",
      ),
    ).toBe(true);
    expect(urlMatchesPattern("https://example.com", "https://bmsys-test.cdyzyc.com/*")).toBe(false);
  });
});

describe("matchSiteProfile", () => {
  const profiles = [
    {
      id: "bmsys-test",
      urlPatterns: ["https://bmsys-test.cdyzyc.com/*"],
      fieldConfigs: [],
      agreementSelectors: [],
      submitSelectors: [],
      otpSelectors: [],
      otpMode: "digits" as const,
      successSignals: [],
      failureSignals: [],
      postLoginCandidates: [],
    },
  ];

  it("matches by id first", () => {
    const result = matchSiteProfile(profiles, "https://example.com", "bmsys-test");
    expect(result.profile?.id).toBe("bmsys-test");
    expect(result.matchedBy).toBe("id");
  });

  it("matches by url pattern", () => {
    const result = matchSiteProfile(profiles, "https://bmsys-test.cdyzyc.com/#/auth/login");
    expect(result.profile?.id).toBe("bmsys-test");
    expect(result.matchedBy).toBe("url");
  });
});
