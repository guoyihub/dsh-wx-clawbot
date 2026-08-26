import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BRIDGE_VERSION,
  IlinkClient,
  extractInboundText,
  inboundMessageKey,
  splitText,
} from '../src/protocol.js'

test('getUpdates sends the official iLink envelope and auth headers', async () => {
  let request
  const client = new IlinkClient(async (url, init) => {
    request = { url: String(url), init }
    return new Response(JSON.stringify({ ret: 0, msgs: [], get_updates_buf: 'next' }))
  })
  const result = await client.getUpdates({
    baseUrl: 'https://example.test/base/',
    token: 'secret-token',
    syncBuf: 'cursor',
  })
  assert.equal(result.get_updates_buf, 'next')
  assert.equal(request.url, 'https://example.test/base/ilink/bot/getupdates')
  assert.equal(request.init.headers.Authorization, 'Bearer secret-token')
  assert.equal(request.init.headers.AuthorizationType, 'ilink_bot_token')
  assert.equal(request.init.headers['iLink-App-Id'], 'bot')
  assert.deepEqual(JSON.parse(request.init.body), {
    get_updates_buf: 'cursor',
    base_info: { channel_version: '2.4.6', bot_agent: `DSH/${BRIDGE_VERSION}` },
  })
})

test('sendText preserves context and run identifiers', async () => {
  let body
  const client = new IlinkClient(async (_url, init) => {
    body = JSON.parse(init.body)
    return new Response(JSON.stringify({ ret: 0 }))
  })
  await client.sendText({
    baseUrl: 'https://example.test', token: 'token', to: 'user', text: 'done',
    contextToken: 'context', runId: 'run',
  })
  assert.equal(body.msg.to_user_id, 'user')
  assert.equal(body.msg.context_token, 'context')
  assert.equal(body.msg.run_id, 'run')
  assert.equal(body.msg.item_list[0].text_item.text, 'done')
})

test('sendText rejects non-zero errcode responses', async () => {
  const client = new IlinkClient(async () => new Response(JSON.stringify({ ret: 0, errcode: -2, errmsg: 'throttled' })))
  await assert.rejects(
    () => client.sendText({
      baseUrl: 'https://example.test', token: 'token', to: 'user', text: 'done', contextToken: 'context',
    }),
    /errcode=-2/,
  )
})

test('message helpers extract transcripts, create stable keys, and split Unicode safely', () => {
  assert.equal(extractInboundText({ item_list: [{ type: 3, voice_item: { text: '  语音文本 ' } }] }), '语音文本')
  assert.equal(inboundMessageKey({ message_id: 42 }), 'id:42')
  assert.deepEqual(splitText('A😀B', 2), ['A😀', 'B'])
})
