import { expect, test } from 'bun:test'
import { resolveOptions } from '../src/options.js'

test('defaults', () => {
  const o = resolveOptions({}, {})
  expect(o.path).toBe('/_inspect'); expect(o.enabled).toBe(true)
  expect(o.maxRequests).toBe(500); expect(o.maxBodyBytes).toBe(65536)
  expect([...o.redact.headers].sort()).toEqual(['authorization', 'cookie', 'set-cookie', 'x-api-key'])
  expect(o.auth).toBeNull()
})
test('path normalization', () => {
  expect(resolveOptions({ path: '/debug/' }, {}).path).toBe('/debug')
  expect(resolveOptions({ path: 'debug' }, {}).path).toBe('/debug')
})
test('production disables unless auth or explicit enabled', () => {
  const prod = { NODE_ENV: 'production' }
  expect(resolveOptions({}, prod).enabled).toBe(false)
  expect(resolveOptions({ auth: { user: 'a', pass: 'b' } }, prod).enabled).toBe(true)
  expect(resolveOptions({ enabled: true }, prod).enabled).toBe(true)
  expect(resolveOptions({ enabled: false }, {}).enabled).toBe(false)
})
test('user redact lists extend defaults, headers lowercased', () => {
  const o = resolveOptions({ redact: { headers: ['X-Session'], bodyKeys: ['ssn'] } }, {})
  expect(o.redact.headers.has('x-session')).toBe(true)
  expect(o.redact.headers.has('authorization')).toBe(true)
  expect(o.redact.bodyKeys).toContain('ssn')
})
