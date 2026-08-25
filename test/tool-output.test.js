import assert from 'node:assert/strict'
import test from 'node:test'
import { isLosslessToolOutput, toLosslessToolOutput } from '../src/tool-output.js'

test('toLosslessToolOutput removes undefined object properties', () => {
  assert.deepEqual(toLosslessToolOutput({ ok: true, drop: undefined }), { ok: true })
})

test('toLosslessToolOutput rejects non-finite numbers', () => {
  assert.throws(() => toLosslessToolOutput({ bad: Number.NaN }), /non-lossless number/)
})

test('isLosslessToolOutput accepts nested arrays and objects', () => {
  assert.equal(isLosslessToolOutput({
    users: [{ index: 1, userId: 'u1' }],
    paired: false,
  }), true)
})
