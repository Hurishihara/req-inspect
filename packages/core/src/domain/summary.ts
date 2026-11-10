import type { RequestRecord, RequestSummary } from './types.js'

export const toSummary = (r: RequestRecord): RequestSummary => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit these keys from the summary
  const { request: _request, response: _response, db, ...summary } = r
  if (!db) return summary
  const flag = db.flags.repeated.length > 0 ? 'repeated' : db.flags.slow.length > 0 ? 'slow' : undefined
  return {
    ...summary,
    dbCount: db.events.length + db.dropped,
    dbMs: db.totalMs,
    ...(flag ? { dbFlag: flag } : {}),
  }
}
