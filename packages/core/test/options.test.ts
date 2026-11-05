import { expect, test } from 'bun:test'

import { resolveOptions } from '../src/options.js'

test('defaults', () => {
  const o = resolveOptions({}, {})
  expect(o.path).toBe('/_inspect')
  expect(o.enabled).toBe(true)
  expect(o.maxRequests).toBe(500)
  expect(o.maxBodyBytes).toBe(65536)
  expect([...o.redact.headers].sort()).toEqual(['authorization', 'cookie', 'set-cookie', 'x-api-key'])
  expect(o.auth).toBeNull()
  expect(o.redact.bodyKeys.some((k) => k instanceof RegExp && k.test('apiKey'))).toBe(true)
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
  expect(o.redact.bodyKeys.some((k) => k instanceof RegExp && k.test('password'))).toBe(true)
})
test('auth requires non-empty user and pass', () => {
  const bad = [
    { user: '', pass: '' },
    { user: 'a', pass: '' },
    { user: '', pass: 'b' },
    { user: 1, pass: 'b' },
    { pass: 'b' },
  ]
  for (const auth of bad) {
    expect(() => resolveOptions({ auth: auth as any }, {})).toThrow(
      new TypeError('[req-inspect] auth.user and auth.pass must be non-empty strings'),
    )
  }
})
test('path that normalizes to the root is rejected', () => {
  for (const path of ['/', '', '///']) {
    expect(() => resolveOptions({ path }, {})).toThrow(
      new TypeError('[req-inspect] path must not be the root'),
    )
  }
})
