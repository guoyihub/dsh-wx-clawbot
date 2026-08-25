import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DOCUMENT_VERSION, hasCredential, setCredential, unsetCredential } from '../src/credential-file.js'

test('credential writer stores refs under versioned layout', async () => {
  const dshHome = await mkdtemp(join(tmpdir(), 'wx-clawbot-credentials-'))
  await setCredential('EXISTING_TEST_KEY', 'first', { dshHome })
  await setCredential('WX_CLAWBOT_TEST_TOKEN', 'second', { dshHome })
  assert.equal(await hasCredential('WX_CLAWBOT_TEST_TOKEN', { dshHome }), true)
  await unsetCredential('WX_CLAWBOT_TEST_TOKEN', { dshHome })
  assert.equal(await hasCredential('WX_CLAWBOT_TEST_TOKEN', { dshHome }), false)
  const source = await readFile(join(dshHome, '.credentials.yaml'), 'utf8')
  assert.match(source, new RegExp(`version: ${DOCUMENT_VERSION}`))
  assert.match(source, /refs:\n/)
  assert.match(source, /EXISTING_TEST_KEY: first/)
  assert.doesNotMatch(source, /second/)
  assert.doesNotMatch(source, /^WX_CLAWBOT_TEST_TOKEN:/m)
})

test('credential writer migrates pre-existing versioned refs and removes stale top-level keys', async () => {
  const dshHome = await mkdtemp(join(tmpdir(), 'wx-clawbot-credentials-'))
  const filename = join(dshHome, '.credentials.yaml')
  const { writeFile } = await import('node:fs/promises')
  await writeFile(filename, [
    'version: 1',
    'refs:',
    '  DEEPSEEK_API_KEY: keep-me',
    'WX_CLAWBOT_BOT_TOKEN: migrate-me',
    '',
  ].join('\n'), { encoding: 'utf8', mode: 0o600 })
  await setCredential('WX_CLAWBOT_BOT_TOKEN', 'fresh-token', { dshHome })
  const source = await readFile(filename, 'utf8')
  assert.match(source, /DEEPSEEK_API_KEY: keep-me/)
  assert.match(source, /WX_CLAWBOT_BOT_TOKEN: fresh-token/)
  assert.doesNotMatch(source, /^WX_CLAWBOT_BOT_TOKEN:/m)
})
