import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { StateStore, normalizeState } from '../src/state.js'

test('normalizeState rejects unsafe permission values and bounds history', () => {
  const normalized = normalizeState({
    version: 1,
    processed: Array.from({ length: 700 }, (_, index) => `m${index}`),
    settings: { permissionPreset: 'unrestricted', maxReplyChars: 99999, allowedUsers: ['u', 'u', ''] },
  }, { agentCwd: 'C:/workspace', maxReplyChars: 3800 })
  assert.equal(normalized.settings.permissionPreset, 'workspace-write')
  assert.equal(normalized.settings.maxReplyChars, 3800)
  assert.deepEqual(normalized.settings.allowedUsers, ['u'])
  assert.equal(normalized.settings.ownerUserId, 'u')
  assert.equal(normalized.processed.length, 500)
})

test('normalizeState preserves bounded authorization audit and repairs owner identity', () => {
  const audit = Array.from({ length: 205 }, (_, index) => ({
    id: `a${index}`,
    at: '2026-08-22T00:00:00.000Z',
    actor: 'owner',
    action: 'test',
  }))
  const normalized = normalizeState({
    version: 1,
    settings: { allowedUsers: ['owner', 'member'], ownerUserId: 'missing' },
    audit,
  })

  assert.equal(normalized.settings.ownerUserId, 'owner')
  assert.equal(normalized.audit.length, 200)
  assert.equal(normalized.audit[0].id, 'a5')
})

test('normalizeState bounds and sanitizes the durable outbound queue', () => {
  const normalized = normalizeState({
    version: 1,
    outbox: [
      { id: '', to: 'user', text: 'invalid' },
      ...Array.from({ length: 105 }, (_, index) => ({
        id: `m${index}`,
        to: 'user',
        text: `reply ${index}`,
        attempts: index,
        createdAt: '2026-08-22T00:00:00.000Z',
      })),
    ],
  })

  assert.equal(normalized.outbox.length, 100)
  assert.equal(normalized.outbox[0].id, 'm5')
  assert.equal(normalized.outbox.at(-1).id, 'm104')
  assert.equal(normalized.outbox[0].nextAttemptAt, null)
})

test('StateStore atomically round-trips account and peer metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wx-clawbot-state-'))
  const store = new StateStore(directory, { agentCwd: 'C:/workspace' })
  const state = await store.load()
  state.account = { accountId: 'bot', userId: 'user', baseUrl: 'https://example.test' }
  state.settings.allowedUsers = ['user']
  state.outbox.push({ id: 'reply-1', to: 'user', text: 'done', createdAt: new Date().toISOString(), attempts: 0 })
  state.peers['bot:user'] = { sessionId: 'session-1' }
  await store.save(state)
  const loaded = await store.load()
  assert.equal(loaded.account.accountId, 'bot')
  assert.equal(loaded.peers['bot:user'].sessionId, 'session-1')
  assert.equal(loaded.outbox[0].text, 'done')
  assert.match(await readFile(join(directory, 'state.json'), 'utf8'), /"allowedUsers"/)
})

test('normalizeState migrates the original single-session peer without changing its id', () => {
  const normalized = normalizeState({
    version: 1,
    peers: {
      'bot:user': {
        sessionId: 'weixin-existing',
        agentPreset: 'standard',
        createdAt: '2026-08-20T00:00:00.000Z',
        lastSeenAt: '2026-08-21T00:00:00.000Z',
      },
    },
    settings: {
      agentCwd: 'D:/workspace',
      agentPreset: 'standard',
      permissionPreset: 'workspace-write',
    },
  })
  const peer = normalized.peers['bot:user']
  assert.equal(peer.sessionId, 'weixin-existing')
  assert.equal(peer.sessions.length, 1)
  assert.deepEqual(peer.sessions[0], {
    sessionId: 'weixin-existing',
    title: null,
    createdAt: '2026-08-20T00:00:00.000Z',
    lastSeenAt: '2026-08-21T00:00:00.000Z',
    agentPreset: 'standard',
    cwd: 'D:/workspace',
    permissionPreset: 'workspace-write',
    archivedAt: null,
  })
  assert.equal(peer.nextPreset, 'standard')
  assert.equal(peer.nextCwd, 'D:/workspace')
})

test('normalizeState preserves a multi-session peer and filters unsafe records', () => {
  const normalized = normalizeState({
    version: 1,
    peers: {
      p: {
        sessionId: 'weixin-b',
        nextPreset: 'minimal',
        nextCwd: 'D:/next',
        sessions: [
          { sessionId: 'weixin-a', permissionPreset: 'danger-full-access', model: { provider: 'p', model: 'm' } },
          { sessionId: 'weixin-b', permissionPreset: 'invalid' },
          { sessionId: 'weixin-b', title: 'duplicate' },
          { title: 'missing id' },
        ],
      },
    },
    settings: { agentCwd: 'D:/default', agentPreset: 'standard' },
  })
  const peer = normalized.peers.p
  assert.equal(peer.sessionId, 'weixin-b')
  assert.equal(peer.sessions.length, 2)
  assert.equal(peer.sessions[0].permissionPreset, 'danger-full-access')
  assert.deepEqual(peer.sessions[0].model, { provider: 'p', model: 'm' })
  assert.equal(peer.sessions[1].permissionPreset, 'workspace-write')
  assert.equal(peer.nextPreset, 'minimal')
  assert.equal(peer.nextCwd, 'D:/next')
})
