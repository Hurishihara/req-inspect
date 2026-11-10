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

const UNREACHABLE_AFTER_MS = 15000
const CLOSED = 2

export const connFromError = (
  readyState: number,
  retryingSinceMs: number | null,
  nowMs: number,
): State['conn'] => {
  if (readyState === CLOSED) return 'disconnected'
  if (retryingSinceMs !== null && nowMs - retryingSinceMs >= UNREACHABLE_AFTER_MS) return 'unreachable'
  return 'reconnecting'
}

export const subscribe = (
  onRecord: (s: RequestSummary) => void,
  onConn: (c: State['conn']) => void,
): { close: () => void; reconnect: () => void } => {
  let es: EventSource | null = null
  let retryingSince: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const open = () => {
    const source = new EventSource('./api/stream')
    es = source
    source.addEventListener('record', (e) => {
      onRecord(JSON.parse(e.data as string) as RequestSummary)
    })
    source.onopen = () => {
      clearTimer()
      retryingSince = null
      onConn('live')
    }
    source.onerror = () => {
      const now = Date.now()
      retryingSince ??= now
      onConn(connFromError(source.readyState, retryingSince, now))
      if (source.readyState === EventSource.CONNECTING && timer === null) {
        timer = setTimeout(() => {
          timer = null
          if (source.readyState !== EventSource.OPEN) {
            onConn(connFromError(source.readyState, retryingSince, Date.now()))
          }
        }, UNREACHABLE_AFTER_MS)
      }
    }
  }

  open()
  return {
    close: () => {
      clearTimer()
      es?.close()
    },
    reconnect: () => {
      clearTimer()
      es?.close()
      retryingSince = null
      open()
      onConn('reconnecting')
    },
  }
}
