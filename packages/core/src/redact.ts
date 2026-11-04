export const REDACTED = '[redacted]'

export function normalizeHeaders(
  h: Record<string, string | string[] | number | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(h)) {
    if (value === undefined) continue
    out[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return out
}

export function redactHeaders(h: Record<string, string>, names: Set<string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(h)) {
    out[name] = names.has(name.toLowerCase()) ? REDACTED : value
  }
  return out
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

export function redactBody(value: unknown, keys: readonly (string | RegExp)[]): unknown {
  const strings = new Set<string>()
  const patterns: RegExp[] = []
  for (const k of keys) {
    if (typeof k === 'string') strings.add(k.toLowerCase())
    else patterns.push(k)
  }
  const matches = (key: string): boolean => {
    if (strings.has(key.toLowerCase())) return true
    return patterns.some((re) => {
      re.lastIndex = 0 // g/y flags make test() stateful
      const hit = re.test(key)
      re.lastIndex = 0
      return hit
    })
  }
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
      const obj: Record<string, unknown> = Object.getPrototypeOf(v) === null ? Object.create(null) : {}
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        obj[k] = matches(k) ? REDACTED : walk(val)
      }
      out = obj
    }
    ancestors.delete(v as object)
    return out
  }
  return walk(value)
}
