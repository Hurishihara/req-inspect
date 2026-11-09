import { useEffect, useRef, useState } from 'react'

import { Button } from './Button'

export const CodeBlock = ({ meta, text }: { meta: string; text: string }) => {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          setCopied(false)
        }, 1500)
      },
      () => undefined,
    )
  }

  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1">
        <span className="text-caption text-ink-muted">{meta}</span>
        <Button variant="ghost" icon="copy" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="m-0 overflow-auto p-3 font-mono text-code break-words whitespace-pre-wrap">{text}</pre>
    </div>
  )
}
