import { expect, test } from 'bun:test'

import { toSummary } from '../../src/domain/summary.js'
import type { RecordDraft } from '../../src/domain/types.js'

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

const dbRec = (over: Partial<NonNullable<RecordDraft['db']>> = {}): NonNullable<RecordDraft['db']> => ({
  events: [],
  dropped: 0,
  totalMs: 3.2,
  flags: { repeated: [], slow: [] },
  ...over,
})

test('toSummary omits db fields when there is no db', () => {
  const s = toSummary({ ...draft(), v: 1, id: 'r_000001' })
  expect(s).not.toHaveProperty('dbCount')
  expect(s).not.toHaveProperty('db')
})

test('toSummary adds dbCount, dbMs and dbFlag (repeated wins)', () => {
  const ev = {
    system: 'postgresql',
    operation: 'S',
    target: null,
    statement: 's',
    offsetMs: 0,
    durationMs: 1,
    fingerprint: 'f',
  } as const
  const base = { v: 1 as const, id: 'r_000001' }
  expect(toSummary({ ...draft({ db: dbRec({ events: [ev], dropped: 4 }) }), ...base })).toMatchObject({
    dbCount: 5,
    dbMs: 3.2,
  })
  const slow = toSummary({ ...draft({ db: dbRec({ flags: { repeated: [], slow: [0] } }) }), ...base })
  expect(slow.dbFlag).toBe('slow')
  const both = toSummary({
    ...draft({ db: dbRec({ flags: { repeated: [{ fingerprint: 'f', count: 5, first: 0 }], slow: [0] } }) }),
    ...base,
  })
  expect(both.dbFlag).toBe('repeated')
  expect(slow).not.toHaveProperty('db')
})
