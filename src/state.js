import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { normalizeDeliveryContexts } from './delivery-context.js'
import { MAX_OUTBOX_MESSAGES } from './outbox.js'

export const STATE_VERSION = 1
export const MAX_PEER_SESSIONS = 50
export const MAX_AUDIT_EVENTS = 200

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function timestamp(value) {
  return nonEmptyString(value) ?? null
}

function boundedString(value, maxLength) {
  const text = nonEmptyString(value)
  return text ? Array.from(text).slice(0, maxLength).join('') : undefined
}

function normalizeOutboxEntry(value) {
  if (!value || typeof value !== 'object') return undefined
  const id = boundedString(value.id, 100)
  const to = boundedString(value.to, 500)
  const text = boundedString(value.text, 4_000)
  if (!id || !to || !text) return undefined
  const attempts = Number.isSafeInteger(value.attempts) && value.attempts >= 0 ? Math.min(value.attempts, 1_000) : 0
  return {
    id,
    to,
    text,
    createdAt: timestamp(value.createdAt) ?? new Date(0).toISOString(),
    attempts,
    nextAttemptAt: timestamp(value.nextAttemptAt),
    ...(boundedString(value.contextToken, 4_000) ? { contextToken: boundedString(value.contextToken, 4_000) } : {}),
    ...(boundedString(value.runId, 500) ? { runId: boundedString(value.runId, 500) } : {}),
    ...(boundedString(value.lastError, 1_000) ? { lastError: boundedString(value.lastError, 1_000) } : {}),
  }
}

function normalizeAuditEvent(value) {
  if (!value || typeof value !== 'object') return undefined
  const id = boundedString(value.id, 100)
  const at = timestamp(value.at)
  const actor = boundedString(value.actor, 500)
  const action = boundedString(value.action, 100)
  if (!id || !at || !actor || !action) return undefined
  return {
    id,
    at,
    actor,
    action,
    ...(boundedString(value.target, 500) ? { target: boundedString(value.target, 500) } : {}),
    ...(boundedString(value.detail, 1_000) ? { detail: boundedString(value.detail, 1_000) } : {}),
  }
}

function permissionPreset(value) {
  return value === 'danger-full-access' ? 'danger-full-access' : 'workspace-write'
}

function normalizeModel(value) {
  if (!value || typeof value !== 'object') return undefined
  const provider = nonEmptyString(value.provider)
  const model = nonEmptyString(value.model)
  if (!provider || !model) return undefined
  const reasoningEffort = nonEmptyString(value.reasoningEffort)
  return {
    provider,
    model,
    ...(reasoningEffort ? { reasoningEffort } : {}),
  }
}

function normalizeSession(value, defaults = {}) {
  if (!value || typeof value !== 'object') return undefined
  const sessionId = nonEmptyString(value.sessionId)
  if (!sessionId) return undefined
  return {
    sessionId,
    title: nonEmptyString(value.title)?.slice(0, 200) ?? null,
    createdAt: timestamp(value.createdAt),
    lastSeenAt: timestamp(value.lastSeenAt),
    agentPreset: nonEmptyString(value.agentPreset) ?? defaults.agentPreset ?? 'standard',
    cwd: nonEmptyString(value.cwd) ?? defaults.agentCwd ?? process.cwd(),
    permissionPreset: permissionPreset(value.permissionPreset ?? defaults.permissionPreset),
    ...(normalizeModel(value.model) ? { model: normalizeModel(value.model) } : {}),
    archivedAt: timestamp(value.archivedAt),
  }
}

export function createPeerState(defaults = {}) {
  return {
    sessionId: null,
    sessions: [],
    nextPreset: nonEmptyString(defaults.agentPreset) ?? 'standard',
    nextCwd: nonEmptyString(defaults.agentCwd) ?? process.cwd(),
  }
}

export function normalizePeer(value, defaults = {}) {
  const base = createPeerState(defaults)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base

  const sessions = []
  const seen = new Set()
  for (const candidate of Array.isArray(value.sessions) ? value.sessions : []) {
    const session = normalizeSession(candidate, defaults)
    if (!session || seen.has(session.sessionId)) continue
    seen.add(session.sessionId)
    sessions.push(session)
  }

  // Version 1 originally stored one session directly on the peer. Promote it
  // into the local session index without changing the state version or id.
  const legacyId = nonEmptyString(value.sessionId)
  if (legacyId && !seen.has(legacyId)) {
    const legacy = normalizeSession({
      sessionId: legacyId,
      title: value.title,
      createdAt: value.createdAt,
      lastSeenAt: value.lastSeenAt,
      agentPreset: value.agentPreset,
      cwd: value.cwd,
      permissionPreset: value.permissionPreset,
      model: value.model,
      archivedAt: value.archivedAt,
    }, defaults)
    if (legacy) sessions.unshift(legacy)
  }

  const limited = sessions.slice(0, MAX_PEER_SESSIONS)
  const active = legacyId && limited.some(session => session.sessionId === legacyId && !session.archivedAt)
    ? legacyId
    : null
  return {
    sessionId: active,
    sessions: limited,
    nextPreset: nonEmptyString(value.nextPreset ?? value.agentPreset) ?? base.nextPreset,
    nextCwd: nonEmptyString(value.nextCwd) ?? base.nextCwd,
  }
}

