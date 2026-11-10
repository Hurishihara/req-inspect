import { AsyncResource } from 'node:async_hooks'

import { currentDbScope, watchDbContext, type DbEventInput, type DbScope } from '@req-inspect/core'

import { sqlFingerprint, sqlOperation, sqlTarget } from './sql.js'

type QueryFn = (...args: unknown[]) => unknown

export interface PgLike {
  Client: { prototype: { query: (...args: unknown[]) => unknown } }
  Pool?: { prototype: { connect?: (...args: unknown[]) => unknown } }
}

interface Emitter {
  on: (event: string, fn: (...a: unknown[]) => void) => unknown
  listenerCount: (event: string) => number
}

type Watcher = ReturnType<typeof watchDbContext>

const MARKER = Symbol.for('req-inspect.pg')

interface Loose {
  rowCount?: unknown
  text?: unknown
  values?: unknown
  on?: unknown
  listenerCount?: unknown
  submit?: unknown
  callback?: unknown
  then?: unknown
}

const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

const rowsOf = (result: unknown): number | undefined => {
  const n = isObject(result) ? result.rowCount : undefined
  return typeof n === 'number' ? n : undefined
}

const describe = (args: unknown[]): { text: string; values: unknown[] | undefined } => {
  const first = args[0]
  const text = typeof first === 'string' ? first : isObject(first) ? first.text : undefined
  const values = Array.isArray(args[1]) ? (args[1] as unknown[]) : isObject(first) ? first.values : undefined
  return { text: typeof text === 'string' ? text : '', values: Array.isArray(values) ? values : undefined }
}

const isEmitter = (v: unknown): v is Emitter =>
  isObject(v) && typeof v.on === 'function' && typeof v.listenerCount === 'function'

const safeScope = (): DbScope | null => {
  try {
    return currentDbScope()
  } catch {
    return null
  }
}

const wrap = (original: QueryFn, watch: Watcher): QueryFn =>
  function (this: unknown, ...args: unknown[]): unknown {
    const scope = safeScope()
    watch.observe(scope !== null)
    if (!scope) return original.apply(this, args)

    const live = scope
    const startMs = live.now()
    let input: Omit<DbEventInput, 'startMs' | 'endMs' | 'rows' | 'error'> | null = null
    try {
      const { text, values } = describe(args)
      input = {
        system: 'postgresql',
        operation: sqlOperation(text),
        target: sqlTarget(text),
        statement: text,
        ...(values ? { params: values } : {}),
        fingerprint: sqlFingerprint(text),
      }
    } catch {
      input = null
    }

    let done = false
    const record = (outcome: { rows?: number; error?: string }): void => {
      if (done) return
      done = true
      if (!input) return
      try {
        live.track({ ...input, startMs, endMs: performance.now(), ...outcome })
      } catch {
        // never let instrumentation reach the app
      }
    }

    const last = args.length - 1
    // pg runs callbacks in the socket's async context; bind the user's callback to the request's context
    // and keep pg's own `this`.
    const wrapCallback = (callback: QueryFn) => {
      const bound = AsyncResource.bind(callback)
      return function (this: unknown, ...cbArgs: unknown[]): unknown {
        const [err, result] = cbArgs
        record(err ? { error: messageOf(err) } : { rows: rowsOf(result) })
        return bound.apply(this, cbArgs)
      }
    }
    let hasCallback = false
    const trailing = args[last]
    if (typeof trailing === 'function') {
      hasCallback = true
      args[last] = wrapCallback(trailing as QueryFn)
    } else if (
      isObject(args[0]) &&
      typeof args[0].callback === 'function' &&
      typeof args[0].submit !== 'function'
    ) {
      // pg also accepts the callback inside the config object; copy it so the caller's object is untouched.
      hasCallback = true
      args[0] = { ...args[0], callback: wrapCallback(args[0].callback as QueryFn) }
    }

    let result: unknown
    try {
      result = original.apply(this, args)
    } catch (err) {
      record({ error: messageOf(err) })
      throw err
    }

    try {
      if (hasCallback) return result
      if (isObject(result) && typeof result.submit === 'function' && isEmitter(result)) {
        result.on('end', (res: unknown) => {
          record({ rows: rowsOf(res) })
        })
        result.on('error', (err: unknown) => {
          record({ error: messageOf(err) })
          // Our listener must not turn an unhandled 'error' event into a silent one.
          if (result.listenerCount('error') <= 1) throw err
        })
      } else if (isObject(result) && typeof result.then === 'function') {
        // Return a derived promise: same value or rejection, and an ignored rejection still surfaces as unhandled.
        return (result as unknown as Promise<unknown>).then(
          (res) => {
            record({ rows: rowsOf(res) })
            return res
          },
          (err: unknown) => {
            record({ error: messageOf(err) })
            throw err
          },
        )
      }
    } catch {
      // never let instrumentation reach the app
    }
    return result
  }

/** pg-pool runs a queued waiter's connect callback in the releasing client's context; bind it to the caller's. */
const wrapConnect = (original: QueryFn): QueryFn =>
  function (this: unknown, ...args: unknown[]): unknown {
    try {
      const last = args.length - 1
      const cb = args[last]
      if (typeof cb === 'function') args[last] = AsyncResource.bind(cb as QueryFn)
    } catch {
      // never let instrumentation reach the app
    }
    return original.apply(this, args)
  }

/** Records every `pg.Client#query` made inside a request on that request's record. Safe to call twice. */
export const instrumentPg = (pg: PgLike): void => {
  try {
    const proto = pg.Client.prototype as Record<symbol, unknown> & { query: QueryFn }
    if (proto[MARKER] || typeof proto.query !== 'function') return
    Object.defineProperty(proto, MARKER, { value: true })
    proto.query = wrap(proto.query, watchDbContext('pg'))
  } catch (err) {
    console.warn('req-inspect: could not instrument pg:', err)
  }
  try {
    const poolProto = pg.Pool?.prototype as (Record<symbol, unknown> & { connect?: QueryFn }) | undefined
    if (!poolProto || poolProto[MARKER] || typeof poolProto.connect !== 'function') return
    Object.defineProperty(poolProto, MARKER, { value: true })
    poolProto.connect = wrapConnect(poolProto.connect)
  } catch (err) {
    console.warn('req-inspect: could not instrument pg.Pool:', err)
  }
}
