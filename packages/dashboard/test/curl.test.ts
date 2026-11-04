import { expect, test } from 'bun:test'
import { toCurl } from '../src/curl'
import { full } from './helpers'

test('toCurl json body, header skip, quote escaping', () => {
  const c = toCurl(full({ method: 'POST', url: '/api/x', request: { headers: { host: 'h', 'content-length': '7', connection: 'close', 'content-type': 'application/json', 'x-n': "it's" }, query: {}, params: {}, body: { kind: 'json', value: { a: 1 }, truncated: false, size: 7 } } }), 'http://localhost:3000')
  expect(c).toBe(`curl -X POST 'http://localhost:3000/api/x' -H 'content-type: application/json' -H 'x-n: it'\\''s' --data-raw '{"a":1}'`)
})

test('toCurl text body and no body', () => {
  const t = toCurl(full({ method: 'PUT', url: '/t', request: { headers: {}, query: {}, params: {}, body: { kind: 'text', value: "a'b", truncated: false, size: 3 } } }), 'http://h')
  expect(t).toBe(`curl -X PUT 'http://h/t' --data-raw 'a'\\''b'`)
  expect(toCurl(full({ url: '/n' }), 'http://h')).toBe(`curl -X GET 'http://h/n'`)
})

test('toCurl quotes unusual methods', () => {
  expect(toCurl(full({ method: "A'B", url: '/m' }), 'http://h')).toBe(`curl -X 'A'\\''B' 'http://h/m'`)
})
