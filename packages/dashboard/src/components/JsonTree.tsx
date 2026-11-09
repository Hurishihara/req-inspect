import { useState } from 'react'

const REDACTED = '[redacted]'

const literalClass = (value: unknown): string => {
  if (value === REDACTED) return 'text-syntax-null italic'
  if (typeof value === 'string') return 'text-syntax-string'
  if (value === null) return 'text-syntax-null'
  return 'text-syntax-number'
}

const Node = ({ name, value, depth }: { name?: string; value: unknown; depth: number }) => {
  const [open, setOpen] = useState(depth < 2)
  const label = name !== undefined && <span className="text-syntax-key">{name}: </span>
  if (value === null || typeof value !== 'object') {
    return (
      <div className="font-mono text-code">
        {label}
        <span className={literalClass(value)}>{JSON.stringify(value)}</span>
      </div>
    )
  }
  const isArr = Array.isArray(value)
  const entries: [string, unknown][] = isArr ? value.map((v, i) => [String(i), v]) : Object.entries(value)
  const [lo, hi] = isArr ? ['[', ']'] : ['{', '}']
  if (entries.length === 0)
    return (
      <div className="font-mono text-code">
        {label}
        <span className="text-syntax-null">
          {lo}
          {hi}
        </span>
      </div>
    )
  return (
    <div>
      <div className="font-mono text-code">
        <button
          type="button"
          className="inline-block h-5 w-4 text-ink-muted"
          onClick={() => {
            setOpen(!open)
          }}
          aria-expanded={open}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? '▾' : '▸'}
        </button>
        {label}
        <span className="text-syntax-null">{lo}</span>
        {!open && (
          <>
            <span className="text-ink-muted italic">{` ${String(entries.length)} ${isArr ? 'items' : 'keys'} `}</span>
            <span className="text-syntax-null">{hi}</span>
          </>
        )}
      </div>
      {open && (
        <div className="pl-4">
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} />
          ))}
          <div className="font-mono text-code text-syntax-null">{hi}</div>
        </div>
      )}
    </div>
  )
}

export const JsonTree = ({ value }: { value: unknown }) => {
  return (
    <div className="overflow-auto">
      <Node value={value} depth={0} />
    </div>
  )
}
