import { expect, test } from 'bun:test'
import { idFromHash } from '../src/hash'

test('idFromHash parses record ids and tolerates garbage', () => {
  expect(idFromHash('')).toBeNull()
  expect(idFromHash('#')).toBeNull()
  expect(idFromHash('#%')).toBeNull()
  expect(idFromHash('#%E0%A4%A')).toBeNull()
  expect(idFromHash('#r_000123')).toBe('r_000123')
  expect(idFromHash('#foo')).toBeNull()
})
