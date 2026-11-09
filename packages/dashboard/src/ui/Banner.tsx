import type { ReactNode } from 'react'

import { Icon, type IconName } from './Icon'

type Variant = 'info' | 'neutral' | 'warn' | 'error'

const styles: Record<Variant, { box: string; icon: string; name: IconName }> = {
  info: { box: 'bg-info-bg border-info', icon: 'text-info', name: 'info' },
  neutral: { box: 'bg-surface border-border', icon: 'text-ink-muted', name: 'info' },
  warn: { box: 'bg-status-4xx-bg border-status-4xx', icon: 'text-status-4xx', name: 'warn' },
  error: { box: 'bg-status-5xx-bg border-status-5xx', icon: 'text-status-5xx', name: 'error' },
}

export const Banner = ({
  variant,
  title,
  children,
  action,
}: {
  variant: Variant
  title: string
  children?: ReactNode
  action?: ReactNode
}) => {
  const s = styles[variant]
  return (
    <div
      className={`flex gap-2 rounded-md border px-3 py-2 text-ink ${s.box}`}
      role={variant === 'error' ? 'alert' : undefined}
    >
      <Icon name={s.name} className={`mt-0.5 ${s.icon}`} />
      <div className="min-w-0 flex-1">
        <strong className="font-semibold">{title}</strong>
        {children && (
          <>
            {' '}
            <span>{children}</span>
          </>
        )}
      </div>
      {action}
    </div>
  )
}
