import { peekRequestsSeen } from './context.js'

const MIN_MISSES = 20
const MIN_AGE_MS = 30_000

const warned = new Set<string>()

/** Test hook: forget which integrations already warned. */
export const resetWatchState = (): void => {
  warned.clear()
}

/**
 * Notices an integration whose queries never run inside an inspected request. Call `observe` for every
 * query with whether a request scope was found. Warns at most once per integration per process.
 */
export const watchDbContext = (integration: 'pg' | 'mongodb'): { observe: (inScope: boolean) => void } => {
  const created = Date.now()
  let misses = 0
  let finished = false
  const observe = (inScope: boolean): void => {
    if (finished) return
    try {
      if (inScope) {
        finished = true
        return
      }
      if (++misses < MIN_MISSES || Date.now() - created < MIN_AGE_MS) return
      finished = true
      if (warned.has(integration)) return
      warned.add(integration)
      console.warn(
        peekRequestsSeen() === 0
          ? `req-inspect: ${integration} queries aren't linked to any request. Is @req-inspect/express 0.3 or newer installed, and is inspector() mounted before your routes?`
          : `req-inspect: requests are being inspected but none of these ${integration} queries ran inside one. See the README's "Database calls" limitations.`,
      )
    } catch {
      finished = true
    }
  }
  return { observe }
}
