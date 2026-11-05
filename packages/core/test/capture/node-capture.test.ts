import { createServer, request as httpRequest } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterEach, expect, spyOn, test } from 'bun:test'

import { createNodeCapture } from '../../src/capture/node-capture.js'
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
  respond: (req: IncomingMessage, res: ServerResponse) => void
}): Promise<{ drafts: RecordDraft[]; status: number; body: string }> => {
  const drafts: RecordDraft[] = []
  const capture = createNodeCapture({
    maxBodyBytes: opts.maxBodyBytes ?? 1024,
    bodyKeys: ['password'],
    record: (d) => drafts.push(d),
  })
  const server = createServer((req, res) => {
    if (opts.install !== false) capture(req, res, { ...baseHooks, ...opts.hooks })
    opts.respond(req, res)
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
