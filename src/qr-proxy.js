import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { DEFAULT_QR_PORT, QR_IMAGE_PATH, QR_PAGE_PATH } from './constants.js'

export { QR_IMAGE_PATH, QR_PAGE_PATH }

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** @returns {string[]} */
export function listLanIpv4Addresses() {
  const addresses = []
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address)
    }
  }
  return addresses
}

export class QrProxyServer {
  /**
   * @param {{ port?: number, bind?: string, baseUrl?: string }} [options]
   */
  constructor(options = {}) {
    this.port = options.port ?? DEFAULT_QR_PORT
    this.bind = options.bind ?? '0.0.0.0'
    this.baseUrl = options.baseUrl?.replace(/\/$/, '')
    /** @type {Buffer | null} */
    this.png = null
    /** @type {string | null} */
    this.liteUrl = null
    /** @type {import('node:http').Server | null} */
    this.server = null
  }

  async start() {
    if (this.server) return
    this.server = createServer((request, response) => {
      void this.handle(request, response)
    })
    await new Promise((resolve, reject) => {
      const onError = error => {
        this.server?.off('listening', onListening)
        reject(error)
      }
      const onListening = () => {
        this.server?.off('error', onError)
        resolve()
      }
      this.server?.once('error', onError)
      this.server?.listen(this.port, this.bind, onListening)
    })
  }

  async stop() {
    if (!this.server) return
    const server = this.server
    this.server = null
    await new Promise(resolve => server.close(() => resolve()))
  }

  /**
   * @param {Buffer} png
   * @param {string | undefined} liteUrl
   */
  setQr(png, liteUrl) {
    this.png = png
    this.liteUrl = liteUrl ?? null
  }

  /**
   * @param {string} pathname
   * @returns {string[]}
   */
  publicUrls(pathname) {
    if (this.baseUrl) return [`${this.baseUrl}${pathname}`]
    const lan = listLanIpv4Addresses()
    if (lan.length) return lan.map(address => `http://${address}:${this.port}${pathname}`)
    return [`http://127.0.0.1:${this.port}${pathname}`]
  }

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   */
  async handle(request, response) {
    const host = request.headers.host ?? `127.0.0.1:${this.port}`
    const url = new URL(request.url ?? '/', `http://${host}`)
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' })
      response.end()
      return
    }
    if (url.pathname === QR_IMAGE_PATH) {
      if (!this.png) {
        response.writeHead(404)
        response.end()
        return
      }
      response.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      })
      response.end(this.png)
      return
    }
    if (url.pathname === QR_PAGE_PATH) {
      if (!this.png) {
        response.writeHead(404)
        response.end()
        return
      }
      const imageUrl = this.publicUrls(QR_IMAGE_PATH)[0]
      const lite = this.liteUrl
        ? `<p>微信备用链接：<a href="${escapeHtml(this.liteUrl)}">${escapeHtml(this.liteUrl)}</a></p>`
        : ''
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      response.end(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DSH 微信配对</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1.5rem; text-align: center; }
    img { max-width: min(100%, 22rem); height: auto; }
    p { color: #444; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>DSH 微信配对</h1>
  <p>请用手机微信扫描下方二维码，或在微信内打开备用链接。</p>
  <p><img src="${escapeHtml(imageUrl)}" alt="微信配对二维码"></p>
  ${lite}
</body>
</html>`)
      return
    }
    response.writeHead(404)
    response.end()
  }
}
