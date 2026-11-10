import type { DbEvent, RepeatFlag } from './types.js'

export const DB_DEFAULTS = { maxEvents: 100, params: false, slowMs: 100, repeatThreshold: 5 } as const

const round1 = (n: number): number => Math.round(n * 10) / 10

/** Total time covered by the intervals; overlaps count once. Rounded to 0.1. */
export const unionMs = (intervals: readonly (readonly [number, number])[]): number => {
  const sorted = intervals.map(([s, e]) => [s, e] as const).sort((a, b) => a[0] - b[0])
  let total = 0
  let curStart = 0
  let curEnd = 0
  let open = false
  for (const [s, e] of sorted) {
    if (!open) {
      curStart = s
      curEnd = e
      open = true
    } else if (s <= curEnd) {
      if (e > curEnd) curEnd = e
    } else {
      total += curEnd - curStart
      curStart = s
      curEnd = e
    }
  }
  if (open) total += curEnd - curStart
  return round1(total)
}

export const slowIndexes = (events: readonly DbEvent[], slowMs: number): number[] => {
  const out: number[] = []
  events.forEach((e, i) => {
    if (e.durationMs >= slowMs) out.push(i)
  })
  return out
}

export const repeatFlags = (
  counts: ReadonlyMap<string, { count: number; first: number }>,
  threshold: number,
): RepeatFlag[] =>
  [...counts]
    .filter(([, v]) => v.count >= threshold)
    .map(([fingerprint, v]) => ({ fingerprint, count: v.count, first: v.first }))
    .sort((a, b) => b.count - a.count)

export const capText = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s)
