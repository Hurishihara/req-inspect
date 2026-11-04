import type { Dispatch } from 'react'
import { matchesFilter } from '../filter'
import type { Action, State } from '../reducer'

const time = (t: number) => new Date(t).toLocaleTimeString()

export function RequestList({ state, dispatch, onClear }: {
  state: State; dispatch: Dispatch<Action>; onClear: () => void
}) {
  const rows = state.items.filter(r => matchesFilter(r, state.filter))
  return (
    <section className="list">
      <div className="toolbar">
        <input
          type="search" placeholder="Filter: POST /users 5xx" value={state.filter}
          onChange={e => dispatch({ type: 'filter', text: e.target.value })}
        />
        <button onClick={() => dispatch({ type: state.paused ? 'resume' : 'pause' })}>
          {state.paused ? `Resume (${state.pending.length})` : 'Pause'}
        </button>
        <button onClick={onClear}>Clear</button>
        <span className={`dot ${state.conn}`} title={state.conn} aria-label={state.conn} />
      </div>
      <div className="rows">
        {rows.length === 0 && <div className="empty">No requests</div>}
        {rows.map(r => (
          <button
            key={r.id}
            className={`row s${Math.floor(r.status / 100)}${r.id === state.selectedId ? ' selected' : ''}`}
            onClick={() => dispatch({ type: 'select', id: r.id })}
          >
            <span className="method">{r.method}</span>
            <span className="path">
              {r.url}
              {r.route && <small>{r.route}</small>}
            </span>
            <span className="status">{r.status}</span>
            <span className="dur">{Math.round(r.durationMs)} ms</span>
            <span className="time">{time(r.startedAt)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
