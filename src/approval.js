import { randomUUID } from 'node:crypto'

export const APPROVAL_TTL_MS = 5 * 60_000
export const MAX_PENDING_APPROVALS = 20

function approvalCode() {
  return randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
}

export function normalizeApprovalCode(value) {
  return String(value ?? '').trim().toUpperCase()
}

export function formatApprovalPrompt(pending) {
  const reason = pending.reason ? `\n原因：${pending.reason}` : ''
  return [
    'DSH 请求一次操作授权。',
    `工具：${pending.toolName}${reason}`,
    `允许一次：/approve ${pending.code}`,
    `拒绝：/reject ${pending.code}`,
    '审批码 5 分钟后失效，且只能使用一次。',
  ].join('\n')
}

export class ApprovalInbox {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs ?? APPROVAL_TTL_MS
    this.maxPending = options.maxPending ?? MAX_PENDING_APPROVALS
    this.codeFactory = options.codeFactory ?? approvalCode
    this.setTimer = options.setTimer ?? setTimeout
    this.clearTimer = options.clearTimer ?? clearTimeout
    this.pending = new Map()
  }

  create({ ownerUserId, agentId, toolName, reason, signal }) {
    if (this.pending.size >= this.maxPending) return { error: 'too-many-pending' }
    let code
    for (let attempt = 0; attempt < 20; attempt += 1) {
      code = normalizeApprovalCode(this.codeFactory())
      if (code && !this.pending.has(code)) break
      code = undefined
    }
    if (!code) return { error: 'code-generation-failed' }

    let settle
    const decision = new Promise(resolve => { settle = resolve })
    const pending = {
      code,
      ownerUserId: String(ownerUserId),
      agentId: String(agentId),
      toolName: Array.from(String(toolName || 'unknown')).slice(0, 200).join(''),
      reason: reason ? Array.from(String(reason)).slice(0, 1_000).join('') : '',
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + this.ttlMs,
      decision,
      settle,
      signal,
      timer: undefined,
      abort: undefined,
    }
    const finishUnavailable = () => this.finish(code, 'unavailable', 'system')
    pending.timer = this.setTimer(finishUnavailable, this.ttlMs)
    pending.timer?.unref?.()
    if (signal) {
      pending.abort = () => this.finish(code, 'cancelled', 'system')
      signal.addEventListener('abort', pending.abort, { once: true })
    }
    this.pending.set(code, pending)
    if (signal?.aborted) this.finish(code, 'cancelled', 'system')
    return { pending, decision }
  }

  decide(ownerUserId, code, outcome) {
    const normalized = normalizeApprovalCode(code)
    const pending = this.pending.get(normalized)
    if (!pending || pending.ownerUserId !== String(ownerUserId)) return { ok: false }
    this.finish(normalized, outcome, String(ownerUserId))
    return { ok: true, pending }
  }

  finish(code, outcome, actor) {
    const pending = this.pending.get(code)
    if (!pending) return false
    this.pending.delete(code)
    if (pending.timer !== undefined) this.clearTimer(pending.timer)
    if (pending.signal && pending.abort) pending.signal.removeEventListener('abort', pending.abort)
    pending.settle({ outcome, actor, pending })
    return true
  }

  cancelAll() {
    for (const code of [...this.pending.keys()]) this.finish(code, 'cancelled', 'system')
  }
}
