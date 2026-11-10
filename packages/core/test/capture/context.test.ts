import { AsyncLocalStorage } from 'node:async_hooks'

import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test'

import {
  createDbSink,
  currentDbScope,
  noteRequest,
  peekRequestsSeen,
  resetContextState,
  runInScope,
  type DbSink,
} from '../../src/capture/context.js'
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

test('a 1 MB fingerprint is capped for the event', () => {
  const s = sink()
  s.scope.track(input({ fingerprint: 'x'.repeat(1_000_000) }))
  const rec = s.close()
  expect(rec?.events[0]?.fingerprint.length).toBeLessThanOrEqual(2048)
})

test('a BigInt in a mongo document still stores the event with the plain statement', () => {
  const s = sink()
  s.scope.track(input({ system: 'mongodb', statement: 'insert users', document: { n: 1n } }))
  expect(s.close()?.events[0]?.statement).toBe('insert users')
})

test('the scope is null once the sink is closed', async () => {
  const s = sink()
  await runInScope(s, async () => {
    s.scope.track(input())
    s.close()
    await Promise.resolve()
    expect(currentDbScope()).toBeNull()
  })
})

describe('shared slot versioning', () => {
  const KEY = Symbol.for('req-inspect.context')
  const META = Symbol.for('req-inspect.context.meta')
  const g = globalThis as unknown as Record<symbol, unknown>
  let saved: [unknown, unknown]
  beforeEach(() => {
    saved = [g[KEY], g[META]]
    Reflect.deleteProperty(g, KEY)
    Reflect.deleteProperty(g, META)
    resetContextState()
  })
  afterEach(() => {
    for (const [k, v] of [
      [KEY, saved[0]],
      [META, saved[1]],
    ] as const) {
      if (v === undefined) Reflect.deleteProperty(g, k)
      else g[k] = v
    }
    resetContextState()
    jest.restoreAllMocks()
  })

  // What core 0.4.0 does on every use.
  const legacyAls = (): AsyncLocalStorage<DbSink> =>
    (g[KEY] ??= new AsyncLocalStorage<DbSink>()) as AsyncLocalStorage<DbSink>

  test('a 0.4.0 copy reading the slot after the new core shares scopes both ways', () => {
    const a = sink()
    runInScope(a, () => {
      const old = legacyAls()
      expect(old).toBeInstanceOf(AsyncLocalStorage)
      expect(old.getStore()).toBe(a)
    })
    const b = sink()
    legacyAls().run(b, () => {
      expect(currentDbScope()).toBe(b.scope)
    })
  })

  test('a 0.4.0 copy that created the slot first is shared and left bare', () => {
    const bare = legacyAls()
    const a = sink()
    bare.run(a, () => {
      expect(currentDbScope()).toBe(a.scope)
    })
    runInScope(a, () => {
      expect(bare.getStore()).toBe(a)
    })
    expect(g[KEY]).toBe(bare)
  })

  test('meta version 2 warns once and keeps a private slot', () => {
    const bare = legacyAls()
    const meta = { version: 2, requestsSeen: 0 }
    g[META] = meta
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    const s = sink()
    runInScope(s, () => {
      expect(currentDbScope()).toBe(s.scope)
      expect(bare.getStore()).toBeUndefined()
    })
    runInScope(s, () => undefined)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('context format 2 and 1')
    expect(g[KEY]).toBe(bare)
    expect(g[META]).toBe(meta)
  })

  test('a non-AsyncLocalStorage value in the slot warns once and keeps a private slot', () => {
    const odd = { hello: 1 }
    g[KEY] = odd
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    const s = sink()
    runInScope(s, () => {
      expect(currentDbScope()).toBe(s.scope)
    })
    runInScope(s, () => undefined)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(g[KEY]).toBe(odd)
  })

  test('noteRequest counts and peek creates nothing', () => {
    expect(peekRequestsSeen()).toBe(0)
    expect(g[KEY]).toBeUndefined()
    expect(g[META]).toBeUndefined()
    noteRequest()
    noteRequest()
    expect(peekRequestsSeen()).toBe(2)
  })
})
