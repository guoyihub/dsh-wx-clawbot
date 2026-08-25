import { defineTool } from '@deepseek-ai/dsh-tools'
import { PLUGIN_NAME } from './constants.js'

const ACTION_LABELS = {
  status: '查看微信通道状态',
  start_pairing: '开始微信配对',
  pair_step: '推进微信配对',
  cancel_pairing: '取消微信配对',
  disconnect: '解除微信配对',
}

/**
 * Register the conversational Weixin bridge configuration tool.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {() => import('./index.js').DshWeixinBridge} getBridge
 */
export function registerWxConfigureTool(ctx, getBridge) {
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'wx_configure',
    description: [
      'Configure or inspect the paired Weixin ClawBot bridge without shell commands.',
      'Typical flow: status → start_pairing (give users the labeled full pairing URLs from the tool output; never ask them to combine a host with a path) → pair_step until paired or needs verify_code → pair_step with verify_code.',
      'Use disconnect to remove local pairing; cancel_pairing aborts an in-progress QR session only.',
    ].join(' '),
    parameters: {
      action: {
        type: 'string',
        required: true,
        description: 'One of: status, start_pairing, pair_step, cancel_pairing, disconnect.',
      },
      agent_cwd: {
        type: 'string',
        description: 'Workspace for new Weixin sessions during start_pairing. Defaults to the bridge config workspace.',
      },
      agent_preset: {
        type: 'string',
        description: 'Agent preset id for start_pairing (default standard).',
      },
      permission_preset: {
        type: 'string',
        description: 'workspace-write or danger-full-access for start_pairing.',
      },
      verify_code: {
        type: 'string',
        description: 'Numeric pairing code from Weixin when pair_step reports needsVerifyCode.',
      },
      qr_port: {
        type: 'number',
        description: 'Standalone QR HTTP port for CLI setup only; Host pairing reuses the DSH webServer listen port and ignores this.',
      },
      qr_base_url: {
        type: 'string',
        description: 'CLI setup only: public base URL for standalone QR HTTP when LAN detection or a tunnel differs.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          action: { type: 'string', required: true },
          message: { type: 'string', required: true },
          paired: { type: 'boolean' },
          credentialConfigured: { type: 'boolean' },
          pairingActive: { type: 'boolean' },
          phase: { type: 'string' },
          needsVerifyCode: { type: 'boolean' },
          pairingPageUrls: {
            type: 'array',
            items: { type: 'string' },
          },
          pairingImageUrls: {
            type: 'array',
            items: { type: 'string' },
          },
          pairingPageUrlLocal: { type: 'string' },
          pairingPageUrlMobile: { type: 'string' },
          pairingImageUrlLocal: { type: 'string' },
          pairingImageUrlMobile: { type: 'string' },
          agentCwd: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: formatConfigureSummary(value),
      }],
      presentationMeta: (_args, value) => ({
        phase: value.phase,
        paired: value.paired,
        needsVerifyCode: value.needsVerifyCode,
      }),
    },
    presentCall(args) {
      const label = ACTION_LABELS[args.action] ?? '配置微信通道'
      return { card: 'generic', title: label, kind: 'generic' }
    },
    presentResult(args, result) {
      if (result.isError) {
        return { card: 'generic', title: '微信配置失败', content: result.content }
      }
      return {
        card: 'generic',
        title: ACTION_LABELS[args.action] ?? '微信配置',
        content: formatConfigureSummary(result.meta ?? {}),
      }
    },
    async execute(args, exec) {
      if (exec.signal.aborted) throw new Error('工具调用已取消')
      return getBridge().configure({
        action: args.action,
        agentCwd: args.agent_cwd,
        agentPreset: args.agent_preset,
        permissionPreset: args.permission_preset,
        verifyCode: args.verify_code,
        qrPort: args.qr_port,
        qrBaseUrl: args.qr_base_url,
        signal: exec.signal,
      })
    },
  })), `${PLUGIN_NAME}: wx_configure`)
}

/**
 * @param {Record<string, unknown>} value
 */
function formatConfigureSummary(value) {
  const lines = [String(value.message ?? '')]
  if (value.paired === true) lines.push('状态：已配对')
  if (value.paired === false) lines.push('状态：未配对')
  if (value.needsVerifyCode) lines.push('需要数字配对码：请向用户索取后再次调用 pair_step 并传入 verify_code。')
  if (typeof value.pairingPageUrlLocal === 'string') {
    lines.push(`本机打开：${value.pairingPageUrlLocal}`)
  }
  if (typeof value.pairingPageUrlMobile === 'string') {
    lines.push(`手机打开：${value.pairingPageUrlMobile}`)
  }
  if (!value.pairingPageUrlLocal && !value.pairingPageUrlMobile && Array.isArray(value.pairingPageUrls) && value.pairingPageUrls.length > 0) {
    lines.push(`配对页：${value.pairingPageUrls.join('、')}`)
  }
  if (typeof value.pairingImageUrlLocal === 'string') {
    lines.push(`本机二维码：${value.pairingImageUrlLocal}`)
  }
  if (typeof value.pairingImageUrlMobile === 'string') {
    lines.push(`手机二维码：${value.pairingImageUrlMobile}`)
  }
  if (!value.pairingImageUrlLocal && !value.pairingImageUrlMobile && Array.isArray(value.pairingImageUrls) && value.pairingImageUrls.length > 0) {
    lines.push(`二维码图片：${value.pairingImageUrls.join('、')}`)
  }
  if (typeof value.agentCwd === 'string') lines.push(`工作区：${value.agentCwd}`)
  return lines.filter(Boolean).join('\n')
}
