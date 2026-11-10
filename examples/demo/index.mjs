import { createRequire } from 'node:module'
import express from 'express'
import { inspector } from '@req-inspect/express'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const users = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Linus' },
]

const app = express()
app.use(inspector())
app.use(express.json())

app.get('/users', (req, res) => res.json(users))

app.get('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id))
  if (!user) return res.status(404).json({ error: 'not found' })
  res.json(user)
})

app.post('/users', (req, res) => {
  const user = { id: users.length + 1, ...req.body }
  users.push(user)
  res.status(201).json(user)
})

app.post('/login', (req, res) => {
  res.json({ user: req.body?.user, token: 'secret-token-123' })
})

app.get('/slow', (req, res) => {
  setTimeout(() => res.json({ ok: true }), 800)
})

app.get('/error', (req, res) => res.status(500).json({ error: 'boom' }))

app.get('/image', (req, res) => {
  res.type('png').send(PNG_1X1)
})

app.get('/big', (req, res) => res.type('text').send('x'.repeat(100_000)))

// Optional database routes. pg and mongodb are devDependencies of the adapter packages, so they are
// resolved from there; the adapters load from their built dist (run `bun run build` first).
const fromPackage = (name) => {
  const dir = new URL(`../../packages/${name}/`, import.meta.url)
  return { require: createRequire(new URL('package.json', dir)), entry: new URL('dist/index.js', dir).href }
}

if (process.env.DATABASE_URL) {
  const { require, entry } = fromPackage('pg')
  const pg = require('pg')
  const { instrumentPg } = await import(entry)
  instrumentPg(pg)
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

  app.get('/db/users', async (req, res, next) => {
    try {
      const sql = 'select id, name from (values (1, $1::text), (2, $2::text)) as users(id, name)'
      const { rows } = await pool.query(sql, ['Ada', 'Linus'])
      res.json(rows)
    } catch (err) {
      next(err)
    }
  })

  app.get('/db/n-plus-one', async (req, res, next) => {
    try {
      const out = []
      for (let id = 1; id <= 6; id++) {
        const { rows } = await pool.query('select $1::int as id, $2::text as name', [id, `user-${id}`])
        out.push(rows[0])
      }
      res.json(out)
    } catch (err) {
      next(err)
    }
  })
}

if (process.env.MONGO_URL) {
  const { require, entry } = fromPackage('mongodb')
  const { MongoClient } = require('mongodb')
  const { instrumentMongo } = await import(entry)
  const client = new MongoClient(process.env.MONGO_URL, { monitorCommands: true })
  instrumentMongo(client)
  await client.connect()
  const notes = client.db('req_inspect_demo').collection('notes')

  app.get('/db/notes', async (req, res, next) => {
    try {
      await notes.insertOne({ text: 'hello', at: new Date() })
      res.json(await notes.find({}).limit(10).toArray())
    } catch (err) {
      next(err)
    }
  })
}

const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  console.log(`Demo on http://localhost:${port} — inspector at http://localhost:${port}/_inspect/`)
})
