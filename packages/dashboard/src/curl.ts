import type { RequestRecord } from '@req-inspect/core'

const SKIP = new Set(['host', 'content-length', 'connection'])
const q = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`

export function toCurl(r: RequestRecord, origin: string): string {
  const parts = ['curl', '-X', r.method, q(origin + r.url)]
  for (const [k, v] of Object.entries(r.request.headers)) {
    if (!SKIP.has(k.toLowerCase())) parts.push('-H', q(`${k}: ${v}`))
  }
  const b = r.request.body
  if (b.kind === 'json') parts.push('--data-raw', q(JSON.stringify(b.value)))
  else if (b.kind === 'text') parts.push('--data-raw', q(String(b.value)))
  return parts.join(' ')
}
