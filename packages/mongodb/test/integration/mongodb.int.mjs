import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MongoClient } from 'mongodb'
import mongoose from 'mongoose'
import { inspector } from '../../../express/dist/index.js'
import { instrumentMongo } from '../../dist/index.js'
import { start, getRecords, findRecord } from '../../../express/test/integration/helpers.mjs'

const enabled = process.env.REQ_INSPECT_DB_IT === '1'
const skip = enabled ? false : 'set REQ_INSPECT_DB_IT=1 (and start test/db/compose.yml) to run'
const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:27017/ri_test'

let server
let client
let native
let Note
const ids = []

const record = (url) => findRecord(server.base, (x) => x.url === url)
const ops = (rec) => rec.db.events.map((e) => e.operation)

before(async () => {
  if (!enabled) return
  const express = (await import('express5')).default
  client = new MongoClient(MONGO_URL, { monitorCommands: true })
  instrumentMongo(client)
  await client.connect()
  native = client.db()
  await native.dropDatabase()

  await mongoose.connect(MONGO_URL, { monitorCommands: true })
  instrumentMongo(mongoose.connection.getClient())
  Note = mongoose.model('Note', new mongoose.Schema({ title: String, password: String }))

  // startup seed runs outside any request, so it must not be recorded
  const seeded = await native.collection('items').insertMany(Array.from({ length: 6 }, (_, i) => ({ n: i })))
  ids.push(...Object.values(seeded.insertedIds))

  const app = express()
  app.use(inspector({ enabled: true }))
  app.get('/native', async (_req, res) => {
    const people = native.collection('people')
    await people.insertOne({ name: 'ada', password: 'hunter2' })
    res.json(await people.find({ name: 'ada' }).toArray())
  })
  app.get('/mongoose', async (_req, res) => {
    await Note.create({ title: 'hello', password: 'hunter2' })
    res.json(await Note.findOne({ title: 'hello' }))
  })
  app.get('/n-plus-one', async (_req, res) => {
    const out = []
    for (const _id of ids) out.push(await native.collection('items').findOne({ _id }))
    res.json(out)
  })
  server = await start(app)
})

after(async () => {
  if (!enabled) return
  await server?.close()
  await native?.dropDatabase()
  await mongoose.disconnect()
  await client?.close()
})

test('native insertOne and find are recorded with targets and rows', { skip }, async () => {
  await fetch(`${server.base}/native`)
  const rec = await record('/native')
  assert.deepEqual(ops(rec), ['insert', 'find'])
  for (const e of rec.db.events) {
    assert.equal(e.system, 'mongodb')
    assert.equal(e.target, 'people')
  }
  assert.equal(rec.db.events[0].rows, 1)
  assert.equal(rec.db.events[1].rows, 1)
})

test('a password field in a written document is redacted', { skip }, async () => {
  await fetch(`${server.base}/native`)
  const rec = await record('/native')
  const text = JSON.stringify(rec.db.events)
  assert.doesNotMatch(text, /hunter2/)
  assert.match(text, /\[redacted\]/)
})

test('mongoose create and findOne are recorded', { skip }, async () => {
  await fetch(`${server.base}/mongoose`)
  const rec = await record('/mongoose')
  assert.deepEqual(ops(rec), ['insert', 'find'])
  assert.equal(rec.db.events[0].target, 'notes')
  assert.equal(rec.db.events[1].target, 'notes')
  assert.doesNotMatch(JSON.stringify(rec.db.events), /hunter2/)
})

test('six findOne by _id flag as repeated', { skip }, async () => {
  await fetch(`${server.base}/n-plus-one`)
  const rec = await record('/n-plus-one')
  assert.equal(rec.db.events.length, 6)
  assert.equal(rec.db.flags.repeated[0].count, 6)
  const summary = (await getRecords(server.base)).find((x) => x.url === '/n-plus-one')
  assert.equal(summary.dbFlag, 'repeated')
})

test('startup seed is on no record', { skip }, async () => {
  for (const s of await getRecords(server.base)) {
    const rec = await findRecord(server.base, (x) => x.id === s.id)
    for (const e of rec.db?.events ?? []) assert.notEqual(e.operation, 'dropDatabase')
    assert.ok(!(rec.db?.events ?? []).some((e) => e.operation === 'insert' && e.target === 'items'))
  }
})
