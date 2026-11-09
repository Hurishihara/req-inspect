import { type StatusClass, statusClass } from '../view'

const colors: Record<StatusClass, string> = {
  '2xx': 'bg-status-2xx-bg text-status-2xx',
  '3xx': 'bg-status-3xx-bg text-status-3xx',
  '4xx': 'bg-status-4xx-bg text-status-4xx',
  '5xx': 'bg-status-5xx-bg text-status-5xx',
  aborted: 'bg-status-5xx-bg text-status-5xx',
  none: 'bg-surface text-ink-muted',
}

export const StatusBadge = ({ status, aborted = false }: { status: number; aborted?: boolean }) => {
  const cls = statusClass(status, aborted)
  const label = cls === 'aborted' ? 'aborted' : cls === 'none' ? '—' : String(status)
  return (
    <span
      className={`inline-block min-w-9 rounded-sm px-1 text-center font-mono text-code font-semibold tabular-nums ${colors[cls]}`}
    >
      {label}
    </span>
  )
}
