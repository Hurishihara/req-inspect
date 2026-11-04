import { afterAll, beforeAll, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, request as rawRequest } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHandler } from '../src/http.js'
import { createInspector } from '../src/inspector.js'
import { resolveOptions } from '../src/options.js'
import { RingStore } from '../src/store.js'
import type { InspectorOptions, RequestRecord } from '../src/types.js'

const uiDir = join(import.meta.dir, 'fixtures', 'ui')

function rec(id: string): RequestRecord {
  return {
    v: 1, id, startedAt: 0, durationMs: 1, method: 'GET', url: '/x', route: null, status: 200,
    request: { headers: {}, query: {}, params: {}, body: { kind: 'none' } },
    response: { headers: {}, body: { kind: 'none' } },
  }
}

const servers: Server[] = []
async function start(store: RingStore, opts: InspectorOptions, dir = uiDir): Promise<string> {
  const handler = createHandler(store, resolveOptions(opts, {}), dir, 50)
  const server = createServer(handler)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  servers.push(server)
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}
/** Raw request so dot segments / encodings reach the server unnormalized. */
function raw(base: string, path: string): Promise<{ status: number; body: string }> {
  const u = new URL(base)
  return new Promise((resolve, reject) => {
    const req = rawRequest({ host: u.hostname, port: u.port, path, method: 'GET' }, (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

const store = new RingStore(10)
let base = ''
beforeAll(async () => { base = await start(store, {}) })
afterAll(() => { for (const s of servers) { s.closeAllConnections(); s.close() } })

test('GET /_inspect redirects to trailing slash', async () => {
  const r = await fetch(base + '/_inspect', { redirect: 'manual' })
  expect(r.status).toBe(302); expect(r.headers.get('location')).toBe('/_inspect/')
})
test('serves index and assets', async () => {
  expect((await fetch(base + '/_inspect/')).headers.get('content-type')).toContain('text/html')
  expect((await fetch(base + '/_inspect/assets/app.js')).headers.get('content-type')).toContain('javascript')
})
test('missing asset → 404', async () => {
  expect((await fetch(base + '/_inspect/assets/nope.js')).status).toBe(404)
})
test('path traversal → 404 and never leaks file contents', async () => {
  const paths = [
    '/_inspect/assets/../../secret.txt',
    '/_inspect/assets/%2e%2e/%2e%2e/secret.txt',
    '/_inspect/assets/..%2f..%2fsecret.txt',
    '/_inspect/assets/..%5c..%5csecret.txt',
    '/_inspect/assets/%2e%2e%5c%2e%2e%5csecret.txt',
    '/_inspect/assets/../index.html',
    '/_inspect/assets/%00',
    '/_inspect/assets/app.js%00.txt',
    '/_inspect/assets/%E0%A4%A',
  ]
  for (const p of paths) {
    const r = await raw(base, p)
    expect([p, r.status]).toEqual([p, 404])
    expect(r.body).not.toContain('TOP-SECRET-CANARY')
  }
  expect((await raw(base, '/_inspect/assets/app.js')).status).toBe(200)
})
test('only the mount path prefix is served', async () => {
  expect((await raw(base, '/_inspectx/')).status).toBe(404)
  expect((await raw(base, '/other')).status).toBe(404)
})
test('query string is stripped before routing', async () => {
  expect((await fetch(base + '/_inspect/?x=1')).status).toBe(200)
  expect((await fetch(base + '/_inspect?x=1', { redirect: 'manual' })).headers.get('location')).toBe('/_inspect/')
})
test('list, get, 404, delete', async () => {
  store.add(rec('r_000001'))
  const list = await (await fetch(base + '/_inspect/api/requests')).json() as any[]
  expect(list[0].id).toBe('r_000001'); expect(list[0].request).toBeUndefined()
  const one = await fetch(base + '/_inspect/api/requests/r_000001')
  expect(one.status).toBe(200)
  expect(((await one.json()) as any).request).toBeDefined()
  expect((await fetch(base + '/_inspect/api/requests/r_999999')).status).toBe(404)
  expect((await fetch(base + '/_inspect/api/requests', { method: 'DELETE' })).status).toBe(204)
  expect(store.list()).toEqual([])
})
test('list honours limit and before; bad limit falls back to default', async () => {
  store.clear()
  for (let i = 1; i <= 5; i++) store.add(rec(`r_00000${i}`))
  const ids = async (q: string) =>
    ((await (await fetch(base + '/_inspect/api/requests' + q)).json()) as any[]).map((r) => r.id)
  expect(await ids('?limit=2')).toEqual(['r_000005', 'r_000004'])
  expect(await ids('?before=r_000003&limit=1')).toEqual(['r_000002'])
  expect(await ids('?limit=abc')).toHaveLength(5)
  store.clear()
})
test('api has cache-control no-store and json content type', async () => {
  for (const p of ['/_inspect/api/requests', '/_inspect/api/requests/r_999999', '/_inspect/api/nope']) {
    const r = await fetch(base + p)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(r.headers.get('content-type')).toContain('application/json')
  }
})
test('method mismatch on known route → 404 json', async () => {
  const r = await fetch(base + '/_inspect/api/requests', { method: 'POST' })
  expect(r.status).toBe(404); expect(await r.json()).toEqual({ error: 'not found' })
})
test('SSE delivers record events and pings', async () => {
  const ac = new AbortController()
  const r = await fetch(base + '/_inspect/api/stream', { signal: ac.signal })
  expect(r.headers.get('content-type')).toContain('text/event-stream')
  expect(r.headers.get('cache-control')).toBe('no-store')
  const reader = r.body!.getReader()
  const dec = new TextDecoder()
  let text = ''
  setTimeout(() => store.add(rec('r_000042')), 20)
  const deadline = Date.now() + 3000
  while (Date.now() < deadline && !(text.includes('event: record') && text.includes(': ping'))) {
    const { value, done } = await reader.read()
    if (done) break
    text += dec.decode(value)
  }
  ac.abort()
  expect(text.startsWith('retry: 2000\n\n')).toBe(true)
  expect(text).toContain('event: record\ndata: ')
  expect(text).toContain('"id":"r_000042"')
  expect(text).not.toContain('"request"')
  expect(text).toContain(': ping\n\n')
  store.clear()
})
test('SSE unsubscribes on close', async () => {
  let subs = 0
  const s = new RingStore(5)
  const orig = s.subscribe.bind(s)
  s.subscribe = (fn) => { subs++; const un = orig(fn); return () => { subs--; un() } }
  const b = await start(s, {})
  const ac = new AbortController()
  const r = await fetch(b + '/_inspect/api/stream', { signal: ac.signal })
  await r.body!.getReader().read()
  expect(subs).toBe(1)
  ac.abort()
  const deadline = Date.now() + 2000
  while (subs !== 0 && Date.now() < deadline) await new Promise((res) => setTimeout(res, 20))
  expect(subs).toBe(0)
})
test('guard: auth configured → 401 with WWW-Authenticate', async () => {
  const b = await start(new RingStore(5), { auth: { user: 'u', pass: 'p' } })
  const r = await fetch(b + '/_inspect/api/requests')
  expect(r.status).toBe(401)
  expect(r.headers.get('www-authenticate')).toBe('Basic realm="req-inspect"')
  const ok = await fetch(b + '/_inspect/api/requests', { headers: { authorization: 'Basic ' + btoa('u:p') } })
  expect(ok.status).toBe(200)
  expect((await fetch(b + '/_inspect/', { headers: { authorization: 'Basic ' + btoa('u:bad') } })).status).toBe(401)
})
test('guard: forwarded header without auth → 403', async () => {
  const r = await fetch(base + '/_inspect/api/requests', { headers: { 'x-forwarded-for': '1.2.3.4' } })
  expect(r.status).toBe(403)
})
test('unknown route → 404 json', async () => {
  const r = await fetch(base + '/_inspect/api/nope')
  expect(r.status).toBe(404); expect(await r.json()).toEqual({ error: 'not found' })
})
test('missing ui dir → 500 explanatory text, api still works', async () => {
  const empty = mkdtempSync(join(tmpdir(), 'req-inspect-empty-'))
  try {
    const b = await start(new RingStore(5), {}, empty)
    const r = await fetch(b + '/_inspect/')
    expect(r.status).toBe(500)
    expect(r.headers.get('content-type')).toContain('text/plain')
    expect(await r.text()).toBe(`req-inspect: dashboard files missing from package (expected at ${empty})`)
    expect((await fetch(b + '/_inspect/api/requests')).status).toBe(200)
  } finally { rmSync(empty, { recursive: true, force: true }) }
})
test('custom mount path', async () => {
  const b = await start(new RingStore(5), { path: '/dbg' })
  expect((await fetch(b + '/dbg/api/requests')).status).toBe(200)
  expect((await fetch(b + '/dbg', { redirect: 'manual' })).headers.get('location')).toBe('/dbg/')
})
test('createInspector exposes handle using the given uiDir', async () => {
  const insp = createInspector({}, { uiDir })
  const server = createServer(insp.handle)
  servers.push(server)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const b = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  expect((await fetch(b + '/_inspect/')).status).toBe(200)
})
