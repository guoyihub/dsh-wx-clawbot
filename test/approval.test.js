import assert from 'node:assert/strict'
import test from 'node:test'
import { ApprovalInbox, formatApprovalPrompt, normalizeApprovalCode } from '../src/approval.js'

test('approval inbox issues one-time owner-bound decisions', async () => {
  const inbox = new ApprovalInbox({ codeFactory: () => 'a1b2c3d4' })
  const created = inbox.create({
    ownerUserId: 'owner',
    agentId: 'agent-1',
    toolName: 'terminal',
    reason: 'write outside workspace',
  })

  assert.equal(created.pending.code, 'A1B2C3D4')
  assert.match(formatApprovalPrompt(created.pending), /\/approve A1B2C3D4/)
  assert.deepEqual(inbox.decide('other', 'a1b2c3d4', 'allowed-once'), { ok: false })
  assert.equal(inbox.decide('owner', ' a1b2c3d4 ', 'allowed-once').ok, true)
  assert.equal(inbox.decide('owner', 'A1B2C3D4', 'allowed-once').ok, false)
  const result = await created.decision
  assert.equal(result.outcome, 'allowed-once')
  assert.equal(result.actor, 'owner')
})

test('approval inbox fails closed on timeout and cancellation', async () => {
  const timers = []
  const inbox = new ApprovalInbox({
    codeFactory: () => `code-${timers.length}`,
    setTimer: callback => { timers.push(callback); return timers.length - 1 },
    clearTimer: () => {},
  })
  const timed = inbox.create({ ownerUserId: 'owner', agentId: 'a', toolName: 'bash' })
  timers[0]()
  assert.equal((await timed.decision).outcome, 'unavailable')

  const controller = new AbortController()
  const cancelled = inbox.create({ ownerUserId: 'owner', agentId: 'b', toolName: 'bash', signal: controller.signal })
  controller.abort()
  assert.equal((await cancelled.decision).outcome, 'cancelled')
})

test('approval inbox bounds pending requests and normalizes codes', () => {
  const inbox = new ApprovalInbox({ maxPending: 1, codeFactory: () => ' only-one ' })
  assert.ok(inbox.create({ ownerUserId: 'owner', agentId: 'a', toolName: 'bash' }).pending)
  assert.equal(inbox.create({ ownerUserId: 'owner', agentId: 'b', toolName: 'bash' }).error, 'too-many-pending')
  assert.equal(normalizeApprovalCode(' ab-cd '), 'AB-CD')
  inbox.cancelAll()
})
