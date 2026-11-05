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

const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  console.log(`Demo on http://localhost:${port} — inspector at http://localhost:${port}/_inspect/`)
})
