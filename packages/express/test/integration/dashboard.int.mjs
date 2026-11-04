import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { inspector } from '@req-inspect/express'
import { loadExpress, start } from './helpers.mjs'

let server

before(async () => {
  const express = await loadExpress()
  const app = express()
  app.use(inspector({ enabled: true, path: '/debug/inspect' }))
  server = await start(app)
})
after(() => server.close())

test('mount path redirects to trailing slash', async () => {
  const res = await fetch(`${server.base}/debug/inspect`, { redirect: 'manual' })
  assert.equal(res.status, 302)
  assert.equal(res.headers.get('location'), '/debug/inspect/')
})

test('index.html uses relative asset urls and every asset is served', async () => {
  const res = await fetch(`${server.base}/debug/inspect/`)
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.ok(!html.includes('src="/'), 'no absolute src')
  assert.ok(!html.includes('href="/'), 'no absolute href')
  const urls = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1])
  assert.ok(urls.length >= 2, 'expects js and css assets')
  for (const u of urls) {
    const r = await fetch(`${server.base}/debug/inspect/${u.slice(2)}`)
    assert.equal(r.status, 200, u)
    await r.arrayBuffer()
  }
})
