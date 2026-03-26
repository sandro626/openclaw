import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "openclaw/plugin-sdk";
import { stringEnum } from "../../../src/agents/schema/typebox.js";
import type { SuperBrowerSiteProfile } from "./config-schema.js";
import { SuperBrowerError } from "./errors.js";
import { clickWithFallback, ensureVisibleAndClick } from "./executor.js";
import { planSuperBrowserTask } from "./planner.js";
import { superBrowerErrorResult, superBrowerJsonResult } from "./result.js";
import { matchSiteProfile } from "./site-profiles.js";
import type { SuperBrowerRuntime } from "./types.js";

const SUPER_BROWSER_ACTIONS = [
  "list_site_profiles",
  "get_site_profile",
  "navigate",
  "snapshot",
  "fill_fields",
  "toggle",
  "click",
  "type_otp",
  "wait_for",
  "plan_task",
  "execute_goal",
  "detect_state",
  "explain_auth_state",
  "recover_landing",
  "capture_diagnostics",
  "run_plan",
] as const;

const SuperBrowserFieldSchema = Type.Object(
  {
    name: Type.String(),
    value: Type.String(),
    selector: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const SuperBrowserPlanStepSchema = Type.Object(
  {
    action: stringEnum(SUPER_BROWSER_ACTIONS),
    selector: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    value: Type.Optional(Type.String()),
    url: Type.Optional(Type.String()),
    text: Type.Optional(Type.String()),
    goal: Type.Optional(Type.String()),
    otp: Type.Optional(Type.String()),
    waitForText: Type.Optional(Type.String()),
    waitForUrl: Type.Optional(Type.String()),
    fields: Type.Optional(Type.Array(SuperBrowserFieldSchema)),
  },
  { additionalProperties: false },
);

const SuperBrowserToolSchema = Type.Object(
  {
    action: stringEnum(SUPER_BROWSER_ACTIONS),
    siteProfileId: Type.Optional(Type.String()),
    url: Type.Optional(Type.String()),
    selector: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    text: Type.Optional(Type.String()),
    goal: Type.Optional(Type.String()),
    otp: Type.Optional(Type.String()),
    waitForText: Type.Optional(Type.String()),
    waitForUrl: Type.Optional(Type.String()),
    maxCandidates: Type.Optional(Type.Number()),
    timeoutMs: Type.Optional(Type.Number()),
    fields: Type.Optional(Type.Array(SuperBrowserFieldSchema)),
    steps: Type.Optional(Type.Array(SuperBrowserPlanStepSchema)),
  },
  { additionalProperties: false },
);

type SuperBrowserAction = (typeof SUPER_BROWSER_ACTIONS)[number];

type SuperBrowserField = {
  name: string;
  value: string;
  selector?: string;
};

type SuperBrowserParams = {
  action: SuperBrowserAction;
  siteProfileId?: string;
  url?: string;
  selector?: string;
  name?: string;
  text?: string;
  goal?: string;
  otp?: string;
  waitForText?: string;
  waitForUrl?: string;
  maxCandidates?: number;
  timeoutMs?: number;
  fields?: SuperBrowserField[];
  steps?: Array<{
    action: SuperBrowserAction;
    selector?: string;
    name?: string;
    value?: string;
    url?: string;
    text?: string;
    goal?: string;
    otp?: string;
    waitForText?: string;
    waitForUrl?: string;
    fields?: SuperBrowserField[];
  }>;
};

export function createSuperBrowserTool(runtime: SuperBrowerRuntime): AnyAgentTool {
  return {
    name: "super_browser",
    label: "superBrower",
    description: "Reusable Playwright + CDP browser executor with action DSL and site profiles.",
    parameters: SuperBrowserToolSchema,
    async execute(_toolCallId, rawParams) {
      const params = rawParams as SuperBrowserParams;
      try {
        return superBrowerJsonResult(await executeAction(runtime, params));
      } catch (error) {
        return superBrowerErrorResult(error);
      }
    },
  } as AnyAgentTool;
}

async function executeAction(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  if (params.action === "list_site_profiles") {
    return runtime.config.siteProfiles.map((profile) => ({
      id: profile.id,
      urlPatterns: profile.urlPatterns,
      otpMode: profile.otpMode,
    }));
  }

  if (params.action === "get_site_profile") {
    if (!params.siteProfileId) {
      throw new SuperBrowerError("siteProfileId is required for get_site_profile");
    }
    return (
      runtime.config.siteProfiles.find((profile) => profile.id === params.siteProfileId) ?? null
    );
  }

  const page = await runtime.getPage();

  if (params.timeoutMs) {
    page.setDefaultTimeout(params.timeoutMs);
  }

  switch (params.action) {
    case "navigate":
      if (!params.url) {
        throw new SuperBrowerError("url is required for navigate");
      }
      await page.goto(params.url, { waitUntil: "domcontentloaded" });
      return await snapshotPage(runtime, params.siteProfileId);
    case "snapshot":
      return await snapshotPage(runtime, params.siteProfileId);
    case "fill_fields":
      return await fillFields(runtime, params);
    case "toggle":
      return await toggleSelector(runtime, params);
    case "click":
      return await clickSelector(runtime, params);
    case "type_otp":
      return await typeOtp(runtime, params);
    case "wait_for":
      return await waitFor(runtime, params);
    case "plan_task":
      return await planTask(runtime, params);
    case "execute_goal":
      return await executeGoal(runtime, params);
    case "detect_state":
      return await detectState(runtime, params);
    case "explain_auth_state":
      return await explainAuthState(runtime, params);
    case "recover_landing":
      return await recoverLanding(runtime, params);
    case "capture_diagnostics":
      return await captureDiagnostics(runtime, params);
    case "run_plan":
      return await runPlan(runtime, params);
    default:
      params.action satisfies never;
      throw new SuperBrowerError(`Unsupported action: ${String(params.action)}`);
  }
}

async function snapshotPage(runtime: SuperBrowerRuntime, siteProfileId?: string) {
  const page = await runtime.getPage();
  const text = ((await page.locator("body").innerText()) || "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, runtime.config.snapshotMaxLength);
  const inputs = await collectElements(page, "input");
  const buttons = await collectElements(page, "button");
  const resolvedProfile = matchSiteProfile(runtime.config.siteProfiles, page.url(), siteProfileId);
  return {
    url: page.url(),
    title: await page.title(),
    text,
    inputs,
    buttons,
    siteProfile: resolvedProfile.profile?.id ?? null,
    siteProfileMatchedBy: resolvedProfile.matchedBy,
  };
}

async function collectElements(
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
  selector: string,
) {
  const locator = page.locator(selector);
  const count = Math.min(await locator.count(), 12);
  const items = [];
  for (let index = 0; index < count; index += 1) {
    const current = locator.nth(index);
    items.push({
      index,
      text: selector === "button" ? (await current.innerText()).trim() : undefined,
      name: await current.getAttribute("name"),
      placeholder: await current.getAttribute("placeholder"),
      type: await current.getAttribute("type"),
    });
  }
  return items;
}

async function fillFields(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  if (!params.fields?.length) {
    throw new SuperBrowerError("fields is required for fill_fields");
  }
  const page = await runtime.getPage();
  const profile = resolveProfile(runtime.config.siteProfiles, page.url(), params.siteProfileId);
  const filled = [];
  for (const field of params.fields) {
    const selector = field.selector ?? resolveFieldSelector(profile, field.name);
    if (!selector) {
      throw new SuperBrowerError(`No selector resolved for field: ${field.name}`);
    }
    await page.locator(selector).first().fill(field.value);
    filled.push({ name: field.name, selector });
  }
  return {
    success: true,
    filled,
    page: await snapshotPage(runtime, params.siteProfileId),
  };
}

async function toggleSelector(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  const page = await runtime.getPage();
  const profile = resolveProfile(runtime.config.siteProfiles, page.url(), params.siteProfileId);
  const selectors = params.selector ? [params.selector] : (profile?.agreementSelectors ?? []);
  const textHints = params.text ? [params.text] : ["我已阅读并同意", "用户服务协议", "同意"];
  if (!selectors.length && !textHints.length) {
    throw new SuperBrowerError(
      "selector or site profile agreementSelectors is required for toggle",
    );
  }
  try {
    const beforeState = await detectToggleState(page, selectors);
    const result = selectors.length
      ? await clickWithFallback(page, {
          selectors,
          textHints,
          verify: async () => {
            const afterState = await detectToggleState(page, selectors);
            if (beforeState == null || afterState == null) {
              return true;
            }
            return beforeState !== afterState;
          },
        })
      : await clickWithFallback(page, { textHints });
    return { success: true, strategy: result.strategy, target: result.value };
  } catch (error) {
    throw new SuperBrowerError(
      `toggle failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function clickSelector(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  const page = await runtime.getPage();
  const profile = resolveProfile(runtime.config.siteProfiles, page.url(), params.siteProfileId);
  const selectors = params.selector ? [params.selector] : (profile?.submitSelectors ?? []);
  const textHints = params.text ? [params.text] : ["下一步", "登录", "提交", "确认"];
  if (!selectors.length && !textHints.length) {
    throw new SuperBrowerError("selector or site profile submitSelectors is required for click");
  }
  try {
    const verify = buildPostClickVerifier(runtime, page, profile);
    const result = selectors.length
      ? await clickWithFallback(page, { selectors, textHints, verify })
      : await clickWithFallback(page, { textHints, verify });
    return { success: true, strategy: result.strategy, target: result.value };
  } catch (error) {
    const snapshot = await snapshotPage(runtime, params.siteProfileId);
    const diagnostics = await runtime.getDiagnostics();
    throw new SuperBrowerError(
      `click failed: ${error instanceof Error ? error.message : String(error)}; available buttons=${JSON.stringify(snapshot.buttons)}; recent requests=${JSON.stringify(diagnostics.requests)}`,
    );
  }
}

async function typeOtp(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  if (!params.otp) {
    throw new SuperBrowerError("otp is required for type_otp");
  }
  const page = await runtime.getPage();
  const profile = resolveProfile(runtime.config.siteProfiles, page.url(), params.siteProfileId);
  const selectors = [
    ...(params.selector ? [params.selector] : []),
    ...(profile?.otpSelectors ?? []).filter((selector) => selector !== params.selector),
  ];
  if (!selectors.length) {
    throw new SuperBrowerError("selector or site profile otpSelectors is required for type_otp");
  }

  const mode = profile?.otpMode ?? "digits";
  const resolvedInputs = await resolveOtpInputs(page, selectors);
  const count = resolvedInputs.count;

  if (mode === "digits" && count >= params.otp.length) {
    for (let index = 0; index < params.otp.length; index += 1) {
      await resolvedInputs.locator.nth(index).fill(params.otp[index] ?? "");
    }
    return { success: true, mode, count: params.otp.length, selector: resolvedInputs.selector };
  }

  if (count >= 1) {
    await resolvedInputs.locator.first().fill(params.otp);
    return {
      success: true,
      mode: "single",
      count: 1,
      selector: resolvedInputs.selector,
    };
  }

  throw new SuperBrowerError("No OTP input matched the configured selectors");
}

async function waitFor(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  const page = await runtime.getPage();
  if (params.selector) {
    await page.locator(params.selector).first().waitFor();
  }
  if (params.waitForUrl) {
    await page.waitForURL(params.waitForUrl);
  }
  if (params.waitForText) {
    await page.getByText(params.waitForText).first().waitFor();
  }
  return await snapshotPage(runtime, params.siteProfileId);
}

async function planTask(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  if (!params.goal) {
    throw new SuperBrowerError("goal is required for plan_task");
  }
  const page = await runtime.getPage();
  const profile = resolveProfile(runtime.config.siteProfiles, page.url(), params.siteProfileId);
  const snapshot = await snapshotPage(runtime, params.siteProfileId);
  return await planSuperBrowserTask({
    config: runtime.config,
    siteProfile: profile,
    goal: params.goal,
    snapshot,
  });
}

async function executeGoal(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  const plan = await planTask(runtime, params);
  const results = [];
  for (const step of plan.steps) {
    results.push(
      await executeAction(runtime, {
        ...params,
        ...step,
        fields:
          step.fields ??
          (step.action === "fill_fields" && step.name && step.value
            ? [{ name: step.name, value: step.value, selector: step.selector }]
            : params.fields),
      }),
    );
  }
  return {
    success: true,
    model: plan.model,
    plannedSteps: plan.steps,
    results,
  };
}

async function detectState(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  const page = await runtime.getPage();
  const profile = resolveProfile(runtime.config.siteProfiles, page.url(), params.siteProfileId);
  const snapshot = await snapshotPage(runtime, params.siteProfileId);
  const result = await evaluateSignals(runtime, page, profile);
  const authContext = await collectAuthContext(runtime, page);
  return {
    ...snapshot,
    state: result.state,
    matchedSignal: result.matchedSignal,
    authContext,
  };
}

async function explainAuthState(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  const page = await runtime.getPage();
  const profile = resolveProfile(runtime.config.siteProfiles, page.url(), params.siteProfileId);
  const snapshot = await snapshotPage(runtime, params.siteProfileId);
  const signalState = await evaluateSignals(runtime, page, profile);
  const authContext = await collectAuthContext(runtime, page);
  const candidateUrls = profile ? await buildRecoveryCandidates(runtime, page, profile) : [];
  const summary = summarizeAuthState({
    signalState: signalState.state,
    matchedSignal: signalState.matchedSignal,
    authContext,
    currentUrl: page.url(),
    currentTitle: await page.title(),
    candidateUrls,
  });

  return {
    summary,
    snapshot,
    signalState: signalState.state,
    matchedSignal: signalState.matchedSignal,
    authContext,
    candidateUrls,
  };
}

async function recoverLanding(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  const page = await runtime.getPage();
  const profile = resolveProfile(runtime.config.siteProfiles, page.url(), params.siteProfileId);
  if (!profile) {
    throw new SuperBrowerError("recover_landing requires a matching site profile");
  }

  const currentState = await evaluateSignals(runtime, page, profile);
  const authContext = await collectAuthContext(runtime, page);
  if (currentState.state === "success") {
    return {
      recovered: false,
      reason: "already_on_successful_page",
      authContext,
      snapshot: await snapshotPage(runtime, params.siteProfileId),
    };
  }

  const maxCandidates = Math.max(1, Math.min(params.maxCandidates ?? 10, 20));
  const authSignal = await findFirstMatchingSignal(runtime, page, profile.successSignals);
  if (!authSignal) {
    return {
      recovered: false,
      reason: "no_authenticated_state_detected",
      currentState,
      authContext,
      snapshot: await snapshotPage(runtime, params.siteProfileId),
    };
  }

  const candidates = (await buildRecoveryCandidates(runtime, page, profile)).slice(
    0,
    maxCandidates,
  );
  const attempts = [];

  for (const candidate of candidates) {
    await page.goto(candidate, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const state = await evaluateSignals(runtime, page, profile);
    attempts.push({
      candidate,
      state: state.state,
      matchedSignal: state.matchedSignal,
      url: page.url(),
      title: await page.title(),
    });
    if (state.state === "success") {
      return {
        recovered: true,
        candidate,
        state: state.state,
        matchedSignal: state.matchedSignal,
        attempts,
        snapshot: await snapshotPage(runtime, params.siteProfileId),
      };
    }
  }

  return {
    recovered: false,
    reason: deriveRecoveryFailureReason(authContext, candidates),
    currentState,
    authSignal,
    authContext,
    attempts,
    snapshot: await snapshotPage(runtime, params.siteProfileId),
  };
}

async function captureDiagnostics(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  const page = await runtime.getPage();
  const diagnostics = await runtime.getDiagnostics();
  const cookies = await page.context().cookies();
  const storage = await page.evaluate(() => ({
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage },
  }));

  return buildCaptureDiagnosticsResult({
    snapshot: await snapshotPage(runtime, params.siteProfileId),
    cookies,
    storage,
    diagnostics,
  });
}

async function runPlan(runtime: SuperBrowerRuntime, params: SuperBrowserParams) {
  if (!params.steps?.length) {
    throw new SuperBrowerError("steps is required for run_plan");
  }
  const results = [];
  for (const step of params.steps) {
    results.push(
      await executeAction(runtime, {
        ...params,
        ...step,
        fields:
          step.fields ??
          (step.action === "fill_fields" && step.name && step.value
            ? [{ name: step.name, value: step.value, selector: step.selector }]
            : params.fields),
        text: step.text ?? params.text,
      }),
    );
  }
  return { success: true, results };
}

function resolveProfile(profiles: SuperBrowerSiteProfile[], url: string, siteProfileId?: string) {
  return matchSiteProfile(profiles, url, siteProfileId).profile;
}

function resolveFieldSelector(profile: SuperBrowerSiteProfile | null, name: string) {
  return profile?.fieldConfigs.find((item) => item.name === name)?.selectors[0];
}

async function evaluateSignals(
  runtime: SuperBrowerRuntime,
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
  profile: SuperBrowerSiteProfile | null,
) {
  if (!profile) {
    return { state: "unknown", matchedSignal: null };
  }

  for (const signal of profile.failureSignals) {
    if (await signalMatches(runtime, page, signal)) {
      return { state: "failure", matchedSignal: signal };
    }
  }

  for (const signal of profile.successSignals) {
    if (await signalMatches(runtime, page, signal)) {
      return { state: "success", matchedSignal: signal };
    }
  }

  return { state: "unknown", matchedSignal: null };
}

async function findFirstMatchingSignal(
  runtime: SuperBrowerRuntime,
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
  signals: SuperBrowerSiteProfile["successSignals"] | SuperBrowerSiteProfile["failureSignals"],
) {
  for (const signal of signals) {
    if (await signalMatches(runtime, page, signal)) {
      return signal;
    }
  }
  return null;
}

async function signalMatches(
  runtime: SuperBrowerRuntime,
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
  signal: {
    type?:
      | "text"
      | "url"
      | "title"
      | "cookie"
      | "localStorage"
      | "sessionStorage"
      | "request"
      | "response";
    key?: string;
    status?: number;
    value: string;
  },
) {
  switch (signal.type ?? "text") {
    case "url":
      return page.url().includes(signal.value);
    case "title":
      return (await page.title()).includes(signal.value);
    case "text":
      return ((await page.locator("body").innerText()) || "").includes(signal.value);
    case "cookie":
      return (await page.context().cookies()).some((cookie) => {
        if (signal.key && cookie.name !== signal.key) {
          return false;
        }
        return `${cookie.name}=${cookie.value}`.includes(signal.value);
      });
    case "localStorage":
      return await storageSignalMatches(page, "localStorage", signal.key, signal.value);
    case "sessionStorage":
      return await storageSignalMatches(page, "sessionStorage", signal.key, signal.value);
    case "request":
      return (await runtime.getDiagnostics()).requests.some((request) =>
        request.url.includes(signal.value),
      );
    case "response":
      return (await runtime.getDiagnostics()).responses.some((response) => {
        if (signal.status != null && response.status !== signal.status) {
          return false;
        }
        return response.url.includes(signal.value);
      });
    default:
      return false;
  }
}

async function storageSignalMatches(
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
  storageType: "localStorage" | "sessionStorage",
  key: string | undefined,
  value: string,
) {
  const items = (await page.evaluate((currentStorageType) => {
    const storage = currentStorageType === "localStorage" ? localStorage : sessionStorage;
    return Object.entries(storage);
  }, storageType)) as Array<[string, string]>;

  return items.some(([entryKey, entryValue]) => {
    if (key && entryKey !== key) {
      return false;
    }
    return `${entryKey}=${entryValue}`.includes(value);
  });
}

async function resolveOtpInputs(
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
  selectors: string[],
) {
  const attempts: string[] = [];

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();
      attempts.push(`${selector}:${count}`);
      if (count > 0) {
        return { locator, count, selector };
      }
    } catch (error) {
      attempts.push(
        `${selector}:invalid:${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new SuperBrowerError(
    `No OTP input matched the configured selectors: ${attempts.join(" | ")}`,
  );
}

async function hasAnyMatchingSelector(
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
  selectors: string[],
) {
  for (const selector of selectors) {
    try {
      if ((await page.locator(selector).count()) > 0) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

async function detectToggleState(
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
  selectors: string[],
) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) {
        continue;
      }
      const state = await locator.evaluate((element) => {
        const input = element as HTMLInputElement;
        const className = element.className?.toString().toLowerCase() ?? "";
        return {
          ariaChecked: element.getAttribute("aria-checked"),
          dataState: element.getAttribute("data-state"),
          checked: typeof input.checked === "boolean" ? input.checked : undefined,
          className,
        };
      });
      return JSON.stringify(state);
    } catch {
      continue;
    }
  }
  return null;
}

function buildPostClickVerifier(
  runtime: SuperBrowerRuntime,
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
  profile: SuperBrowerSiteProfile | null,
) {
  if (!profile) {
    return undefined;
  }

  const beforeUrl = page.url();

  return async () => {
    if (page.url() !== beforeUrl) {
      return true;
    }

    if (profile.otpSelectors.length && (await hasAnyMatchingSelector(page, profile.otpSelectors))) {
      return true;
    }

    const diagnostics = await runtime.getDiagnostics();
    if (
      diagnostics.requests.some((request) => request.url.includes("/auth/")) ||
      diagnostics.responses.some((response) => response.url.includes("/auth/"))
    ) {
      return true;
    }

    const state = await evaluateSignals(runtime, page, profile);
    return state.state !== "unknown";
  };
}

async function buildRecoveryCandidates(
  runtime: SuperBrowerRuntime,
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
  profile: SuperBrowerSiteProfile,
) {
  const candidates = new Set<string>();
  const origin = new URL(page.url()).origin;

  for (const candidate of profile.postLoginCandidates) {
    candidates.add(candidate);
  }

  for (const candidate of await extractStorageCandidates(page, origin)) {
    candidates.add(candidate);
  }

  for (const candidate of extractResponseCandidates(await runtime.getDiagnostics(), origin)) {
    candidates.add(candidate);
  }

  return Array.from(candidates);
}

async function collectAuthContext(
  runtime: SuperBrowerRuntime,
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
) {
  const storageEntries = (await page.evaluate(() => Object.entries(localStorage))) as Array<
    [string, string]
  >;
  return buildAuthContext(storageEntries, await runtime.getDiagnostics());
}

export function parsePreferences(storageMap: Map<string, string>) {
  for (const [key, value] of storageMap.entries()) {
    if (!key.includes("preferences")) {
      continue;
    }
    try {
      const parsed = JSON.parse(value) as {
        value?: {
          app?: {
            defaultHomePath?: string;
          };
        };
      };
      return {
        defaultHomePath: parsed.value?.app?.defaultHomePath ?? null,
      };
    } catch {
      continue;
    }
  }

  return { defaultHomePath: null };
}

export function extractMenuPayload(
  diagnostics: Awaited<ReturnType<SuperBrowerRuntime["getDiagnostics"]>>,
) {
  for (const response of [...diagnostics.responses].reverse()) {
    if (!response.url.includes("/system/user/menus") || !response.bodySnippet) {
      continue;
    }
    const parsed = safelyParseJson(response.bodySnippet) as {
      code?: string;
      msg?: string;
      data?: {
        menus?: unknown[];
        permissions?: unknown[];
      };
    } | null;
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

export function buildAuthContext(
  storageEntries: Array<[string, string]>,
  diagnostics: Awaited<ReturnType<SuperBrowerRuntime["getDiagnostics"]>>,
) {
  const storageMap = new Map(storageEntries);
  const preferences = parsePreferences(storageMap);
  const menuPayload = extractMenuPayload(diagnostics);

  return {
    defaultHomePath: preferences.defaultHomePath,
    hasAccessToken:
      typeof storageMap.get("vben-web-ele-5.5.9-prod-core-access") === "string" &&
      storageMap.get("vben-web-ele-5.5.9-prod-core-access")!.length > 0,
    menuCount: menuPayload?.data?.menus?.length ?? null,
    permissionCount: menuPayload?.data?.permissions?.length ?? null,
    menuPayload,
  };
}

export function deriveRecoveryFailureReason(
  authContext: Awaited<ReturnType<typeof collectAuthContext>>,
  candidates: string[],
) {
  if (authContext.hasAccessToken && authContext.menuCount === 0) {
    return "authenticated_but_menu_empty";
  }
  if (authContext.defaultHomePath && candidates.length <= 1) {
    return "default_home_path_invalid";
  }
  if (candidates.length === 0) {
    return "no_recovery_candidates";
  }
  return "no_candidate_reached_success";
}

export function summarizeAuthState(params: {
  signalState: "success" | "failure" | "unknown";
  matchedSignal: unknown;
  authContext: Awaited<ReturnType<typeof collectAuthContext>>;
  currentUrl: string;
  currentTitle: string;
  candidateUrls: string[];
}) {
  const { signalState, matchedSignal, authContext, currentUrl, currentTitle, candidateUrls } =
    params;

  const observations: string[] = [];
  const nextActions: string[] = [];

  if (authContext.hasAccessToken) {
    observations.push("Login token is present in localStorage.");
  } else {
    observations.push("No login token detected in localStorage.");
  }

  if (authContext.menuCount != null) {
    observations.push(`Menu count is ${authContext.menuCount}.`);
  }

  if (authContext.permissionCount != null) {
    observations.push(`Permission count is ${authContext.permissionCount}.`);
  }

  if (authContext.defaultHomePath) {
    observations.push(`Default home path is ${authContext.defaultHomePath}.`);
  }

  if (currentTitle.includes("404")) {
    observations.push("Current page title indicates a 404 route.");
  }

  if (signalState === "failure" && matchedSignal) {
    observations.push(`A failure signal matched: ${JSON.stringify(matchedSignal)}.`);
  } else if (signalState === "success" && matchedSignal) {
    observations.push(`A success signal matched: ${JSON.stringify(matchedSignal)}.`);
  }

  let conclusion = "Auth state is inconclusive.";

  if (authContext.hasAccessToken && authContext.menuCount === 0) {
    conclusion =
      "Authentication succeeded, but the account has no menus. This is an account or backend configuration issue, not a browser execution issue.";
    nextActions.push("Check backend role assignment and menu permissions for this account.");
    nextActions.push("Check whether the configured default home path exists for this account.");
  } else if (authContext.hasAccessToken && currentTitle.includes("404")) {
    conclusion =
      "Authentication succeeded, but the frontend landed on an invalid route. The route mapping or default home path is wrong.";
    nextActions.push("Check frontend route availability for the default home path.");
    nextActions.push("Try a known-good route from menus or site configuration.");
  } else if (!authContext.hasAccessToken && signalState === "failure") {
    conclusion = "Authentication failed before a usable login state was created.";
    nextActions.push("Check credentials, MFA code, and failure text on the page.");
  } else if (authContext.hasAccessToken && signalState === "success") {
    conclusion = "Authentication succeeded and the current state looks usable.";
    if (candidateUrls.length > 0) {
      nextActions.push("Continue navigation using recovered candidate routes if needed.");
    }
  } else if (!authContext.hasAccessToken) {
    conclusion = "No authenticated browser state was detected yet.";
    nextActions.push("Retry login flow and capture diagnostics if the issue repeats.");
  }

  if (candidateUrls.length > 0) {
    nextActions.push(`Recovery candidates available: ${candidateUrls.slice(0, 5).join(", ")}`);
  }

  return {
    conclusion,
    observations,
    nextActions,
    currentUrl,
    currentTitle,
  };
}

export function buildCaptureDiagnosticsResult(params: {
  snapshot: unknown;
  cookies: unknown;
  storage: {
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
  };
  diagnostics: Awaited<ReturnType<SuperBrowerRuntime["getDiagnostics"]>>;
}) {
  return {
    snapshot: params.snapshot,
    cookies: params.cookies,
    storage: params.storage,
    consoleMessages: params.diagnostics.consoleMessages,
    requests: params.diagnostics.requests,
    responses: params.diagnostics.responses,
    pageErrors: params.diagnostics.pageErrors,
  };
}

async function extractStorageCandidates(
  page: Awaited<ReturnType<SuperBrowerRuntime["getPage"]>>,
  origin: string,
) {
  const entries = (await page.evaluate(() => Object.entries(localStorage))) as Array<
    [string, string]
  >;
  const candidates = new Set<string>();

  for (const [key, value] of entries) {
    if (!key.includes("preferences")) {
      continue;
    }

    try {
      const parsed = JSON.parse(value) as {
        value?: {
          app?: {
            defaultHomePath?: string;
          };
        };
      };
      const defaultHomePath = parsed.value?.app?.defaultHomePath;
      if (defaultHomePath) {
        candidates.add(normalizeCandidateUrl(origin, defaultHomePath));
      }
    } catch {
      continue;
    }
  }

  return Array.from(candidates);
}

export function extractResponseCandidates(
  diagnostics: Awaited<ReturnType<SuperBrowerRuntime["getDiagnostics"]>>,
  origin: string,
) {
  const candidates = new Set<string>();

  for (const response of diagnostics.responses) {
    if (!response.url.includes("/menus") || !response.bodySnippet) {
      continue;
    }

    const parsed = safelyParseJson(response.bodySnippet);
    if (!parsed) {
      continue;
    }

    for (const path of collectRoutePaths(parsed)) {
      candidates.add(normalizeCandidateUrl(origin, path));
    }
  }

  return Array.from(candidates);
}

function safelyParseJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function collectRoutePaths(value: unknown): string[] {
  const results = new Set<string>();

  const visit = (current: unknown) => {
    if (!current || typeof current !== "object") {
      return;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }
      return;
    }

    const record = current as Record<string, unknown>;
    for (const key of ["path", "route", "routePath", "redirect", "redirectPath"]) {
      const maybePath = record[key];
      if (typeof maybePath === "string" && maybePath.startsWith("/")) {
        results.add(maybePath);
      }
    }

    for (const nestedValue of Object.values(record)) {
      visit(nestedValue);
    }
  };

  visit(value);
  return Array.from(results);
}

export function normalizeCandidateUrl(origin: string, path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (path.startsWith("#/")) {
    return `${origin}/${path}`;
  }
  if (path.startsWith("/")) {
    return `${origin}/#${path}`;
  }
  return `${origin}/#/${path.replace(/^\/+/u, "")}`;
}
