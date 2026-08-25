import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DEFAULT_CREDENTIAL_REF } from '../src/constants.js'
import {
  WxPairingSession,
  disconnectPairing,
  readPairingStatus,
  resolvePairingOptions,
} from '../src/pairing-service.js'
import { StateStore } from '../src/state.js'
import { isLosslessToolOutput } from '../src/tool-output.js'
import { credentialsPath } from '../src/credential-file.js'

function createMockClient(sequence) {
  let pollIndex = 0
  return {
    async getQrCode() {
      return { qrcode: 'qr-token', qrcode_img_content: 'qr-content' }
    },
    async pollQrStatus() {
      const next = sequence[pollIndex]
      pollIndex += 1
      return next ?? { status: 'wait' }
    },
  }
}

test('resolvePairingOptions defaults qr port and workspace', () => {
  const options = resolvePairingOptions({ agentCwd: 'E:/workspace' }, { qrPort: 3081 })
  assert.equal(options.agentCwd.replace(/\\/g, '/'), 'E:/workspace')
  assert.equal(options.qrPort, 3081)
  assert.equal(options.permissionPreset, 'workspace-write')
})

test('QrProxyServer registers host routes without binding a port', async () => {
  const routes = []
  const webServer = {
    host: '127.0.0.1',
    port: 3080,
    register(route) {
      routes.push(route)
      return () => {
        const index = routes.indexOf(route)
        if (index >= 0) routes.splice(index, 1)
      }
    },
  }
  const proxy = new (await import('../src/qr-proxy.js')).QrProxyServer({ webServer })
  await proxy.start()
  assert.equal(proxy.hosted, true)
  assert.equal(routes.length, 2)
  assert.equal(routes[0]?.path, '/api/wx-clawbot/pairing')
  await proxy.stop()
  assert.equal(routes.length, 0)
})

test('WxPairingSession uses webServer routes when provided', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wx-host-'))
  const routes = []
  const webServer = {
    host: '127.0.0.1',
    port: 3080,
    register(route) {
      routes.push(route)
      return () => {
        const index = routes.indexOf(route)
        if (index >= 0) routes.splice(index, 1)
      }
    },
  }
  const options = resolvePairingOptions({
    stateDir: join(root, 'state'),
    dshHome: root,
    webServer,
  })
  const session = new WxPairingSession(options, {
    client: createMockClient([{ status: 'wait' }]),
  })
  await session.start()
  assert.equal(routes.length, 2)
  assert.equal(session.pairingPageUrlLocal, 'http://127.0.0.1:3080/api/wx-clawbot/pairing')
  assert.equal(session.pairingImageUrlLocal, 'http://127.0.0.1:3080/api/wx-clawbot/pairing-qr.png')
  await session.cancel()
  assert.equal(routes.length, 0)
  await rm(root, { recursive: true, force: true })
})

test('WxPairingSession completes pairing and persists credentials', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wx-pair-'))
  const stateDir = join(root, 'state')
  const dshHome = root
  const options = resolvePairingOptions({
    stateDir,
    dshHome,
    agentCwd: join(root, 'workspace'),
    qrPort: 0,
  })
  const client = createMockClient([
    { status: 'scaned' },
    {
      status: 'confirmed',
      bot_token: 'token-abc',
      ilink_bot_id: 'bot-1',
      ilink_user_id: 'user-1',
      baseurl: 'https://ilinkai.weixin.qq.com',
    },
  ])
  const session = new WxPairingSession(options, { client })
  await session.start()
  assert.equal(session.phase, 'waiting_scan')
  assert.ok(session.pairingPageUrls.length > 0)

  await session.step({})
  assert.equal(session.phase, 'scanned')

  const done = await session.step({})
  assert.equal(done.paired, true)
  assert.equal(done.phase, 'confirmed')

  const status = await readPairingStatus(options)
  assert.equal(status.paired, true)
  assert.equal(status.accountId, 'bot-1')

  const credentials = await readFile(credentialsPath(dshHome), 'utf8')
  assert.match(credentials, /WX_CLAWBOT_BOT_TOKEN/)
  assert.match(credentials, /token-abc/)

  await disconnectPairing(options)
  const cleared = await readPairingStatus(options)
  assert.equal(cleared.paired, false)
  await rm(root, { recursive: true, force: true })
})

test('WxPairingSession requests verify code before confirmation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wx-pair-'))
  const options = resolvePairingOptions({ stateDir: join(root, 'state'), dshHome: root, qrPort: 0 })
  const client = createMockClient([
    { status: 'need_verifycode' },
    {
      status: 'confirmed',
      bot_token: 'token-xyz',
      ilink_bot_id: 'bot-2',
      ilink_user_id: 'user-2',
    },
  ])
  const session = new WxPairingSession(options, { client })
  await session.start()
  const needCode = await session.step({})
  assert.equal(needCode.needsVerifyCode, true)
  const done = await session.step({ verifyCode: '123456' })
  assert.equal(done.paired, true)
  await rm(root, { recursive: true, force: true })
})

test('DshWeixinBridge configure reports status and rejects unknown actions', async () => {
  const { DshWeixinBridge } = await import('../src/index.js')
  const root = await mkdtemp(join(tmpdir(), 'wx-bridge-'))
  const bridge = new DshWeixinBridge(
    { credentials: { resolve: async () => null }, logger: { info() {}, warn() {} } },
    {
      enabled: true,
      stateDir: join(root, 'state'),
      credentialRef: DEFAULT_CREDENTIAL_REF,
      agentCwd: root,
    },
    { store: new StateStore(join(root, 'state')) },
  )
  const status = await bridge.configure({ action: 'status' })
  assert.equal(status.paired, false)
  assert.match(status.message, /尚未配对/)
  assert.equal('ownerUserId' in status, false)
  assert.equal(isLosslessToolOutput(status), true)
  await assert.rejects(
    () => bridge.configure({ action: 'nope' }),
    /unknown wx_configure action/,
  )
  await rm(root, { recursive: true, force: true })
})
