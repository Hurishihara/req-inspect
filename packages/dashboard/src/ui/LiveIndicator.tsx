export const LiveIndicator = ({
  conn,
  paused,
  pending,
}: {
  conn: 'live' | 'reconnecting'
  paused: boolean
  pending: number
}) => {
  const dot = paused ? 'bg-ink-muted' : conn === 'live' ? 'bg-signal-live' : 'bg-signal-warn'
  const text = paused ? 'Paused' : conn === 'live' ? 'Live' : 'Reconnecting…'
  return (
    <span role="status" className="inline-flex items-center gap-2 text-caption text-ink-muted">
      <span className={`inline-block size-2 rounded-full ${dot}`} aria-hidden="true" />
      {text}
      {paused && <span aria-hidden="true">{` · ${String(pending)} waiting`}</span>}
    </span>
  )
}
