import { createRequire } from 'node:module'

import { expect, test } from 'bun:test'

test('ESM entry exports only createInspector', async () => {
  const m = await import('../dist/index.js')
  expect(Object.keys(m).sort()).toEqual(['createInspector'])
})

test('CJS entry exports only createInspector', () => {
  const m = createRequire(import.meta.url)('../dist/index.cjs') as Record<string, unknown>
  expect(
    Object.keys(m)
      .filter((k) => k !== '__esModule')
      .sort(),
  ).toEqual(['createInspector'])
})

test('inspector object exposes only the public members', async () => {
  const { createInspector } = await import('../dist/index.js')
  expect(Object.keys(createInspector({})).sort()).toEqual(['capture', 'dispatch', 'handle', 'options'])
})
