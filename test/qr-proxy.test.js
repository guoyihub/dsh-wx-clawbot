import assert from 'node:assert/strict'
import test from 'node:test'
import { QR_IMAGE_PATH, QR_PAGE_PATH, QrProxyServer } from '../src/qr-proxy.js'

test('qr proxy serves pairing page and png', async () => {
  const proxy = new QrProxyServer({ port: 0, bind: '127.0.0.1', baseUrl: 'http://phone.example:8030' })
  await proxy.start()
  const address = proxy.server.address()
  assert(address && typeof address === 'object')
  proxy.setQr(Buffer.from('png-bytes'), 'https://liteapp.weixin.qq.com/q/demo')

  const page = await fetch(`http://127.0.0.1:${address.port}${QR_PAGE_PATH}`)
  assert.equal(page.status, 200)
  const html = await page.text()
  assert.match(html, /DSH 微信配对/)
  assert.match(html, /http:\/\/phone\.example:8030\/api\/wx-clawbot\/pairing-qr\.png/)

  const image = await fetch(`http://127.0.0.1:${address.port}${QR_IMAGE_PATH}`)
  assert.equal(image.status, 200)
  assert.equal(image.headers.get('content-type'), 'image/png')
  assert.equal(Buffer.from(await image.arrayBuffer()).toString(), 'png-bytes')

  await proxy.stop()
})

test('qr proxy publicUrls prefers configured base url', () => {
  const proxy = new QrProxyServer({ baseUrl: 'http://tunnel.example' })
  assert.deepEqual(proxy.publicUrls(QR_PAGE_PATH), ['http://tunnel.example/api/wx-clawbot/pairing'])
})

test('qr proxy publicUrls builds hosted absolute urls from webServer port', () => {
  const proxy = new QrProxyServer({
    webServer: { host: '127.0.0.1', port: 4567, register: () => () => {} },
    mobilePublicBaseUrl: 'https://dshmobile.example.com',
  })
  const urls = proxy.publicUrls(QR_PAGE_PATH)
  assert.equal(urls[0], 'https://dshmobile.example.com/api/wx-clawbot/pairing')
  assert.ok(urls.some(url => url === 'http://127.0.0.1:4567/api/wx-clawbot/pairing'))
})

test('pairingUrlFields labels local and mobile urls', async () => {
  const { pairingUrlFields } = await import('../src/qr-proxy.js')
  const fields = pairingUrlFields(
    [
      'https://dshmobile.example.com/api/wx-clawbot/pairing',
      'http://127.0.0.1:3080/api/wx-clawbot/pairing',
    ],
    [
      'https://dshmobile.example.com/api/wx-clawbot/pairing-qr.png',
      'http://127.0.0.1:3080/api/wx-clawbot/pairing-qr.png',
    ],
  )
  assert.equal(fields.pairingPageUrlMobile, 'https://dshmobile.example.com/api/wx-clawbot/pairing')
  assert.equal(fields.pairingPageUrlLocal, 'http://127.0.0.1:3080/api/wx-clawbot/pairing')
})

test('qr proxy publicUrls builds absolute urls for standalone server', () => {
  const proxy = new QrProxyServer({ port: 3081, bind: '127.0.0.1' })
  const urls = proxy.publicUrls(QR_PAGE_PATH)
  assert.ok(urls.some(url => url === 'http://127.0.0.1:3081/api/wx-clawbot/pairing'))
})
