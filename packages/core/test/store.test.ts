import { expect, test } from 'bun:test'

import { RingStore } from '../src/store.js'
import type { RequestRecord } from '../src/types.js'

function rec(id: string): RequestRecord {
  return {
    v: 1,
    id,
    startedAt: 0,
    durationMs: 1,
    method: 'GET',
    url: '/',
    route: null,
    status: 200,
    request: { headers: {}, query: {}, params: {}, body: null as never },
    response: { headers: {}, body: null as never },
  }
}
const pad = (i: number) => `r_${String(i).padStart(6, '0')}`

test('ids are monotonic and zero-padded', () => {
  const s = new RingStore(3)
  expect(s.nextId()).toBe('r_000001')
  expect(s.nextId()).toBe('r_000002')
})
test('evicts oldest beyond capacity', () => {
  const s = new RingStore(2)
  ;['r_000001', 'r_000002', 'r_000003'].forEach((id) => {
    s.add(rec(id))
  })
  expect(s.get('r_000001')).toBeUndefined()
  expect(s.get('r_000003')?.id).toBe('r_000003')
  expect(s.list().map((r) => r.id)).toEqual(['r_000003', 'r_000002'])
})
test('list paging with before and limit', () => {
  const s = new RingStore(10)
  for (let i = 1; i <= 5; i++) s.add(rec(pad(i)))
  expect(s.list({ before: 'r_000004', limit: 2 }).map((r) => r.id)).toEqual(['r_000003', 'r_000002'])
})
test('evicted before-cursor returns older survivors only', () => {
  const s = new RingStore(2)
  ;['r_000001', 'r_000002', 'r_000003'].forEach((id) => {
    s.add(rec(id))
  })
  expect(s.list({ before: 'r_000001' })).toEqual([])
  expect(s.list({ before: 'r_000003' }).map((r) => r.id)).toEqual(['r_000002'])
})
test('limit clamps to 500 and 1, defaults to 100', () => {
  const s = new RingStore(1000)
  for (let i = 1; i <= 600; i++) s.add(rec(pad(i)))
  expect(s.list({ limit: 9999 }).length).toBe(500)
  expect(s.list({ limit: 0 }).length).toBe(1)
  expect(s.list().length).toBe(100)
})
test('subscribe, unsubscribe, throwing subscriber removed', () => {
  const s = new RingStore(5)
  let c1 = 0,
    c2 = 0
  s.subscribe(() => {
    c1++
    throw new Error('boom')
  })
  const off2 = s.subscribe(() => {
    c2++
  })
  s.add(rec('r_000001'))
  s.add(rec('r_000002'))
  expect(c1).toBe(1)
  expect(c2).toBe(2)
  off2()
  s.add(rec('r_000003'))
  expect(c2).toBe(2)
})
test('clear empties but keeps counter', () => {
  const s = new RingStore(3)
  s.nextId()
  s.add(rec('r_000001'))
  s.clear()
  expect(s.list()).toEqual([])
  expect(s.get('r_000001')).toBeUndefined()
  expect(s.nextId()).toBe('r_000002')
})
