import { PLUGIN_NAME } from './constants.js'
import { maskUserId, resolveOutboundRecipient } from './control.js'
import { splitText } from './protocol.js'

/**
 * @param {{
 *   state?: { account?: { accountId?: string }, settings?: { allowedUsers?: string[], maxReplyChars?: number } },
 *   agentOwners: Map<string, string>,
 *   allowed: (userId: string) => boolean,
 *   send: (userId: string, text: string) => Promise<void>,
 * }} bridge
 * @param {{ agentId: string, reference?: string, text: string, signal?: AbortSignal }} input
 * @returns {Promise<{ sent: true, to: string, chunks: number }>}
 */
export async function sendToAuthorizedUser(bridge, input) {
  if (!bridge.state?.account?.accountId) {
    throw new Error(`微信通道尚未配对；请先运行 ${PLUGIN_NAME} setup`)
  }
  if (input.signal?.aborted) throw new Error('工具调用已取消')
  if (!bridge.state?.settings) throw new Error('微信通道尚未就绪')
  const userId = resolveOutboundRecipient(
    bridge.state.settings,
    bridge.agentOwners,
    input.agentId,
    input.reference,
  )
  if (!bridge.allowed(userId)) {
    throw new Error(`用户 ${maskUserId(userId)} 未授权`)
  }
  const trimmed = String(input.text ?? '').trim()
  if (!trimmed) throw new Error('消息内容不能为空')
  const chunks = splitText(trimmed, bridge.state.settings.maxReplyChars ?? 3800)
  if (!chunks.length) throw new Error('消息内容不能为空')
  await bridge.send(userId, trimmed)
  return { sent: true, to: userId, chunks: chunks.length }
}
