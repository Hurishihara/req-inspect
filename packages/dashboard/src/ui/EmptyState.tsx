import type { ReactNode } from 'react'

export const EmptyState = ({
  title,
  hint,
  action,
}: {
  title: string
  hint?: ReactNode
  action?: ReactNode
}) => (
  <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
    <p className="text-title font-semibold">{title}</p>
    {hint && <p className="max-w-80 text-ink-muted">{hint}</p>}
    {action}
  </div>
)
