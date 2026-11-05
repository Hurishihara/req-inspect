import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { captureParsedBody, classifyContentType } from './body.js'
import { createHandler } from './http.js'
import { resolveOptions } from './options.js'
import { redactBody, redactHeaders, redactUrl, scrubJsonText } from './redact.js'
import { RingStore } from './store.js'
import { warnOnce } from './warn.js'
import type {
  CapturedBody,
  InspectorOptions,
  RecordDraft,
  RequestRecord,
  RequestSummary,
  ResolvedOptions,
} from './types.js'

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

export function toSummary(r: RequestRecord): RequestSummary {
  const { request: _request, response: _response, ...summary } = r
  return summary
}

export function createInspector(
  options: InspectorOptions = {},
  internal: { uiDir?: string } = {},
): Inspector {
  const opts = resolveOptions(options)
  const store = new RingStore(opts.maxRequests)
  const uiDir = internal.uiDir ?? join(dirname(fileURLToPath(import.meta.url)), 'ui')
  const handle = createHandler(store, opts, uiDir)
  const keys = opts.redact.bodyKeys

  const redactCaptured = (b: CapturedBody, contentType: string | undefined): CapturedBody => {
    if (b.kind !== 'json' && b.kind !== 'text') return b
    if (typeof b.value !== 'string') return { ...b, value: redactBody(b.value, keys) }
    // Unparsed JSON text, e.g. a truncated prefix: scrub it by key.
    if (classifyContentType(contentType) === 'json') return { ...b, value: scrubJsonText(b.value, keys) }
    return b
  }

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
          const { request, response } = draft
          const record: RequestRecord = {
            ...draft,
            v: 1,
            id: store.nextId(),
            url: redactUrl(draft.url, keys),
            request: {
              ...request,
              headers: redactHeaders(request.headers, opts.redact.headers),
              query: redactBody(request.query, keys),
              body: redactCaptured(request.body, request.headers['content-type']),
            },
            response: {
              ...response,
              headers: redactHeaders(response.headers, opts.redact.headers),
              body: redactCaptured(response.body, response.headers['content-type']),
            },
          }
          store.add(record)
        } catch (err) {
          warnOnce('record', err)
        }
      })
    },
  }
}
