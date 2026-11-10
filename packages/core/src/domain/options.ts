import { DB_DEFAULTS } from './db.js'
import type { InspectorOptions, InternalOptions } from './types.js'

export const DEFAULT_PATH = '/_inspect'
export const DEFAULT_MAX_REQUESTS = 500
export const DEFAULT_MAX_BODY_BYTES = 65536
export const REDACTED_HEADERS_DEFAULT: readonly string[] = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
]
export const BODY_KEYS_DEFAULT: readonly (string | RegExp)[] = [/password|token|secret|apikey|api_key/i]

const normalizePath = (path: string): string => {
  let p = path.startsWith('/') ? path : `/${path}`
  while (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0

const dbNumber = (v: unknown, fallback: number, integer = false): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && (!integer || Number.isInteger(v)) ? v : fallback

const resolveDb = (db: InspectorOptions['db']): InternalOptions['db'] => ({
  maxEvents: dbNumber(db?.maxEvents, DB_DEFAULTS.maxEvents, true),
  params: db?.params ?? DB_DEFAULTS.params,
  slowMs: dbNumber(db?.slowMs, DB_DEFAULTS.slowMs),
  repeatThreshold: dbNumber(db?.repeatThreshold, DB_DEFAULTS.repeatThreshold),
})

export const resolveOptions = (
  opts: InspectorOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): InternalOptions => {
  const auth = opts.auth ?? null
  if (auth !== null && !(isNonEmptyString(auth.user) && isNonEmptyString(auth.pass))) {
    throw new TypeError('[req-inspect] auth.user and auth.pass must be non-empty strings')
  }
  const path = normalizePath(opts.path ?? DEFAULT_PATH)
  if (path === '/') throw new TypeError('[req-inspect] path must not be the root')
  const enabled = opts.enabled ?? (env.NODE_ENV !== 'production' || auth !== null)
  return {
    path,
    enabled,
    auth,
    maxRequests: opts.maxRequests ?? DEFAULT_MAX_REQUESTS,
    maxBodyBytes: opts.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
    ignore: opts.ignore ?? [],
    redact: {
      headers: new Set([
        ...REDACTED_HEADERS_DEFAULT,
        ...(opts.redact?.headers ?? []).map((h) => h.toLowerCase()),
      ]),
      bodyKeys: [...BODY_KEYS_DEFAULT, ...(opts.redact?.bodyKeys ?? [])],
    },
    db: resolveDb(opts.db),
  }
}
