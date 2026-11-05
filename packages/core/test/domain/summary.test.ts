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
