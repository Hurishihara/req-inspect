import { describe, expect, test } from 'bun:test'

import { applyTheme, nextTheme, readTheme } from '../src/theme'

const fakeRoot = () => {
  const attrs = new Map<string, string>()
  const root = {
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    removeAttribute: (k: string) => void attrs.delete(k),
  }
  return { root: root as unknown as HTMLElement, attrs }
}

describe('theme', () => {
  test('nextTheme cycles', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })
  test('readTheme', () => {
    expect(readTheme(null)).toBe('system')
    expect(readTheme({ getItem: () => 'dark' })).toBe('dark')
    expect(readTheme({ getItem: () => 'light' })).toBe('light')
    expect(readTheme({ getItem: () => 'blue' })).toBe('system')
    expect(readTheme({ getItem: () => null })).toBe('system')
    expect(
      readTheme({
        getItem: () => {
          throw new Error('denied')
        },
      }),
    ).toBe('system')
  })
  test('applyTheme dark sets attribute and stores', () => {
    const { root, attrs } = fakeRoot()
    const calls: string[] = []
    applyTheme('dark', root, {
      setItem: (k, v) => void calls.push(`set ${k}=${v}`),
      removeItem: (k) => void calls.push(`remove ${k}`),
    })
    expect(attrs.get('data-theme')).toBe('dark')
    expect(calls).toEqual(['set req-inspect:theme=dark'])
  })
  test('applyTheme system removes attribute and key', () => {
    const { root, attrs } = fakeRoot()
    attrs.set('data-theme', 'dark')
    const calls: string[] = []
    applyTheme('system', root, {
      setItem: (k, v) => void calls.push(`set ${k}=${v}`),
      removeItem: (k) => void calls.push(`remove ${k}`),
    })
    expect(attrs.has('data-theme')).toBe(false)
    expect(calls).toEqual(['remove req-inspect:theme'])
  })
  test('applyTheme tolerates throwing storage', () => {
    const { root, attrs } = fakeRoot()
    const bad = {
      setItem: () => {
        throw new Error('full')
      },
      removeItem: () => {
        throw new Error('full')
      },
    }
    expect(() => {
      applyTheme('light', root, bad)
      applyTheme('system', root, bad)
    }).not.toThrow()
    expect(attrs.has('data-theme')).toBe(false)
  })
})
