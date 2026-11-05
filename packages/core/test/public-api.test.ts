import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { expect, test } from 'bun:test'

// Built output is loaded by a computed specifier so typecheck and lint pass before `bun run build`.
const distPath = (name: string): string => fileURLToPath(new URL(`../dist/${name}`, import.meta.url))
const loadEsm = async (): Promise<Record<string, unknown>> =>
  (await import(pathToFileURL(distPath('index.js')).href)) as Record<string, unknown>
const loadCjs = (): Record<string, unknown> =>
  createRequire(import.meta.url)(distPath('index.cjs')) as Record<string, unknown>

type CreateInspector = (options: object) => Record<string, (...args: never[]) => unknown>

test('ESM entry exports only createInspector', async () => {
  expect(Object.keys(await loadEsm()).sort()).toEqual(['createInspector'])
})

test('CJS entry exports only createInspector', () => {
  expect(
    Object.keys(loadCjs())
      .filter((k) => k !== '__esModule')
      .sort(),
  ).toEqual(['createInspector'])
})

test('inspector object exposes only the public members', async () => {
  const createInspector = (await loadEsm()).createInspector as CreateInspector
  expect(Object.keys(createInspector({})).sort()).toEqual(['capture', 'dispatch', 'handle', 'options'])
})

test('dispatch works when detached from the inspector object', async () => {
  const createInspector = (await loadEsm()).createInspector as CreateInspector
  const { dispatch } = createInspector({}) as { dispatch: (p: string) => string }
  expect(dispatch('/_inspect')).toBe('handle')
})
