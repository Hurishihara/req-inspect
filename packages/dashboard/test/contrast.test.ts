import { readFileSync } from 'node:fs'

import { expect, test } from 'bun:test'

type Theme = Map<string, string>

const PAIRS: [fg: string[], bg: string[], min: number][] = [
  [
    ['ink'],
    ['bg', 'surface', 'surface-raised', 'hover', 'selected', 'info-bg', 'status-4xx-bg', 'status-5xx-bg'],
    4.5,
  ],
  [['ink-muted'], ['bg', 'surface', 'surface-raised', 'hover', 'selected'], 4.5],
  [['accent-ink'], ['accent'], 4.5],
  ...[2, 3, 4, 5].map((n): [string[], string[], number] => [
    [`status-${String(n)}xx`],
    [`status-${String(n)}xx-bg`, 'bg', 'selected'],
    4.5,
  ]),
  [['syntax-key', 'syntax-string', 'syntax-number', 'syntax-null'], ['bg', 'surface'], 4.5],
  [['border-strong', 'focus'], ['bg', 'surface'], 3],
  [['info'], ['info-bg', 'bg'], 3],
  [['signal-live', 'signal-warn'], ['surface'], 3],
]

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')

const parseBlock = (block: string): Theme => {
  const theme: Theme = new Map()
  for (const m of block.matchAll(/^\s*--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6}|var\(--[a-z0-9-]+\));\s*$/gm)) {
    theme.set(m[1], m[2])
  }
  return theme
}

const darkStart = css.indexOf('@media (prefers-color-scheme: dark)')
const lightSource = darkStart === -1 ? css : css.slice(0, darkStart)
const darkSource = darkStart === -1 ? '' : css.slice(darkStart)
const light = parseBlock(lightSource.slice(lightSource.indexOf(':root')))
const dark = parseBlock(darkSource.slice(darkSource.indexOf(':root')))

const resolve = (name: string, primary: Theme): string => {
  let current = name
  for (let i = 0; i < 10; i++) {
    const value = primary.get(current) ?? light.get(current)
    if (value === undefined) throw new Error(`token --${current} is not defined`)
    const alias = /^var\(--([a-z0-9-]+)\)$/.exec(value)
    if (!alias?.[1]) return value
    current = alias[1]
  }
  throw new Error(`alias loop at --${name}`)
}

const channel = (v: number): number => {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const luminance = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

const ratio = (a: string, b: string): number => {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const check = (themeName: string, theme: Theme): string[] => {
  const failures: string[] = []
  for (const [fgs, bgs, min] of PAIRS) {
    for (const fg of fgs) {
      for (const bg of bgs) {
        const r = ratio(resolve(fg, theme), resolve(bg, theme))
        if (r < min) {
          failures.push(`${themeName}: ${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${String(min)}:1`)
        }
      }
    }
  }
  return failures
}

test('light theme meets WCAG contrast', () => {
  expect(check('light', light)).toEqual([])
})

test('dark theme meets WCAG contrast', () => {
  expect(dark.size).toBeGreaterThan(0)
  expect(check('dark', dark)).toEqual([])
})

test('ratio implements the WCAG formula', () => {
  expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  expect(ratio('#777777', '#ffffff')).toBeGreaterThan(4.47)
  expect(ratio('#777777', '#ffffff')).toBeLessThan(4.49)
})
