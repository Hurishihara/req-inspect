import { useState } from 'react'
import type { DbEvent, RequestRecord } from '@req-inspect/core'

import { dbShare, repeatAdvice } from '../db'
import { formatDuration } from '../format'
import { Banner } from '../ui/Banner'
import { CodeBlock } from '../ui/CodeBlock'
import { EmptyState } from '../ui/EmptyState'

const COLUMNS = ['#', 'Offset', 'Operation', 'Statement', 'Duration', 'Rows']

const EventRows = ({ index, event: e, slow }: { index: number; event: DbEvent; slow: boolean }) => {
  const [open, setOpen] = useState(false)
  const params =
    e.params !== undefined
      ? JSON.stringify(e.params)
      : e.paramCount !== undefined
        ? `${String(e.paramCount)} params`
        : null
  return (
    <>
      <tr className={`align-top ${e.error === undefined ? 'border-b border-border' : ''}`}>
        <td className="py-1 pr-2 text-ink-muted tabular-nums">{index + 1}</td>
        <td className="py-1 pr-2 whitespace-nowrap text-ink-muted tabular-nums">
          {formatDuration(e.offsetMs)}
        </td>
        <td className="py-1 pr-2 font-mono text-code whitespace-nowrap">
          {e.operation}
          {e.target !== null && <span className="text-ink-muted">{` ${e.target}`}</span>}
        </td>
        <td className="w-full max-w-0 py-1 pr-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              setOpen(!open)
            }}
            className="block w-full truncate text-left font-mono text-code"
          >
            {e.statement}
          </button>
          {params !== null && (
            <span
              className={`block truncate text-caption text-ink-muted ${e.params !== undefined ? 'font-mono' : ''}`}
            >
              {params}
            </span>
          )}
        </td>
        <td
          className={`py-1 pr-2 text-right whitespace-nowrap tabular-nums ${slow ? 'text-status-4xx' : 'text-ink-muted'}`}
        >
          {formatDuration(e.durationMs)}
        </td>
        <td className="py-1 text-right text-ink-muted tabular-nums">{e.rows ?? '—'}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={COLUMNS.length} className="pb-2">
            <CodeBlock meta={`${e.system} · ${e.operation}`} text={e.statement} />
          </td>
        </tr>
      )}
      {e.error !== undefined && (
        <tr className="border-b border-border">
          <td />
          <td colSpan={COLUMNS.length - 1} className="pb-1 text-caption text-status-5xx">
            {e.error}
          </td>
        </tr>
      )}
    </>
  )
}

export const QueriesPanel = ({ record: r }: { record: RequestRecord }) => {
  const db = r.db
  if (!db) {
    return (
      <EmptyState
        title="No database calls"
        hint="Instrument your driver with `@req-inspect/pg` or `@req-inspect/mongodb` to see queries here."
      />
    )
  }
  const total = db.events.length + db.dropped
  const slow = new Set(db.flags.slow)
  const slowEvents = db.flags.slow.flatMap((i) => (i < db.events.length ? [db.events[i]] : []))
  const slowFloor =
    slowEvents.length > 0 ? Math.floor(Math.min(...slowEvents.map((e) => e.durationMs))) : null
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-muted">
        {`${String(total)} ${total === 1 ? 'query' : 'queries'} · ${formatDuration(db.totalMs)} · ${String(dbShare(db.totalMs, r.durationMs))}% of request time`}
      </p>
      {db.flags.repeated.map((f) => {
        const hit = f.first < db.events.length ? db.events[f.first] : undefined
        const system = (hit ?? db.events.find((e) => e.fingerprint === f.fingerprint))?.system ?? 'postgresql'
        return (
          <Banner key={f.fingerprint} variant="warn" title="Repeated query.">
            <code className="font-mono text-code">{f.fingerprint.slice(0, 120)}</code>
            {` ran ${String(f.count)} times. ${repeatAdvice(system)}`}
          </Banner>
        )
      })}
      {db.flags.slow.length > 0 && (
        <Banner variant="warn" title="Slow queries.">
          {`${String(db.flags.slow.length)} took ${slowFloor === null ? 'a long time' : `${String(slowFloor)} ms or more`}.`}
        </Banner>
      )}
      {db.dropped > 0 && (
        <Banner variant="neutral" title="Not all queries recorded.">
          {`${String(db.dropped)} more were made after the first ${String(db.events.length)}.`}
        </Banner>
      )}
      {db.events.length > 0 && (
        <table className="w-full table-auto border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-caption text-ink-muted">
              {COLUMNS.map((c) => (
                <th key={c} scope="col" className="py-1 pr-2 font-normal">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {db.events.map((e, i) => (
              <EventRows key={i} index={i} event={e} slow={slow.has(i)} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