export function createDefaultState(defaults = {}) {
  return {
    version: STATE_VERSION,
    account: null,
    syncBuf: '',
    processed: [],
    outbox: [],
    deliveryContexts: {},
    audit: [],
    peers: {},
    settings: {
      enabled: defaults.enabled !== false,
      allowedUsers: [],
      ownerUserId: null,
      agentCwd: defaults.agentCwd ?? process.cwd(),
      agentPreset: defaults.agentPreset ?? 'standard',
      permissionPreset: defaults.permissionPreset ?? 'workspace-write',
      maxReplyChars: defaults.maxReplyChars ?? 3800,
    },
  }
}

export function normalizeState(value, defaults = {}) {
  const base = createDefaultState(defaults)
  if (!value || typeof value !== 'object' || value.version !== STATE_VERSION) return base
  const settings = value.settings && typeof value.settings === 'object' ? value.settings : {}
  const normalizedSettings = {
    ...base.settings,
    enabled: typeof settings.enabled === 'boolean' ? settings.enabled : base.settings.enabled,
    allowedUsers: Array.isArray(settings.allowedUsers)
      ? [...new Set(settings.allowedUsers.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()))].slice(0, 100)
      : [],
    agentCwd: typeof settings.agentCwd === 'string' && settings.agentCwd.trim() ? settings.agentCwd : base.settings.agentCwd,
    agentPreset: typeof settings.agentPreset === 'string' && settings.agentPreset.trim() ? settings.agentPreset : base.settings.agentPreset,
    permissionPreset: permissionPreset(settings.permissionPreset),
    maxReplyChars: Number.isSafeInteger(settings.maxReplyChars) && settings.maxReplyChars >= 200 && settings.maxReplyChars <= 4000
      ? settings.maxReplyChars
      : base.settings.maxReplyChars,
  }
  normalizedSettings.ownerUserId = nonEmptyString(settings.ownerUserId)
    && normalizedSettings.allowedUsers.includes(settings.ownerUserId.trim())
    ? settings.ownerUserId.trim()
    : normalizedSettings.allowedUsers[0] ?? null
  const peers = {}
  if (value.peers && typeof value.peers === 'object' && !Array.isArray(value.peers)) {
    for (const [key, peer] of Object.entries(value.peers)) {
      if (!nonEmptyString(key)) continue
      peers[key] = normalizePeer(peer, normalizedSettings)
    }
  }
  const outbox = Array.isArray(value.outbox)
    ? value.outbox.map(normalizeOutboxEntry).filter(Boolean).slice(-MAX_OUTBOX_MESSAGES)
    : []
  const audit = Array.isArray(value.audit)
    ? value.audit.map(normalizeAuditEvent).filter(Boolean).slice(-MAX_AUDIT_EVENTS)
    : []
  return {
    ...base,
    account: value.account && typeof value.account === 'object' ? value.account : null,
    syncBuf: typeof value.syncBuf === 'string' ? value.syncBuf : '',
    processed: Array.isArray(value.processed) ? value.processed.filter(item => typeof item === 'string').slice(-500) : [],
    outbox,
    deliveryContexts: normalizeDeliveryContexts(value.deliveryContexts),
    audit,
    peers,
    settings: normalizedSettings,
  }
}

export class StateStore {
  constructor(stateDir, defaults = {}) {
    this.path = join(stateDir, 'state.json')
    this.defaults = defaults
    this.writes = Promise.resolve()
  }

  async load() {
    try {
      return normalizeState(JSON.parse(await readFile(this.path, 'utf8')), this.defaults)
    } catch (error) {
      if (error?.code === 'ENOENT') return createDefaultState(this.defaults)
      throw error
    }
  }

  save(value) {
    const snapshot = JSON.stringify(normalizeState(value, this.defaults), null, 2)
    this.writes = this.writes.then(async () => {
      await mkdir(dirname(this.path), { recursive: true })
      const temporary = `${this.path}.${randomUUID()}.tmp`
      await writeFile(temporary, `${snapshot}\n`, { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, this.path)
    })
    return this.writes
  }

  flush() {
    return this.writes
  }
}
