import { afterEach, expect, spyOn, test } from 'bun:test'
import { createInspector, toSummary } from '../src/inspector.js'
import { captureRawBody } from '../src/body.js'
import type { RecordDraft } from '../src/types.js'

const tick = () => new Promise((r) => setImmediate(r))
const none = { kind: 'none' } as const
const draft = (over: Partial<RecordDraft> = {}): RecordDraft => ({
  startedAt: 1,
  durationMs: 2,
  method: 'GET',
  url: '/x',
  route: null,
  status: 200,
  request: { headers: {}, query: {}, params: {}, body: none },
  response: { headers: {}, body: none },
  ...over,
})

test('record stores redacted copy with id and v', async () => {
  const i = createInspector({})
  i.record(
    draft({
      request: {
        headers: { authorization: 'x' },
        query: {},
        params: {},
        body: { kind: 'json', value: { password: 'p' }, truncated: false, size: 16 },
      },
      response: {
        headers: { 'set-cookie': 'c=1' },
        body: { kind: 'json', value: { token: 't', ok: 1 }, truncated: false, size: 9 },
      },
    }),
  )
  expect(i.store.list()).toHaveLength(0)
  await tick()
  const [r] = i.store.list()
  expect(r).toMatchObject({ v: 1, id: 'r_000001' })
  expect(r.request.headers.authorization).toBe('[redacted]')
  expect((r.request.body as any).value.password).toBe('[redacted]')
  expect(r.response.headers['set-cookie']).toBe('[redacted]')
  expect((r.response.body as any).value).toEqual({ token: '[redacted]', ok: 1 })
})
test('string body values pass through unchanged', async () => {
  const i = createInspector({})
  i.record(
    draft({
      request: {
        headers: {},
        query: {},
        params: {},
        body: { kind: 'text', value: 'password=1', truncated: false, size: 10 },
      },
    }),
  )
  await tick()
  expect((i.store.list()[0].request.body as any).value).toBe('password=1')
})
test('isInspectorPath', () => {
  const i = createInspector({})
  expect(i.isInspectorPath('/_inspect')).toBe(true)
  expect(i.isInspectorPath('/_inspect/api/requests')).toBe(true)
  expect(i.isInspectorPath('/_inspectx')).toBe(false)
})
test('shouldIgnore prefix and regexp', () => {
  const i = createInspector({ ignore: ['/health', /\.ico$/] })
  expect(i.shouldIgnore('/health/live')).toBe(true)
  expect(i.shouldIgnore('/favicon.ico')).toBe(true)
  expect(i.shouldIgnore('/users')).toBe(false)
})

let spy: ReturnType<typeof spyOn> | undefined
afterEach(() => {
  spy?.mockRestore()
  spy = undefined
})

test('record never throws and warns once', async () => {
  spy = spyOn(console, 'warn').mockImplementation(() => {})
  const i = createInspector({})
  const bad = () =>
    draft({
      request: {
        get headers(): Record<string, string> {
          throw new Error('boom')
        },
        query: {},
        params: {},
        body: none,
      },
    })
  expect(() => {
    i.record(bad())
    i.record(bad())
  }).not.toThrow()
  await tick()
  expect(spy).toHaveBeenCalledTimes(1)
  expect(String(spy.mock.calls[0][0])).toBe('[req-inspect] record: boom')
  expect(i.store.list()).toHaveLength(0)
})
test('record drops draft on RangeError from very deep body', async () => {
  spy = spyOn(console, 'warn').mockImplementation(() => {})
  const i = createInspector({})
  let deep: any = {}
  const root = deep
  for (let n = 0; n < 200000; n++) {
    deep.a = {}
    deep = deep.a
  }
  i.record(
    draft({
      request: {
        headers: {},
        query: {},
        params: {},
        body: { kind: 'json', value: root, truncated: false, size: 1 },
      },
    }),
  )
  await tick()
  expect(i.store.list()).toHaveLength(0)
})
test('toSummary drops request and response', () => {
  const s = toSummary({ ...draft(), v: 1, id: 'r_000001' })
  expect(Object.keys(s).sort()).toEqual([
    'durationMs',
    'id',
    'method',
    'route',
    'startedAt',
    'status',
    'url',
    'v',
  ])
})

