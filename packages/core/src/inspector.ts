import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createNodeCapture } from './capture/node-capture.js'
import { captureParsedBody } from './domain/body.js'
import { resolveOptions } from './domain/options.js'
import { toRecord } from './domain/record.js'
import { redactBody } from './domain/redact.js'
import type {
  CaptureHooks,
  CapturedBody,
  InspectorOptions,
  RecordDraft,
  ResolvedOptions,
} from './domain/types.js'
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
  /** Tells an adapter what to do with a request path (without its query string). */
  dispatch: (pathname: string) => 'handle' | 'skip' | 'capture'
  capture: (req: IncomingMessage, res: ServerResponse, hooks: CaptureHooks) => void
}

export type InspectorInternals = Inspector & {
  store: RingStore
  record: (draft: RecordDraft) => void
  captureRequestBody: (value: unknown, contentType: string | undefined) => CapturedBody
}

export const createInspectorInternals = (
  options: InspectorOptions = {},
  internal: { uiDir?: string } = {},
): InspectorInternals => {
  const opts = resolveOptions(options)
  const store = new RingStore(opts.maxRequests)
  const uiDir = internal.uiDir ?? join(dirname(fileURLToPath(import.meta.url)), 'ui')
  const handle = createHandler(store, opts, uiDir)
  const keys = opts.redact.bodyKeys

  const record = (draft: RecordDraft): void => {
    setImmediate(() => {
      try {
        store.add(toRecord(draft, store.nextId(), opts.redact))
      } catch (err) {
        warnOnce('record', err)
      }
    })
  }
  const isInspectorPath = (p: string): boolean => p === opts.path || p.startsWith(`${opts.path}/`)
  const shouldIgnore = (p: string): boolean =>
    opts.ignore.some((i) => (typeof i === 'string' ? p.startsWith(i) : i.test(p)))

  return {
    options: opts,
    store,
    handle,
    isInspectorPath,
    shouldIgnore,
    captureRequestBody: (value, contentType) =>
      captureParsedBody(redactBody(value, keys), contentType, opts.maxBodyBytes),
    record,
    dispatch: (p) => {
      if (!opts.enabled) return 'skip'
      if (isInspectorPath(p)) return 'handle'
      return shouldIgnore(p) ? 'skip' : 'capture'
    },
    capture: createNodeCapture({ maxBodyBytes: opts.maxBodyBytes, bodyKeys: keys, record }),
  }
}

export const createInspector = (
  options: InspectorOptions = {},
  internal: { uiDir?: string } = {},
): Inspector => createInspectorInternals(options, internal)
