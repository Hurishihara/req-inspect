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

export const CONTEXT_VERSION = 1

interface ContextSlot {
  version: number
  storage: AsyncLocalStorage<DbSink>
  requestsSeen: number
}

interface ContextHolder {
  [CONTEXT_KEY]?: unknown
}

let privateSlot: ContextSlot | undefined
let warnedIncompatible = false

/** Test hook: forget the module-local slot and the one-time warning. */
export const resetContextState = (): void => {
  privateSlot = undefined
  warnedIncompatible = false
}

const isSlot = (v: unknown): v is ContextSlot =>
  typeof v === 'object' && v !== null && typeof (v as { version?: unknown }).version === 'number'

const newSlot = (storage = new AsyncLocalStorage<DbSink>()): ContextSlot => ({
  version: CONTEXT_VERSION,
  storage,
  requestsSeen: 0,
})

// Shared through globalThis so a second copy of core in node_modules reuses the same storage.
const getSlot = (): ContextSlot => {
  const g = globalThis as ContextHolder
  const found = g[CONTEXT_KEY]
  if (found === undefined) return (g[CONTEXT_KEY] = newSlot())
  // core 0.4.0 stored a bare, unlabelled AsyncLocalStorage: that is format 1. Wrap the same instance so
  // copies that already hold it stay shared with this one.
  if (found instanceof AsyncLocalStorage)
    return (g[CONTEXT_KEY] = newSlot(found as AsyncLocalStorage<DbSink>))
  if (isSlot(found) && found.version === CONTEXT_VERSION) return found
  if (!warnedIncompatible) {
    warnedIncompatible = true
    const theirs = isSlot(found) ? String(found.version) : 'unknown'
    console.warn(
      `req-inspect: two incompatible versions of @req-inspect/core are installed (context format ${theirs} and ${String(CONTEXT_VERSION)}). Database calls may not be recorded. Run \`npm update @req-inspect\` so all packages use one version.`,
    )
  }
  return (privateSlot ??= newSlot())
}

/** Counts one captured request in the slot. */
export const noteRequest = (): void => {
  getSlot().requestsSeen++
}

/** Requests captured so far, read without creating the slot; 0 when there is none. */
export const peekRequestsSeen = (): number => {
  const found = (globalThis as ContextHolder)[CONTEXT_KEY]
  if (isSlot(found) && found.version === CONTEXT_VERSION) return found.requestsSeen
  return privateSlot?.requestsSeen ?? 0
}

const getAls = (): AsyncLocalStorage<DbSink> => getSlot().storage

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
