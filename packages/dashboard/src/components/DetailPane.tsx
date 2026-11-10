import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { RequestRecord } from '@req-inspect/core'

import { fetchRecord } from '../api'
import { toCurl } from '../curl'
import { formatDuration } from '../format'
import { Banner } from '../ui/Banner'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { KeyValueList } from '../ui/KeyValueList'
import { SectionLabel } from '../ui/SectionLabel'
import { StatusBadge } from '../ui/StatusBadge'
import { Tabs } from '../ui/Tabs'
import { BodyView } from './BodyView'
import { JsonTree } from './JsonTree'
import { QueriesPanel } from './QueriesPanel'

type Tab = 'overview' | 'request' | 'queries' | 'response'
type Loaded = { id: string; record: RequestRecord | null } | 'error'

const TABS: { id: Tab; label: string; count?: number }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'request', label: 'Request' },
  { id: 'queries', label: 'Queries' },
  { id: 'response', label: 'Response' },
]

const SECTION = 'detail flex min-h-0 min-w-0 flex-1 flex-col'

const BackButton = ({ onBack, autoFocus }: { onBack: () => void; autoFocus: boolean }) => (
  <Button variant="ghost" icon="back" aria-label="Back to requests" onClick={onBack} autoFocus={autoFocus} />
)

const Shell = ({
  onBack,
  autoFocusBack,
  busy,
  children,
}: {
  onBack?: () => void
  autoFocusBack: boolean
  busy?: boolean
  children: ReactNode
}) => (
  <section className={SECTION} aria-busy={busy}>
    {onBack && (
      <div className="flex h-toolbar shrink-0 items-center border-b border-border bg-surface px-2">
        <BackButton onBack={onBack} autoFocus={autoFocusBack} />
      </div>
    )}
    {children}
  </section>
)

export const DetailPane = ({
  id,
  onBack,
  autoFocusBack = false,
}: {
  id: string | null
  onBack?: () => void
  autoFocusBack?: boolean
}) => {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [retry, setRetry] = useState(0)
  const [tab, setTab] = useState<Tab>('overview')

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
  }, [id, retry])

  const back = onBack ? { onBack, autoFocusBack } : { autoFocusBack }
  if (!id) {
    return (
      <Shell {...back}>
        <EmptyState title="Select a request" mark={32} hint="Use ↑↓ to move through the list." />
      </Shell>
    )
  }
  if (loaded === 'error') {
    return (
      <Shell {...back}>
        <div className="p-4">
          <Banner
            variant="error"
            title="Couldn't load this request."
            action={
              <Button
                onClick={() => {
                  setLoaded(null)
                  setRetry((n) => n + 1)
                }}
              >
                Retry
              </Button>
            }
          />
        </div>
      </Shell>
    )
  }
  if (loaded?.id !== id) {
    return (
      <Shell {...back} busy>
        <p className="p-4 text-caption text-ink-muted">Loading…</p>
      </Shell>
    )
  }
  const r = loaded.record
  if (!r) {
    return (
      <Shell {...back}>
        <EmptyState
          title="This request is no longer in memory"
          hint="Older requests are dropped once the list reaches maxRequests."
        />
      </Shell>
    )
  }

  return (
    <DetailView record={r} tab={tab} onTabChange={setTab} {...(onBack ? { onBack, autoFocusBack } : {})} />
  )
}

export const DetailView = ({
  record: r,
  tab,
  onTabChange,
  onBack,
  autoFocusBack = false,
}: {
  record: RequestRecord
  tab: Tab
  onTabChange: (tab: Tab) => void
  onBack?: () => void
  autoFocusBack?: boolean
}) => {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toCurl(r, location.origin))
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        setCopied(false)
      }, 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  const query = r.request.query
  const hasQuery = query != null && Object.keys(query).length > 0
  const hasParams = Object.keys(r.request.params).length > 0
  const headers = (h: Record<string, string>) => <KeyValueList entries={Object.entries(h)} />

  return (
    <section className={SECTION}>
      <Tabs
        tabs={TABS.map((t) =>
          t.id === 'queries' && r.db ? { ...t, count: r.db.events.length + r.db.dropped } : t,
        )}
        value={tab}
        onChange={(t) => {
          onTabChange(t as Tab)
        }}
        idPrefix="detail"
        leading={onBack && <BackButton onBack={onBack} autoFocus={autoFocusBack} />}
      />
      <div
        role="tabpanel"
        id={`detail-panel-${tab}`}
        aria-labelledby={`detail-tab-${tab}`}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto p-4"
      >
        {tab === 'overview' && (
          <KeyValueList
            entries={[
              ['Method', r.method],
              ['URL', r.url],
              ['Route', r.route ?? '—'],
              ['Status', <StatusBadge key="status" status={r.status} aborted={r.aborted === true} />],
              ['Duration', formatDuration(r.durationMs)],
              [
                'Time',
                <time
                  key="time"
                  dateTime={new Date(r.startedAt).toISOString()}
                  title={new Date(r.startedAt).toISOString()}
                >
                  {new Date(r.startedAt).toLocaleString()}
                </time>,
              ],
              ['Aborted', r.aborted ? 'yes' : 'no'],
            ]}
          />
        )}
        {tab === 'request' && (
          <>
            <Button
              variant="primary"
              icon="copy"
              onClick={() => {
                void copy()
              }}
            >
              {copied ? 'Copied' : 'Copy as cURL'}
            </Button>
            <div className="mt-4">
              <SectionLabel>Headers</SectionLabel>
              {headers(r.request.headers)}
              <SectionLabel>Query</SectionLabel>
              {hasQuery ? <JsonTree value={query} /> : <p className="text-ink-muted">None</p>}
              <SectionLabel>Params</SectionLabel>
              {hasParams ? <JsonTree value={r.request.params} /> : <p className="text-ink-muted">None</p>}
              <SectionLabel>Body</SectionLabel>
              <BodyView body={r.request.body} />
            </div>
          </>
        )}
        {tab === 'queries' && <QueriesPanel record={r} />}
        {tab === 'response' && (
          <>
            <SectionLabel>Headers</SectionLabel>
            {headers(r.response.headers)}
            <SectionLabel>Body</SectionLabel>
            <BodyView body={r.response.body} />
          </>
        )}
      </div>
    </section>
  )
}
