import { createServer, request as httpRequest } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterEach, expect, spyOn, test } from 'bun:test'

import { currentDbScope } from '../../src/capture/context.js'
import { createNodeCapture } from '../../src/capture/node-capture.js'
import { DB_DEFAULTS } from '../../src/domain/db.js'
import type { CaptureHooks, RecordDraft } from '../../src/domain/types.js'

const servers: Server[] = []
afterEach(() => {
  for (const s of servers.splice(0)) s.close()
})

const baseHooks: CaptureHooks = {
  route: () => null,
  params: () => ({}),
  query: () => ({}),
  body: () => undefined,
}

const run = async (opts: {
  maxBodyBytes?: number
  hooks?: Partial<CaptureHooks>
  method?: string
  path?: string
  reqHeaders?: Record<string, string>
  install?: boolean
  withNext?: boolean
  respond: (req: IncomingMessage, res: ServerResponse) => void
}): Promise<{ drafts: RecordDraft[]; status: number; body: string }> => {
  const drafts: RecordDraft[] = []
  const capture = createNodeCapture({
    maxBodyBytes: opts.maxBodyBytes ?? 1024,
    bodyKeys: ['password'],
    db: { ...DB_DEFAULTS },
    record: (d) => drafts.push(d),
  })
  const server = createServer((req, res) => {
    const respond = (): void => {
      opts.respond(req, res)
    }
    if (opts.install === false) respond()
    else if (opts.withNext) capture(req, res, { ...baseHooks, ...opts.hooks }, respond)
    else {
      capture(req, res, { ...baseHooks, ...opts.hooks })
      respond()
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  servers.push(server)
  const port = (server.address() as AddressInfo).port
  const out = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path: opts.path ?? '/',
        method: opts.method ?? 'GET',
        headers: opts.reqHeaders,
      },
      (res) => {
        let body = ''
        res.on('data', (c) => {
          body += String(c)
        })
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body })
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
  await new Promise((r) => setTimeout(r, 20))
  return { drafts, ...out }
}

test('captures status, route, params, query, body and response', async () => {
  const { drafts } = await run({
    method: 'POST',
    path: '/users/7?q=1',
    reqHeaders: { 'content-type': 'application/json' },
    hooks: {
      route: () => '/users/:id',
      params: () => ({ id: '7' }),
      query: () => ({ q: '1' }),
      body: () => ({ a: 1 }),
    },
    respond: (_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end('{"ok":true}')
    },
  })
  expect(drafts).toHaveLength(1)
  const d = drafts[0]
  expect(d).toMatchObject({
    method: 'POST',
    url: '/users/7?q=1',
    route: '/users/:id',
    status: 200,
    request: { params: { id: '7' }, query: { q: '1' }, body: { kind: 'json', value: { a: 1 } } },
    response: { body: { kind: 'json', value: { ok: true } } },
  })
  expect(d.aborted).toBeUndefined()
})

test('caps buffered bytes at maxBodyBytes and counts the rest', async () => {
  const { drafts } = await run({
    maxBodyBytes: 16,
    respond: (_req, res) => {
      res.setHeader('content-type', 'text/plain')
      res.write('0123456789')
      res.write('0123456789')
      res.write('0123456789')
      res.end()
    },
  })
  expect(drafts[0].response.body).toMatchObject({ kind: 'text', truncated: true, size: 30 })
})

test('close then finish records exactly once', async () => {
  const { drafts } = await run({
    respond: (_req, res) => {
      res.emit('close')
      res.end('x')
    },
  })
  expect(drafts).toHaveLength(1)
  expect(drafts[0].aborted).toBe(true)
})

test('HEAD response body is none', async () => {
  const { drafts } = await run({
    method: 'HEAD',
    respond: (_req, res) => {
      res.setHeader('content-type', 'text/plain')
      res.end('hello')
    },
  })
  expect(drafts[0].response.body).toEqual({ kind: 'none' })
})

test('zero-length binary request body is none', async () => {
  const { drafts } = await run({
    hooks: { body: () => Buffer.alloc(0) },
    respond: (_req, res) => {
      res.end('x')
    },
  })
  expect(drafts[0].request.body).toEqual({ kind: 'none' })
})

test('write() return value is passed through', async () => {
  // Same handler with and without capture: a 4 MiB first write to a client that has not read yet
  // overflows the socket buffer, so the original returns false; the wrapper must return it unchanged.
  const big = Buffer.alloc(4 * 1024 * 1024)
  const results: boolean[] = []
  for (const install of [false, true]) {
    await run({
      install,
      respond: (_req, res) => {
        results.push(res.write(big))
        res.end()
      },
    })
  }
  expect(results).toHaveLength(2)
  expect(results[0]).toBe(false)
  expect(results[1]).toBe(results[0])
})

test('throwing hook does not break the response', async () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  try {
    const { status, body } = await run({
      hooks: {
        route: () => {
          throw new Error('boom')
        },
      },
      respond: (_req, res) => {
        res.write('hello ')
        res.end('world')
      },
    })
    expect(status).toBe(200)
    expect(body).toBe('hello world')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toStartWith('[req-inspect] capture')
  } finally {
    warn.mockRestore()
  }
})

