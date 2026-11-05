import { classifyContentType } from './body.js'
import { redactBody, redactHeaders, redactUrl, scrubJsonText } from './redact.js'
import type { CapturedBody, RecordDraft, RequestRecord, InternalOptions } from './types.js'

const redactCaptured = (
  b: CapturedBody,
  contentType: string | undefined,
  keys: InternalOptions['redact']['bodyKeys'],
): CapturedBody => {
  if (b.kind !== 'json' && b.kind !== 'text') return b
  if (typeof b.value !== 'string') return { ...b, value: redactBody(b.value, keys) }
  // Unparsed JSON text, e.g. a truncated prefix: scrub it by key.
  if (classifyContentType(contentType) === 'json') return { ...b, value: scrubJsonText(b.value, keys) }
  return b
}

export const toRecord = (
  draft: RecordDraft,
  id: string,
  redact: InternalOptions['redact'],
): RequestRecord => {
  const keys = redact.bodyKeys
  const { request, response } = draft
  return {
    ...draft,
    v: 1,
    id,
    url: redactUrl(draft.url, keys),
    request: {
      ...request,
      headers: redactHeaders(request.headers, redact.headers),
      query: redactBody(request.query, keys),
      body: redactCaptured(request.body, request.headers['content-type'], keys),
    },
    response: {
      ...response,
      headers: redactHeaders(response.headers, redact.headers),
      body: redactCaptured(response.body, response.headers['content-type'], keys),
    },
  }
}
