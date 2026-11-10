import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { inspector } from '@req-inspect/express'
import { currentDbScope } from '@req-inspect/core'
import { loadExpress, start, getRecords, findRecord } from './helpers.mjs'

let server

const track = () => {
  const now = performance.now()
  currentDbScope().track({
    system: 'postgresql',
    operation: 'SELECT',
    target: 'users',
    statement: 'select 1',
    startMs: now - 2,
    endMs: now,
    fingerprint: 'select 1',
  })
}

before(async () => {
  const express = await loadExpress()
  const app = express()
  app.use(inspector({ enabled: true }))
  app.get('/with-db', async (_req, res) => {
    await new Promise((r) => setTimeout(r, 5))
    track()
    track()
    res.json({ ok: true })
  })
  app.get('/no-db', (_req, res) => res.json({ ok: true }))
  server = await start(app)
})

after(async () => {
  await server.close()
})

test('db calls made in a handler land on the record and summary', async () => {
  await fetch(`${server.base}/with-db`)
  const full = await findRecord(server.base, (x) => x.url === '/with-db')
  assert.equal(full.db.events.length, 2)
  const summary = (await getRecords(server.base)).find((x) => x.url === '/with-db')
  assert.equal(summary.dbCount, 2)
  assert.equal(typeof summary.dbMs, 'number')
  assert.equal('db' in summary, false)
})

test('a route that tracks nothing has no db fields', async () => {
  await fetch(`${server.base}/no-db`)
  const full = await findRecord(server.base, (x) => x.url === '/no-db')
  assert.equal('db' in full, false)
  const summary = (await getRecords(server.base)).find((x) => x.url === '/no-db')
  assert.equal('dbCount' in summary, false)
})
