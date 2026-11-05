import type { RequestRecord, RequestSummary } from '@req-inspect/core'

import type { State } from './reducer'

export const fetchList = async (): Promise<RequestSummary[]> => {
  const res = await fetch('./api/requests')
  if (!res.ok) throw new Error(`list failed: ${String(res.status)}`)
  return (await res.json()) as RequestSummary[]
}

export const fetchRecord = async (id: string): Promise<RequestRecord | null> => {
  const res = await fetch(`./api/requests/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`record failed: ${String(res.status)}`)
  return (await res.json()) as RequestRecord
}

export const clearAll = async (): Promise<void> => {
  const res = await fetch('./api/requests', { method: 'DELETE' })
  if (!res.ok) throw new Error(`clear failed: ${String(res.status)}`)
}

export const subscribe = (
  onRecord: (s: RequestSummary) => void,
  onConn: (c: State['conn']) => void,
): (() => void) => {
  const es = new EventSource('./api/stream')
  es.addEventListener('record', (e) => {
    onRecord(JSON.parse(e.data as string) as RequestSummary)
  })
  es.onopen = () => {
    onConn('live')
  }
  es.onerror = () => {
    onConn('reconnecting')
  }
  return () => {
    es.close()
  }
}
