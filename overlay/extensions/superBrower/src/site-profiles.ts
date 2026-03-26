import type { SuperBrowerSiteProfile } from "./config-schema.js";

export function matchSiteProfile(
  profiles: SuperBrowerSiteProfile[],
  url: string,
  siteProfileId?: string,
) {
  if (siteProfileId) {
    const profile = profiles.find((item) => item.id === siteProfileId) ?? null;
    return { profile, matchedBy: profile ? ("id" as const) : ("none" as const) };
  }

  for (const profile of profiles) {
    if (profile.urlPatterns.some((pattern) => urlMatchesPattern(url, pattern))) {
      return { profile, matchedBy: "url" as const };
    }
  }

  return { profile: null, matchedBy: "none" as const };
}

export function urlMatchesPattern(url: string, pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/gu, "\\$&").replace(/\*/gu, ".*");
  return new RegExp(`^${escaped}$`, "u").test(url);
}
