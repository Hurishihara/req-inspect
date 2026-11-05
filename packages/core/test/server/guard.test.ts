import { expect, test } from 'bun:test'

import { checkAccess } from '../../src/server/guard.js'

const basic = (u: string, p: string) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64')
const auth = { user: 'admin', pass: 's3cret' }
const remote = (authorization: string | string[] | undefined) =>
  checkAccess({ remoteAddress: '10.0.0.5', headers: { authorization } }, auth)

test('loopback allowed without auth', () => {
  for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1'])
    expect(checkAccess({ remoteAddress: a, headers: { host: 'localhost' } }, null)).toEqual({ ok: true })
})
test('remote refused without auth', () => {
  expect(checkAccess({ remoteAddress: '10.0.0.5', headers: {} }, null)).toEqual({ ok: false, status: 403 })
  expect(checkAccess({ remoteAddress: undefined, headers: {} }, null)).toEqual({ ok: false, status: 403 })
})
test('forwarded headers refused even from loopback', () => {
  expect(
    checkAccess(
      { remoteAddress: '127.0.0.1', headers: { host: 'localhost', 'x-forwarded-for': '1.2.3.4' } },
      null,
    ),
  ).toEqual({ ok: false, status: 403 })
  expect(
    checkAccess(
      { remoteAddress: '127.0.0.1', headers: { host: 'localhost', forwarded: 'for=1.2.3.4' } },
      null,
    ),
  ).toEqual({ ok: false, status: 403 })
  expect(
    checkAccess({ remoteAddress: '127.0.0.1', headers: { host: 'localhost', 'x-forwarded-for': '' } }, null),
  ).toEqual({ ok: false, status: 403 })
  expect(
    checkAccess({ remoteAddress: '127.0.0.1', headers: { host: 'localhost', forwarded: [] } }, null),
  ).toEqual({ ok: false, status: 403 })
})
test('basic auth: correct allows remote, wrong or missing → 401', () => {
  expect(remote(basic('admin', 's3cret'))).toEqual({ ok: true })
  expect(remote(basic('admin', 'nope'))).toEqual({ ok: false, status: 401 })
  expect(remote(basic('other', 's3cret'))).toEqual({ ok: false, status: 401 })
  expect(checkAccess({ remoteAddress: '127.0.0.1', headers: {} }, auth)).toEqual({ ok: false, status: 401 })
})
test('password containing a colon', () => {
  const a = { user: 'admin', pass: 'a:b' }
  expect(
    checkAccess({ remoteAddress: '10.0.0.5', headers: { authorization: basic('admin', 'a:b') } }, a),
  ).toEqual({ ok: true })
  expect(
    checkAccess({ remoteAddress: '10.0.0.5', headers: { authorization: basic('admin', 'a') } }, a),
  ).toEqual({ ok: false, status: 401 })
})
test('scheme match is case-insensitive; other schemes and malformed values give 401', () => {
  const b64 = Buffer.from('admin:s3cret').toString('base64')
  expect(remote('basic ' + b64)).toEqual({ ok: true })
  expect(remote('BASIC ' + b64)).toEqual({ ok: true })
  expect(remote('Bearer ' + b64)).toEqual({ ok: false, status: 401 })
  expect(remote('Basic')).toEqual({ ok: false, status: 401 })
  expect(remote('Basic !!!not-base64***')).toEqual({ ok: false, status: 401 })
  expect(remote('Basic ' + Buffer.from('nocolon').toString('base64'))).toEqual({ ok: false, status: 401 })
  expect(remote('')).toEqual({ ok: false, status: 401 })
})
test('array header uses first element; forwarded headers ignored with auth', () => {
  expect(remote([basic('admin', 's3cret'), basic('x', 'y')])).toEqual({ ok: true })
  expect(remote([basic('x', 'y'), basic('admin', 's3cret')])).toEqual({ ok: false, status: 401 })
  expect(remote([])).toEqual({ ok: false, status: 401 })
  expect(
    checkAccess(
      {
        remoteAddress: '10.0.0.5',
        headers: { authorization: basic('admin', 's3cret'), 'x-forwarded-for': '1.2.3.4' },
      },
      auth,
    ),
  ).toEqual({ ok: true })
})

const local = (host: string | string[] | undefined) =>
  checkAccess({ remoteAddress: '127.0.0.1', headers: { host } }, null)
test('without auth the Host header must name localhost (DNS rebinding)', () => {
  for (const h of ['localhost', 'LOCALHOST', 'app.localhost', '127.0.0.1', '[::1]', '::1'])
    expect(local(h)).toEqual({ ok: true })
  for (const h of ['localhost:3000', 'a.b.localhost:8080', '127.0.0.1:3000', '[::1]:3000'])
    expect(local(h)).toEqual({ ok: true })
  for (const h of [
    'evil.example',
    'evil.example:3000',
    'localhost.evil.example',
    'evillocalhost',
    '127.0.0.2',
    '[::2]:3000',
    '0.0.0.0',
    '',
  ]) {
    expect(local(h)).toEqual({ ok: false, status: 403 })
  }
  expect(local(undefined)).toEqual({ ok: false, status: 403 })
})
test('Host header is not checked with auth', () => {
  expect(
    checkAccess(
      {
        remoteAddress: '10.0.0.5',
        headers: { host: 'evil.example', authorization: basic('admin', 's3cret') },
      },
      auth,
    ),
  ).toEqual({ ok: true })
})
