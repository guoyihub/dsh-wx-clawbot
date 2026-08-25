import { defineTool } from '@deepseek-ai/dsh-tools'
import { PLUGIN_NAME } from './constants.js'
import { maskUserId } from './control.js'

/**
 * Register the model-facing Weixin outbound tool on the DSH tool registry.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {() => { sendToUser: (input: object) => Promise<{ sent: true, to: string, chunks: number }> }} getBridge
 */
export function registerWxSendTool(ctx, getBridge) {
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'wx_send',
    description: [
      'Send a text message to an authorized Weixin user through the paired ClawBot channel.',
      'Use when the task requires proactively notifying a Weixin user outside the normal reply turn.',
      'When to is omitted, the message goes to the Weixin user that owns the current agent session, or the sole authorized user when only one exists.',
    ].join(' '),
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'Plain-text message body to deliver.',
      },
      to: {
        type: 'string',
        description: 'Authorized Weixin user index (1-based), user ID, or 0 when only one user exists. Omit to target the current session owner or the sole authorized user.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sent: { type: 'boolean', required: true },
          to: { type: 'string', required: true },
          chunks: { type: 'number', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `已向微信用户 ${maskUserId(value.to)} 发送 ${value.chunks} 条消息。`,
      }],
      presentationMeta: (_args, value) => ({ to: value.to, chunks: value.chunks }),
    },
    presentCall(args) {
      const title = args.to ? `发送微信消息给 ${args.to}` : '发送微信消息给当前会话用户'
      return { card: 'generic', title, kind: 'generic' }
    },
    presentResult(args, result) {
      if (result.isError) {
        return { card: 'generic', title: '微信消息发送失败', content: result.content }
      }
      const meta = result.meta
      const to = typeof meta?.to === 'string' ? maskUserId(meta.to) : (args.to ?? '当前会话用户')
      const chunks = typeof meta?.chunks === 'number' ? meta.chunks : undefined
      return {
        card: 'generic',
        title: '微信消息已发送',
        content: chunks == null ? `目标：${to}` : `目标：${to}，分段：${chunks}`,
      }
    },
    async execute(args, exec) {
      if (exec.signal.aborted) throw new Error('工具调用已取消')
      return getBridge().sendToUser({
        agentId: exec.agent.id,
        reference: args.to,
        text: args.text,
        signal: exec.signal,
      })
    },
  })), `${PLUGIN_NAME}: wx_send`)
}
