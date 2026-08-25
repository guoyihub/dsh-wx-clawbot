import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import QRCode from 'qrcode'
import { DEFAULT_BASE_URL, IlinkClient } from './protocol.js'
import { StateStore } from './state.js'
import {
  defaultDshHome,
  hasCredential,
  setCredential,
  unsetCredential,
} from './credential-file.js'
import { DEFAULT_CREDENTIAL_REF, DEFAULT_QR_PORT, PLUGIN_NAME, QR_IMAGE_PATH, QR_PAGE_PATH } from './constants.js'
import { maskUserId } from './control.js'
import { QrProxyServer, pairingUrlFields } from './qr-proxy.js'

/**
 * @typedef {object} PairingOptions
 * @property {string} stateDir
 * @property {string} dshHome
 * @property {string} credentialRef
 * @property {string} agentCwd
 * @property {string} agentPreset
 * @property {'workspace-write' | 'danger-full-access'} permissionPreset
 * @property {number} qrPort
 * @property {string} qrBind
 * @property {string | undefined} [qrBaseUrl]
 * @property {string | undefined} [qrFile]
 * @property {import('./qr-proxy.js').QrProxyServer['webServer']} [webServer]
 * @property {string | undefined} [mobilePublicBaseUrl]
 */

/**
 * Read the Mobile PWA public origin from DSH mobile-pairing settings, when set.
 * @param {string} dshHome
 * @returns {Promise<string | undefined>}
 */
export async function readMobilePublicBaseUrl(dshHome) {
  try {
    const raw = await readFile(join(resolve(dshHome), 'mobile-pairing.json'), 'utf8')
    const parsed = JSON.parse(raw)
    const value = parsed?.mobilePublicBaseUrl
    if (typeof value !== 'string' || !value.trim()) return undefined
    return new URL(value.trim()).origin
  } catch {
    return undefined
  }
}

/**
 * @param {object} [overrides]
 * @param {object} [defaults]
 * @returns {PairingOptions}
 */
export function resolvePairingOptions(overrides = {}, defaults = {}) {
  const dshHome = overrides.dshHome
    ? resolve(overrides.dshHome)
    : (defaults.dshHome ? resolve(defaults.dshHome) : defaultDshHome())
  const stateDir = resolve(overrides.stateDir ?? defaults.stateDir ?? join(dshHome, PLUGIN_NAME))
  const permissionPreset = overrides.permissionPreset ?? defaults.permissionPreset ?? 'workspace-write'
  if (!['workspace-write', 'danger-full-access'].includes(permissionPreset)) {
    throw new Error('permissionPreset must be workspace-write or danger-full-access')
  }
  const qrPort = Number.isFinite(overrides.qrPort) ? overrides.qrPort : (defaults.qrPort ?? DEFAULT_QR_PORT)
  return {
    stateDir,
    dshHome,
    credentialRef: overrides.credentialRef ?? defaults.credentialRef ?? DEFAULT_CREDENTIAL_REF,
    agentCwd: resolve(overrides.agentCwd ?? defaults.agentCwd ?? process.cwd()),
    agentPreset: overrides.agentPreset ?? defaults.agentPreset ?? 'standard',
    permissionPreset,
    qrPort,
    qrBind: overrides.qrBind ?? defaults.qrBind ?? '0.0.0.0',
    qrBaseUrl: overrides.qrBaseUrl ?? defaults.qrBaseUrl,
    qrFile: overrides.qrFile ? resolve(overrides.qrFile) : undefined,
    webServer: overrides.webServer ?? defaults.webServer,
    mobilePublicBaseUrl: overrides.mobilePublicBaseUrl ?? defaults.mobilePublicBaseUrl,
  }
}

/**
 * @param {PairingOptions} options
 */
export async function readPairingStatus(options) {
  const state = await new StateStore(options.stateDir).load()
  const credentialConfigured = await hasCredential(options.credentialRef, { dshHome: options.dshHome })
  return {
    paired: Boolean(state.account?.accountId),
    credentialConfigured,
    ...(state.account?.accountId ? { accountId: state.account.accountId } : {}),
    allowedUsers: state.settings.allowedUsers.length,
    authorizedUsers: state.settings.allowedUsers.map((userId, index) => ({
      index: index + 1,
      userId,
      maskedUserId: maskUserId(userId),
    })),
    ownerUserId: state.settings.ownerUserId ?? undefined,
    sessionCount: Object.keys(state.peers).length,
    agentCwd: state.settings.agentCwd ?? options.agentCwd,
    agentPreset: state.settings.agentPreset ?? options.agentPreset,
    permissionPreset: state.settings.permissionPreset ?? options.permissionPreset,
    stateDir: options.stateDir,
  }
}

/**
 * @param {import('./protocol.js').QrConfirmResponse} response
 * @param {PairingOptions} options
 * @param {StateStore} store
 */
