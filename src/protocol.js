import crypto, { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
export const BRIDGE_VERSION = require('../package.json').version

export const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com'
export const PROTOCOL_VERSION = '2.4.6'
export const DEFAULT_BOT_TYPE = '3'
export const MESSAGE_TYPE_USER = 1
export const MESSAGE_TYPE_BOT = 2
export const ITEM_TYPE_TEXT = 1
export const ITEM_TYPE_VOICE = 3

const APP_ID = 'bot'
const CLIENT_VERSION = (2 << 16) | (4 << 8) | 6

function randomWechatUin() {
  const value = crypto.randomBytes(4).readUInt32BE(0)
  return Buffer.from(String(value), 'utf8').toString('base64')
}

function commonHeaders() {
  return {
    'iLink-App-Id': APP_ID,
    'iLink-App-ClientVersion': String(CLIENT_VERSION),
  }
}

function requestHeaders(token) {
  return {
    'content-type': 'application/json',
    AuthorizationType: 'ilink_bot_token',
    'X-WECHAT-UIN': randomWechatUin(),
    ...commonHeaders(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function baseInfo() {
  return {
    channel_version: PROTOCOL_VERSION,
    bot_agent: `DSH/${BRIDGE_VERSION}`,
  }
}

function combinedSignal(timeoutMs, externalSignal) {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const abort = () => controller.abort()
  externalSignal?.addEventListener('abort', abort, { once: true })
  if (externalSignal?.aborted) controller.abort()
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose() {
      clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', abort)
    },
  }
}

async function jsonRequest(fetchImpl, baseUrl, endpoint, options = {}) {
  const url = new URL(endpoint, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  const timeout = combinedSignal(options.timeoutMs ?? 15_000, options.signal)
  try {
    const response = await fetchImpl(url, {
      method: options.method ?? 'POST',
      headers: options.method === 'GET' ? commonHeaders() : requestHeaders(options.token),
      ...(options.method === 'GET' ? {} : { body: JSON.stringify(options.body ?? {}) }),
      signal: timeout.signal,
    })
    const raw = await response.text()
    if (!response.ok) throw new Error(`${options.label ?? endpoint} HTTP ${response.status}: ${raw.slice(0, 500)}`)
    try {
      return JSON.parse(raw)
    } catch {
      throw new Error(`${options.label ?? endpoint} returned invalid JSON`)
    }
  } catch (error) {
    if (timeout.timedOut() && !options.signal?.aborted) {
      const wrapped = new Error(`${options.label ?? endpoint} timed out`)
      wrapped.name = 'TimeoutError'
      throw wrapped
    }
    throw error
  } finally {
    timeout.dispose()
  }
}

export class IlinkClient {
  constructor(fetchImpl = globalThis.fetch) {
    this.fetch = fetchImpl
  }

  getQrCode(localTokens = [], baseUrl = DEFAULT_BASE_URL) {
    return jsonRequest(this.fetch, baseUrl, `ilink/bot/get_bot_qrcode?bot_type=${DEFAULT_BOT_TYPE}`, {
      body: { local_token_list: localTokens.slice(-10) },
      label: 'get_bot_qrcode',
    })
  }

  pollQrStatus({ baseUrl = DEFAULT_BASE_URL, qrcode, verifyCode, signal }) {
    let endpoint = `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`
    if (verifyCode) endpoint += `&verify_code=${encodeURIComponent(verifyCode)}`
    return jsonRequest(this.fetch, baseUrl, endpoint, {
      method: 'GET',
      timeoutMs: 35_000,
      signal,
      label: 'get_qrcode_status',
    })
  }

  async getUpdates({ baseUrl, token, syncBuf = '', timeoutMs = 35_000, signal }) {
    try {
      return await jsonRequest(this.fetch, baseUrl, 'ilink/bot/getupdates', {
        token,
        timeoutMs,
        signal,
        label: 'getupdates',
        body: { get_updates_buf: syncBuf, base_info: baseInfo() },
      })
    } catch (error) {
      if (error?.name === 'TimeoutError') return { ret: 0, msgs: [], get_updates_buf: syncBuf }
      throw error
    }
  }

  sendText({ baseUrl, token, to, text, contextToken, runId }) {
    return jsonRequest(this.fetch, baseUrl, 'ilink/bot/sendmessage', {
      token,
      label: 'sendmessage',
      body: {
        msg: {
          from_user_id: '',
          to_user_id: to,
          client_id: `wx-clawbot-${randomUUID()}`,
          message_type: MESSAGE_TYPE_BOT,
          message_state: 2,
          item_list: [{ type: ITEM_TYPE_TEXT, text_item: { text } }],
          ...(contextToken ? { context_token: contextToken } : {}),
          ...(runId ? { run_id: runId } : {}),
        },
        base_info: baseInfo(),
      },
    }).then((response) => {
      if (response.ret != null && response.ret !== 0) {
        throw new Error(`sendmessage ret=${response.ret}: ${response.errmsg ?? 'unknown error'}`)
      }
      return response
    })
  }

  notifyStart({ baseUrl, token }) {
    return jsonRequest(this.fetch, baseUrl, 'ilink/bot/msg/notifystart', {
      token,
      timeoutMs: 10_000,
      label: 'notifystart',
      body: { base_info: baseInfo() },
    })
  }

  notifyStop({ baseUrl, token }) {
    return jsonRequest(this.fetch, baseUrl, 'ilink/bot/msg/notifystop', {
      token,
      timeoutMs: 10_000,
      label: 'notifystop',
      body: { base_info: baseInfo() },
    })
  }
}

export function extractInboundText(message) {
  const items = Array.isArray(message?.item_list) ? message.item_list : []
  for (const item of items) {
    if (item?.type === ITEM_TYPE_TEXT && typeof item.text_item?.text === 'string') {
      const text = item.text_item.text.trim()
      if (text) return text
    }
    if (item?.type === ITEM_TYPE_VOICE && typeof item.voice_item?.text === 'string') {
      const text = item.voice_item.text.trim()
      if (text) return text
    }
  }
  return ''
}

export function inboundMessageKey(message) {
  if (message?.message_id != null) return `id:${String(message.message_id)}`
  if (message?.seq != null) return `seq:${String(message.seq)}`
  if (message?.client_id) return `client:${String(message.client_id)}`
  return `fallback:${String(message?.from_user_id ?? '')}:${String(message?.create_time_ms ?? '')}`
}

export function splitText(text, limit = 3900) {
  const chars = Array.from(String(text ?? ''))
  if (chars.length === 0) return []
  const chunks = []
  for (let offset = 0; offset < chars.length; offset += limit) {
    chunks.push(chars.slice(offset, offset + limit).join(''))
  }
  return chunks
}
