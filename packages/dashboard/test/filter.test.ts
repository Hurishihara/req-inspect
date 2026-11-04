import { expect, test } from 'bun:test'
import { matchesFilter } from '../src/filter'
import { sum } from './helpers'

test('filter tokens', () => {
  const s = sum('r_000001', { method: 'POST', url: '/api/users', route: '/api/users', status: 503 })
  expect(matchesFilter(s, 'post 5xx')).toBe(true); expect(matchesFilter(s, '/USERS')).toBe(true)
  expect(matchesFilter(s, 'get')).toBe(false); expect(matchesFilter(s, '4xx')).toBe(false); expect(matchesFilter(s, '')).toBe(true)
})

test('whitespace-only matches all; route and case-insensitive status class', () => {
  const s = sum('r_000001', { url: '/users/42', route: '/users/:id', status: 404 })
  expect(matchesFilter(s, '   ')).toBe(true)
  expect(matchesFilter(s, ':ID')).toBe(true)
  expect(matchesFilter(s, '4XX')).toBe(true)
  expect(matchesFilter(s, 'get 4xx users')).toBe(true)
  expect(matchesFilter(sum('r_000002', { route: null }), ':id')).toBe(false)
})
