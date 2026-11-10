import { formatDuration } from './format'

export const dbShare = (totalMs: number, durationMs: number): number =>
  durationMs <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((totalMs / durationMs) * 100)))

export const dbCaption = (count: number, ms: number): string => `${String(count)} q · ${formatDuration(ms)}`

export const repeatAdvice = (system: 'postgresql' | 'mongodb'): string =>
  system === 'mongodb'
    ? 'Load them in one query (for MongoDB, $in).'
    : 'Load them in one query (for SQL, WHERE id = ANY($1)).'
