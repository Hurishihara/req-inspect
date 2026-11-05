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
  InternalOptions,
  InspectorOptions,
  RecordDraft,
  ResolvedOptions,
} from './domain/types.js'
import { createHandler } from './server/handler.js'
import { RingStore } from './store/ring-store.js'
import { warnOnce } from './support/warn.js'

export interface Inspector {
  /** Frozen, read-only view of the resolved options. */
  readonly options: ResolvedOptions
  /**
   * Tells an adapter what to do with a request path (the full original path, without its query string):
   * `'handle'` for the dashboard path, `'skip'` when disabled or ignored, `'capture'` otherwise.
   */
  dispatch: (pathname: string) => 'handle' | 'skip' | 'capture'
  /**
   * Serves the dashboard, API and live stream for a request that `dispatch` answered `'handle'`, after the
   * access checks. Responds 404 when the inspector is disabled.
   */
  handle: (req: IncomingMessage, res: ServerResponse) => void
  /**
   * Starts capturing a request that `dispatch` answered `'capture'`: wraps `res.write` and `res.end` and
   * stores a redacted record when the response finishes or closes. Never throws; a failure warns once and
   * leaves the response unaffected. Does nothing when the inspector is disabled.
   */
  capture: (req: IncomingMessage, res: ServerResponse, hooks: CaptureHooks) => void
}

export interface InspectorInternals extends Inspector {
  /** Mutable options the engine itself uses. */
  options: InternalOptions
  store: RingStore
  isInspectorPath: (pathname: string) => boolean
  shouldIgnore: (pathname: string) => boolean
  /** Captures an already-parsed request body, redacting it before it is serialized and truncated. */
  captureRequestBody: (value: unknown, contentType: string | undefined) => CapturedBody
  record: (draft: RecordDraft) => void
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
    capture: opts.enabled
      ? createNodeCapture({ maxBodyBytes: opts.maxBodyBytes, bodyKeys: keys, record })
      : () => undefined,
  }
}

// `Set` cannot be frozen, so the public view gets its own copy of the header set.
const freezeOptions = (o: InternalOptions): ResolvedOptions =>
  Object.freeze({
    ...o,
    auth: o.auth === null ? null : Object.freeze({ ...o.auth }),
    ignore: Object.freeze([...o.ignore]),
    redact: Object.freeze({
      headers: new Set(o.redact.headers),
      bodyKeys: Object.freeze([...o.redact.bodyKeys]),
    }),
  })

export const createInspector = (options: InspectorOptions = {}): Inspector => {
  const { options: resolved, dispatch, handle, capture } = createInspectorInternals(options)
  return { options: freezeOptions(resolved), dispatch, handle, capture }
}
