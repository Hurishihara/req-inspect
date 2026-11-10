import { describe, expect, test } from 'bun:test'

import { dbCaption, dbShare, repeatAdvice } from '../src/db'

describe('db helpers', () => {
  test('dbShare', () => {
    expect(dbShare(42, 120)).toBe(35)
    expect(dbShare(200, 100)).toBe(100)
    expect(dbShare(5, 0)).toBe(0)
  })
  test('dbCaption', () => {
    expect(dbCaption(8, 42)).toBe('8 q · 42 ms')
    expect(dbCaption(3, 1200)).toBe('3 q · 1.2 s')
  })
  test('repeatAdvice', () => {
    expect(repeatAdvice('postgresql')).toContain('ANY($1)')
    expect(repeatAdvice('mongodb')).toContain('$in')
  })
})
