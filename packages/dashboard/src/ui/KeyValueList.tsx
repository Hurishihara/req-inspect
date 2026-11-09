import type { ReactNode } from 'react'

export const KeyValueList = ({
  entries,
  empty = 'No headers',
}: {
  entries: [string, ReactNode][]
  empty?: string
}) => {
  if (entries.length === 0) return <p className="text-ink-muted">{empty}</p>
  return (
    <dl className="grid grid-cols-[minmax(96px,160px)_minmax(0,1fr)] gap-x-4 gap-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="break-words text-ink-muted">{k}</dt>
          <dd
            className={`m-0 break-all font-mono text-code ${v === '[redacted]' ? 'text-syntax-null italic' : ''}`}
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  )
}
