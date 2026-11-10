import type { RequestSummary } from '@req-inspect/core'

import { dbCaption } from '../db'
import { formatDuration } from '../format'
import { Icon } from '../ui/Icon'
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
    className={`grid min-h-row w-full grid-cols-[56px_minmax(0,1fr)_44px_56px_120px_72px] items-center gap-2 border-b border-border px-3 py-1 text-left hover:bg-hover ${
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
    <span className="flex min-w-0 items-center gap-1 text-caption tabular-nums">
      {item.dbFlag !== undefined && (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-status-4xx">
          <Icon name="warn" />
          {item.dbFlag === 'repeated' ? 'N+1' : 'slow'}
        </span>
      )}
      {item.dbCount !== undefined && (
        <span className="min-w-0 truncate text-ink-muted">{dbCaption(item.dbCount, item.dbMs ?? 0)}</span>
      )}
    </span>
    <span className="text-caption text-ink-muted tabular-nums">
      {new Date(item.startedAt).toLocaleTimeString()}
    </span>
  </button>
)
