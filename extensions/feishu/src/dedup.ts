// Prevent duplicate processing when WebSocket reconnects or Feishu redelivers messages.
// Key format: `${accountId}:${messageId}` to allow different accounts to process the same message
const DEDUP_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEDUP_MAX_SIZE = 1_000;
const DEDUP_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // cleanup every 5 minutes
const processedMessageIds = new Map<string, number>(); // `${accountId}:${messageId}` -> timestamp
let lastCleanupTime = Date.now();

export function tryRecordMessage(messageId: string, accountId?: string): boolean {
  const now = Date.now();
  const key = accountId ? `${accountId}:${messageId}` : messageId;

  // Throttled cleanup: evict expired entries at most once per interval.
  if (now - lastCleanupTime > DEDUP_CLEANUP_INTERVAL_MS) {
    for (const [id, ts] of processedMessageIds) {
      if (now - ts > DEDUP_TTL_MS) {
        processedMessageIds.delete(id);
      }
    }
    lastCleanupTime = now;
  }

  if (processedMessageIds.has(key)) {
    return false;
  }

  // Evict oldest entries if cache is full.
  if (processedMessageIds.size >= DEDUP_MAX_SIZE) {
    const first = processedMessageIds.keys().next().value!;
    processedMessageIds.delete(first);
  }

  processedMessageIds.set(key, now);
  return true;
}
