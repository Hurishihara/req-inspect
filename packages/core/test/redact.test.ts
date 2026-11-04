import { expect, test } from 'bun:test'
import { REDACTED, normalizeHeaders, redactHeaders, redactBody } from '../src/redact.js'
import { BODY_KEYS_DEFAULT } from '../src/options.js'

test('normalizeHeaders lowercases and joins', () => {
  expect(normalizeHeaders({ 'X-A': ['1', '2'], 'Content-Length': 5, skip: undefined })).toEqual({ 'x-a': '1, 2', 'content-length': '5' })
})
test('redactHeaders', () => {
  const input = { authorization: 'Bearer t', accept: '*/*' }
  const out = redactHeaders(input, new Set(['authorization']))
  expect(out).toEqual({ authorization: '[redacted]', accept: '*/*' })
  expect(out).not.toBe(input); expect(input.authorization).toBe('Bearer t')
})
test('redactBody nested, arrays, mixed case', () => {
  const keys = [/password|token|secret|apikey|api_key/i]
  expect(redactBody({ users: [{ Password: 'x', name: 'a' }], meta: { API_KEY: 'k' } }, keys))
    .toEqual({ users: [{ Password: '[redacted]', name: 'a' }], meta: { API_KEY: '[redacted]' } })
})
test('redactBody works with default body keys', () => {
  expect(redactBody({ apiKey: 'k', ok: 1 }, BODY_KEYS_DEFAULT)).toEqual({ apiKey: REDACTED, ok: 1 })
})
test('redactBody string key is case-insensitive equality', () => {
  expect(redactBody({ SSN: '1', ssnx: '2' }, ['ssn'])).toEqual({ SSN: '[redacted]', ssnx: '2' })
})
test('redactBody does not mutate and handles cycles', () => {
  const o: any = { token: 't' }; o.self = o
  const r: any = redactBody(o, [/token/i])
  expect(o.token).toBe('t'); expect(r.token).toBe('[redacted]'); expect(r.self).toBe('[circular]')
})
test('redactBody redacts objects by key and passes non-plain values through', () => {
  const d = new Date(0); const b = Buffer.from('x')
  const r: any = redactBody({ secret: { a: 1 }, d, b, n: null, s: 'x' }, [/secret/i])
  expect(r.secret).toBe('[redacted]'); expect(r.d).toBe(d); expect(r.b).toBe(b); expect(r.n).toBeNull()
})
test('redactBody global/sticky regex is not stateful', () => {
  const r: any = redactBody({ token: 1, token2: 2, token3: 3 }, [/token/g, /token/y])
  expect(r).toEqual({ token: REDACTED, token2: REDACTED, token3: REDACTED })
})
test('redactBody shared (non-cyclic) references are not marked circular', () => {
  const shared = { a: 1 }
  expect(redactBody({ x: shared, y: shared }, [])).toEqual({ x: { a: 1 }, y: { a: 1 } })
})
