import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeDeliveryContexts,
  rememberDeliveryContext,
  resolveDeliveryContext,
} from '../src/delivery-context.js'

test('rememberDeliveryContext stores the latest inbound token per user', () => {
  const first = rememberDeliveryContext({}, 'user-1', ' token-a ', 'run-a')
  const second = rememberDeliveryContext(first, 'user-1', 'token-b', undefined)

  assert.equal(first['user-1'].contextToken, 'token-a')
  assert.equal(first['user-1'].runId, 'run-a')
  assert.equal(second['user-1'].contextToken, 'token-b')
  assert.equal(second['user-1'].runId, undefined)
})

test('resolveDeliveryContext rejects missing cached tokens with actionable guidance', () => {
  assert.throws(
    () => resolveDeliveryContext({}, 'user-1'),
    /缺少会话 context_token/,
  )
})

test('normalizeDeliveryContexts drops invalid entries', () => {
  assert.deepEqual(normalizeDeliveryContexts({
    ok: { contextToken: 'ctx', updatedAt: '2026-08-26T00:00:00.000Z' },
    bad: { contextToken: '   ' },
    '': { contextToken: 'ctx' },
  }), {
    ok: { contextToken: 'ctx', updatedAt: '2026-08-26T00:00:00.000Z' },
  })
})
