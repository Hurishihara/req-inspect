import { createHash, timingSafeEqual } from 'node:crypto'

import type { InternalOptions } from '../domain/types.js'

export type AccessResult = { ok: true } | { ok: false; status: 401 | 403 }

type HeaderValue = string | string[] | undefined

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const BASIC = /^basic\s+([A-Za-z0-9+/]+={0,2})\s*$/i

const digest = (s: string): Buffer => createHash('sha256').update(s).digest()
const safeEqual = (a: string, b: string): boolean => timingSafeEqual(digest(a), digest(b))

const firstValue = (v: HeaderValue): string | undefined => {
  return Array.isArray(v) ? v[0] : v
}

/** Hostname of a Host header, lowercased, port and IPv6 brackets removed. */
const hostname = (host: string): string => {
  const h = host.trim().toLowerCase()
  if (h.startsWith('[')) {
    const end = h.indexOf(']')
    return end < 0 ? '' : h.slice(1, end)
  }
  // A bare IPv6 address has several colons; only a single colon separates a port.
  const colon = h.indexOf(':')
  return colon >= 0 && colon === h.lastIndexOf(':') ? h.slice(0, colon) : h
}

// Without auth, a browser page on another origin could reach the dashboard through DNS rebinding;
// such requests carry the attacker's hostname, so only localhost names are accepted.
const isLocalHost = (host: string | undefined): boolean => {
  if (host === undefined) return false
  const name = hostname(host)
  return name === 'localhost' || name.endsWith('.localhost') || name === '127.0.0.1' || name === '::1'
}

const parseBasic = (header: string | undefined): { user: string; pass: string } | null => {
  const m = header === undefined ? null : BASIC.exec(header)
  if (!m) return null
  const decoded = Buffer.from(m[1], 'base64').toString('utf8')
  const i = decoded.indexOf(':')
  if (i < 0) return null
  return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) }
}

export const checkAccess = (
  req: { remoteAddress: string | undefined; headers: Record<string, HeaderValue> },
  auth: InternalOptions['auth'],
): AccessResult => {
  if (!auth) {
    const forwarded = req.headers['x-forwarded-for'] !== undefined || req.headers.forwarded !== undefined
    if (forwarded || req.remoteAddress === undefined || !LOOPBACK.has(req.remoteAddress))
      return { ok: false, status: 403 }
    if (!isLocalHost(firstValue(req.headers.host))) return { ok: false, status: 403 }
    return { ok: true }
  }
  const creds = parseBasic(firstValue(req.headers.authorization))
  if (!creds) return { ok: false, status: 401 }
  // Evaluate both comparisons so timing does not reveal which field mismatched.
  const userOk = safeEqual(creds.user, auth.user)
  const passOk = safeEqual(creds.pass, auth.pass)
  return userOk && passOk ? { ok: true } : { ok: false, status: 401 }
}
