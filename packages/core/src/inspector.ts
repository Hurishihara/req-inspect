import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { captureParsedBody } from './domain/body.js'
import { resolveOptions } from './domain/options.js'
import { toRecord } from './domain/record.js'
import { redactBody } from './domain/redact.js'
import type { CapturedBody, InspectorOptions, RecordDraft, ResolvedOptions } from './domain/types.js'
import { createHandler } from './server/handler.js'
import { RingStore } from './store/ring-store.js'
import { warnOnce } from './support/warn.js'

export interface Inspector {
  options: ResolvedOptions
  store: RingStore
  isInspectorPath: (pathname: string) => boolean
  shouldIgnore: (pathname: string) => boolean
  /** Captures an already-parsed request body, redacting it before it is serialized and truncated. */
  captureRequestBody: (value: unknown, contentType: string | undefined) => CapturedBody
  record: (draft: RecordDraft) => void
  handle: (req: IncomingMessage, res: ServerResponse) => void
}

export const createInspector = (
  options: InspectorOptions = {},
  internal: { uiDir?: string } = {},
): Inspector => {
  const opts = resolveOptions(options)
  const store = new RingStore(opts.maxRequests)
  const uiDir = internal.uiDir ?? join(dirname(fileURLToPath(import.meta.url)), 'ui')
  const handle = createHandler(store, opts, uiDir)
  const keys = opts.redact.bodyKeys

  return {
    options: opts,
    store,
    handle,
    isInspectorPath: (p) => p === opts.path || p.startsWith(`${opts.path}/`),
    shouldIgnore: (p) => opts.ignore.some((i) => (typeof i === 'string' ? p.startsWith(i) : i.test(p))),
    captureRequestBody: (value, contentType) =>
      captureParsedBody(redactBody(value, keys), contentType, opts.maxBodyBytes),
    record(draft) {
      setImmediate(() => {
        try {
          store.add(toRecord(draft, store.nextId(), opts.redact))
        } catch (err) {
          warnOnce('record', err)
        }
      })
    },
  }
}
