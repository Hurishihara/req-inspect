import { expect, test } from 'bun:test'

import { resolveOptions } from '../../src/domain/options.js'
import { toRecord } from '../../src/domain/record.js'
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

test('toRecord redacts url, query, headers and both bodies', () => {
  const r = toRecord(
    draft({
      url: '/x?token=t&page=2',
      request: {
        headers: { authorization: 'a' },
        query: { token: 't' },
        params: {},
        body: { kind: 'json', value: { password: 'p' }, truncated: false, size: 16 },
      },
      response: {
        headers: { 'content-type': 'application/json' },
        body: { kind: 'text', value: '{"token":"abc","x', truncated: true, size: 999 },
      },
    }),
    'r_000001',
    resolveOptions({}, {}).redact,
  )
  expect(r).toMatchObject({ v: 1, id: 'r_000001' })
  expect(r.url).toBe('/x?token=[redacted]&page=2')
  expect(r.request.query).toEqual({ token: '[redacted]' })
  expect(r.request.headers.authorization).toBe('[redacted]')
  expect((r.request.body as { value: { password: string } }).value.password).toBe('[redacted]')
  expect(JSON.stringify(r.response.body)).not.toContain('abc')
})
