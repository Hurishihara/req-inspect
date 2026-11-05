import type { RequestRecord, RequestSummary } from '@req-inspect/core'

export const sum = (id: string, o: Partial<RequestSummary> = {}): RequestSummary => ({
  v: 1,
  id,
  startedAt: 0,
  durationMs: 1,
  method: 'GET',
  url: '/',
  route: null,
  status: 200,
  ...o,
})

export const full = (o: Partial<RequestRecord> = {}): RequestRecord => ({
  ...sum('r_000001'),
  request: { headers: {}, query: {}, params: {}, body: { kind: 'none' } },
  response: { headers: {}, body: { kind: 'none' } },
  ...o,
})
