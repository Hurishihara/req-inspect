import type { InspectorOptions, ResolvedOptions } from './types.js'

const DEFAULT_REDACT_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key']
const DEFAULT_REDACT_BODY_KEYS: (string | RegExp)[] = []

function normalizePath(path: string): string {
  let p = path.startsWith('/') ? path : `/${path}`
  while (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}

export function resolveOptions(
  opts: InspectorOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): ResolvedOptions {
  const auth = opts.auth ?? null
  const enabled = opts.enabled ?? (env.NODE_ENV !== 'production' || auth !== null)
  return {
    path: normalizePath(opts.path ?? '/_inspect'),
    enabled,
    auth,
    maxRequests: opts.maxRequests ?? 500,
    maxBodyBytes: opts.maxBodyBytes ?? 65536,
    ignore: opts.ignore ?? [],
    redact: {
      headers: new Set([...DEFAULT_REDACT_HEADERS, ...(opts.redact?.headers ?? []).map((h) => h.toLowerCase())]),
      bodyKeys: [...DEFAULT_REDACT_BODY_KEYS, ...(opts.redact?.bodyKeys ?? [])],
    },
  }
}