export async function applyPairingSuccess(response, options, store) {
  if (!response.bot_token || !response.ilink_bot_id || !response.ilink_user_id) {
    throw new Error('登录已确认，但微信网关缺少 bot_token、ilink_bot_id 或 ilink_user_id')
  }
  const credentialFile = await setCredential(options.credentialRef, response.bot_token, { dshHome: options.dshHome })
  const state = await store.load()
  state.account = {
    accountId: response.ilink_bot_id,
    userId: response.ilink_user_id,
    baseUrl: response.baseurl || DEFAULT_BASE_URL,
    connectedAt: new Date().toISOString(),
  }
  state.syncBuf = ''
  state.processed = []
  state.peers = {}
  state.settings.allowedUsers = [response.ilink_user_id]
  state.settings.ownerUserId = response.ilink_user_id
  state.settings.agentCwd = options.agentCwd
  state.settings.agentPreset = options.agentPreset
  state.settings.permissionPreset = options.permissionPreset
  await store.save(state)
  return {
    credentialFile,
    accountId: response.ilink_bot_id,
    userId: response.ilink_user_id,
  }
}

/**
 * @param {PairingOptions} options
 */
export async function disconnectPairing(options) {
  const store = new StateStore(options.stateDir)
  const state = await store.load()
  state.account = null
  state.syncBuf = ''
  state.processed = []
  state.peers = {}
  state.settings.allowedUsers = []
  state.settings.ownerUserId = null
  await store.save(state)
  await unsetCredential(options.credentialRef, { dshHome: options.dshHome })
}

/**
 * @param {import('./qr-proxy.js').QrProxyServer} proxy
 * @param {string} qrContent
 * @param {string | undefined} liteUrl
 * @param {string | undefined} qrFile
 */
export async function publishQrToProxy(proxy, qrContent, liteUrl, qrFile) {
  const png = await QRCode.toBuffer(qrContent, { width: 512, margin: 2, type: 'png' })
  proxy.setQr(png, liteUrl)
  if (qrFile) await writeFile(qrFile, png)
  return {
    ...pairingUrlFields(
      proxy.publicUrls(QR_PAGE_PATH),
      proxy.publicUrls(QR_IMAGE_PATH),
    ),
    terminalQr: await QRCode.toString(qrContent, { type: 'terminal', small: true }),
    liteUrl: liteUrl ?? null,
  }
}

export class WxPairingSession {
  /**
   * @param {PairingOptions} options
   * @param {{ client?: IlinkClient, store?: StateStore }} [deps]
   */
  constructor(options, deps = {}) {
    this.options = options
    this.client = deps.client ?? new IlinkClient()
    this.store = deps.store ?? new StateStore(options.stateDir)
    /** @type {QrProxyServer | null} */
    this.proxy = null
    this.qr = null
    this.pollingBaseUrl = DEFAULT_BASE_URL
    this.verifyCode = undefined
    /** @type {'idle' | 'waiting_scan' | 'scanned' | 'need_verify_code' | 'confirmed' | 'failed'} */
    this.phase = 'idle'
    this.message = ''
    this.pairingPageUrls = []
    this.pairingImageUrls = []
    /** @type {string | undefined} */
    this.pairingPageUrlLocal = undefined
    /** @type {string | undefined} */
    this.pairingPageUrlMobile = undefined
    /** @type {string | undefined} */
    this.pairingImageUrlLocal = undefined
    /** @type {string | undefined} */
    this.pairingImageUrlMobile = undefined
    this.terminalQr = ''
    this.liteUrl = null
    this.error = null
    this.result = null
  }

  get active() {
    return this.phase === 'waiting_scan' || this.phase === 'scanned' || this.phase === 'need_verify_code'
  }

  applyPublishedPairingUrls(published) {
    this.pairingPageUrls = published.pairingPageUrls
    this.pairingImageUrls = published.pairingImageUrls
    this.pairingPageUrlLocal = published.pairingPageUrlLocal
    this.pairingPageUrlMobile = published.pairingPageUrlMobile
    this.pairingImageUrlLocal = published.pairingImageUrlLocal
    this.pairingImageUrlMobile = published.pairingImageUrlMobile
  }

  snapshot() {
    return {
      phase: this.phase,
      message: this.message,
      pairingPageUrls: [...this.pairingPageUrls],
      pairingImageUrls: [...this.pairingImageUrls],
      ...(this.pairingPageUrlLocal ? { pairingPageUrlLocal: this.pairingPageUrlLocal } : {}),
      ...(this.pairingPageUrlMobile ? { pairingPageUrlMobile: this.pairingPageUrlMobile } : {}),
      ...(this.pairingImageUrlLocal ? { pairingImageUrlLocal: this.pairingImageUrlLocal } : {}),
      ...(this.pairingImageUrlMobile ? { pairingImageUrlMobile: this.pairingImageUrlMobile } : {}),
      needsVerifyCode: this.phase === 'need_verify_code',
      paired: this.phase === 'confirmed',
      terminalQr: this.terminalQr || undefined,
      liteUrl: this.liteUrl,
      ...(this.result?.accountId ? { accountId: this.result.accountId } : {}),
      error: this.error,
    }
  }

