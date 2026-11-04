import { resolveOptions } from './options.js'
import { redactBody, redactHeaders } from './redact.js'
import { RingStore } from './store.js'
import { warnOnce } from './warn.js'
import type {
  CapturedBody, InspectorOptions, RecordDraft, RequestRecord, RequestSummary, ResolvedOptions,
} from './types.js'

export interface Inspector {
  options: ResolvedOptions
  store: RingStore
  isInspectorPath(pathname: string): boolean
  shouldIgnore(pathname: string): boolean
  record(draft: RecordDraft): void
}

export function toSummary(r: RequestRecord): RequestSummary {
  const { request: _request, response: _response, ...summary } = r
  return summary
}

export function createInspector(options: InspectorOptions = {}): Inspector {
  const opts = resolveOptions(options)
  const store = new RingStore(opts.maxRequests)

  const redactCaptured = (b: CapturedBody): CapturedBody =>
    (b.kind === 'json' || b.kind === 'text') && typeof b.value !== 'string'
      ? { ...b, value: redactBody(b.value, opts.redact.bodyKeys) }
      : b

  return {
    options: opts,
    store,
    isInspectorPath: (p) => p === opts.path || p.startsWith(`${opts.path}/`),
    shouldIgnore: (p) => opts.ignore.some((i) => (typeof i === 'string' ? p.startsWith(i) : i.test(p))),
    record(draft) {
      setImmediate(() => {
        try {
          const record: RequestRecord = {
            ...draft,
            v: 1,
            id: store.nextId(),
            request: {
              ...draft.request,
              headers: redactHeaders(draft.request.headers, opts.redact.headers),
              body: redactCaptured(draft.request.body),
            },
            response: {
              ...draft.response,
              headers: redactHeaders(draft.response.headers, opts.redact.headers),
              body: redactCaptured(draft.response.body),
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
