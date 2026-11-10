import { expect, test } from 'bun:test'

import { capText, repeatFlags, slowIndexes, unionMs } from '../../src/domain/db.js'
import type { DbEvent } from '../../src/domain/types.js'

const ev = (durationMs: number): DbEvent => ({
  system: 'postgresql',
  operation: 'SELECT',
  target: null,
  statement: 's',
  offsetMs: 0,
  durationMs,
  fingerprint: 'f',
})

test('unionMs merges overlaps and rounds to 0.1', () => {
  expect(
    unionMs([
      [0, 10],
      [5, 15],
      [20, 25],
    ]),
  ).toBe(20)
  expect(unionMs([])).toBe(0)
  expect(
    unionMs([
      [0, 1.04],
      [1.04, 2.06],
    ]),
  ).toBe(2.1)
})

test('slowIndexes uses >= slowMs', () => {
  expect(slowIndexes([ev(99.9), ev(100), ev(250)], 100)).toEqual([1, 2])
})

test('repeatFlags keeps counts at threshold, sorted descending', () => {
  const counts = new Map([
    ['a', { count: 4, first: 0 }],
    ['b', { count: 5, first: 1 }],
    ['c', { count: 1000, first: 2 }],
  ])
  expect(repeatFlags(counts, 5)).toEqual([
    { fingerprint: 'c', count: 1000, first: 2 },
    { fingerprint: 'b', count: 5, first: 1 },
  ])
})

test('capText cuts with an ellipsis', () => {
  const out = capText('x'.repeat(2049), 2048)
  expect(out.length).toBe(2048)
  expect(out.endsWith('…')).toBe(true)
  expect(capText('abc', 2048)).toBe('abc')
})
