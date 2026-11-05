import type { RequestSummary } from '@req-inspect/core'

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

export const matchesFilter = (s: RequestSummary, text: string): boolean => {
  const tokens = text.split(/\s+/).filter(Boolean)
  return tokens.every((t) => {
    if (/^[1-5]xx$/i.test(t)) return Math.floor(s.status / 100) === Number(t[0])
    const up = t.toUpperCase()
    if (METHODS.has(up)) return s.method.toUpperCase() === up
    const low = t.toLowerCase()
    return s.url.toLowerCase().includes(low) || (s.route?.toLowerCase().includes(low) ?? false)
  })
}
