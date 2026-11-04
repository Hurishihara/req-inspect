import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { inspector } from '@req-inspect/express'
import { loadExpress, start, waitFor, getRecords, findRecord } from './helpers.mjs'

let server
let ignoreServer

before(async () => {
  const express = await loadExpress()
  const app = express()
  app.use(inspector({ enabled: true }))
  app.use(express.json())
  app.use(express.urlencoded({ extended: false }))
  const api = express.Router()
  api.get('/users/:id', (req, res) => res.json({ id: req.params.id }))
  api.post('/users', (req, res) => res.status(201).json(req.body))
  api.get('/big', (_req, res) => res.type('text/plain').send('x'.repeat(100000)))
  api.get('/empty', (_req, res) => res.status(204).end())
  api.get('/slow', (_req, res) => setTimeout(() => res.json({ ok: true }), 500))
  app.use('/api', api)
  server = await start(app)

  const app2 = express()
  app2.use(inspector({ enabled: true, ignore: ['/health'] }))
  app2.get('/health', (_req, res) => res.send('ok'))
  app2.get('/other', (_req, res) => res.send('ok'))
  ignoreServer = await start(app2)
})

after(async () => {
  await server.close()
  await ignoreServer.close()
})

test('route template from nested router', async () => {
  await fetch(`${server.base}/api/users/42`)
  const r = await findRecord(server.base, (x) => x.url === '/api/users/42')
  assert.equal(r.route, '/api/users/:id')
  assert.equal(r.request.params.id, '42')
  assert.equal(r.status, 200)
  assert.deepEqual(r.response.body, { kind: 'json', value: { id: '42' }, truncated: false, size: 11 })
})

test('unmatched → route null, 404', async () => {
  await fetch(`${server.base}/nope`)
  const r = await findRecord(server.base, (x) => x.url === '/nope')
  assert.equal(r.route, null)
  assert.equal(r.status, 404)
})

test('json request body captured and redacted', async () => {
  await fetch(`${server.base}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    body: JSON.stringify({ name: 'a', password: 'p' }),
  })
  const r = await findRecord(server.base, (x) => x.method === 'POST' && x.url === '/api/users')
  assert.equal(r.status, 201)
  assert.equal(r.request.body.value.password, '[redacted]')
  assert.equal(r.request.body.value.name, 'a')
  assert.equal(r.request.headers.authorization, '[redacted]')
})

test('form body captured', async () => {
  await fetch(`${server.base}/api/users?form=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'a=1',
  })
  const r = await findRecord(server.base, (x) => x.url === '/api/users?form=1')
  assert.deepEqual(r.request.body, { kind: 'json', value: { a: '1' }, truncated: false, size: 9 })
})

test('truncation', async () => {
  await fetch(`${server.base}/api/big`)
  const r = await findRecord(server.base, (x) => x.url === '/api/big')
  assert.equal(r.response.body.kind, 'text')
  assert.equal(r.response.body.truncated, true)
  assert.equal(r.response.body.size, 100000)
  assert.equal(r.response.body.value.length, 65536)
})

test('bodiless responses', async () => {
  await fetch(`${server.base}/api/empty`)
  await fetch(`${server.base}/api/users/1`, { method: 'HEAD' })
  const a = await findRecord(server.base, (x) => x.url === '/api/empty')
  const b = await findRecord(server.base, (x) => x.method === 'HEAD')
  assert.deepEqual(a.response.body, { kind: 'none' })
  assert.deepEqual(b.response.body, { kind: 'none' })
})

test('aborted request', async () => {
  const req = httpRequest(`${server.base}/api/slow`)
  req.on('error', () => {})
  req.end()
  setTimeout(() => req.destroy(), 50)
  const r = await waitFor(async () => (await getRecords(server.base)).find((x) => x.url === '/api/slow' && x.aborted))
  assert.equal(r.aborted, true)
})

test('inspector requests are not captured', async () => {
  for (let i = 0; i < 3; i++) await fetch(`${server.base}/_inspect/api/requests`)
  await new Promise((r) => setTimeout(r, 50))
  const all = await getRecords(server.base)
  assert.equal(all.some((x) => x.url.startsWith('/_inspect')), false)
})

test('ignore list', async () => {
  await fetch(`${ignoreServer.base}/health`)
  await fetch(`${ignoreServer.base}/other`)
  await findRecord(ignoreServer.base, (x) => x.url === '/other')
  const all = await getRecords(ignoreServer.base)
  assert.equal(all.some((x) => x.url === '/health'), false)
})

test('close then finish records exactly once', async () => {
  const express = await loadExpress()
  const app = express()
  app.use(inspector({ enabled: true }))
  app.get('/late', (_req, res) => {
    res.setHeader('content-length', '10')
    res.write('12345')
    setTimeout(() => res.end('67890'), 200)
  })
  const s = await start(app)
  try {
    await new Promise((resolve) => {
      const req = httpRequest(`${s.base}/late`, (res) => {
        res.once('data', () => req.destroy())
        res.on('error', () => {})
      })
      req.on('error', resolve)
      req.on('close', resolve)
      req.end()
    })
    await new Promise((r) => setTimeout(r, 400))
    const all = (await getRecords(s.base)).filter((x) => x.url === '/late')
    assert.equal(all.length, 1)
  } finally { await s.close() }
})

test('mounted under a prefix: absolute inspector path works and requests are captured', async () => {
  const express = await loadExpress()
  const app = express()
  const mw = inspector({ enabled: true })
  app.use('/x', mw)
  app.get('/x/hello', (_req, res) => res.send('hi'))
  app.use(mw)
  const s = await start(app)
  try {
    assert.equal((await fetch(`${s.base}/_inspect/api/requests`)).status, 200)
    await fetch(`${s.base}/x/hello`)
    const r = await findRecord(s.base, (x) => x.url === '/x/hello')
    assert.equal(r.status, 200)
  } finally { await s.close() }
})
