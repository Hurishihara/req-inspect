import type { DbScope } from '@req-inspect/core'

export interface Pending {
  scope: DbScope
  startMs: number
  operation: string
  target: string | null
  document: Record<string, unknown>
  fingerprint: string
}

const STALE_MS = 60_000

/** In-flight commands by requestId. A lost reply is dropped after 60 s, on the next insert. */
export const createPending = () => {
  const map = new Map<number, { at: number; value: Pending }>()
  return {
    set: (id: number, value: Pending): void => {
      const now = performance.now()
      for (const [key, entry] of map) if (now - entry.at > STALE_MS) map.delete(key)
      map.set(id, { at: now, value })
    },
    take: (id: number): Pending | undefined => {
      const entry = map.get(id)
      map.delete(id)
      return entry?.value
    },
    get size(): number {
      return map.size
    },
  }
}
