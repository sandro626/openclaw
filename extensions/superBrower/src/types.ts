import type { Browser, Page } from "playwright-core";
import type { PluginLogger } from "../api.js";
import type { SuperBrowerConfig, SuperBrowerSiteProfile } from "./config-schema.js";

export type SuperBrowerRuntime = {
  config: SuperBrowerConfig;
  logger: PluginLogger;
  getPage(): Promise<Page>;
  getDiagnostics(): Promise<SuperBrowerDiagnostics>;
  close(): Promise<void>;
};

export type SuperBrowerSession = {
  browser: Browser;
  page: Page;
  diagnostics: SuperBrowerDiagnostics;
};

export type SuperBrowerDiagnostics = {
  consoleMessages: Array<{
    type: string;
    text: string;
  }>;
  requests: Array<{
    method: string;
    url: string;
    resourceType: string;
  }>;
  responses: Array<{
    status: number;
    url: string;
    contentType?: string;
    bodySnippet?: string;
  }>;
  pageErrors: string[];
};

export type SuperBrowerResolvedProfile = {
  profile: SuperBrowerSiteProfile | null;
  matchedBy: "id" | "url" | "none";
};
