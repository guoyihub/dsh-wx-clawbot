import assert from 'node:assert/strict'
import test from 'node:test'
import { sendToAuthorizedUser } from '../src/outbound-send.js'

function createBridge() {
  const bridge = {
    state: {
      account: { accountId: 'bot-1', baseUrl: 'https://ilinkai.weixin.qq.com' },
      settings: {
        allowedUsers: ['owner-abcdefgh', 'member-12345678'],
        maxReplyChars: 20,
      },
      deliveryContexts: {
        'owner-abcdefgh': { contextToken: 'ctx-owner', updatedAt: '2026-08-26T00:00:00.000Z' },
        'member-12345678': { contextToken: 'ctx-member', runId: 'run-1', updatedAt: '2026-08-26T00:00:00.000Z' },
      },
    },
    agentOwners: new Map([['agent-owner', 'owner-abcdefgh']]),
    allowed(from) {
      return this.state.settings.allowedUsers.includes(from)
    },
    async ensureReady() {},
    async send(to, text, contextToken, runId) {
      this.delivered.push({ to, text, contextToken, runId })
    },
    delivered: [],
  }
  return bridge
}

test('sendToAuthorizedUser delivers to the owning Weixin user by default', async () => {
  const bridge = createBridge()

  const result = await sendToAuthorizedUser(bridge, {
    agentId: 'agent-owner',
    text: '任务已完成',
  })

  assert.deepEqual(result, { sent: true, to: 'owner-abcdefgh', chunks: 1 })
  assert.deepEqual(bridge.delivered, [{
    to: 'owner-abcdefgh',
    text: '任务已完成',
    contextToken: 'ctx-owner',
    runId: undefined,
  }])
})

test('sendToAuthorizedUser accepts explicit authorized recipient and splits long messages', async () => {
  const bridge = createBridge()

  const result = await sendToAuthorizedUser(bridge, {
    agentId: 'agent-other',
    reference: '2',
    text: '012345678901234567890',
  })

  assert.equal(result.to, 'member-12345678')
  assert.equal(result.chunks, 2)
  assert.equal(bridge.delivered.length, 1)
  assert.equal(bridge.delivered[0].to, 'member-12345678')
  assert.equal(bridge.delivered[0].contextToken, 'ctx-member')
  assert.equal(bridge.delivered[0].runId, 'run-1')
})

test('sendToAuthorizedUser rejects unpaired bridge and empty text', async () => {
  const bridge = createBridge()
  bridge.state.account = {}
  await assert.rejects(
    () => sendToAuthorizedUser(bridge, { agentId: 'agent-owner', text: 'hello' }),
    /尚未配对/,
  )

  const paired = createBridge()
  await assert.rejects(
    () => sendToAuthorizedUser(paired, { agentId: 'agent-owner', text: '   ' }),
    /不能为空/,
  )
})

test('sendToAuthorizedUser requires explicit recipient for non-weixin agents with multiple users', async () => {
  const bridge = createBridge()
  await assert.rejects(
    () => sendToAuthorizedUser(bridge, { agentId: 'web-agent', text: 'hello' }),
    /未指定 to/,
  )
})

test('sendToAuthorizedUser requires cached delivery context for proactive sends', async () => {
  const bridge = createBridge()
  delete bridge.state.deliveryContexts['owner-abcdefgh']
  await assert.rejects(
    () => sendToAuthorizedUser(bridge, { agentId: 'agent-owner', text: 'hello' }),
    /context_token/,
  )
})

test('sendToAuthorizedUser delivers to sole authorized user for web agents', async () => {
  const bridge = createBridge()
  bridge.state.settings.allowedUsers = ['owner-abcdefgh']
  bridge.state.settings.ownerUserId = 'owner-abcdefgh'
  bridge.state.deliveryContexts = {
    'owner-abcdefgh': { contextToken: 'ctx-solo', updatedAt: '2026-08-26T00:00:00.000Z' },
  }

  const result = await sendToAuthorizedUser(bridge, {
    agentId: 'web-agent',
    text: '微信网关连接成功',
  })

  assert.deepEqual(result, { sent: true, to: 'owner-abcdefgh', chunks: 1 })
})
