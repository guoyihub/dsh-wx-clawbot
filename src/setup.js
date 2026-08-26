#!/usr/bin/env node

import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { join, resolve } from 'node:path'
import { defaultDshHome } from './credential-file.js'
import { DEFAULT_QR_PORT, PLUGIN_NAME } from './constants.js'
import {
  disconnectPairing,
  readPairingStatus,
  resolvePairingOptions,
  WxPairingSession,
} from './pairing-service.js'

function parseArgs(argv) {
  const command = argv[0] || 'help'
  const result = { command }
  for (let index = 1; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--state-dir') result.stateDir = argv[++index]
    else if (arg === '--credential-ref') result.credentialRef = argv[++index]
    else if (arg === '--dsh-home') result.dshHome = argv[++index]
    else if (arg === '--agent-cwd') result.agentCwd = argv[++index]
    else if (arg === '--agent-preset') result.agentPreset = argv[++index]
    else if (arg === '--permission-preset') result.permissionPreset = argv[++index]
    else if (arg === '--qr-port') result.qrPort = Number(argv[++index])
    else if (arg === '--qr-bind') result.qrBind = argv[++index]
    else if (arg === '--qr-base-url') result.qrBaseUrl = argv[++index]
    else if (arg === '--qr-file') result.qrFile = argv[++index]
    else if (arg === '--help' || arg === '-h') result.command = 'help'
    else throw new Error(`unknown option: ${arg}`)
  }
  if (!result.stateDir) {
    result.stateDir = join(
      defaultDshHome(result.dshHome ? { ...process.env, DSH_HOME: result.dshHome } : process.env),
      PLUGIN_NAME,
    )
  }
  if (result.qrFile) result.qrFile = resolve(result.qrFile)
  if (result.command === 'setup') result.serveQrHttp = true
  return { ...resolvePairingOptions(result), command: result.command }
}

function usage() {
  stdout.write([
    'DSH Wx ClawBot connector',
    '',
    'Usage:',
    `  ${PLUGIN_NAME} setup [--agent-cwd PATH] [--qr-port PORT] [--qr-base-url URL] [--qr-file PATH]`,
    `  ${PLUGIN_NAME} status [--state-dir PATH] [--credential-ref NAME] [--dsh-home PATH]`,
    `  ${PLUGIN_NAME} disconnect [--state-dir PATH] [--credential-ref NAME] [--dsh-home PATH]`,
    '',
    `QR pairing is served over HTTP (default :${DEFAULT_QR_PORT}) for phone access on the LAN or tunnel.`,
    '',
  ].join('\n'))
}

async function promptVerifyCode(reader, prompt) {
  while (true) {
    const code = (await reader.question(prompt)).trim()
    if (/^\d+$/.test(code)) return code
    stdout.write('配对码只能包含数字。\n')
  }
}

async function publishQr(session) {
  const snapshot = session.snapshot()
  if (snapshot.terminalQr) stdout.write(`${snapshot.terminalQr}\n`)
  stdout.write('\n请让用户在微信内打开下方腾讯配对链接（点开即可扫码）。\n')
  if (snapshot.pairingUrl) stdout.write(`微信配对链接：${snapshot.pairingUrl}\n`)
  for (const url of snapshot.pairingPageUrls) stdout.write(`备用配对页：${url}\n`)
  for (const url of snapshot.pairingImageUrls) stdout.write(`备用二维码图片：${url}\n`)
  stdout.write('\n')
}

async function pair(options) {
  const session = new WxPairingSession(options)
  await session.start()
  await publishQr(session)

  const reader = createInterface({ input: stdin, output: stdout })
  try {
    while (session.active) {
      if (session.phase === 'need_verify_code') {
        const code = await promptVerifyCode(reader, '请输入手机微信显示的数字配对码：')
        await session.step({ verifyCode: code })
      } else {
        if (session.phase === 'scanned') stdout.write('已扫码，正在确认...\n')
        await session.step({})
      }
      if (session.phase === 'failed') throw new Error(session.error ?? session.message)
      if (session.active) await new Promise(resolveDelay => setTimeout(resolveDelay, 1000))
    }
    if (session.phase === 'confirmed') {
      stdout.write(`\n连接成功。\n状态目录：${options.stateDir}\n允许用户：${session.result?.userId ?? '-'}\n`)
    }
  } finally {
    reader.close()
    if (session.phase !== 'confirmed') await session.cancel()
  }
}

async function status(options) {
  const snapshot = await readPairingStatus(options)
  stdout.write([
    `配对状态：${snapshot.paired ? '已配对' : '未配对'}`,
    `凭据状态：${snapshot.credentialConfigured ? '已配置' : '未配置'}`,
    `账号：${snapshot.accountId ?? '-'}`,
    `允许用户：${snapshot.allowedUsers}`,
    `会话数：${snapshot.sessionCount}`,
    `状态目录：${options.stateDir}`,
    '',
  ].join('\n'))
}

async function disconnect(options) {
  await disconnectPairing(options)
  stdout.write('本机 DSH Wx ClawBot 配对信息和令牌已清除。\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.command === 'help') return usage()
  if (options.command === 'setup') return pair(options)
  if (options.command === 'status') return status(options)
  if (options.command === 'disconnect') return disconnect(options)
  throw new Error(`unknown command: ${options.command}`)
}

main().catch(error => {
  process.stderr.write(`${PLUGIN_NAME}: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
