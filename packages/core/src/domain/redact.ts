export const REDACTED = '[redacted]'

export const normalizeHeaders = (
  h: Record<string, string | string[] | number | undefined>,
): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(h)) {
    if (value === undefined) continue
    out[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return out
}

export const redactHeaders = (h: Record<string, string>, names: Set<string>): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(h)) {
    out[name] = names.has(name.toLowerCase()) ? REDACTED : value
  }
  return out
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null) return false
  const proto: unknown = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

type KeyMatcher = (key: string) => boolean

const keyMatcher = (keys: readonly (string | RegExp)[]): KeyMatcher => {
  const strings = new Set<string>()
  const patterns: RegExp[] = []
  for (const k of keys) {
    if (typeof k === 'string') strings.add(k.toLowerCase())
    else patterns.push(k)
  }
  return (key) => {
    if (strings.has(key.toLowerCase())) return true
    return patterns.some((re) => {
      re.lastIndex = 0 // g/y flags make test() stateful
      const hit = re.test(key)
      re.lastIndex = 0
      return hit
    })
  }
}

// `"key": value` where value is a string (possibly cut off by truncation), number, boolean or null.
// Object and array values are not matched.
const JSON_PAIR = /"((?:[^"\\]|\\.)*)"(\s*:\s*)(?:"(?:[^"\\]|\\.)*(?:"|\\?$)|-?\d[\d.eE+-]*|true|false|null)/g

const decodeJsonKey = (raw: string): string => {
  try {
    return JSON.parse(`"${raw}"`) as string
  } catch {
    return raw
  }
}

/** Key-based redaction for JSON text that could not be parsed, such as a truncated prefix. */
export const scrubJsonText = (text: string, keys: readonly (string | RegExp)[]): string => {
  const matches = keyMatcher(keys)
  return text.replace(JSON_PAIR, (whole, rawKey: string, sep: string) =>
    matches(decodeJsonKey(rawKey)) ? `"${rawKey}"${sep}"${REDACTED}"` : whole,
  )
}

const decodeQueryKey = (raw: string): string => {
  // URLSearchParams decodes '+' and percent escapes and never throws on malformed ones.
  for (const k of new URLSearchParams(`${raw}=`).keys()) return k
  return raw
}

/** Replaces the values of matching query-string keys with `[redacted]`; other parameters stay verbatim and in order. */
export const redactUrl = (url: string, keys: readonly (string | RegExp)[]): string => {
  const q = url.indexOf('?')
  if (q < 0) return url
  const matches = keyMatcher(keys)
  let changed = false
  const parts = url
    .slice(q + 1)
    .split('&')
    .map((part) => {
      const eq = part.indexOf('=')
      const rawKey = eq < 0 ? part : part.slice(0, eq)
      if (rawKey === '' || !matches(decodeQueryKey(rawKey))) return part
      changed = true
      return `${rawKey}=${REDACTED}`
    })
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `changed` is assigned inside the map callback, which control-flow analysis cannot see
  return changed ? `${url.slice(0, q + 1)}${parts.join('&')}` : url
}

export const redactBody = (value: unknown, keys: readonly (string | RegExp)[]): unknown => {
  const matches = keyMatcher(keys)
  // Tracks only the current ancestor chain, so shared (non-cyclic) references are copied, not flagged.
  const ancestors = new Set<object>()
  const walk = (v: unknown): unknown => {
    const isArr = Array.isArray(v)
    if (!isArr && !isPlainObject(v)) return v
    if (ancestors.has(v as object)) return '[circular]'
    ancestors.add(v as object)
    let out: unknown
    if (isArr) {
      out = (v as unknown[]).map(walk)
    } else {
      const obj: Record<string, unknown> =
        Object.getPrototypeOf(v) === null ? (Object.create(null) as Record<string, unknown>) : {}
      for (const [k, val] of Object.entries(v)) {
        obj[k] = matches(k) ? REDACTED : walk(val)
      }
      out = obj
    }
    ancestors.delete(v as object)
    return out
  }
  return walk(value)
}