test('captureRequestBody redacts before truncating an over-cap body', async () => {
  const i = createInspector({ maxBodyBytes: 64 })
  const body = i.captureRequestBody({ password: 'hunter2', filler: 'x'.repeat(200) }, 'application/json')
  expect(body).toMatchObject({ kind: 'text', truncated: true })
  expect(JSON.stringify(body)).not.toContain('hunter2')
  expect((body as any).value).toContain('"password":"[redacted]"')
  i.record(
    draft({
      request: { headers: { 'content-type': 'application/json' }, query: {}, params: {}, body },
    }),
  )
  await tick()
  expect(JSON.stringify(i.store.list()[0])).not.toContain('hunter2')
})
test('captureRequestBody redacts small bodies and leaves strings and buffers alone', () => {
  const i = createInspector({})
  expect(i.captureRequestBody({ token: 't', a: 1 }, 'application/json')).toEqual({
    kind: 'json',
    value: { token: '[redacted]', a: 1 },
    truncated: false,
    size: 28,
  })
  expect(i.captureRequestBody('hi', 'text/plain')).toEqual({
    kind: 'text',
    value: 'hi',
    truncated: false,
    size: 2,
  })
  expect(i.captureRequestBody(Buffer.from([1]), 'image/png')).toEqual({
    kind: 'binary',
    contentType: 'image/png',
    size: 1,
  })
})
test('truncated JSON response text is scrubbed of secret keys', async () => {
  const i = createInspector({ maxBodyBytes: 64 })
  const raw = Buffer.from(JSON.stringify({ token: 'tok_live_abc', n: 5, filler: 'x'.repeat(200) }))
  const body = captureRawBody([raw.subarray(0, 64)], raw.length, 'application/json', undefined, 64)
  expect((body as any).value).toContain('tok_live_abc') // precondition: capture itself is unredacted
  i.record(draft({ response: { headers: { 'content-type': 'application/json; charset=utf-8' }, body } }))
  await tick()
  const stored = i.store.list()[0].response.body as any
  expect(JSON.stringify(stored)).not.toContain('tok_live_abc')
  expect(stored.value).toContain('"token":"[redacted]"')
  expect(stored.value).toContain('"n":5')
})
test('scrub covers a secret value cut off by truncation, numbers, booleans and null', async () => {
  const i = createInspector({ redact: { bodyKeys: ['pin', 'flag', 'nothing'] } })
  const text =
    '{"pin": 1234, "flag":true, "nothing" : null, "esc\\"aped_token":"a\\"b", "keep":"ok", "secret":"tok_li'
  i.record(
    draft({
      response: {
        headers: { 'content-type': 'application/problem+json' },
        body: { kind: 'text', value: text, truncated: true, size: 999 },
      },
    }),
  )
  await tick()
  const v = (i.store.list()[0].response.body as any).value as string
  expect(v).toBe(
    '{"pin": "[redacted]", "flag":"[redacted]", "nothing" : "[redacted]", "esc\\"aped_token":"[redacted]", "keep":"ok", "secret":"[redacted]"',
  )
})
test('non-JSON text bodies are not scrubbed', async () => {
  const i = createInspector({})
  i.record(
    draft({
      response: {
        headers: { 'content-type': 'text/plain' },
        body: { kind: 'text', value: '"token":"x"', truncated: false, size: 11 },
      },
    }),
  )
  await tick()
  expect((i.store.list()[0].response.body as any).value).toBe('"token":"x"')
})
test('query object and url query string are redacted, other params kept in order', async () => {
  const i = createInspector({})
  i.record(
    draft({
      url: '/search?token=qs_secret&page=2&api_key=k&q=a%20b',
      request: {
        headers: {},
        query: { token: 'qs_secret', page: '2', api_key: 'k', q: 'a b' },
        params: {},
        body: none,
      },
    }),
  )
  await tick()
  const r = i.store.get(i.store.list()[0].id)!
  expect(r.url).toBe('/search?token=[redacted]&page=2&api_key=[redacted]&q=a%20b')
  expect(r.request.query).toEqual({ token: '[redacted]', page: '2', api_key: '[redacted]', q: 'a b' })
  expect(i.store.list()[0].url).toBe(r.url)
})
test('url without secret query keys is stored unchanged', async () => {
  const i = createInspector({})
  i.record(draft({ url: '/a?b=1&c&d=%ZZ' }))
  i.record(draft({ url: '/plain' }))
  await tick()
  expect(i.store.list().map((r) => r.url)).toEqual(['/plain', '/a?b=1&c&d=%ZZ'])
})