  async start() {
    if (this.active) throw new Error('已有进行中的微信配对会话')
    this.proxy = new QrProxyServer({
      webServer: this.options.webServer,
      mobilePublicBaseUrl: this.options.mobilePublicBaseUrl,
      port: this.options.qrPort,
      bind: this.options.qrBind,
      baseUrl: this.options.qrBaseUrl,
    })
    await this.proxy.start().catch(error => {
      if (!this.options.webServer && error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
        throw new Error(`端口 ${this.options.qrPort} 已被占用；请指定其他 qr_port，或在 Host 内配对以复用 webServer 端口`)
      }
      throw error
    })
    this.qr = await this.client.getQrCode()
    if (!this.qr?.qrcode || !this.qr?.qrcode_img_content) {
      await this.cleanupProxy()
      throw new Error('微信网关没有返回有效二维码')
    }
    const published = await publishQrToProxy(
      this.proxy,
      this.qr.qrcode_img_content,
      this.qr.qrcode_img_content,
      this.options.qrFile,
    )
    this.applyPublishedPairingUrls(published)
    this.terminalQr = published.terminalQr
    this.liteUrl = published.liteUrl
    this.phase = 'waiting_scan'
    this.message = '请让用户直接打开下方完整配对链接（本机或手机）；扫码后再次调用 pair_step。'
    return this.snapshot()
  }

  /**
   * @param {{ verifyCode?: string, signal?: AbortSignal }} [input]
   */
  async step(input = {}) {
    if (!this.active) {
      if (this.phase === 'confirmed') return this.snapshot()
      throw new Error('没有进行中的微信配对会话；请先调用 start_pairing')
    }
    if (input.signal?.aborted) throw new Error('工具调用已取消')
    if (input.verifyCode !== undefined) {
      const code = String(input.verifyCode).trim()
      if (!/^\d+$/.test(code)) throw new Error('配对码只能包含数字')
      this.verifyCode = code
    }
    const response = await this.client.pollQrStatus({
      baseUrl: this.pollingBaseUrl,
      qrcode: this.qr.qrcode,
      verifyCode: this.verifyCode,
    }).catch(error => {
      this.message = `等待扫码时网络波动：${error instanceof Error ? error.message : String(error)}`
      return { status: 'wait' }
    })

    switch (response.status) {
      case 'wait':
        this.message = '仍在等待扫码；请让用户用微信扫描二维码后再次调用 pair_step。'
        break
      case 'scaned':
        this.verifyCode = undefined
        this.phase = 'scanned'
        this.message = '已扫码，正在确认；请稍候再次调用 pair_step。'
        break
      case 'need_verifycode':
        this.phase = 'need_verify_code'
        this.message = '请在手机微信查看数字配对码，并通过 pair_step 传入 verify_code。'
        break
      case 'verify_code_blocked':
        this.phase = 'failed'
        this.error = '配对码多次输入错误，请取消后重新开始配对'
        this.message = this.error
        await this.cleanupProxy()
        break
      case 'scaned_but_redirect':
        if (response.redirect_host) this.pollingBaseUrl = `https://${response.redirect_host}`
        this.message = '已扫码，正在切换网关；请再次调用 pair_step。'
        break
      case 'binded_redirect':
        this.phase = 'failed'
        this.error = '该 ClawBot 已绑定；请先在原绑定端解除后重新配对'
        this.message = this.error
        await this.cleanupProxy()
        break
      case 'expired':
        this.qr = await this.client.getQrCode()
        this.verifyCode = undefined
        this.pollingBaseUrl = DEFAULT_BASE_URL
        if (!this.qr?.qrcode || !this.qr?.qrcode_img_content) {
          this.phase = 'failed'
          this.error = '刷新二维码失败'
          this.message = this.error
          await this.cleanupProxy()
          break
        }
        {
          const published = await publishQrToProxy(
            this.proxy,
            this.qr.qrcode_img_content,
            this.qr.qrcode_img_content,
            this.options.qrFile,
          )
          this.applyPublishedPairingUrls(published)
          this.terminalQr = published.terminalQr
          this.liteUrl = published.liteUrl
          this.phase = 'waiting_scan'
          this.message = '二维码已过期并已刷新；请让用户扫描新的二维码后再次调用 pair_step。'
        }
        break
      case 'confirmed': {
        this.result = await applyPairingSuccess(response, this.options, this.store)
        this.phase = 'confirmed'
        this.message = `微信配对成功。账号 ${this.result.accountId} 已写入凭据并完成授权。`
        await this.cleanupProxy()
        break
      }
      default:
        this.message = `微信返回未知扫码状态：${String(response.status)}`
    }
    return this.snapshot()
  }

  async cancel() {
    await this.cleanupProxy()
    if (this.phase !== 'confirmed') this.phase = 'idle'
    this.message = '微信配对已取消。'
    return this.snapshot()
  }

  async cleanupProxy() {
    if (!this.proxy) return
    const proxy = this.proxy
    this.proxy = null
    await proxy.stop()
  }
}
