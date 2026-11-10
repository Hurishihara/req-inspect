import { useEffect, useReducer, useRef } from 'react'

import { clearAll, fetchList, subscribe } from './api'
import { idFromHash } from './hash'
import { useKeyboardNav } from './hooks/useKeyboardNav'
import { useMediaQuery } from './hooks/useMediaQuery'
import { initialState, reducer } from './reducer'
import { RequestList } from './components/RequestList'
import { DetailPane } from './components/DetailPane'

export const App = () => {
  const [state, dispatch] = useReducer(reducer, { ...initialState, selectedId: idFromHash(location.hash) })
  const prevConn = useRef(state.conn)
  const reconnectRef = useRef<() => void>(() => undefined)
  const filterRef = useRef<HTMLInputElement>(null)
  const focusIdRef = useRef<string | null>(null)
  useKeyboardNav({ filterRef })
  const narrow = useMediaQuery('(max-width: 719px)')

  useEffect(() => {
    let alive = true
    fetchList()
      .then((items) => {
        if (alive) dispatch({ type: 'loaded', items })
      })
      .catch(() => {
        /* list unavailable: the stream keeps the view live */
      })
    const sub = subscribe(
      (item) => {
        dispatch({ type: 'received', item })
      },
      (conn) => {
        dispatch({ type: 'conn', state: conn })
      },
    )
    reconnectRef.current = sub.reconnect
    return () => {
      alive = false
      sub.close()
    }
  }, [])

  useEffect(() => {
    if (prevConn.current !== 'live' && state.conn === 'live') {
      fetchList()
        .then((items) => {
          dispatch({ type: 'loaded', items })
        })
        .catch(() => {
          /* list unavailable: the stream keeps the view live */
        })
    }
    prevConn.current = state.conn
  }, [state.conn])

  useEffect(() => {
    const onHash = () => {
      dispatch({ type: 'select', id: idFromHash(location.hash) })
    }
    window.addEventListener('hashchange', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  useEffect(() => {
    const want = state.selectedId ? `#${encodeURIComponent(state.selectedId)}` : ''
    if (location.hash !== want) {
      if (want) location.hash = want
      else history.replaceState(null, '', location.pathname + location.search)
    }
  }, [state.selectedId])

  const onClear = async () => {
    try {
      await clearAll()
    } catch {
      return
    }
    dispatch({ type: 'cleared' })
  }

  const list = (className: string) => (
    <div className={className}>
      <RequestList
        state={state}
        dispatch={dispatch}
        filterRef={filterRef}
        focusIdRef={focusIdRef}
        onReconnect={() => {
          reconnectRef.current()
        }}
        onClear={() => {
          void onClear()
        }}
      />
    </div>
  )

  if (narrow) {
    return (
      <div className="flex h-full">
        {state.selectedId === null ? (
          list('flex min-w-0 flex-1 flex-col')
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <DetailPane
              id={state.selectedId}
              autoFocusBack
              onBack={() => {
                focusIdRef.current = state.selectedId
                dispatch({ type: 'select', id: null })
              }}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {list('flex w-[45%] min-w-[360px] flex-col border-r border-border')}
      <div className="flex min-w-0 flex-1 flex-col">
        <DetailPane id={state.selectedId} />
      </div>
    </div>
  )
}
