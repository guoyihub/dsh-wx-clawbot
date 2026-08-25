import assert from 'node:assert/strict'
import test from 'node:test'
import {
  OUTBOX_RETRY_BASE_MS,
  OUTBOX_RETRY_MAX_MS,
  outboxEntryDue,
  outboxRetryDelay,
} from '../src/outbox.js'

test('outbox retry uses bounded exponential backoff', () => {
  assert.equal(outboxRetryDelay(1), OUTBOX_RETRY_BASE_MS)
  assert.equal(outboxRetryDelay(2), OUTBOX_RETRY_BASE_MS * 2)
  assert.equal(outboxRetryDelay(99), OUTBOX_RETRY_MAX_MS)
})

test('outbox due check accepts first attempts and honors retry timestamps', () => {
  const now = Date.now()
  assert.equal(outboxEntryDue({ nextAttemptAt: null }, now), true)
  assert.equal(outboxEntryDue({ nextAttemptAt: new Date(now - 1).toISOString() }, now), true)
  assert.equal(outboxEntryDue({ nextAttemptAt: new Date(now + 1).toISOString() }, now), false)
})
