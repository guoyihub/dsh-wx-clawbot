import assert from 'node:assert/strict'
import test from 'node:test'
import { collectAgentReply, limitText } from '../src/agent-reply.js'

test('collectAgentReply selects the latest assistant snapshot inside the turn', () => {
  const events = [
    { seq: 1, type: 'turn/start' },
    { seq: 2, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'draft' }] } } },
    { seq: 3, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'final' }] } } },
    { seq: 4, type: 'turn/end', data: { reason: { kind: 'completed' } } },
  ]
  assert.deepEqual(collectAgentReply(events, 1), { text: 'final', reason: { kind: 'completed' } })
  assert.equal(limitText('abcdef', 4), 'abc…')
})
