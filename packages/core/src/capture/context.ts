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

const META_KEY = Symbol.for('req-inspect.context.meta')

interface ContextMeta {
  version: number
  requestsSeen: number
}

interface ContextHolder {
  [CONTEXT_KEY]?: unknown
  [META_KEY]?: unknown
}

interface PrivateState {
  storage: AsyncLocalStorage<DbSink>
  meta: ContextMeta
}

let privateState: PrivateState | undefined
let warnedIncompatible = false

/** Test hook: forget the module-local state and the one-time warning. */
export const resetContextState = (): void => {
  privateState = undefined
  warnedIncompatible = false
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const isStorage = (v: unknown): v is AsyncLocalStorage<DbSink> =>
  isObject(v) && typeof v.run === 'function' && typeof v.getStore === 'function'

const isMeta = (v: unknown): v is ContextMeta =>
  isObject(v) && typeof v.version === 'number' && typeof v.requestsSeen === 'number'

const incompatible = (theirs: string): PrivateState => {
  if (!warnedIncompatible) {
    warnedIncompatible = true
    console.warn(
      `req-inspect: two incompatible versions of @req-inspect/core are installed (context format ${theirs} and ${String(CONTEXT_VERSION)}). Database calls may not be recorded. Run \`npm update @req-inspect\` so all packages use one version.`,
    )
  }
  return (privateState ??= {
    storage: new AsyncLocalStorage<DbSink>(),
    meta: { version: CONTEXT_VERSION, requestsSeen: 0 },
  })
}

// The slot stays a bare AsyncLocalStorage, exactly as core 0.4.0 creates it, so any copy can share it.
// Metadata (format version, request count) lives under a separate key that 0.4.0 copies simply ignore.
const getState = (): { storage: AsyncLocalStorage<DbSink>; meta: ContextMeta } => {
  const g = globalThis as ContextHolder
  const slot = (g[CONTEXT_KEY] ??= new AsyncLocalStorage<DbSink>())
  if (!isStorage(slot)) return incompatible('unknown')
  const meta = (g[META_KEY] ??= { version: CONTEXT_VERSION, requestsSeen: 0 })
  if (!isMeta(meta)) return incompatible('unknown')
  if (meta.version !== CONTEXT_VERSION) return incompatible(String(meta.version))
  return { storage: slot, meta }
}

/** Counts one captured request. */
export const noteRequest = (): void => {
  getState().meta.requestsSeen++
}

/** Requests captured so far, read without creating anything; 0 when unknown. */
export const peekRequestsSeen = (): number => {
  const meta = (globalThis as ContextHolder)[META_KEY]
  if (isMeta(meta) && meta.version === CONTEXT_VERSION) return meta.requestsSeen
  return privateState?.meta.requestsSeen ?? 0
}

const getAls = (): AsyncLocalStorage<DbSink> => getState().storage

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
