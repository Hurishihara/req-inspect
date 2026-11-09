import type { RequestSummary } from '@req-inspect/core'

import { formatDuration } from '../format'
import { StatusBadge } from '../ui/StatusBadge'
import { isSlow } from '../view'

export const RequestRow = ({
  item,
  selected,
  focusable,
  onSelect,
  rowRef,
}: {
  item: RequestSummary
  selected: boolean
  focusable: boolean
  onSelect: () => void
  rowRef?: (el: HTMLButtonElement | null) => void
}) => (
  <button
    ref={rowRef}
    type="button"
    role="option"
    aria-selected={selected}
    tabIndex={focusable ? 0 : -1}
    onClick={onSelect}
    className={`grid min-h-row w-full grid-cols-[56px_minmax(0,1fr)_44px_56px_72px] items-center gap-2 border-b border-border px-3 py-1 text-left hover:bg-hover ${
      selected ? 'bg-selected' : ''
    }`}
  >
    <span className="font-mono text-code font-semibold">{item.method}</span>
    <span className="min-w-0">
      <span className="block truncate font-mono text-code">{item.url}</span>
      {item.route && <span className="block truncate text-caption text-ink-muted">{item.route}</span>}
    </span>
    <StatusBadge status={item.status} aborted={item.aborted === true} />
    <span
      className={`text-right text-caption tabular-nums ${isSlow(item.durationMs) ? 'text-status-4xx' : 'text-ink-muted'}`}
    >
      {formatDuration(item.durationMs)}
    </span>
    <span className="text-caption text-ink-muted tabular-nums">
      {new Date(item.startedAt).toLocaleTimeString()}
    </span>
  </button>
)
