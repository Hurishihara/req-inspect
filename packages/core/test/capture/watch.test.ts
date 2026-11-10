import { afterEach, beforeEach, expect, jest, spyOn, test } from 'bun:test'

import { noteRequest, resetContextState } from '../../src/capture/context.js'
import { resetWatchState, watchDbContext } from '../../src/capture/watch.js'

const KEY = Symbol.for('req-inspect.context')
const g = globalThis as unknown as Record<symbol, unknown>
let saved: unknown
let now = 1_000_000

beforeEach(() => {
  saved = g[KEY]
  Reflect.deleteProperty(g, KEY)
  resetContextState()
  resetWatchState()
  now = 1_000_000
  spyOn(Date, 'now').mockImplementation(() => now)
})
afterEach(() => {
  if (saved === undefined) Reflect.deleteProperty(g, KEY)
  else g[KEY] = saved
  jest.restoreAllMocks()
})

const misses = (w: { observe: (b: boolean) => void }, n: number): void => {
  for (let i = 0; i < n; i++) w.observe(false)
}

test('19 misses after 31 s do not warn', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  const w = watchDbContext('pg')
  now += 31_000
  misses(w, 19)
  expect(warn).not.toHaveBeenCalled()
})

test('20 misses after 29 s do not warn, then warn once the time has passed', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  const w = watchDbContext('pg')
  now += 29_000
  misses(w, 20)
  expect(warn).not.toHaveBeenCalled()
  now += 1_000
  misses(w, 5)
  expect(warn).toHaveBeenCalledTimes(1)
})

test('20 misses after 30 s warn once with the express hint when no request was seen', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  const w = watchDbContext('pg')
  now += 30_000
  misses(w, 50)
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn.mock.calls[0]?.[0]).toBe(
    "req-inspect: pg queries aren't linked to any request. Is @req-inspect/express 0.3 or newer installed, and is inspector() mounted before your routes?",
  )
  expect(g[KEY]).toBeUndefined()
})

test('warns with the limitations message when requests were seen', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  noteRequest()
  const w = watchDbContext('mongodb')
  now += 30_000
  misses(w, 20)
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn.mock.calls[0]?.[0]).toBe(
    'req-inspect: requests are being inspected but none of these mongodb queries ran inside one. See the README\'s "Database calls" limitations.',
  )
})

test('one in-scope observation silences it forever', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  const w = watchDbContext('pg')
  misses(w, 5)
  w.observe(true)
  now += 60_000
  misses(w, 100)
  expect(warn).not.toHaveBeenCalled()
})

test('integrations warn independently', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  const a = watchDbContext('pg')
  const b = watchDbContext('mongodb')
  now += 30_000
  misses(a, 20)
  misses(b, 20)
  expect(warn).toHaveBeenCalledTimes(2)
})

test('never throws', () => {
  spyOn(console, 'warn').mockImplementation(() => {
    throw new Error('boom')
  })
  const w = watchDbContext('pg')
  now += 30_000
  expect(() => {
    misses(w, 30)
  }).not.toThrow()
})
