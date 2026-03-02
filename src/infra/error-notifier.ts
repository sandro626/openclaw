/**
 * Error notification module for sending alerts to external channels.
 * Used to notify admins when critical errors occur in the gateway.
 */

type ErrorNotifier = (error: unknown, context: { type: string; message: string }) => Promise<void>;

let globalNotifier: ErrorNotifier | null = null;
let globalNotifyTarget: string | null = null;
let globalNotifyLevel: "fatal" | "error" | "warn" = "error";

/**
 * Register a global error notifier.
 * This will be called when critical errors occur.
 */
export function registerErrorNotifier(notifier: ErrorNotifier | null): void {
  globalNotifier = notifier;
}

/**
 * Set the notification target (e.g., feishu chat ID, webhook URL).
 */
export function setErrorNotifyTarget(target: string | null): void {
  globalNotifyTarget = target;
}

/**
 * Get the current notification target.
 */
export function getErrorNotifyTarget(): string | null {
  return globalNotifyTarget;
}

/**
 * Set minimum notification level.
 */
export function setErrorNotifyLevel(level: "fatal" | "error" | "warn"): void {
  globalNotifyLevel = level;
}

/**
 * Check if a notification should be sent based on level.
 */
function shouldNotify(errorType: string): boolean {
  const levels = ["fatal", "error", "warn"];
  const errorLevel = errorType === "transient" ? "warn" : errorType;
  const configLevel = globalNotifyLevel;

  return levels.indexOf(errorLevel) >= levels.indexOf(configLevel);
}

/**
 * Notify about an error.
 * This is a no-op if no notifier is registered or level is below threshold.
 */
export async function notifyError(error: unknown, context: { type: string; message: string }): Promise<void> {
  if (!globalNotifier || !globalNotifyTarget) {
    return;
  }

  if (!shouldNotify(context.type)) {
    return;
  }

  try {
    await globalNotifier(error, context);
  } catch (notifyError) {
    // Don't let notification errors crash the system
    console.error("[openclaw] Error notification failed:", notifyError);
  }
}

/**
 * Format an error for notification.
 */
export function formatErrorForNotification(error: unknown, context: { type: string; message: string }): string {
  const timestamp = new Date().toISOString();
  const errorStr = error instanceof Error
    ? `${error.message}\n${error.stack ?? ""}`
    : String(error);

  const typeEmoji = context.type === "fatal" ? "🚨" : context.type === "config" ? "⚙️" : "⚠️";

  return `${typeEmoji} **Gateway Error Alert**

**Time**: ${timestamp}
**Type**: ${context.type}
**Message**: ${context.message}

\`\`\`
${errorStr.slice(0, 2000)}
\`\`\``;
}

/**
 * Create an error notifier that sends via HTTP webhook.
 * Supports Feishu webhook format.
 */
export function createWebhookErrorNotifier(webhookUrl: string): ErrorNotifier {
  return async (error: unknown, context: { type: string; message: string }) => {
    const message = formatErrorForNotification(error, context);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          msg_type: "text",
          content: {
            text: message,
          },
        }),
      });

      if (!response.ok) {
        console.error(`[openclaw] Webhook notification failed: ${response.status} ${response.statusText}`);
      }
    } catch (fetchError) {
      console.error("[openclaw] Failed to send webhook error notification:", fetchError);
    }
  };
}

/**
 * Initialize error notification from environment variables.
 * Set OPENCLAW_ERROR_NOTIFY_WEBHOOK to enable.
 *
 * Example:
 *   OPENCLAW_ERROR_NOTIFY_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
 *   OPENCLAW_ERROR_NOTIFY_LEVEL=error
 */
export function initErrorNotification(): void {
  const webhookUrl = process.env.OPENCLAW_ERROR_NOTIFY_WEBHOOK;
  if (!webhookUrl) {
    return;
  }

  const level = (process.env.OPENCLAW_ERROR_NOTIFY_LEVEL as "fatal" | "error" | "warn") ?? "error";

  setErrorNotifyTarget(webhookUrl);
  setErrorNotifyLevel(level);

  const notifier = createWebhookErrorNotifier(webhookUrl);
  registerErrorNotifier(notifier);

  console.log(`[openclaw] Error notification enabled via webhook, level: ${level}`);
}