test('body hook value is redacted before truncation', async () => {
  const { drafts } = await run({
    maxBodyBytes: 64,
    reqHeaders: { 'content-type': 'application/json' },
    hooks: { body: () => ({ password: 'hunter2', filler: 'x'.repeat(200) }) },
    respond: (_req, res) => {
      res.end('x')
    },
  })
  expect(JSON.stringify(drafts[0].request.body)).not.toContain('hunter2')
})

test('capture never throws when its setup fails and leaves the response untouched', async () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  const drafts: RecordDraft[] = []
  const capture = createNodeCapture({
    maxBodyBytes: 1024,
    bodyKeys: [],
    db: { ...DB_DEFAULTS },
    record: (d) => drafts.push(d),
  })
  let threw: unknown
  let untouched = false
  const server = createServer((req, res) => {
    const write: unknown = Reflect.get(res, 'write')
    const end: unknown = Reflect.get(res, 'end')
    res.once = () => {
      throw new Error('once boom')
    }
    try {
      capture(req, res, baseHooks)
    } catch (err) {
      threw = err
    }
    untouched = Reflect.get(res, 'write') === write && Reflect.get(res, 'end') === end
    res.end('still ok')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  servers.push(server)
  const port = (server.address() as AddressInfo).port
  const res = await fetch(`http://127.0.0.1:${String(port)}/`)
  expect(await res.text()).toBe('still ok')
  expect(threw).toBeUndefined()
  expect(untouched).toBe(true)
  warn.mockRestore()
})

const track = (): void => {
  currentDbScope()?.track({
    system: 'postgresql',
    operation: 'SELECT',
    target: null,
    statement: 'select 1',
    startMs: performance.now() - 1,
    endMs: performance.now(),
    fingerprint: 'select ?',
  })
}

test('with next, db events tracked in the handler land on the record', async () => {
  const { drafts } = await run({
    withNext: true,
    respond: (_req, res) => {
      track()
      track()
      res.end('ok')
    },
  })
  expect(drafts[0]?.db?.events).toHaveLength(2)
})

test('without next there is no db context or db field', async () => {
  let scope: unknown = 'unset'
  const { drafts } = await run({
    respond: (_req, res) => {
      scope = currentDbScope()
      res.end('ok')
    },
  })
  expect(scope).toBeNull()
  expect(drafts[0]).not.toHaveProperty('db')
})

test('a track after the response finished is not on the record', async () => {
  const { drafts } = await run({
    withNext: true,
    respond: (_req, res) => {
      track()
      res.end('ok')
      setTimeout(track, 30)
    },
  })
  await new Promise((r) => setTimeout(r, 60))
  expect(drafts[0]?.db?.events).toHaveLength(1)
})

test('next is still called once when setup fails', () => {
  let calls = 0
  const capture = createNodeCapture({
    maxBodyBytes: 10,
    bodyKeys: [],
    db: { ...DB_DEFAULTS },
    record: () => undefined,
  })
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  const res = {
    once: () => {
      throw new Error('boom')
    },
  } as unknown as ServerResponse
  capture({ headers: {} } as IncomingMessage, res, baseHooks, () => {
    calls++
  })
  warn.mockRestore()
  expect(calls).toBe(1)
})
