import type { RequestRecord, RequestSummary } from '@req-inspect/core'

import type { State } from './reducer'

export async function fetchList(): Promise<RequestSummary[]> {
  const res = await fetch('./api/requests')
  if (!res.ok) throw new Error(`list failed: ${res.status}`)
  return res.json()
}

export async function fetchRecord(id: string): Promise<RequestRecord | null> {
  const res = await fetch(`./api/requests/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`record failed: ${res.status}`)
  return res.json()
}

export async function clearAll(): Promise<void> {
  const res = await fetch('./api/requests', { method: 'DELETE' })
  if (!res.ok) throw new Error(`clear failed: ${res.status}`)
}

export function subscribe(
  onRecord: (s: RequestSummary) => void,
  onConn: (c: State['conn']) => void,
): () => void {
  const es = new EventSource('./api/stream')
  es.addEventListener('record', (e) => {
    onRecord(JSON.parse(e.data))
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
