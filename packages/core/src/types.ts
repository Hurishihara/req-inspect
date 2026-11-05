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
export interface ResolvedOptions {
  path: string
  enabled: boolean
  auth: { user: string; pass: string } | null
  maxRequests: number
  maxBodyBytes: number
  ignore: (string | RegExp)[]
  redact: { headers: Set<string>; bodyKeys: (string | RegExp)[] } // defaults merged, headers lowercased
}
