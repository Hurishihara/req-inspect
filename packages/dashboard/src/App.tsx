import { useEffect, useReducer, useRef } from 'react'

import { clearAll, fetchList, subscribe } from './api'
import { idFromHash } from './hash'
import { initialState, reducer } from './reducer'
import { RequestList } from './components/RequestList'
import { DetailPane } from './components/DetailPane'

export const App = () => {
  const [state, dispatch] = useReducer(reducer, { ...initialState, selectedId: idFromHash(location.hash) })
  const prevConn = useRef(state.conn)

  useEffect(() => {
    let alive = true
    fetchList()
      .then((items) => {
        if (alive) dispatch({ type: 'loaded', items })
      })
      .catch(() => {
        /* list unavailable: the stream keeps the view live */
      })
    const unsub = subscribe(
      (item) => {
        dispatch({ type: 'received', item })
      },
      (conn) => {
        dispatch({ type: 'conn', state: conn })
      },
    )
    return () => {
      alive = false
      unsub()
    }
  }, [])

  useEffect(() => {
    if (prevConn.current === 'reconnecting' && state.conn === 'live') {
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

  return (
    <div className="app">
      <RequestList
        state={state}
        dispatch={dispatch}
        onClear={() => {
          void onClear()
        }}
      />
      <DetailPane id={state.selectedId} />
    </div>
  )
}
