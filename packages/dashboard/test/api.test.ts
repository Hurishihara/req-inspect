import { expect, test } from 'bun:test'

import { connFromError } from '../src/api'

test('connFromError', () => {
  expect(connFromError(2, null, 0)).toBe('disconnected')
  expect(connFromError(2, 0, 99_999)).toBe('disconnected')
  expect(connFromError(0, null, 50_000)).toBe('reconnecting')
  expect(connFromError(0, 1000, 15_999)).toBe('reconnecting')
  expect(connFromError(0, 0, 14_999)).toBe('reconnecting')
  expect(connFromError(0, 0, 15_000)).toBe('unreachable')
})
