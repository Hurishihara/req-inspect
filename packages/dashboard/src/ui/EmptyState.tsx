import type { ReactNode } from 'react'

import { Logo } from './Logo'

export const EmptyState = ({
  title,
  hint,
  action,
  mark,
}: {
  title: string
  hint?: ReactNode
  action?: ReactNode
  mark?: number
}) => (
  <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
    {mark !== undefined && <Logo size={mark} />}
    <p className="text-title font-semibold">{title}</p>
    {hint && <p className="max-w-80 text-ink-muted">{hint}</p>}
    {action}
  </div>
)
