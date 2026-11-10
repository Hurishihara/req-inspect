import { AsyncLocalStorage } from 'node:async_hooks'

import { expect, test } from 'bun:test'

import { createDbSink, currentDbScope, runInScope } from '../../src/capture/context.js'
import { DB_DEFAULTS } from '../../src/domain/db.js'
import type { DbEventInput, DbOptions } from '../../src/domain/types.js'

const sink = (db: DbOptions = {}, bodyKeys: (string | RegExp)[] = ['password']) =>
  createDbSink({ db: { ...DB_DEFAULTS, ...db }, bodyKeys, t0: 0 })

const input = (over: Partial<DbEventInput> = {}): DbEventInput => ({
  system: 'postgresql',
  operation: 'SELECT',
  target: 'users',
  statement: 'select 1',
  startMs: 10,
  endMs: 12,
  fingerprint: 'select ?',
  ...over,
})

test('currentDbScope is null at top level', () => {
  expect(currentDbScope()).toBeNull()
})

test('scope survives await, timers and Promise.all branches', async () => {
  const s = sink()
  await runInScope(s, async () => {
    expect(currentDbScope()).toBe(s.scope)
    await Promise.resolve()
    expect(currentDbScope()).toBe(s.scope)
    await new Promise<void>((r) =>
      setTimeout(() => {
        expect(currentDbScope()).toBe(s.scope)
        r()
      }, 1),
    )
    await Promise.all([
      (async () => {
        await Promise.resolve()
        expect(currentDbScope()).toBe(s.scope)
      })(),
      new Promise<void>((r) =>
        setImmediate(() => {
          expect(currentDbScope()).toBe(s.scope)
          r()
        }),
      ),
    ])
  })
  expect(currentDbScope()).toBeNull()
})

test('parallel scopes are isolated', async () => {
  const a = sink()
  const b = sink()
  const seen = await Promise.all([
    runInScope(a, async () => {
      await new Promise((r) => setTimeout(r, 5))
      return currentDbScope()
    }),
    runInScope(b, async () => {
      await Promise.resolve()
      return currentDbScope()
    }),
  ])
  expect(seen[0]).toBe(a.scope)
  expect(seen[1]).toBe(b.scope)
})

test('the storage is shared through a global symbol', () => {
  runInScope(sink(), () => undefined)
  const als = (globalThis as unknown as Record<symbol, unknown>)[Symbol.for('req-inspect.context')]
  expect(als).toBeInstanceOf(AsyncLocalStorage)
})

test('1000 identical tracks: 100 stored, 900 dropped, true repeat count', () => {
  const s = sink()
  for (let i = 0; i < 1000; i++) s.scope.track(input())
  const rec = s.close()
  expect(rec?.events).toHaveLength(100)
  expect(rec?.dropped).toBe(900)
  expect(rec?.flags.repeated[0]).toEqual({ fingerprint: 'select ?', count: 1000, first: 0 })
})

test('track after close changes nothing and does not throw', () => {
  const s = sink()
  s.scope.track(input())
  const rec = s.close()
  expect(() => {
    s.scope.track(input())
  }).not.toThrow()
  expect(rec?.events).toHaveLength(1)
  expect(rec?.dropped).toBe(0)
})

test('close returns undefined when nothing was tracked', () => {
  expect(sink().close()).toBeUndefined()
})

test('params are dropped by default, kept with db.params', () => {
  const off = sink()
  off.scope.track(input({ params: [1, 2, 3] }))
  const offEvent = off.close()?.events[0]
  expect(offEvent).toMatchObject({ paramCount: 3 })
  expect(offEvent).not.toHaveProperty('params')
  const on = sink({ params: true })
  on.scope.track(input({ params: [1, 2, 3] }))
  expect(on.close()?.events[0]).toMatchObject({ params: [1, 2, 3], paramCount: 3 })
})

test('mongo document is redacted into the statement', () => {
  const s = sink()
  s.scope.track(input({ system: 'mongodb', document: { find: 'users', filter: { password: 'x' } } }))
  const st = s.close()?.events[0]?.statement ?? ''
  expect(st).toContain('"[redacted]"')
  expect(st).not.toContain('"x"')
})

test('offsets, durations, caps, totals and slow flags', () => {
  const s = createDbSink({ db: { ...DB_DEFAULTS, slowMs: 100 }, bodyKeys: [], t0: 5 })
  s.scope.track(input({ startMs: 10.04, endMs: 12.06, statement: 'x'.repeat(3000), error: 'e'.repeat(600) }))
  s.scope.track(input({ startMs: 20, endMs: 150, fingerprint: 'other' }))
  const rec = s.close()
  expect(rec?.events[0]).toMatchObject({ offsetMs: 5, durationMs: 2 })
  expect(rec?.events[0]?.statement).toHaveLength(2048)
  expect(rec?.events[0]?.error).toHaveLength(500)
  expect(rec?.flags.slow).toEqual([1])
  expect(rec?.totalMs).toBe(132)
})
