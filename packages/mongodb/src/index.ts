import { currentDbScope, watchDbContext } from '@req-inspect/core'

import { createPending } from './pending.js'
import { commandDocument, keyShape, SKIPPED_COMMANDS } from './shape.js'

export interface MongoClientLike {
  on: (event: string, fn: (e: never) => void) => unknown
  options?: { monitorCommands?: boolean }
}

interface StartedEvent {
  requestId: number
  commandName: string
  command: Record<string, unknown>
}
interface SucceededEvent {
  requestId: number
  reply?: unknown
}
interface FailedEvent {
  requestId: number
  failure?: unknown
}

const seen = new WeakSet()
let warned = false

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const rowsOf = (reply: unknown): number | undefined => {
  if (!isObject(reply)) return undefined
  if (typeof reply.n === 'number') return reply.n
  const cursor = reply.cursor
  const batch = isObject(cursor) ? cursor.firstBatch : undefined
  return Array.isArray(batch) ? (batch as unknown[]).length : undefined
}

const messageOf = (failure: unknown): string =>
  failure instanceof Error
    ? failure.message
    : isObject(failure) && typeof failure.message === 'string'
      ? failure.message
      : String(failure)

const targetOf = (name: string, command: Record<string, unknown>): string | null => {
  const direct = command[name]
  if (typeof direct === 'string') return direct
  const collection = command.collection // getMore carries a cursor id in `command[name]`
  return typeof collection === 'string' ? collection : null
}

/**
 * Records every MongoDB command made inside a request on that request's record. The client must have been
 * created with `monitorCommands: true`. Safe to call twice on one client.
 */
export const instrumentMongo = (client: MongoClientLike): void => {
  try {
    if (client.options?.monitorCommands !== true) {
      if (!warned) {
        warned = true
        console.warn(
          'req-inspect: MongoDB tracking needs `monitorCommands: true` in the MongoClient options; queries are not recorded.',
        )
      }
      return
    }
    if (seen.has(client)) return
    seen.add(client)
    const pending = createPending()
    const watch = watchDbContext('mongodb')

    client.on('commandStarted', (e: StartedEvent) => {
      try {
        if (SKIPPED_COMMANDS.has(e.commandName)) return
        const scope = currentDbScope()
        watch.observe(scope !== null)
        if (!scope) return
        const target = targetOf(e.commandName, e.command)
        const document = commandDocument(e.command)
        const firstOf = (v: unknown): unknown => (Array.isArray(v) ? (v as unknown[])[0] : undefined)
        const firstQuery = (v: unknown): unknown => {
          const item = firstOf(v)
          return typeof item === 'object' && item !== null ? (item as { q?: unknown }).q : undefined
        }
        const filter =
          document.filter ??
          document.query ??
          firstQuery(document.updates) ??
          firstQuery(document.deletes) ??
          document.pipeline ??
          firstOf(document.documents)
        pending.set(e.requestId, {
          scope,
          startMs: scope.now(),
          operation: e.commandName,
          target,
          document,
          fingerprint: `${e.commandName} ${target ?? ''} ${keyShape(filter ?? {})}`,
        })
      } catch {
        // never let instrumentation reach the app
      }
    })

    const finish = (id: number, outcome: { rows?: number; error?: string }): void => {
      try {
        const p = pending.take(id)
        if (!p) return
        p.scope.track({
          system: 'mongodb',
          operation: p.operation,
          target: p.target,
          statement: `${p.operation} ${p.target ?? ''}`.trim(),
          document: p.document,
          startMs: p.startMs,
          endMs: performance.now(),
          fingerprint: p.fingerprint,
          ...outcome,
        })
      } catch {
        // never let instrumentation reach the app
      }
    }

    client.on('commandSucceeded', (e: SucceededEvent) => {
      try {
        const rows = rowsOf(e.reply)
        finish(e.requestId, rows === undefined ? {} : { rows })
      } catch {
        // never let instrumentation reach the driver
      }
    })
    client.on('commandFailed', (e: FailedEvent) => {
      try {
        finish(e.requestId, { error: messageOf(e.failure) })
      } catch {
        // never let instrumentation reach the driver
      }
    })
  } catch (err) {
    console.warn('req-inspect: could not instrument mongodb:', err)
  }
}
