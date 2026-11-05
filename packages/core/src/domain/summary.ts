import type { RequestRecord, RequestSummary } from './types.js'

export const toSummary = (r: RequestRecord): RequestSummary => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit these keys from the summary
  const { request: _request, response: _response, ...summary } = r
  return summary
}
