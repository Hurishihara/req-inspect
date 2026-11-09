import { useState } from 'react'

import { applyTheme, nextTheme, readTheme, type Theme } from '../theme'
import { Button } from './Button'
import type { IconName } from './Icon'

const ICONS: Record<Theme, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' }
const LABELS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' }

const safeStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>(() => readTheme(safeStorage()))
  const label = `Theme: ${LABELS[theme]}`
  return (
    <Button
      variant="ghost"
      icon={ICONS[theme]}
      aria-label={label}
      title={label}
      onClick={() => {
        const next = nextTheme(theme)
        applyTheme(next, document.documentElement, safeStorage())
        setTheme(next)
      }}
    />
  )
}
