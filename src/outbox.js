export const MAX_OUTBOX_MESSAGES = 100
export const OUTBOX_RETRY_BASE_MS = 5_000
export const OUTBOX_RETRY_MAX_MS = 5 * 60_000

export function outboxRetryDelay(attempts) {
  const exponent = Math.max(0, Math.min(16, Number(attempts) - 1))
  return Math.min(OUTBOX_RETRY_MAX_MS, OUTBOX_RETRY_BASE_MS * (2 ** exponent))
}

export function outboxEntryDue(entry, now = Date.now()) {
  const dueAt = Date.parse(entry?.nextAttemptAt)
  return !Number.isFinite(dueAt) || dueAt <= now
}
