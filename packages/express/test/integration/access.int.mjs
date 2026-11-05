import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { inspector } from '@req-inspect/express'
import { loadExpress, start } from './helpers.mjs'

async function appWith(options, env) {
  const express = await loadExpress()
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = env
  let mw
  try {
    mw = inspector(options)
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prev
  }
  const app = express()
  app.use(mw)
  app.get('/ping', (_req, res) => res.send('pong'))
  return start(app)
}

test('production without auth disables', async () => {
  const s = await appWith({}, 'production')
  try {
    assert.equal((await fetch(`${s.base}/_inspect/`)).status, 404)
    assert.equal((await fetch(`${s.base}/_inspect/api/requests`)).status, 404)
    assert.equal(await (await fetch(`${s.base}/ping`)).text(), 'pong')
  } finally {
    await s.close()
  }
})

test('forwarded header → 403', async () => {
  const s = await appWith({ enabled: true }, 'development')
  try {
    const r = await fetch(`${s.base}/_inspect/api/requests`, { headers: { 'x-forwarded-for': '1.2.3.4' } })
    assert.equal(r.status, 403)
  } finally {
    await s.close()
  }
})

test('auth → 401 without credentials, 200 with', async () => {
  const s = await appWith({ enabled: true, auth: { user: 'u', pass: 'p' } }, 'production')
  try {
    const no = await fetch(`${s.base}/_inspect/api/requests`, { headers: { 'x-forwarded-for': '1.2.3.4' } })
    assert.equal(no.status, 401)
    const ok = await fetch(`${s.base}/_inspect/api/requests`, {
      headers: {
        authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'x-forwarded-for': '1.2.3.4',
      },
    })
    assert.equal(ok.status, 200)
  } finally {
    await s.close()
  }
})

test('non-localhost Host header → 403 without auth (DNS rebinding)', async () => {
  const s = await appWith({ enabled: true }, 'development')
  const statusWithHost = (host) =>
    new Promise((resolve, reject) => {
      const req = httpRequest(`${s.base}/_inspect/api/requests`, { headers: { host } }, (res) => {
        res.resume()
        resolve(res.statusCode)
      })
      req.on('error', reject)
      req.end()
    })
  try {
    assert.equal(await statusWithHost('evil.example'), 403)
    assert.equal(await statusWithHost('localhost:1234'), 200)
  } finally {
    await s.close()
  }
})
