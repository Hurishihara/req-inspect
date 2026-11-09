import { describe, expect, test } from 'bun:test'

import { formatDuration, formatSize } from '../src/format'

describe('formatDuration', () => {
  test.each([
    [48, '48 ms'],
    [999.4, '999 ms'],
    [999.6, '1.0 s'],
    [1200, '1.2 s'],
    [0.4, '0 ms'],
  ])('%f -> %s', (ms, want) => {
    expect(formatDuration(ms)).toBe(want)
  })
})

describe('formatSize', () => {
  test('sizes', () => {
    expect(formatSize(214)).toBe('214 B')
    expect(formatSize(65536)).toBe('64.0 KB')
  })
})
