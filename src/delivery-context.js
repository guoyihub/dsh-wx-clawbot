import { maskUserId } from './control.js'

function boundedString(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? Array.from(text).slice(0, maxLength).join('') : undefined
}

/**
 * Normalize persisted Weixin delivery context keyed by authorized user id.
 * @param {unknown} value
 * @returns {Record<string, { contextToken: string, runId?: string, updatedAt: string }>}
 */
export function normalizeDeliveryContexts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  /** @type {Record<string, { contextToken: string, runId?: string, updatedAt: string }>} */
  const contexts = {}
  for (const [userId, entry] of Object.entries(value)) {
    if (!boundedString(userId, 500) || !entry || typeof entry !== 'object') continue
    const contextToken = boundedString(entry.contextToken, 4_000)
    if (!contextToken) continue
    const updatedAt = boundedString(entry.updatedAt, 100) ?? new Date(0).toISOString()
    contexts[userId] = {
      contextToken,
      updatedAt,
      ...(boundedString(entry.runId, 500) ? { runId: boundedString(entry.runId, 500) } : {}),
    }
  }
  return contexts
}

/**
 * @param {Record<string, { contextToken: string, runId?: string, updatedAt: string }>} contexts
 * @param {string} userId
 * @param {string | undefined} contextToken
 * @param {string | undefined} runId
 */
export function rememberDeliveryContext(contexts, userId, contextToken, runId) {
  const to = boundedString(userId, 500)
  const token = boundedString(contextToken, 4_000)
  if (!to || !token) return contexts
  return {
    ...contexts,
    [to]: {
      contextToken: token,
      updatedAt: new Date().toISOString(),
      ...(boundedString(runId, 500) ? { runId: boundedString(runId, 500) } : {}),
    },
  }
}

/**
 * Resolve the cached Weixin conversation token required for outbound delivery.
 * @param {Record<string, { contextToken: string, runId?: string, updatedAt: string }> | undefined} contexts
 * @param {string} userId
 * @returns {{ contextToken: string, runId?: string }}
 */
export function resolveDeliveryContext(contexts, userId) {
  const entry = contexts?.[userId]
  if (!entry?.contextToken) {
    throw new Error(
      `无法向微信用户 ${maskUserId(userId)} 主动发消息：缺少会话 context_token。`
      + '请让用户先在微信向 ClawBot 发送任意消息，再重试 wx_send。',
    )
  }
  return entry.runId
    ? { contextToken: entry.contextToken, runId: entry.runId }
    : { contextToken: entry.contextToken }
}
