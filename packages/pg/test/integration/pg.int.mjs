import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { pgTable, integer, text } from 'drizzle-orm/pg-core'
import { eq } from 'drizzle-orm'
import { inspector } from '../../../express/dist/index.js'
import { instrumentPg } from '../../dist/index.js'
import { start, getRecords, findRecord } from '../../../express/test/integration/helpers.mjs'

const enabled = process.env.REQ_INSPECT_DB_IT === '1'
const skip = enabled ? false : 'set REQ_INSPECT_DB_IT=1 (and start test/db/compose.yml) to run'
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres'

const users = pgTable('users', { id: integer('id').primaryKey(), name: text('name') })

let server
let pool

const record = (url) => findRecord(server.base, (x) => x.url === url)
const ops = (rec) => rec.db.events.map((e) => e.operation)

before(async () => {
  if (!enabled) return
  const express = (await import('express5')).default
  instrumentPg(pg)
  pool = new pg.Pool({ connectionString: DATABASE_URL })
  // startup queries run outside any request, so they must not be recorded
  await pool.query('drop table if exists users')
  await pool.query('create table users (id integer primary key, name text)')
  await pool.query("insert into users select g, 'user' || g from generate_series(1, 10) g")

  const db = drizzle(pool)
  const app = express()
  app.use(inspector({ enabled: true }))
  app.get('/raw', async (_req, res) => {
    const r = await pool.query('select * from users where id = $1', [1])
    res.json({ rows: r.rows })
  })
  app.get('/tx', async (_req, res) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('insert into users (id, name) values ($1, $2)', [101, 'a'])
      await client.query('insert into users (id, name) values ($1, $2)', [102, 'b'])
      await client.query('COMMIT')
      res.json({ ok: true })
    } finally {
      client.release()
    }
  })
  app.get('/drizzle', async (_req, res) => {
    res.json(await db.select().from(users).where(eq(users.id, 2)))
  })
  app.get('/n-plus-one', async (_req, res) => {
    const out = []
    for (let id = 1; id <= 6; id++) {
      out.push((await pool.query('select name from users where id = $1', [id])).rows[0])
    }
    res.json(out)
  })
  app.get('/bad-sql', async (_req, res) => {
    try {
      await pool.query('select * from no_such_table')
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'app failure' })
    }
  })
  server = await start(app)
})

after(async () => {
  if (!enabled) return
  await server?.close()
  await pool?.query('drop table if exists users')
  await pool?.end()
})

test('raw pool.query is recorded with operation, target and rows', { skip }, async () => {
  await fetch(`${server.base}/raw`)
  const rec = await record('/raw')
  assert.equal(rec.db.events.length, 1)
  const [e] = rec.db.events
  assert.equal(e.system, 'postgresql')
  assert.equal(e.operation, 'SELECT')
  assert.equal(e.target, 'users')
  assert.equal(e.rows, 1)
  assert.equal(e.error, undefined)
})

test('a transaction records BEGIN, both inserts and COMMIT in order', { skip }, async () => {
  await fetch(`${server.base}/tx`)
  const rec = await record('/tx')
  assert.deepEqual(ops(rec), ['BEGIN', 'INSERT', 'INSERT', 'COMMIT'])
  assert.equal(rec.db.events[1].target, 'users')
  assert.equal(rec.db.events[1].rows, 1)
  assert.equal(rec.db.events[2].rows, 1)
})

test('a Drizzle select is recorded', { skip }, async () => {
  await fetch(`${server.base}/drizzle`)
  const rec = await record('/drizzle')
  assert.equal(rec.db.events.length, 1)
  const [e] = rec.db.events
  assert.equal(e.operation, 'SELECT')
  assert.equal(e.target, 'users')
  assert.equal(e.rows, 1)
})

test('six single-row selects flag as repeated', { skip }, async () => {
  await fetch(`${server.base}/n-plus-one`)
  const rec = await record('/n-plus-one')
  assert.equal(rec.db.events.length, 6)
  assert.equal(rec.db.flags.repeated[0].count, 6)
  const summary = (await getRecords(server.base)).find((x) => x.url === '/n-plus-one')
  assert.equal(summary.dbCount, 6)
  assert.equal(summary.dbFlag, 'repeated')
})

test('bad SQL records an error and the app still answers its own 500', { skip }, async () => {
  const res = await fetch(`${server.base}/bad-sql`)
  assert.equal(res.status, 500)
  assert.deepEqual(await res.json(), { error: 'app failure' })
  const rec = await record('/bad-sql')
  assert.equal(rec.db.events.length, 1)
  assert.equal(typeof rec.db.events[0].error, 'string')
  assert.ok(rec.db.events[0].error.length > 0)
})

test('startup queries are on no record', { skip }, async () => {
  for (const s of await getRecords(server.base)) {
    const rec = await findRecord(server.base, (x) => x.id === s.id)
    for (const e of rec.db?.events ?? []) {
      assert.doesNotMatch(e.statement, /generate_series|create table|drop table/i)
    }
  }
})
