import {
  type Dispatch,
  type KeyboardEvent,
  type MutableRefObject,
  type RefObject,
  useEffect,
  useRef,
} from 'react'

import { matchesFilter } from '../filter'
import type { Action, State } from '../reducer'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { LiveIndicator } from '../ui/LiveIndicator'
import { SearchField } from '../ui/SearchField'
import { ThemeToggle } from '../ui/ThemeToggle'
import { emptyReason, listKeyIndex } from '../view'
import { RequestRow } from './RequestRow'

const origin = () => (typeof location === 'undefined' ? 'http://localhost:3000' : location.origin)

export const RequestList = ({
  state,
  dispatch,
  onClear,
  filterRef,
  focusIdRef,
}: {
  state: State
  dispatch: Dispatch<Action>
  onClear: () => void
  filterRef: RefObject<HTMLInputElement | null>
  focusIdRef?: MutableRefObject<string | null>
}) => {
  const rows = state.items.filter((r) => matchesFilter(r, state.filter))
  const rowEls = useRef(new Map<string, HTMLButtonElement>())
  const selectedIndex = rows.findIndex((r) => r.id === state.selectedId)
  const reason = emptyReason(state.items.length, rows.length)

  useEffect(() => {
    const id = focusIdRef?.current
    if (!id) return
    rowEls.current.get(id)?.focus()
    focusIdRef.current = null
  }, [focusIdRef])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = listKeyIndex(e.key, selectedIndex, rows.length)
    if (idx === null) return
    e.preventDefault()
    const target = rows[idx]
    dispatch({ type: 'select', id: target.id })
    rowEls.current.get(target.id)?.focus()
  }

  return (
    <section className="list flex min-h-0 flex-col">
      <div className="flex h-toolbar shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <SearchField
          value={state.filter}
          onChange={(text) => {
            dispatch({ type: 'filter', text })
          }}
          onClear={() => {
            dispatch({ type: 'filter', text: '' })
          }}
          inputRef={filterRef}
        />
        <Button
          icon={state.paused ? 'play' : 'pause'}
          count={state.paused ? state.pending.length : undefined}
          onClick={() => {
            dispatch({ type: state.paused ? 'resume' : 'pause' })
          }}
        >
          {state.paused ? 'Resume' : 'Pause'}
        </Button>
        <Button variant="danger" icon="trash" onClick={onClear}>
          Clear
        </Button>
        <LiveIndicator conn={state.conn} paused={state.paused} pending={state.pending.length} />
        <ThemeToggle />
      </div>
      {reason === 'waiting' && (
        <EmptyState
          title="Waiting for requests"
          hint={
            <>
              Send a request to your app and it appears here live. Try{' '}
              <code className="rounded-sm border border-border bg-surface px-1 font-mono text-code">
                curl {origin()}
              </code>
              .
            </>
          }
        />
      )}
      {reason === 'no-matches' && (
        <EmptyState
          title="No matches"
          hint={`Nothing matches "${state.filter}".`}
          action={
            <Button
              onClick={() => {
                dispatch({ type: 'filter', text: '' })
              }}
            >
              Clear filter
            </Button>
          }
        />
      )}
      {reason === null && (
        <div
          role="listbox"
          aria-label="Requests"
          className="min-h-0 flex-1 overflow-auto"
          onKeyDown={onKeyDown}
        >
          {rows.map((r, i) => (
            <RequestRow
              key={r.id}
              item={r}
              selected={r.id === state.selectedId}
              focusable={selectedIndex < 0 ? i === 0 : i === selectedIndex}
              onSelect={() => {
                dispatch({ type: 'select', id: r.id })
              }}
              rowRef={(el) => {
                if (el) rowEls.current.set(r.id, el)
                else rowEls.current.delete(r.id)
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}
