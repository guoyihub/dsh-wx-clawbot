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
    },
    agentOwners: new Map([['agent-owner', 'owner-abcdefgh']]),
    allowed(from) {
      return this.state.settings.allowedUsers.includes(from)
    },
    async send(to, text) {
      this.delivered.push({ to, text })
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
  assert.deepEqual(bridge.delivered, [{ to: 'owner-abcdefgh', text: '任务已完成' }])
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

test('sendToAuthorizedUser delivers to sole authorized user for web agents', async () => {
  const bridge = createBridge()
  bridge.state.settings.allowedUsers = ['owner-abcdefgh']
  bridge.state.settings.ownerUserId = 'owner-abcdefgh'

  const result = await sendToAuthorizedUser(bridge, {
    agentId: 'web-agent',
    text: '微信网关连接成功',
  })

  assert.deepEqual(result, { sent: true, to: 'owner-abcdefgh', chunks: 1 })
})
