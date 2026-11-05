import type { ServerResponse } from 'node:http'

import { toSummary } from '../domain/summary.js'
import type { RingStore } from '../store/ring-store.js'
import { notFound, sendJson } from './respond.js'
import { decode } from './static.js'

export const listRequests = (res: ServerResponse, store: RingStore, query: URLSearchParams): void => {
  const n = Number(query.get('limit'))
  const limit = query.get('limit') !== null && query.get('limit') !== '' && Number.isFinite(n) ? n : undefined
  const before = query.get('before') ?? undefined
  sendJson(res, 200, store.list({ limit, before }).map(toSummary))
}

export const getRequest = (res: ServerResponse, store: RingStore, rawId: string): void => {
  const id = decode(rawId)
  const record = id === null ? undefined : store.get(id)
  if (record) sendJson(res, 200, record)
  else notFound(res)
}

export const clearRequests = (res: ServerResponse, store: RingStore): void => {
  store.clear()
  res.writeHead(204, { 'cache-control': 'no-store' })
  res.end()
}
