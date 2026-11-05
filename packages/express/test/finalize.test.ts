import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import { test, expect } from 'bun:test'

import { inspector } from '../src/index.js'

test('close followed by finish records exactly once', async () => {
  const mw = inspector({ enabled: true })
  const server = createServer((req, res) => {
    ;(req as any).originalUrl = req.url
    mw(req as any, res as any, () => {
      res.emit('close') // simulate close arriving before finish
      res.end('done') // finish fires afterwards
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  try {
    expect((await fetch(`${base}/a`)).status).toBe(200)
    await new Promise((r) => setTimeout(r, 50))
    const list = (await (await fetch(`${base}/_inspect/api/requests`)).json()) as { url: string }[]
    expect(list.filter((x) => x.url === '/a').length).toBe(1)
  } finally {
    server.closeAllConnections()
    server.close()
  }
})
