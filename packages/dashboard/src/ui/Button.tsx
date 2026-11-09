import type { ButtonHTMLAttributes } from 'react'

import { Icon, type IconName } from './Icon'

type Variant = 'default' | 'primary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  default: 'border-border-strong bg-surface-raised text-ink hover:bg-hover',
  primary: 'border-accent bg-accent text-accent-ink hover:brightness-110',
  ghost: 'border-transparent bg-transparent text-ink hover:bg-hover',
  danger: 'border-transparent bg-transparent text-status-5xx hover:bg-hover',
}

export const Button = ({
  variant = 'default',
  icon,
  count,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName; count?: number }) => (
  <button
    type={type}
    className={`inline-flex h-control items-center gap-2 rounded-md border px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className ?? ''}`.trim()}
    {...rest}
  >
    {icon && <Icon name={icon} />}
    {children}
    {count !== undefined && (
      <span className="inline-block min-w-[18px] rounded-full bg-accent px-1 text-center font-mono text-[11px] leading-[18px] text-accent-ink">
        {count}
      </span>
    )}
  </button>
)
