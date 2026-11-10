import { expect, test } from 'bun:test'
import type { RequestSummary } from '@req-inspect/core'

import { initialState, reducer } from '../src/reducer'
import { sum } from './helpers'

const id = (n: number) => 'r_' + String(n).padStart(6, '0')

test('loaded dedupes, sorts newest first, caps 500', () => {
  const items: RequestSummary[] = []
  for (let i = 1; i <= 600; i++) items.push(sum(id(i)))
  items.push(sum(id(10)), sum(id(600)))
  const s = reducer(initialState, { type: 'loaded', items })
  expect(s.items).toHaveLength(500)
  expect(s.items[0].id).toBe(id(600))
  expect(s.items[499].id).toBe(id(101))
  const ids = s.items.map((i) => i.id)
  expect(ids).toEqual([...ids].sort().reverse())
  expect(new Set(ids).size).toBe(500)
})

test('loaded merges with existing; later copy wins', () => {
  let s = reducer(initialState, { type: 'loaded', items: [sum(id(1), { status: 200 }), sum(id(2))] })
  s = reducer(s, { type: 'loaded', items: [sum(id(1), { status: 500 })] })
  expect(s.items.map((i) => i.id)).toEqual([id(2), id(1)])
  expect(s.items[1].status).toBe(500)
})

test('received while not paused merges newest first', () => {
  let s = reducer(initialState, { type: 'received', item: sum(id(1)) })
  s = reducer(s, { type: 'received', item: sum(id(2)) })
  expect(s.items.map((i) => i.id)).toEqual([id(2), id(1)])
})

test('received while paused goes to pending; resume merges', () => {
  let s = reducer(initialState, { type: 'pause' })
  s = reducer(s, { type: 'received', item: sum('r_000002') })
  expect(s.items).toHaveLength(0)
  expect(s.pending).toHaveLength(1)
  s = reducer(s, { type: 'resume' })
  expect(s.items[0].id).toBe('r_000002')
  expect(s.pending).toEqual([])
  expect(s.paused).toBe(false)
})

test('cleared empties items, pending and selection', () => {
  let s = reducer(initialState, { type: 'loaded', items: [sum(id(1))] })
  s = reducer(s, { type: 'select', id: id(1) })
  s = reducer(s, { type: 'pause' })
  s = reducer(s, { type: 'received', item: sum(id(2)) })
  s = reducer(s, { type: 'cleared' })
  expect(s.items).toEqual([])
  expect(s.pending).toEqual([])
  expect(s.selectedId).toBeNull()
})

test('select, filter and conn update state', () => {
  let s = reducer(initialState, { type: 'select', id: 'x' })
  expect(s.selectedId).toBe('x')
  s = reducer(s, { type: 'filter', text: 'post' })
  expect(s.filter).toBe('post')
  s = reducer(s, { type: 'conn', state: 'reconnecting' })
  expect(s.conn).toBe('reconnecting')
  for (const c of ['unreachable', 'disconnected'] as const) {
    s = reducer(s, { type: 'conn', state: c })
    expect(s.conn).toBe(c)
  }
})
