import { LEGACY_SESSION_ID_PREFIXES, SESSION_ID_PREFIX } from './constants.js'

export function parseControlCommand(text) {
  const match = /^\/([a-z][a-z0-9_-]*)(?=$|[\t\n\r ])/u.exec(String(text ?? ''))
  if (!match) return undefined
  return {
    name: match[1],
    argument: String(text).slice(match[0].length).trim(),
  }
}

function activityTime(session) {
  const value = session.lastSeenAt || session.createdAt
  const parsed = value ? Date.parse(value) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

export function visibleSessions(peer, options = {}) {
  const includeArchived = options.includeArchived === true
  return [...(peer?.sessions ?? [])]
    .filter(session => includeArchived || !session.archivedAt)
    .sort((left, right) => activityTime(right) - activityTime(left))
}

export function searchSessions(peer, query, options = {}) {
  const wanted = String(query ?? '').trim().toLocaleLowerCase()
  if (!wanted) return []
  const limit = Number.isSafeInteger(options.limit) && options.limit > 0 ? options.limit : 10
  return visibleSessions(peer, { includeArchived: options.includeArchived === true })
    .filter((session) => {
      const values = [session.title, session.sessionId, shortSessionId(session.sessionId), session.cwd]
      return values.some(value => String(value ?? '').toLocaleLowerCase().includes(wanted))
    })
    .slice(0, limit)
}


function compactSessionId(value) {
  const id = String(value)
  if (id.startsWith(SESSION_ID_PREFIX)) return id.slice(SESSION_ID_PREFIX.length)
  for (const prefix of LEGACY_SESSION_ID_PREFIXES) {
    if (id.startsWith(prefix)) return id.slice(prefix.length)
  }
  return id
}

export function shortSessionId(sessionId) {
  return compactSessionId(sessionId).slice(0, 8)
}

export function resolveSessionReference(peer, reference, options = {}) {
  const sessions = visibleSessions(peer, options)
  const wanted = String(reference ?? '').trim()
  if (!wanted) return { error: '请提供会话序号或短 ID。' }
  if (/^[1-9]\d*$/u.test(wanted)) {
    const session = sessions[Number(wanted) - 1]
    return session ? { session } : { error: `没有序号为 ${wanted} 的会话。` }
  }
  const lowered = wanted.toLowerCase()
  const matches = sessions.filter(session => {
    const full = session.sessionId.toLowerCase()
    const compact = compactSessionId(full).toLowerCase()
    return full.startsWith(lowered) || compact.startsWith(lowered)
  })
  if (matches.length === 1) return { session: matches[0] }
  if (matches.length > 1) return { error: `短 ID ${wanted} 不唯一，请多输入几位。` }
  return { error: `找不到会话 ${wanted}。` }
}

export function parseModelSpecifier(value) {
  const input = String(value ?? '').trim()
  const separator = input.indexOf('/')
  if (separator <= 0 || separator === input.length - 1) return undefined
  return {
    provider: input.slice(0, separator).trim(),
    model: input.slice(separator + 1).trim(),
  }
}

export function maskUserId(userId) {
  const value = String(userId ?? '')
  if (value.length <= 8) return value
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

export function resolveAllowedUserReference(settings, reference) {
  const users = settings?.allowedUsers ?? []
  const wanted = String(reference ?? '').trim()
  if (!wanted) return { error: '请提供用户序号或用户 ID。' }
  if (/^[1-9]\d*$/u.test(wanted)) {
    const userId = users[Number(wanted) - 1]
    return userId ? { userId } : { error: `没有序号为 ${wanted} 的用户。` }
  }
  const matches = users.filter(userId => userId === wanted || userId.startsWith(wanted))
  if (matches.length === 1) return { userId: matches[0] }
  if (matches.length > 1) return { error: `用户 ID 前缀 ${wanted} 不唯一，请多输入几位。` }
  return { error: `找不到用户 ${wanted}。` }
}

/**
 * Resolve the outbound Weixin user for a tool call.
 * @param {object | undefined} settings
 * @param {Map<string, string>} agentOwners
 * @param {string | number | undefined} agentId
 * @param {string | undefined} reference
 * @returns {string}
 */
export function resolveOutboundRecipient(settings, agentOwners, agentId, reference) {
  const wanted = String(reference ?? '').trim()
  if (wanted) {
    const resolved = resolveAllowedUserReference(settings, wanted)
    if (!resolved.userId) throw new Error(resolved.error)
    return resolved.userId
  }
  const owner = agentOwners.get(String(agentId ?? ''))
  if (!owner) {
    throw new Error('未指定 to，且当前 Agent 不是微信用户会话；请提供授权用户序号或用户 ID。')
  }
  return owner
}
