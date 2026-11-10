import type { State } from '../reducer'
import { Button } from './Button'

const dotFor = (conn: State['conn']) => {
  if (conn === 'live') return 'bg-signal-live'
  if (conn === 'disconnected') return 'bg-status-5xx'
  return 'bg-signal-warn'
}

const textFor = (conn: State['conn']) => {
  if (conn === 'live') return 'Live'
  if (conn === 'reconnecting') return 'Reconnecting…'
  if (conn === 'unreachable') return "Can't reach your app · retrying"
  return 'Disconnected'
}

export const LiveIndicator = ({
  conn,
  paused,
  pending,
  onReconnect,
}: {
  conn: State['conn']
  paused: boolean
  pending: number
  onReconnect?: () => void
}) => {
  const dot = paused ? 'bg-ink-muted' : dotFor(conn)
  const text = paused ? 'Paused' : textFor(conn)
  return (
    <>
      <span role="status" className="inline-flex items-center gap-2 text-caption text-ink-muted">
        <span className={`inline-block size-2 rounded-full ${dot}`} aria-hidden="true" />
        {text}
        {paused && <span aria-hidden="true">{` · ${String(pending)} waiting`}</span>}
      </span>
      {!paused && conn === 'disconnected' && (
        <Button variant="ghost" onClick={onReconnect}>
          Reconnect
        </Button>
      )}
    </>
  )
}
