import { describe, expect, test } from 'bun:test'

import { emptyReason, isSlow, isTypingTarget, nextIndex, statusClass, tabKeyIndex } from '../src/view'

describe('statusClass', () => {
  test.each([
    [200, false, '2xx'],
    [301, false, '3xx'],
    [404, false, '4xx'],
    [503, false, '5xx'],
    [599, false, '5xx'],
    [0, false, 'none'],
    [101, false, 'none'],
    [200, true, 'aborted'],
  ] as const)('%i aborted=%s -> %s', (s, a, want) => {
    expect(statusClass(s, a)).toBe(want)
  })
})

describe('isSlow', () => {
  test.each([
    [999.4, false],
    [999.6, true],
    [1000, true],
    [48, false],
  ])('%f -> %s', (ms, want) => {
    expect(isSlow(ms)).toBe(want)
  })
})

describe('nextIndex', () => {
  test.each([
    [2, 1, 5, 3],
    [4, 1, 5, 4],
    [0, -1, 5, 0],
    [-1, 1, 5, 0],
    [-1, -1, 5, 0],
    [3, -1, 0, -1],
    [0, Infinity, 5, 4],
    [3, -Infinity, 5, 0],
  ])('(%i, %f, %i) -> %i', (c, d, l, want) => {
    expect(nextIndex(c, d, l)).toBe(want)
  })
})

describe('tabKeyIndex', () => {
  test('keys', () => {
    expect(tabKeyIndex('ArrowRight', 0, 3)).toBe(1)
    expect(tabKeyIndex('ArrowRight', 2, 3)).toBe(0)
    expect(tabKeyIndex('ArrowLeft', 0, 3)).toBe(2)
    expect(tabKeyIndex('Home', 2, 3)).toBe(0)
    expect(tabKeyIndex('End', 0, 3)).toBe(2)
    expect(tabKeyIndex('a', 0, 3)).toBeNull()
  })
})

describe('emptyReason', () => {
  test('reasons', () => {
    expect(emptyReason(0, 0)).toBe('waiting')
    expect(emptyReason(5, 0)).toBe('no-matches')
    expect(emptyReason(5, 3)).toBeNull()
  })
})

describe('isTypingTarget', () => {
  test('targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
