import { useState } from 'react'

const REDACTED = '[redacted]'

function Node({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const label = name !== undefined && <span className="key">{name}: </span>
  if (value === null || typeof value !== 'object') {
    const cls = value === REDACTED ? 'redacted' : typeof value === 'string' ? 'str' : 'lit'
    return (
      <div className="jt-line">
        {label}
        <span className={cls}>{JSON.stringify(value)}</span>
      </div>
    )
  }
  const isArr = Array.isArray(value)
  const entries: [string, unknown][] = isArr ? value.map((v, i) => [String(i), v]) : Object.entries(value)
  const [lo, hi] = isArr ? ['[', ']'] : ['{', '}']
  if (entries.length === 0)
    return (
      <div className="jt-line">
        {label}
        {lo}
        {hi}
      </div>
    )
  return (
    <div>
      <div className="jt-line">
        <button
          className="toggle"
          onClick={() => {
            setOpen(!open)
          }}
          aria-label={open ? 'collapse' : 'expand'}
        >
          {open ? '▾' : '▸'}
        </button>
        {label}
        {lo}
        {!open && (
          <span className="muted">
            {' '}
            {entries.length} {isArr ? 'items' : 'keys'} {hi}
          </span>
        )}
      </div>
      {open && (
        <div className="jt-children">
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} />
          ))}
          <div className="jt-line">{hi}</div>
        </div>
      )}
    </div>
  )
}

export function JsonTree({ value }: { value: unknown }) {
  return (
    <div className="jsontree">
      <Node value={value} depth={0} />
    </div>
  )
}
