import type { CapturedBody } from '@req-inspect/core'

import { formatSize } from '../format'
import { Banner } from '../ui/Banner'
import { CodeBlock } from '../ui/CodeBlock'
import { JsonTree } from './JsonTree'

export const BodyView = ({ body }: { body: CapturedBody }) => {
  if (body.kind === 'none') return <p className="text-ink-muted">No body</p>
  if (body.kind === 'binary') {
    const enc = body.encoding ? ` · ${body.encoding}` : ''
    return (
      <Banner variant="neutral" title="Binary body.">
        {`${body.contentType} · ${formatSize(body.size)}${enc}`}
      </Banner>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {body.truncated && (
        <Banner variant="info" title="Truncated.">
          {`Showing the first 64 KB of ${formatSize(body.size)}.`}
        </Banner>
      )}
      {body.kind === 'json' ? (
        <JsonTree value={body.value} />
      ) : (
        <CodeBlock meta={`text · ${formatSize(body.size)}`} text={String(body.value)} />
      )}
    </div>
  )
}
