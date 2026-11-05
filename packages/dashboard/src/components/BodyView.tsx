import type { CapturedBody } from '@req-inspect/core'

import { formatSize } from '../format'
import { JsonTree } from './JsonTree'

export function BodyView({ body }: { body: CapturedBody }) {
  if (body.kind === 'none') return <p className="muted">No body</p>
  if (body.kind === 'binary') {
    const enc = body.encoding ? ` · ${body.encoding}` : ''
    return <p className="muted">{`Binary · ${body.contentType} · ${formatSize(body.size)}${enc}`}</p>
  }
  return (
    <div>
      {body.truncated && (
        <div className="banner">{`Truncated: showing first 64 KB of ${formatSize(body.size)}`}</div>
      )}
      {body.kind === 'json' ? <JsonTree value={body.value} /> : <pre>{String(body.value)}</pre>}
    </div>
  )
}
