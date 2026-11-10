import { expect, test } from 'bun:test'

import { commandDocument, keyShape, SKIPPED_COMMANDS } from '../src/shape.js'

test('keyShape lists sorted keys recursively without values', () => {
  expect(keyShape({ b: 1, a: { y: 2, x: 3 } })).toBe('{a:{x,y},b}')
  expect(keyShape({})).toBe('{}')
  expect(keyShape(5)).toBe('')
})

test('keyShape ignores array length and non-plain objects', () => {
  expect(keyShape({ _id: { $in: [1] } })).toBe(keyShape({ _id: { $in: [1, 2, 3] } }))
  expect(keyShape([{ a: 1 }, { b: 2 }])).toBe('[{a}]')
  expect(keyShape({ at: new Date() })).toBe('{at}')
})

test('commandDocument strips driver routing fields', () => {
  expect(commandDocument({ find: 'u', filter: {}, $db: 'x', lsid: {} })).toEqual({ find: 'u', filter: {} })
})

test('SKIPPED_COMMANDS covers driver chatter', () => {
  for (const c of ['hello', 'isMaster', 'ismaster', 'ping', 'saslStart', 'saslContinue']) {
    expect(SKIPPED_COMMANDS.has(c)).toBe(true)
  }
  expect(SKIPPED_COMMANDS.has('find')).toBe(false)
})
