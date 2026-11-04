import type { RequestSummary } from '@req-inspect/core'

export interface State {
  items: RequestSummary[]; paused: boolean; pending: RequestSummary[]
  selectedId: string | null; filter: string; conn: 'live' | 'reconnecting'
}
export type Action =
  | { type: 'loaded'; items: RequestSummary[] }
  | { type: 'received'; item: RequestSummary }
  | { type: 'pause' } | { type: 'resume' }
  | { type: 'select'; id: string | null }
  | { type: 'filter'; text: string }
  | { type: 'cleared' }
  | { type: 'conn'; state: State['conn'] }

export const initialState: State = { items: [], paused: false, pending: [], selectedId: null, filter: '', conn: 'live' }

const MAX = 500
const num = (id: string) => Number(id.slice(id.lastIndexOf('_') + 1))

function merge(existing: RequestSummary[], incoming: RequestSummary[]): RequestSummary[] {
  const byId = new Map<string, RequestSummary>()
  for (const r of existing) byId.set(r.id, r)
  for (const r of incoming) byId.set(r.id, r)
  return [...byId.values()].sort((a, b) => num(b.id) - num(a.id)).slice(0, MAX)
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'loaded': return { ...s, items: merge(s.items, a.items) }
    case 'received':
      return s.paused ? { ...s, pending: [a.item, ...s.pending] } : { ...s, items: merge(s.items, [a.item]) }
    case 'pause': return { ...s, paused: true }
    case 'resume': return { ...s, paused: false, items: merge(s.items, s.pending), pending: [] }
    case 'select': return { ...s, selectedId: a.id }
    case 'filter': return { ...s, filter: a.text }
    case 'cleared': return { ...s, items: [], pending: [], selectedId: null }
    case 'conn': return { ...s, conn: a.state }
  }
}
