import { chromium, type Response } from "playwright-core";
import type { SuperBrowerConfig } from "./config-schema.js";
import { SuperBrowerError } from "./errors.js";
import type { SuperBrowerSession } from "./types.js";

export async function createSuperBrowerSession(
  config: SuperBrowerConfig,
): Promise<SuperBrowerSession> {
  const diagnostics = {
    consoleMessages: [],
    requests: [],
    responses: [],
    pageErrors: [],
  };

  if (config.cdpUrl) {
    const browser = await chromium.connectOverCDP(config.cdpUrl, {
      timeout: config.connectTimeoutMs,
    });
    const context = browser.contexts[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(config.actionTimeoutMs);
    attachDiagnostics(page, diagnostics);
    return { browser, page, diagnostics };
  }

  const browser = await chromium.launch({
    channel: config.chromePath ? undefined : "chrome",
    executablePath: config.chromePath,
    headless: config.headless,
    timeout: config.connectTimeoutMs,
    args: ["--no-sandbox", "--disable-dev-shm-usage", ...config.launchArgs],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(config.actionTimeoutMs);
  attachDiagnostics(page, diagnostics);
  return { browser, page, diagnostics };
}

export async function ensureVisibleAndClick(page: SuperBrowerSession["page"], selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.click({ force: true });
      return selector;
    }
  }
  throw new SuperBrowerError(`No clickable selector matched: ${selectors.join(", ")}`);
}

export async function clickWithFallback(
  page: SuperBrowerSession["page"],
  options: {
    selectors?: string[];
    textHints?: string[];
    verify?: () => Promise<boolean>;
    verifyDelayMs?: number;
  },
) {
  const attempts: string[] = [];
  const verifyDelayMs = options.verifyDelayMs ?? 1_200;

  for (const selector of options.selectors ?? []) {
    const locator = page.locator(selector).first();
    attempts.push(`selector:${selector}`);
    if ((await locator.count()) > 0) {
      await locator.click({ force: true });
      if (await verifyClick(page, options.verify, verifyDelayMs)) {
        return { strategy: "selector", value: selector, attempts };
      }
      attempts.push(`verify-failed:selector:${selector}`);
    }
  }

  for (const text of options.textHints ?? []) {
    const roleLocator = page.getByRole("button", { name: text, exact: false }).first();
    attempts.push(`role-button:${text}`);
    if ((await roleLocator.count()) > 0) {
      await roleLocator.click({ force: true });
      if (await verifyClick(page, options.verify, verifyDelayMs)) {
        return { strategy: "role-button", value: text, attempts };
      }
      attempts.push(`verify-failed:role-button:${text}`);
    }

    const textLocator = page.getByText(text, { exact: false }).first();
    attempts.push(`text:${text}`);
    if ((await textLocator.count()) > 0) {
      await textLocator.click({ force: true });
      if (await verifyClick(page, options.verify, verifyDelayMs)) {
        return { strategy: "text", value: text, attempts };
      }
      attempts.push(`verify-failed:text:${text}`);
    }
  }

  const buttonLocator = page.locator("button");
  const buttonCount = Math.min(await buttonLocator.count(), 20);
  for (let index = 0; index < buttonCount; index += 1) {
    const current = buttonLocator.nth(index);
    const text = (await current.innerText()).trim();
    for (const hint of options.textHints ?? []) {
      attempts.push(`button-index:${index}:${text}`);
      if (text && text.includes(hint)) {
        await current.click({ force: true });
        if (await verifyClick(page, options.verify, verifyDelayMs)) {
          return { strategy: "button-index", value: `${index}:${text}`, attempts };
        }
        attempts.push(`verify-failed:button-index:${index}:${text}`);
      }
    }
  }

  throw new SuperBrowerError(`No clickable target matched. Attempts: ${attempts.join(" | ")}`);
}

async function verifyClick(
  page: SuperBrowerSession["page"],
  verify: (() => Promise<boolean>) | undefined,
  verifyDelayMs: number,
) {
  if (!verify) {
    return true;
  }
  await page.waitForTimeout(verifyDelayMs);
  return await verify();
}

function attachDiagnostics(
  page: SuperBrowerSession["page"],
  diagnostics: SuperBrowerSession["diagnostics"],
) {
  page.on("console", (message) => {
    diagnostics.consoleMessages.push({
      type: message.type(),
      text: message.text(),
    });
    trimDiagnostics(diagnostics.consoleMessages);
  });
  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push(error.message);
    trimDiagnostics(diagnostics.pageErrors);
  });
  page.on("request", (request) => {
    diagnostics.requests.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
    });
    trimDiagnostics(diagnostics.requests);
  });
  page.on("response", (response) => {
    void captureResponseDetails(response, diagnostics.responses);
  });
}

function trimDiagnostics<T>(items: T[]) {
  const maxItems = 30;
  if (items.length > maxItems) {
    items.splice(0, items.length - maxItems);
  }
}

async function captureResponseDetails(
  response: Response,
  responses: SuperBrowerSession["diagnostics"]["responses"],
) {
  const headers = await response.allHeaders().catch(() => ({}));
  const contentType = headers["content-type"];
  const record: (typeof responses)[number] = {
    status: response.status(),
    url: response.url(),
    contentType,
  };

  if (shouldCaptureResponseBody(response.url(), contentType)) {
    const bodyText = await response.text().catch(() => "");
    if (bodyText) {
      record.bodySnippet = bodyText.slice(0, 8_000);
    }
  }

  responses.push(record);
  trimDiagnostics(responses);
}

function shouldCaptureResponseBody(url: string, contentType?: string) {
  if (!contentType) {
    return false;
  }

  const lowerContentType = contentType.toLowerCase();
  if (!lowerContentType.includes("application/json") && !lowerContentType.includes("text/")) {
    return false;
  }

  return (
    url.includes("/menus") ||
    url.includes("/auth/") ||
    url.includes("/login") ||
    url.includes("/route") ||
    url.includes("/permission")
  );
}
