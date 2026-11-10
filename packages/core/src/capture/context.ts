import { AsyncLocalStorage } from 'node:async_hooks'

import { capText, repeatFlags, slowIndexes, unionMs } from '../domain/db.js'
import { redactBody } from '../domain/redact.js'
import type { DbEvent, DbEventInput, DbOptions, DbRecord, DbScope } from '../domain/types.js'
import { warnOnce } from '../support/warn.js'

export interface DbSink {
  scope: DbScope
  /** Closes the sink; `undefined` when nothing was tracked. */
  close: () => DbRecord | undefined
  isClosed: () => boolean
}

const STATEMENT_MAX = 2048
const FINGERPRINT_MAX = 2048
const ERROR_MAX = 500
const CONTEXT_KEY = Symbol.for('req-inspect.context')

interface ContextHolder {
  [CONTEXT_KEY]?: AsyncLocalStorage<DbSink>
}

// Shared through globalThis so a second copy of core in node_modules reuses the same storage.
const getAls = (): AsyncLocalStorage<DbSink> => {
  const g = globalThis as ContextHolder
  return (g[CONTEXT_KEY] ??= new AsyncLocalStorage<DbSink>())
}

// JSON.stringify returns undefined for some inputs despite its declared type.
const stringify = (v: unknown): string | undefined => JSON.stringify(v)

const round1 = (n: number): number => Math.round(n * 10) / 10

export const createDbSink = (opts: {
  db: Required<DbOptions>
  bodyKeys: readonly (string | RegExp)[]
  t0: number
}): DbSink => {
  const { db, bodyKeys, t0 } = opts
  const events: DbEvent[] = []
  const intervals: [number, number][] = []
  const counts = new Map<string, { count: number; first: number }>()
  let tracked = 0
  let dropped = 0
  let closed = false

  const track = (input: DbEventInput): void => {
    if (closed) return
    try {
      const e = { ...input, fingerprint: capText(input.fingerprint, FINGERPRINT_MAX) }
      const index = tracked++
      intervals.push([e.startMs, e.endMs])
      const seen = counts.get(e.fingerprint)
      if (seen) seen.count++
      else counts.set(e.fingerprint, { count: 1, first: index })
      if (events.length >= db.maxEvents) {
        dropped++
        return
      }
      let statement = e.statement
      if (e.document !== undefined) {
        try {
          statement = stringify(redactBody(e.document, bodyKeys)) ?? e.statement
        } catch {
          // e.g. a BigInt in the document: keep the plain statement so the event is still stored
        }
      }
      events.push({
        system: e.system,
        operation: e.operation,
        target: e.target,
        statement: capText(statement, STATEMENT_MAX),
        ...(db.params && e.params ? { params: e.params } : {}),
        ...(e.params ? { paramCount: e.params.length } : {}),
        offsetMs: round1(e.startMs - t0),
        durationMs: round1(e.endMs - e.startMs),
        ...(e.rows === undefined ? {} : { rows: e.rows }),
        ...(e.error === undefined ? {} : { error: capText(e.error, ERROR_MAX) }),
        fingerprint: e.fingerprint,
      })
    } catch (err) {
      warnOnce('db', err)
    }
  }

  const close = (): DbRecord | undefined => {
    closed = true
    if (tracked === 0) return undefined
    const record: DbRecord = {
      events,
      dropped,
      totalMs: unionMs(intervals),
      flags: { repeated: repeatFlags(counts, db.repeatThreshold), slow: slowIndexes(events, db.slowMs) },
    }
    intervals.length = 0
    counts.clear()
    return record
  }

  return { scope: { track, now: () => performance.now() }, close, isClosed: () => closed }
}

export const runInScope = <T>(sink: DbSink, fn: () => T): T => getAls().run(sink, fn)

/** The current request's DB scope, or `null` outside a request or when the inspector is disabled. */
export const currentDbScope = (): DbScope | null => {
  const sink = getAls().getStore()
  return sink && !sink.isClosed() ? sink.scope : null
}
