import { expect, test } from 'bun:test'

import { captureParsedBody, captureRawBody } from '../../src/domain/body.js'

const MAX = 16
test('parsed: undefined → none; {} without content-type → none', () => {
  expect(captureParsedBody(undefined, 'application/json', MAX)).toEqual({ kind: 'none' })
  expect(captureParsedBody({}, undefined, MAX)).toEqual({ kind: 'none' })
})
test('parsed: small object → json', () => {
  expect(captureParsedBody({ a: 1 }, 'application/json', MAX)).toEqual({
    kind: 'json',
    value: { a: 1 },
    truncated: false,
    size: 7,
  })
})
test('parsed: oversize object → truncated text', () => {
  const b = captureParsedBody({ long: 'x'.repeat(50) }, 'application/json', MAX)
  expect(b).toMatchObject({ kind: 'text', truncated: true })
  expect((b as any).value.length).toBe(MAX)
})
test('parsed: circular → unserializable', () => {
  const o: any = {}
  o.self = o
  expect(captureParsedBody(o, 'application/json', MAX)).toEqual({
    kind: 'text',
    value: '[unserializable]',
    truncated: false,
    size: 0,
  })
})
test('parsed: string → text; Buffer → binary', () => {
  expect(captureParsedBody('hi', 'text/plain', MAX)).toEqual({
    kind: 'text',
    value: 'hi',
    truncated: false,
    size: 2,
  })
  expect(captureParsedBody(Buffer.from([1, 2, 3]), 'image/png', MAX)).toEqual({
    kind: 'binary',
    contentType: 'image/png',
    size: 3,
  })
  expect(captureParsedBody(Buffer.from([1]), undefined, MAX)).toEqual({
    kind: 'binary',
    contentType: 'application/octet-stream',
    size: 1,
  })
})
test('parsed: oversize string truncated by bytes, size is full', () => {
  expect(captureParsedBody('y'.repeat(40), 'text/plain', MAX)).toMatchObject({
    kind: 'text',
    truncated: true,
    size: 40,
  })
})
test('raw: json parsed, +json recognized', () => {
  expect(
    captureRawBody([Buffer.from('{"a":1}')], 7, 'application/problem+json; charset=utf-8', undefined, MAX),
  ).toEqual({ kind: 'json', value: { a: 1 }, truncated: false, size: 7 })
})
test('raw: invalid json falls back to text', () => {
  expect(captureRawBody([Buffer.from('{nope')], 5, 'application/json', undefined, MAX)).toEqual({
    kind: 'text',
    value: '{nope',
    truncated: false,
    size: 5,
  })
})
test('raw: truncated json stored as text', () => {
  expect(
    captureRawBody([Buffer.from('{"a":"xxxxxxx')], 100, 'application/json', undefined, MAX),
  ).toMatchObject({ kind: 'text', truncated: true, size: 100 })
})
test('raw: truncated text keeps size of full body', () => {
  expect(captureRawBody([Buffer.from('x'.repeat(MAX))], 100, 'text/html', undefined, MAX)).toMatchObject({
    kind: 'text',
    truncated: true,
    size: 100,
  })
})
test('raw: content-encoding → binary with encoding', () => {
  expect(captureRawBody([Buffer.from([1, 2])], 2, 'application/json', 'gzip', MAX)).toEqual({
    kind: 'binary',
    contentType: 'application/json',
    size: 2,
    encoding: 'gzip',
  })
})
test('raw: image → binary; zero bytes → none', () => {
  expect(captureRawBody([], 0, 'text/plain', undefined, MAX)).toEqual({ kind: 'none' })
  expect(captureRawBody([Buffer.from([1])], 1, 'image/png', undefined, MAX)).toMatchObject({
    kind: 'binary',
    contentType: 'image/png',
  })
})
test('raw: application/javascript → binary', () => {
  expect(captureRawBody([Buffer.from('var a=1')], 7, 'application/javascript', undefined, MAX)).toEqual({
    kind: 'binary',
    contentType: 'application/javascript',
    size: 7,
  })
})
