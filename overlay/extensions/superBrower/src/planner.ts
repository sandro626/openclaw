import type { SuperBrowerConfig, SuperBrowerSiteProfile } from "./config-schema.js";
import { SuperBrowerError } from "./errors.js";

export type SuperBrowerPlannedStep = {
  action:
    | "navigate"
    | "snapshot"
    | "fill_fields"
    | "toggle"
    | "click"
    | "type_otp"
    | "wait_for"
    | "detect_state"
    | "explain_auth_state"
    | "recover_landing"
    | "capture_diagnostics";
  selector?: string;
  name?: string;
  value?: string;
  url?: string;
  text?: string;
  otp?: string;
  waitForText?: string;
  waitForUrl?: string;
};

export async function planSuperBrowserTask(params: {
  config: SuperBrowerConfig;
  siteProfile: SuperBrowerSiteProfile | null;
  goal: string;
  snapshot: unknown;
}) {
  const planner = params.config.planner;
  if (!planner?.enabled) {
    throw new SuperBrowerError("planner is not enabled for superBrower");
  }

  const apiKey = process.env[planner.apiKeyEnv];
  if (!apiKey) {
    throw new SuperBrowerError(`planner api key missing: ${planner.apiKeyEnv}`);
  }

  const systemPrompt = [
    "You are a browser-task planner.",
    "Return strict JSON only.",
    "Use only these actions: navigate, snapshot, fill_fields, toggle, click, type_otp, wait_for, detect_state, explain_auth_state, recover_landing, capture_diagnostics.",
    `Never exceed ${planner.maxSteps} steps.`,
    "Prefer deterministic actions and site profile selectors when available.",
    "For OTP or MFA pages, prefer waiting on the OTP input selector instead of waiting for visible text.",
    "If the page contains login fields and the goal is to log in, you must produce concrete login actions, not just snapshot or diagnostics.",
    "A login plan should usually include fill_fields for username and password, then toggle or click submit, then wait_for/type_otp if MFA is required, then detect_state or explain_auth_state.",
    "If the task is login-related, end with detect_state or explain_auth_state.",
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      goal: params.goal,
      siteProfile: params.siteProfile,
      snapshot: params.snapshot,
      responseFormat: {
        steps: [
          {
            action:
              "navigate|snapshot|fill_fields|toggle|click|type_otp|wait_for|detect_state|explain_auth_state|recover_landing|capture_diagnostics",
            selector: "optional selector for wait_for/click/toggle/type_otp",
            name: "optional",
            value: "optional",
            url: "optional",
            text: "optional",
            otp: "optional",
            waitForText: "optional",
            waitForUrl: "optional",
          },
        ],
      },
    },
    null,
    2,
  );

  const response = await fetch(`${planner.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: planner.model,
      max_tokens: planner.maxTokens,
      temperature: planner.temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new SuperBrowerError(
      `planner request failed (${response.status} ${response.statusText}): ${rawText.slice(0, 500)}`,
    );
  }

  const payload = JSON.parse(rawText) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content?.find((item) => item.type === "text")?.text?.trim();
  if (!text) {
    throw new SuperBrowerError("planner returned no text content");
  }

  const parsed = parsePlannerJson(text);
  const rawSteps = Array.isArray(parsed?.steps) ? (parsed.steps as SuperBrowerPlannedStep[]) : null;
  const steps = rawSteps
    ? normalizePlannerSteps({
        goal: params.goal,
        snapshot: params.snapshot,
        siteProfile: params.siteProfile,
        steps: rawSteps,
        maxSteps: planner.maxSteps,
      })
    : null;
  if (!steps?.length) {
    throw new SuperBrowerError(`planner returned no usable steps: ${text.slice(0, 500)}`);
  }

  return {
    model: planner.model,
    rawText: text,
    steps: steps as SuperBrowerPlannedStep[],
  };
}

function parsePlannerJson(text: string) {
  try {
    return JSON.parse(text) as { steps?: unknown[] };
  } catch {
    const fenced =
      text.match(/```json\s*([\s\S]*?)```/u)?.[1] ?? text.match(/```([\s\S]*?)```/u)?.[1];
    if (!fenced) {
      return null;
    }
    try {
      return JSON.parse(fenced) as { steps?: unknown[] };
    } catch {
      return null;
    }
  }
}

function normalizePlannerSteps(params: {
  goal: string;
  snapshot: unknown;
  siteProfile: SuperBrowerSiteProfile | null;
  steps: SuperBrowerPlannedStep[];
  maxSteps: number;
}) {
  const normalized = params.steps
    .map((step) => ({
      ...step,
      selector: step.selector ?? undefined,
      name: step.name ?? undefined,
      value: step.value ?? undefined,
      url: step.url ?? undefined,
      text: step.text ?? undefined,
      otp: step.otp ?? undefined,
      waitForText: step.waitForText ?? undefined,
      waitForUrl: step.waitForUrl ?? undefined,
    }))
    .map((step) => normalizeLoginStep(step, params.siteProfile))
    .filter((step) => Boolean(step.action));

  if (!looksLikeLoginTask(params.goal, params.snapshot, params.siteProfile)) {
    return normalized.slice(0, params.maxSteps);
  }

  const hasUsername = normalized.some(
    (step) => step.action === "fill_fields" && step.name === "username",
  );
  const hasPassword = normalized.some(
    (step) => step.action === "fill_fields" && step.name === "password",
  );
  const hasSubmit = normalized.some((step) => step.action === "click" || step.action === "toggle");
  const hasOtpWait = normalized.some(
    (step) =>
      step.action === "wait_for" &&
      (Boolean(step.selector) || Boolean(step.waitForText) || Boolean(step.waitForUrl)),
  );
  const hasStateCheck = normalized.some(
    (step) => step.action === "detect_state" || step.action === "explain_auth_state",
  );

  const fallback: SuperBrowerPlannedStep[] = [];

  if (!hasUsername) {
    fallback.push({
      action: "fill_fields",
      name: "username",
      value: extractGoalValue(params.goal, "username"),
    });
  }
  if (!hasPassword) {
    fallback.push({
      action: "fill_fields",
      name: "password",
      value: extractGoalValue(params.goal, "password"),
    });
  }
  if (!hasSubmit && params.siteProfile?.agreementSelectors[0]) {
    fallback.push({ action: "toggle", selector: params.siteProfile.agreementSelectors[0] });
  }
  if (!hasSubmit) {
    fallback.push({
      action: "click",
      selector: params.siteProfile?.submitSelectors[0],
      text: "下一步",
    });
  }
  if (!hasOtpWait && params.siteProfile?.otpSelectors[0]) {
    fallback.push({ action: "wait_for", selector: params.siteProfile.otpSelectors[0] });
  }
  if (!normalized.some((step) => step.action === "type_otp") && looksLikeOtpGoal(params.goal)) {
    fallback.push({
      action: "type_otp",
      otp: extractGoalOtp(params.goal),
      selector: params.siteProfile?.otpSelectors[0],
    });
  }
  if (!hasStateCheck) {
    fallback.push({ action: "detect_state" });
  }

  return mergeSteps(normalized, fallback).slice(0, params.maxSteps);
}

function normalizeLoginStep(
  step: SuperBrowerPlannedStep,
  siteProfile: SuperBrowerSiteProfile | null,
) {
  if (step.action === "toggle" && siteProfile?.agreementSelectors[0]) {
    return {
      ...step,
      selector: siteProfile.agreementSelectors[0],
    };
  }

  if (step.action === "click" && siteProfile?.submitSelectors[0]) {
    return {
      ...step,
      selector: siteProfile.submitSelectors[0],
    };
  }

  if (
    step.action === "wait_for" &&
    siteProfile?.otpSelectors[0] &&
    ((!step.selector && step.waitForText && /验证码|otp|mfa/iu.test(step.waitForText)) ||
      step.selector !== siteProfile.otpSelectors[0])
  ) {
    return {
      ...step,
      selector: siteProfile.otpSelectors[0],
      waitForText: undefined,
    };
  }

  if (step.action === "type_otp" && siteProfile?.otpSelectors[0]) {
    return {
      ...step,
      selector: siteProfile.otpSelectors[0],
    };
  }

  return step;
}

function mergeSteps(primary: SuperBrowerPlannedStep[], fallback: SuperBrowerPlannedStep[]) {
  const merged = [...primary];
  for (const candidate of fallback) {
    if (
      candidate.action === "fill_fields" &&
      merged.some((step) => step.action === "fill_fields" && step.name === candidate.name)
    ) {
      continue;
    }
    if (
      candidate.action !== "fill_fields" &&
      merged.some((step) => step.action === candidate.action)
    ) {
      continue;
    }
    merged.push(candidate);
  }
  return merged;
}

function looksLikeLoginTask(
  goal: string,
  snapshot: unknown,
  siteProfile: SuperBrowerSiteProfile | null,
) {
  const goalLower = goal.toLowerCase();
  if (goalLower.includes("login") || goal.includes("登录")) {
    return true;
  }
  const inputNames = Array.isArray((snapshot as { inputs?: Array<{ name?: string }> }).inputs)
    ? ((snapshot as { inputs?: Array<{ name?: string }> }).inputs ?? []).map(
        (item) => item.name ?? "",
      )
    : [];
  return (
    inputNames.includes("username") ||
    inputNames.includes("password") ||
    Boolean(siteProfile?.fieldConfigs.find((field) => field.name === "username")) ||
    Boolean(siteProfile?.fieldConfigs.find((field) => field.name === "password"))
  );
}

function looksLikeOtpGoal(goal: string) {
  return (
    goal.includes("验证码") ||
    goal.toLowerCase().includes("otp") ||
    goal.toLowerCase().includes("mfa")
  );
}

function extractGoalValue(goal: string, field: "username" | "password") {
  if (field === "username") {
    return goal.match(/1\d{10}/u)?.[0] ?? "";
  }
  if (field === "password") {
    return goal.match(/密码\s*([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]+)/u)?.[1] ?? "";
  }
  return "";
}

function extractGoalOtp(goal: string) {
  return goal.match(/验证码\s*([0-9]{4,8})/u)?.[1] ?? "";
}
