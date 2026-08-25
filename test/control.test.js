import assert from 'node:assert/strict'
import test from 'node:test'
import {
  maskUserId,
  parseControlCommand,
  parseModelSpecifier,
  resolveAllowedUserReference,
  resolveOutboundRecipient,
  resolveSessionReference,
  searchSessions,
  shortSessionId,
  visibleSessions,
} from '../src/control.js'

const peer = {
  sessionId: 'weixin-bbbbbbbb-2222',
  sessions: [
    { sessionId: 'weixin-aaaaaaaa-1111', title: 'Release notes', cwd: 'D:/docs', createdAt: '2026-08-20T00:00:00.000Z', archivedAt: null },
    { sessionId: 'weixin-bbbbbbbb-2222', title: 'Fix login', cwd: 'D:/app', createdAt: '2026-08-21T00:00:00.000Z', archivedAt: null },
    { sessionId: 'weixin-cccccccc-3333', title: 'Archived release', cwd: 'D:/old', createdAt: '2026-08-22T00:00:00.000Z', archivedAt: '2026-08-22T01:00:00.000Z' },
  ],
}

test('parseControlCommand keeps free-form arguments and rejects non-commands', () => {
  assert.deepEqual(parseControlCommand('/new  手机控制任务  '), { name: 'new', argument: '手机控制任务' })
  assert.deepEqual(parseControlCommand('/cancel'), { name: 'cancel', argument: '' })
  assert.equal(parseControlCommand('do /cancel'), undefined)
  assert.equal(parseControlCommand('/INVALID'), undefined)
})

test('session search matches title, id, and cwd without exposing archives by default', () => {
  assert.deepEqual(searchSessions(peer, 'release').map(item => item.sessionId), ['weixin-aaaaaaaa-1111'])
  assert.deepEqual(searchSessions(peer, 'D:/APP').map(item => item.sessionId), ['weixin-bbbbbbbb-2222'])
  assert.deepEqual(searchSessions(peer, 'cccc', { includeArchived: true }).map(item => item.sessionId), ['weixin-cccccccc-3333'])
  assert.deepEqual(searchSessions(peer, 'archived'), [])
})

test('session references use visible activity order and compact id prefixes', () => {
  assert.deepEqual(visibleSessions(peer).map(item => item.sessionId), [
    'weixin-bbbbbbbb-2222',
    'weixin-aaaaaaaa-1111',
  ])
  assert.equal(resolveSessionReference(peer, '1').session.sessionId, 'weixin-bbbbbbbb-2222')
  assert.equal(resolveSessionReference(peer, 'aaaaaaaa').session.sessionId, 'weixin-aaaaaaaa-1111')
  assert.match(resolveSessionReference(peer, '9').error, /没有序号/)
  assert.equal(shortSessionId('weixin-bbbbbbbb-2222'), 'bbbbbbbb')
})

test('model specifier splits only the provider prefix', () => {
  assert.deepEqual(parseModelSpecifier('openai/org/model'), { provider: 'openai', model: 'org/model' })
  assert.equal(parseModelSpecifier('missing-separator'), undefined)
  assert.equal(parseModelSpecifier('/model'), undefined)
})

test('allowed user references support list positions and unique prefixes', () => {
  const settings = { allowedUsers: ['owner-abcdefgh', 'member-12345678', 'member-87654321'] }
  assert.equal(resolveAllowedUserReference(settings, '2').userId, 'member-12345678')
  assert.equal(resolveAllowedUserReference(settings, 'member-1').userId, 'member-12345678')
  assert.match(resolveAllowedUserReference(settings, 'member').error, /不唯一/)
  assert.equal(maskUserId('owner-abcdefgh'), 'owne…efgh')
  assert.equal(resolveAllowedUserReference({ allowedUsers: ['solo-user-id'] }, '0').userId, 'solo-user-id')
})

test('resolveOutboundRecipient prefers explicit to and falls back to agent owner', () => {
  const settings = { allowedUsers: ['owner-abcdefgh', 'member-12345678'] }
  const owners = new Map([['agent-1', 'owner-abcdefgh']])
  assert.equal(resolveOutboundRecipient(settings, owners, 'agent-1', undefined), 'owner-abcdefgh')
  assert.equal(resolveOutboundRecipient(settings, owners, 'agent-1', '2'), 'member-12345678')
  assert.throws(
    () => resolveOutboundRecipient(settings, owners, 'agent-2', undefined),
    /未指定 to/,
  )
})

test('resolveOutboundRecipient falls back to sole authorized user for web agents', () => {
  const settings = { allowedUsers: ['solo-user-id'], ownerUserId: 'solo-user-id' }
  assert.equal(resolveOutboundRecipient(settings, new Map(), 'web-agent', undefined), 'solo-user-id')
  assert.equal(resolveOutboundRecipient(settings, new Map(), 'web-agent', '0'), 'solo-user-id')
})
