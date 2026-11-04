import { afterEach, expect, spyOn, test } from 'bun:test'
import { createInspector, toSummary } from '../src/inspector.js'
import type { RecordDraft } from '../src/types.js'

const tick = () => new Promise((r) => setImmediate(r))
const none = { kind: 'none' } as const
const draft = (over: Partial<RecordDraft> = {}): RecordDraft => ({
  startedAt: 1, durationMs: 2, method: 'GET', url: '/x', route: null, status: 200,
  request: { headers: {}, query: {}, params: {}, body: none },
  response: { headers: {}, body: none },
  ...over,
})

test('record stores redacted copy with id and v', async () => {
  const i = createInspector({})
  i.record(draft({
    request: { headers: { authorization: 'x' }, query: {}, params: {}, body: { kind: 'json', value: { password: 'p' }, truncated: false, size: 16 } },
    response: { headers: { 'set-cookie': 'c=1' }, body: { kind: 'json', value: { token: 't', ok: 1 }, truncated: false, size: 9 } },
  }))
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
  i.record(draft({ request: { headers: {}, query: {}, params: {}, body: { kind: 'text', value: 'password=1', truncated: false, size: 10 } } }))
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
afterEach(() => { spy?.mockRestore(); spy = undefined })

test('record never throws and warns once', async () => {
  spy = spyOn(console, 'warn').mockImplementation(() => {})
  const i = createInspector({})
  const bad = () => draft({
    request: { get headers(): Record<string, string> { throw new Error('boom') }, query: {}, params: {}, body: none },
  })
  expect(() => { i.record(bad()); i.record(bad()) }).not.toThrow()
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
  for (let n = 0; n < 200000; n++) { deep.a = {}; deep = deep.a }
  i.record(draft({ request: { headers: {}, query: {}, params: {}, body: { kind: 'json', value: root, truncated: false, size: 1 } } }))
  await tick()
  expect(i.store.list()).toHaveLength(0)
})
test('toSummary drops request and response', () => {
  const s = toSummary({ ...draft(), v: 1, id: 'r_000001' })
  expect(Object.keys(s).sort()).toEqual(
    ['durationMs', 'id', 'method', 'route', 'startedAt', 'status', 'url', 'v'],
  )
})
