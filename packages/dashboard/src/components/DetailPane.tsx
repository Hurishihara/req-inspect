import { useEffect, useState } from 'react'
import type { RequestRecord } from '@req-inspect/core'

import { fetchRecord } from '../api'
import { toCurl } from '../curl'
import { BodyView } from './BodyView'
import { JsonTree } from './JsonTree'

type Tab = 'overview' | 'request' | 'response'
type Loaded = { id: string; record: RequestRecord | null } | 'error'

const Headers = ({ headers }: { headers: Record<string, string> }) => {
  const entries = Object.entries(headers)
  if (!entries.length) return <p className="muted">No headers</p>
  return (
    <dl className="kv">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd className={v === '[redacted]' ? 'redacted' : undefined}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

const Message = ({ text }: { text: string }) => (
  <section className="detail">
    <div className="empty">{text}</div>
  </section>
)

export const DetailPane = ({ id }: { id: string | null }) => {
  const [tab, setTab] = useState<Tab>('overview')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drop the previous record immediately when the selection changes so stale data is never shown
    setLoaded(null)
    if (!id) return
    let alive = true
    fetchRecord(id)
      .then((record) => {
        if (alive) setLoaded({ id, record })
      })
      .catch(() => {
        if (alive) setLoaded('error')
      })
    return () => {
      alive = false
    }
  }, [id])

  if (!id) return <Message text="Select a request" />
  if (loaded === 'error') return <Message text="Failed to load request." />
  if (loaded?.id !== id) return <Message text="Loading…" />
  const r = loaded.record
  if (!r) return <Message text="This request is no longer in memory." />

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toCurl(r, location.origin))
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
      }, 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  const hasQuery = r.request.query != null && Object.keys(r.request.query).length > 0
  const hasParams = Object.keys(r.request.params).length > 0

  return (
    <section className="detail">
      <div className="tabs" role="tablist">
        {(['overview', 'request', 'response'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'active' : ''}
            onClick={() => {
              setTab(t)
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="tabbody">
        {tab === 'overview' && (
          <dl className="kv">
            <div>
              <dt>Method</dt>
              <dd>{r.method}</dd>
            </div>
            <div>
              <dt>URL</dt>
              <dd>{r.url}</dd>
            </div>
            <div>
              <dt>Route</dt>
              <dd>{r.route ?? '—'}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{r.status}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{Math.round(r.durationMs)} ms</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{new Date(r.startedAt).toISOString()}</dd>
            </div>
            <div>
              <dt>Aborted</dt>
              <dd>{r.aborted ? 'yes' : 'no'}</dd>
            </div>
          </dl>
        )}
        {tab === 'request' && (
          <>
            <button
              className="copy"
              onClick={() => {
                void copy()
              }}
            >
              {copied ? 'Copied' : 'Copy as cURL'}
            </button>
            <h3>Headers</h3>
            <Headers headers={r.request.headers} />
            <h3>Query</h3>
            {hasQuery ? <JsonTree value={r.request.query} /> : <p className="muted">None</p>}
            <h3>Params</h3>
            {hasParams ? <JsonTree value={r.request.params} /> : <p className="muted">None</p>}
            <h3>Body</h3>
            <BodyView body={r.request.body} />
          </>
        )}
        {tab === 'response' && (
          <>
            <h3>Headers</h3>
            <Headers headers={r.response.headers} />
            <h3>Body</h3>
            <BodyView body={r.response.body} />
          </>
        )}
      </div>
    </section>
  )
}
