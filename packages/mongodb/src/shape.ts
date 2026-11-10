/** Commands the driver sends for its own bookkeeping; never worth showing. */
export const SKIPPED_COMMANDS: ReadonlySet<string> = new Set([
  'hello',
  'isMaster',
  'ismaster',
  'ping',
  'saslStart',
  'saslContinue',
  'endSessions',
  'killCursors',
  'buildInfo',
  'getParameter',
])

const STRIPPED_KEYS: ReadonlySet<string> = new Set([
  '$db',
  'lsid',
  '$clusterTime',
  'txnNumber',
  '$readPreference',
  'apiVersion',
])

const MAX_DEPTH = 8

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null) return false
  const proto = Object.getPrototypeOf(v) as unknown
  return proto === Object.prototype || proto === null
}

const shapeOf = (value: unknown, depth: number): string => {
  if (depth > MAX_DEPTH) return ''
  if (Array.isArray(value)) {
    const first = (value as unknown[])[0]
    return `[${first === undefined ? '' : shapeOf(first, depth + 1)}]`
  }
  if (!isPlain(value)) return ''
  const parts = Object.keys(value)
    .sort()
    .map((k) => {
      const inner = shapeOf(value[k], depth + 1)
      return inner === '' ? k : `${k}:${inner}`
    })
  return `{${parts.join(',')}}`
}

/** The sorted keys of a value, recursively and without values; arrays show the shape of their first element only. */
export const keyShape = (value: unknown): string => shapeOf(value, 0)

/** The command body minus driver session and routing fields. */
export const commandDocument = (command: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(command).filter(([k]) => !STRIPPED_KEYS.has(k)))
