export type CapturedBody =
  | { kind: 'none' }
  | { kind: 'text' | 'json'; value: unknown; truncated: boolean; size: number }
  | { kind: 'binary'; contentType: string; size: number; encoding?: string }

export interface RequestRecord {
  v: 1
  id: string
  startedAt: number
  durationMs: number
  method: string
  url: string
  route: string | null
  status: number
  aborted?: true
  request: {
    headers: Record<string, string>
    query: unknown
    params: Record<string, string>
    body: CapturedBody
  }
  response: { headers: Record<string, string>; body: CapturedBody }
}
export type RequestSummary = Omit<RequestRecord, 'request' | 'response'>
export type RecordDraft = Omit<RequestRecord, 'v' | 'id'> // unredacted, from adapters

export interface InspectorOptions {
  path?: string
  enabled?: boolean
  auth?: { user: string; pass: string }
  maxRequests?: number
  maxBodyBytes?: number
  ignore?: (string | RegExp)[]
  redact?: { headers?: string[]; bodyKeys?: (string | RegExp)[] }
}
/** Mutable, engine-internal form of the resolved options. */
export interface InternalOptions {
  path: string
  enabled: boolean
  auth: { user: string; pass: string } | null
  maxRequests: number
  maxBodyBytes: number
  ignore: (string | RegExp)[]
  redact: { headers: Set<string>; bodyKeys: (string | RegExp)[] } // defaults merged, headers lowercased
}

/** Read-only view of the resolved options, as exposed by `Inspector.options`. */
export interface ResolvedOptions {
  readonly path: string
  readonly enabled: boolean
  readonly auth: Readonly<{ user: string; pass: string }> | null
  readonly maxRequests: number
  readonly maxBodyBytes: number
  readonly ignore: readonly (string | RegExp)[]
  /**
   * Defaults merged, headers lowercased. `headers` is a copy: mutating it has no effect on the inspector,
   * which keeps its own instance.
   */
  readonly redact: Readonly<{ headers: ReadonlySet<string>; bodyKeys: readonly (string | RegExp)[] }>
}

/**
 * Framework-specific readers an adapter supplies to `Inspector.capture`.
 * Each is called at most once per request, and any that throws is caught and warned about once.
 */
export interface CaptureHooks {
  /** Matched route pattern, or `null`. Read on the first `res.write`/`res.end`, at the latest when the response finishes or closes. */
  route: () => string | null
  /** Route params. Read on the first `res.write`/`res.end`, at the latest when the response finishes or closes. */
  params: () => Record<string, string>
  /** Parsed query. Read when the response finishes or closes. */
  query: () => unknown
  /** The framework's parsed request body. Read when the response finishes or closes. */
  body: () => unknown
}
